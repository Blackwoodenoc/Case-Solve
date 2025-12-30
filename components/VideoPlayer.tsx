
import React, { useRef, useState, useCallback } from 'react';
import { VideoFile } from '../types';
import { Upload, X, Loader2, AlertCircle, Globe, Youtube, Instagram, Music2, Eye, MessageCircle, FileText, Download } from 'lucide-react';

interface VideoPlayerProps {
  video: VideoFile | null;
  onVideoSelect: (file: File) => void;
  onRemoteUrlSelect: (url: string) => void;
  onClear: () => void;
}

const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&v=${Date.now()}`,
];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onVideoSelect, onRemoteUrlSelect, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestions, setErrorSuggestions] = useState<string[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [isCreatingPassport, setIsCreatingPassport] = useState(false);
  const [stylePassport, setStylePassport] = useState<any>(null);
  const [showPassport, setShowPassport] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]?.type.startsWith('video/')) {
      onVideoSelect(e.dataTransfer.files[0]);
    }
  }, [onVideoSelect]);

  const fetchFromUrl = async () => {
    if (!url) return;
    
    // Автоматически добавляем https:// если протокол отсутствует
    let fullUrl = url.trim();
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }
    
    try { new URL(fullUrl); } catch (e) {
      setError('Неверный формат URL.');
      return;
    }

    const isYouTube = fullUrl.includes('youtube.com') || fullUrl.includes('youtu.be');
    const isInstagram = fullUrl.includes('instagram.com');
    const isTikTok = fullUrl.includes('tiktok.com');
    const isSocial = isYouTube || isInstagram || isTikTok || fullUrl.includes('vimeo.com');

    // Для YouTube, Instagram, TikTok - скачиваем автоматически
    if (isYouTube || isInstagram || isTikTok) {
      setIsFetching(true);
      setError(null);
      setErrorSuggestions([]);
      
      const platformName = isYouTube ? 'YouTube' : isInstagram ? 'Instagram' : 'TikTok';
      
      console.log(`🔄 Отправка запроса на скачивание ${platformName}:`, fullUrl);
      
      try {
        const response = await fetch('http://localhost:3003/api/download-youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: fullUrl })
        });

        console.log(`📥 Ответ от сервера (${platformName}):`, response.status, response.statusText);

        if (!response.ok) {
          let errorMessage = 'Ошибка скачивания';
          let errorData: any = {};
          try {
            errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (jsonErr) {
            // Если не удалось распарсить JSON, используем статус
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          const error = new Error(errorMessage) as any;
          error.suggestions = errorData.suggestions;
          error.errorCode = errorData.errorCode;
          throw error;
        }

        let data;
        try {
          data = await response.json();
        } catch (jsonErr) {
          throw new Error('Сервер вернул некорректный ответ');
        }
        
        // Конвертируем base64 в File
        const byteCharacters = atob(data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType });
        const file = new File([blob], data.filename, { type: data.mimeType });

        onVideoSelect(file);
        setUrl('');
        setError(null);
        setErrorSuggestions([]);
        setIsFetching(false);
        return;
      } catch (err: any) {
        console.error('Ошибка автоскачивания:', err);
        let errorMessage = `${platformName}: ${err.message}`;
        
        // Специальная обработка ошибки подключения
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch')) {
          errorMessage = `Не удалось подключиться к серверу. Убедитесь, что сервер запущен на порту 3003.`;
          setErrorSuggestions([
            'Запустите сервер: npm run dev:server',
            'Или запустите всё сразу: npm run dev:all',
            'Проверьте, что сервер работает на http://localhost:3003'
          ]);
        } else if (err.suggestions && Array.isArray(err.suggestions) && err.suggestions.length > 0) {
          setErrorSuggestions(err.suggestions);
        } else {
          setErrorSuggestions([]);
        }
        
        setError(errorMessage);
        setIsFetching(false);
        return;
      }
    }

    // Для других соцсетей - используем метаданные
    if (isSocial) {
      setIsFetching(true);
      await onRemoteUrlSelect(fullUrl);
      setUrl('');
      setError(null);
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setError(null);
    setErrorSuggestions([]);

    for (let i = 0; i < PROXIES.length; i++) {
      try {
        const proxyUrl = PROXIES[i](fullUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (blob.type.includes('text/html')) throw new Error('Not video');

        const fileName = fullUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
        onVideoSelect(new File([blob], fileName, { type: blob.type || 'video/mp4' }));
        setUrl('');
        setIsFetching(false);
        return;
      } catch (err) {}
    }

    await onRemoteUrlSelect(fullUrl);
    setUrl('');
    setIsFetching(false);
    setErrorSuggestions([]);
    setError('Прямая загрузка не удалась. Ссылка добавлена для глубокого AI анализа.');
  };

  const fetchComments = async () => {
    if (!video?.remoteUrl) return;
    
    const videoUrl = video.remoteUrl;
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    
    if (!isYouTube) {
      setError('Извлечение комментариев доступно только для YouTube видео');
      return;
    }

    setIsLoadingComments(true);
    setError(null);

    try {
      console.log('💬 Запрос комментариев для:', videoUrl);
      
      const response = await fetch('http://localhost:3003/api/youtube-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
        signal: AbortSignal.timeout(60000) // 60 секунд таймаут
      });

      // Проверяем Content-Type перед парсингом
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Сервер вернул не JSON:', text.substring(0, 200));
        throw new Error('Сервер вернул неверный формат. Проверьте, что сервер запущен на порту 3003.');
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        throw new Error(errorData.error || 'Ошибка загрузки комментариев');
      }

      const data = await response.json();
      console.log('✅ Получено комментариев:', data.count);
      
      setComments(data.comments || []);
      setShowComments(true);
      setIsLoadingComments(false);
    } catch (err: any) {
      console.error('❌ Ошибка загрузки комментариев:', err);
      
      let errorMessage = err.message || 'Неизвестная ошибка';
      
      // Более понятные сообщения об ошибках
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        errorMessage = 'Превышено время ожидания. Попробуйте еще раз.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMessage = 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен на порту 3003.';
      } else if (err.message.includes('CORS')) {
        errorMessage = 'Ошибка CORS. Проверьте настройки сервера.';
      }
      
      setError(`Комментарии: ${errorMessage}`);
      setIsLoadingComments(false);
    }
  };

  const createStylePassport = async () => {
    if (!video?.remoteUrl) return;
    
    const videoUrl = video.remoteUrl;
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    
    if (!isYouTube) {
      setError('Паспорт стиля доступен только для YouTube видео');
      return;
    }

    setIsCreatingPassport(true);
    setError(null);

    try {
      console.log('📋 Создание паспорта стиля для:', videoUrl);
      
      const response = await fetch('http://localhost:3003/api/style-passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания паспорта');
      }

      const data = await response.json();
      console.log('✅ Паспорт стиля создан:', data.passport);
      
      setStylePassport(data.passport);
      setShowPassport(true);
      setIsCreatingPassport(false);
    } catch (err: any) {
      console.error('❌ Ошибка создания паспорта:', err);
      let errorMessage = `Паспорт стиля: ${err.message}`;
      
      // Специальная обработка ошибки подключения
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch')) {
        errorMessage = 'Паспорт стиля: Не удалось подключиться к серверу. Убедитесь, что сервер запущен на порту 3003. Запустите: npm run dev:server';
      }
      
      setError(errorMessage);
      setIsCreatingPassport(false);
    }
  };

  // Функция для извлечения YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    try {
      const urlObj = new URL(url.includes('://') ? url : 'https://' + url);
      
      // YouTube Shorts
      if (urlObj.pathname.includes('/shorts/')) {
        return urlObj.pathname.split('/shorts/')[1].split(/[?&#]/)[0];
      }
      
      // YouTube youtu.be
      if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.slice(1).split(/[?&#]/)[0];
      }
      
      // YouTube youtube.com/watch
      if (urlObj.searchParams.has('v')) {
        return urlObj.searchParams.get('v');
      }
      
      return null;
    } catch {
      return null;
    }
  };

  // Функция для скачивания YouTube видео
  const downloadYouTubeVideo = async () => {
    if (!video?.remoteUrl) return;
    
    setIsDownloading(true);
    setError(null);
    setErrorSuggestions([]);
    
    try {
      console.log(`🔄 Запуск скачивания YouTube:`, video.remoteUrl);
      
      const response = await fetch('http://localhost:3003/api/youtube-full-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: video.remoteUrl })
      });

      if (!response.ok) {
        let errorMessage = 'Ошибка скачивания YouTube';
        let errorData: any = {};
        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonErr) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        const error = new Error(errorMessage) as any;
        error.suggestions = errorData.suggestions || [];
        throw error;
      }

      const data = await response.json();
      console.log(`✅ Видео скачано:`, data);
      
      setError(null);
      setErrorSuggestions([]);
      alert(`✅ Видео успешно скачано!\n\n📊 Метаданные:\n- Комментариев: ${data.metadata?.total_comments || 0}\n- Просмотров: ${data.video_info?.view_count?.toLocaleString() || 0}\n- Лайков: ${data.video_info?.like_count?.toLocaleString() || 0}\n\n📁 Видео сохранено в: ${data.video_file?.folder}\n\n📝 Анализ последних 10 комментариев выполнен.`);
      
      } catch (err: any) {
        console.error('Ошибка скачивания:', err);
        let errorMessage = `Ошибка скачивания: ${err.message}`;
        
        // Специальная обработка ошибки подключения
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch')) {
          errorMessage = 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен на порту 3003.';
          setErrorSuggestions([
            'Запустите сервер: npm run dev:server',
            'Или запустите всё сразу: npm run dev:all',
            'Проверьте, что сервер работает на http://localhost:3003'
          ]);
        } else if (err.suggestions && Array.isArray(err.suggestions) && err.suggestions.length > 0) {
          setErrorSuggestions(err.suggestions);
        } else {
          setErrorSuggestions([]);
        }
        
        setError(errorMessage);
      } finally {
        setIsDownloading(false);
      }
  };

  const getPlatformIcon = (remoteUrl?: string) => {
    if (!remoteUrl) return <Globe size={48} className="text-blue-500 mb-4 drop-shadow-lg" />;
    if (remoteUrl.includes('youtube.com') || remoteUrl.includes('youtu.be')) 
      return <Youtube size={48} className="text-red-500 mb-4 drop-shadow-lg" />;
    if (remoteUrl.includes('instagram.com')) 
      return <Instagram size={48} className="text-pink-500 mb-4 drop-shadow-lg" />;
    if (remoteUrl.includes('tiktok.com')) 
      return <Music2 size={48} className="text-cyan-400 mb-4 drop-shadow-lg" />;
    return <Globe size={48} className="text-blue-500 mb-4 drop-shadow-lg" />;
  };

  if (video) {
    const isYouTube = video.remoteUrl?.includes('youtube.com') || video.remoteUrl?.includes('youtu.be');
    const youtubeVideoId = isYouTube && video.remoteUrl ? getYouTubeVideoId(video.remoteUrl) : null;
    
    return (
      <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800 group flex items-center justify-center">
        {video.url ? (
          <video src={video.url} controls className="w-full h-full object-contain" />
        ) : isYouTube && youtubeVideoId ? (
          // Встроенный YouTube iframe плеер
          <iframe
            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video player"
          />
        ) : (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {video.metadata?.thumbnail && (
               <img src={video.metadata.thumbnail} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-40 scale-105" alt="" />
            )}
            <div className="relative z-10 text-center p-8 flex flex-col items-center max-w-lg">
              {getPlatformIcon(video.remoteUrl)}
              <h4 className="text-slate-100 font-bold text-lg px-4 line-clamp-2 leading-snug drop-shadow-md">
                {video.metadata?.title || 'Ссылка на соцсеть'}
              </h4>
              
              <div className="flex gap-2 mt-2">
                {video.metadata?.author && (
                  <p className="text-blue-400 text-sm font-semibold tracking-wide uppercase text-[10px] bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">{video.metadata.author}</p>
                )}
                {video.metadata?.thumbnail && (
                  <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    <Eye size={10} /> Visual Ready
                  </div>
                )}
              </div>

              <div className="mt-6 px-4 py-1.5 bg-slate-950/50 rounded-full border border-white/5 backdrop-blur-sm">
                <p className="text-slate-500 text-[10px] font-mono truncate max-w-[200px]">{video.remoteUrl}</p>
              </div>
            </div>
          </div>
        )}
        
        <button onClick={onClear} className="absolute top-4 right-4 p-2.5 bg-slate-950/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all border border-white/10 shadow-xl z-20">
          <X size={16} />
        </button>

        {isYouTube && (
          <>
            <button 
              onClick={downloadYouTubeVideo}
              disabled={isDownloading}
              className="absolute top-4 right-16 p-2.5 bg-slate-950/80 hover:bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all border border-white/10 shadow-xl z-20 disabled:opacity-50"
              title="Скачать видео и метаданные"
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
            </button>
            
            <button 
              onClick={fetchComments}
              disabled={isLoadingComments}
              className="absolute top-4 left-4 p-2.5 bg-slate-950/80 hover:bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all border border-white/10 shadow-xl z-20 disabled:opacity-50"
              title="Показать комментарии"
            >
              {isLoadingComments ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <MessageCircle size={16} />
              )}
            </button>
            
            <button 
              onClick={createStylePassport}
              disabled={isCreatingPassport}
              className="absolute top-16 left-4 p-2.5 bg-slate-950/80 hover:bg-green-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all border border-white/10 shadow-xl z-20 disabled:opacity-50"
              title="Создать паспорт стиля"
            >
              {isCreatingPassport ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileText size={16} />
              )}
            </button>
          </>
        )}

        {showComments && comments.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 max-h-[200px] overflow-y-auto bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-4 z-10">
            <div className="flex justify-between items-center mb-3">
              <h5 className="text-slate-200 font-bold text-sm flex items-center gap-2">
                <MessageCircle size={14} className="text-blue-400" />
                Комментарии ({comments.length})
              </h5>
              <button 
                onClick={() => setShowComments(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {comments.slice(0, 10).map((comment, idx) => (
                <div key={idx} className="bg-slate-900/50 rounded-lg p-2 border border-slate-800">
                  <p className="text-blue-400 text-[10px] font-bold mb-1">{comment.author || 'Аноним'}</p>
                  <p className="text-slate-300 text-xs leading-relaxed">{comment.text || comment.content}</p>
                  {comment.like_count > 0 && (
                    <p className="text-slate-500 text-[9px] mt-1">👍 {comment.like_count}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showPassport && stylePassport && (
          <div className="absolute bottom-0 left-0 right-0 max-h-[350px] overflow-y-auto bg-gradient-to-t from-slate-950 via-slate-950/98 to-slate-950/95 backdrop-blur-md border-t border-green-500/30 p-4 z-10">
            <div className="flex justify-between items-center mb-3">
              <h5 className="text-green-400 font-bold text-sm flex items-center gap-2">
                <FileText size={14} className="text-green-400" />
                📋 Паспорт стиля — {stylePassport.video_info?.title}
              </h5>
              <button 
                onClick={() => setShowPassport(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="space-y-2">
              {/* Статистика */}
              <div className="bg-slate-900/50 rounded-lg p-2 border border-green-500/20">
                <p className="text-green-300 text-[10px] font-bold mb-1">📊 Статистика</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-slate-400">Комментариев:</span> <span className="text-slate-200">{stylePassport.statistics?.total_comments}</span></div>
                  <div><span className="text-slate-400">Просмотров:</span> <span className="text-slate-200">{stylePassport.video_info?.view_count?.toLocaleString()}</span></div>
                  <div><span className="text-slate-400">Язык аудитории:</span> <span className="text-slate-200">{stylePassport.insights?.audience_language}</span></div>
                  <div><span className="text-slate-400">Вовлеченность:</span> <span className="text-slate-200">{stylePassport.insights?.engagement_level}</span></div>
                </div>
              </div>
              
              {/* Эмоциональный тон */}
              {stylePassport.style_analysis?.emotional_tone && (
                <div className="bg-slate-900/50 rounded-lg p-2 border border-green-500/20">
                  <p className="text-green-300 text-[10px] font-bold mb-1">💭 Эмоциональная окраска</p>
                  <div className="space-y-1">
                    {Object.entries(stylePassport.style_analysis.emotional_tone).map(([emotion, count]: [string, any]) => (
                      <div key={emotion} className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${
                              emotion === 'positive' ? 'bg-green-500' :
                              emotion === 'negative' ? 'bg-red-500' :
                              emotion === 'funny' ? 'bg-yellow-500' :
                              emotion === 'aggressive' ? 'bg-orange-500' :
                              'bg-slate-500'
                            }`}
                            style={{ width: `${Math.min((count / stylePassport.statistics.total_comments) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 w-16">{emotion}: {count}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-green-400 mt-1">Доминирует: {stylePassport.style_analysis.dominant_emotion}</p>
                </div>
              )}
              
              {/* Частые слова */}
              {stylePassport.style_analysis?.frequent_words && Object.keys(stylePassport.style_analysis.frequent_words).length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-2 border border-green-500/20">
                  <p className="text-green-300 text-[10px] font-bold mb-1">🔥 Ключевые слова и фразы</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(stylePassport.style_analysis.frequent_words).slice(0, 15).map(([word, count]: [string, any]) => (
                      <span key={word} className="bg-green-500/10 text-green-300 px-2 py-0.5 rounded text-[9px] border border-green-500/30">
                        {word} <span className="text-green-500">×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Топ комментарии */}
              {stylePassport.top_comments && stylePassport.top_comments.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-2 border border-green-500/20">
                  <p className="text-green-300 text-[10px] font-bold mb-1">⭐ Топ комментарии (по лайкам)</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {stylePassport.top_comments.slice(0, 5).map((comment: any, idx: number) => (
                      <div key={idx} className="text-[9px] leading-relaxed">
                        <span className="text-blue-400 font-bold">{comment.author}</span>
                        <span className="text-slate-400"> ({comment.likes} 👍): </span>
                        <span className="text-slate-300">{comment.text.substring(0, 80)}{comment.text.length > 80 ? '...' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-5 backdrop-blur-sm ${
          isDragging 
            ? 'border-blue-400 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 shadow-2xl shadow-blue-500/20 scale-[1.02]' 
            : 'border-slate-700/50 bg-slate-900/30 hover:border-slate-600/50'
        }`}
      >
        <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && onVideoSelect(e.target.files[0])} accept="video/*" className="hidden" />
        
        <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center cursor-pointer group">
          <div className={`p-5 rounded-2xl mb-4 transition-all ${
            isDragging 
              ? 'bg-blue-500/30 scale-110' 
              : 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 group-hover:from-blue-500/20 group-hover:to-cyan-500/20 border border-slate-700/50 group-hover:border-blue-500/50'
          }`}>
            <Upload size={36} className={`transition-colors ${isDragging ? 'text-blue-300' : 'text-slate-400 group-hover:text-blue-400'}`} />
          </div>
          <div className="text-center">
            <h3 className="text-slate-100 font-bold text-lg mb-1.5">Загрузить видео файл</h3>
            <p className="text-xs text-slate-400 font-medium">Перетащите файл сюда или нажмите для выбора</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-2">Прямой мультимодальный анализ</p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-950/95 via-slate-950/90 to-slate-950/80 backdrop-blur-xl border-t border-slate-800/50 rounded-b-2xl shadow-2xl">
           <div className="mb-3">
             <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2">
               <Globe size={14} className="text-blue-400" />
               Или вставьте ссылку на видео
             </p>
           </div>
           <div className="flex gap-2">
                <input 
                    type="text" 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="YouTube, Instagram Reels, TikTok..."
                    className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder:text-slate-600 transition-all"
                    onKeyDown={(e) => { if (e.key === 'Enter' && url && !isFetching) { e.preventDefault(); fetchFromUrl(); } }}
                />
                <button 
                    type="button"
                    onClick={() => { if (url && !isFetching) fetchFromUrl(); }} 
                    disabled={isFetching || !url} 
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-95 flex items-center gap-2"
                >
                    {isFetching ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span className="hidden sm:inline">Скачиваю...</span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span className="hidden sm:inline">Скачать</span>
                        <span className="sm:hidden">↓</span>
                      </>
                    )}
                </button>
           </div>
           {error && (
             <div className="mt-2 space-y-2">
               <p className="text-[10px] text-amber-400 flex items-center gap-1.5 font-medium bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                 <AlertCircle size={10} /> {error}
               </p>
               
               {/* Показываем suggestions, если они есть */}
               {errorSuggestions && errorSuggestions.length > 0 && (
                 <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-[9px] text-blue-300">
                   <p className="font-bold mb-1.5">💡 Рекомендации:</p>
                   <ul className="space-y-1 list-disc list-inside">
                     {errorSuggestions.map((suggestion, idx) => (
                       <li key={idx} className="text-blue-200">{suggestion}</li>
                     ))}
                   </ul>
                 </div>
               )}
               
               {/* Для YouTube ошибок показываем альтернативные сервисы, если нет suggestions */}
               {(error.includes('YouTube') || error.includes('youtube')) && (!errorSuggestions || errorSuggestions.length === 0) && (
                   <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-[9px] text-blue-300">
                     <p className="font-bold mb-1">🌐 Альтернативные способы скачивания:</p>
                     <div className="space-y-1">
                       <a href="https://y2mate.com" target="_blank" rel="noopener noreferrer" className="block hover:text-blue-400 underline">• y2mate.com</a>
                       <a href="https://savefrom.net" target="_blank" rel="noopener noreferrer" className="block hover:text-blue-400 underline">• savefrom.net</a>
                       <a href="https://en.savefrom.net" target="_blank" rel="noopener noreferrer" className="block hover:text-blue-400 underline">• en.savefrom.net</a>
                     </div>
                   </div>
                 )}
                 
                 {error.includes('временно ограничил') || error.includes('429') || error.includes('временно недоступен') ? (
                 <div className="space-y-2">
                   <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-[9px] text-blue-300">
                     <p className="font-bold mb-1">🌐 Альтернативные способы:</p>
                     <div className="space-y-1">
                       <a href="https://saveinsta.app" target="_blank" rel="noopener noreferrer" className="block hover:text-blue-400 underline">• saveinsta.app</a>
                       <a href="https://snapinsta.app" target="_blank" rel="noopener noreferrer" className="block hover:text-blue-400 underline">• snapinsta.app</a>
                       <a href="https://instasave.website" target="_blank" rel="noopener noreferrer" className="block hover:text-blue-400 underline">• instasave.website</a>
                     </div>
                   </div>
                   {url && url.includes('instagram.com') && (
                     <div className="bg-purple-500/10 border border-purple-500/20 rounded p-2">
                       <p className="text-[9px] text-purple-300 font-bold mb-1.5">🎬 Ручное скачивание через браузер:</p>
                       <ol className="text-[8px] text-purple-200 space-y-1 mb-2">
                         <li>1. Откройте видео в Instagram</li>
                         <li>2. F12 → Network → Фильтр "mp4"</li>
                         <li>3. Воспроизведите видео</li>
                         <li>4. ПКМ на .mp4 → "Save as..."</li>
                       </ol>
                       <a 
                         href={url} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[9px] rounded transition-all"
                       >
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                           <polyline points="15 3 21 3 21 9"></polyline>
                           <line x1="10" y1="14" x2="21" y2="3"></line>
                         </svg>
                         Открыть в Instagram
                       </a>
                     </div>
                   )}
                 </div>
                 ) : null}
             </div>
           )}
           <p className="text-[9px] text-slate-500 mt-2 flex items-center gap-1">
             💡 Instagram: используйте ссылки на <span className="font-mono text-blue-400">Reels</span> (видео). При ошибке "429" подождите 2-3 минуты.
           </p>
        </div>
      </div>
    </div>
  );
};
