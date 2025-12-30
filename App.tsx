
import React, { useState, useEffect } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { AnalysisPanel } from './components/AnalysisPanel';
import { analyzeVideoContent, analyzeRemoteLink, fetchVideoMetadata, analyzeShortsDNA } from './services/geminiService';
import { transcribeVideo } from './services/whisperService';
import { VideoFile, AnalysisState, AnalysisType } from './types';
import { BrainCircuit, Sparkles, Info, Loader2, Key, ShieldCheck, ExternalLink, Dna } from 'lucide-react';

// The AI Studio environment provides the AIStudio type and window.aistudio property globally.
// Local declarations are removed to avoid modifier and type mismatch conflicts.

export default function App() {
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    result: null,
    error: null,
  });
  const [customPrompt, setCustomPrompt] = useState("");

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    // Проверяем наличие API ключа в переменных окружения
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    console.log('🔑 API Key check:', {
      hasApiKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPreview: apiKey ? apiKey.substring(0, 10) + '...' : 'not found'
    });
    setHasApiKey(!!apiKey && apiKey.length > 0);
  };

  const handleSelectKey = async () => {
    // В локальной версии показываем инструкцию
    alert('Для локального запуска:\n\n1. Создайте файл .env.local в корне проекта\n2. Добавьте строку: GEMINI_API_KEY=ваш_ключ\n3. Перезапустите сервер (npm run dev)\n\nВаш ключ уже настроен, если вы видите это сообщение, перезапустите сервер.');
  };

  const handleVideoSelect = (file: File) => {
    if (video?.url) URL.revokeObjectURL(video.url);
    const url = URL.createObjectURL(file);
    setVideo({ file, url, name: file.name, type: file.type, isRemote: false });
    setAnalysis({ isLoading: false, result: null, error: null });
  };

  const handleRemoteUrlSelect = async (url: string) => {
    setProgressMsg("Fetching link metadata...");
    const metadata = await fetchVideoMetadata(url);
    setVideo({ 
      file: null, 
      url: null, 
      name: metadata?.title || 'Remote Content', 
      type: 'video/remote', 
      isRemote: true, 
      remoteUrl: url,
      metadata: metadata || undefined
    });
    setAnalysis({ isLoading: false, result: null, error: null });
    setProgressMsg("");
  };

  const handleClearVideo = () => {
    if (video?.url) URL.revokeObjectURL(video.url);
    setVideo(null);
    setAnalysis({ isLoading: false, result: null, error: null });
  };

  const runAnalysis = async (prompt: string) => {
    if (!video) return;
    setAnalysis({ isLoading: true, result: null, error: null, stylePassport: null });
    setProgressMsg("Consulting Gemini Pro...");

    try {
      let response;
      
      // Специальный режим для Shorts DNA Analysis
      if (prompt === AnalysisType.SHORTS_DNA) {
        if (!video.file) {
          throw new Error("Анализ доступен только для загруженных файлов (не для ссылок).");
        }
        
        // Сначала транскрибируем видео через Whisper
        let transcript: string | undefined = undefined;
        try {
          setProgressMsg("🎤 Транскрибирую аудио через Whisper...");
          const transcriptionResult = await transcribeVideo(video.file, 'base', null, setProgressMsg);
          transcript = transcriptionResult.transcript;
          console.log(`✅ Транскрипция получена: ${transcript.length} символов, язык: ${transcriptionResult.language}`);
          
          if (transcript.length === 0) {
            console.warn("⚠️ Транскрипт пустой, продолжаю без него");
            transcript = undefined;
          }
        } catch (transcribeError: any) {
          console.warn("⚠️ Ошибка транскрипции Whisper, продолжаю без транскрипта:", transcribeError.message);
          
          // Показываем предупреждение пользователю, но продолжаем анализ
          if (transcribeError.message.includes("WHISPER_NOT_AVAILABLE") || 
              transcribeError.message.includes("Whisper недоступен")) {
            setProgressMsg("⚠️ Whisper недоступен. Установите: pip install openai-whisper. Продолжаю анализ без транскрипта...");
          } else {
            setProgressMsg("⚠️ Ошибка транскрипции. Продолжаю анализ без транскрипта...");
          }
          
          // Продолжаем анализ без транскрипта - Gemini может извлечь его сам
          transcript = undefined;
        }
        
        setProgressMsg("🧬 Извлекаю ДНК успеха из короткого видео...");
        response = await analyzeShortsDNA(video.file, transcript, undefined, undefined, setProgressMsg);
        setAnalysis({ 
          isLoading: false, 
          result: response.text, 
          error: null,
          stylePassport: response.stylePassport || null,
          groundingUrls: undefined
        });
        return;
      }
      
      // Обычные режимы анализа
      if (video.isRemote && video.remoteUrl) {
        response = await analyzeRemoteLink(video.remoteUrl, prompt, setProgressMsg, video.metadata);
      } else if (video.file) {
        response = await analyzeVideoContent(video.file, prompt, setProgressMsg);
      } else {
        throw new Error("Источник отсутствует.");
      }
      
      setAnalysis({ 
        isLoading: false, 
        result: response.text, 
        error: null,
        groundingUrls: response.groundingUrls,
        stylePassport: null
      });
    } catch (err: any) {
      if (err.message === "API_KEY_INVALID") {
        setHasApiKey(false);
        setAnalysis({ isLoading: false, result: null, error: "Доступ запрещён: Пожалуйста, выберите действительный платный API ключ.", stylePassport: null });
      } else {
        setAnalysis({ isLoading: false, result: null, error: err.message || "Анализ не удался.", stylePassport: null });
      }
    } finally {
      setProgressMsg("");
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
            <Key className="text-blue-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">API ключ не найден</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Для работы приложения необходим Gemini API ключ.
          </p>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs font-mono text-slate-300 mb-2">Инструкция:</p>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Создайте файл <code className="bg-slate-950 px-1 rounded">.env.local</code></li>
              <li>Добавьте: <code className="bg-slate-950 px-1 rounded">GEMINI_API_KEY=ваш_ключ</code></li>
              <li>Перезапустите: <code className="bg-slate-950 px-1 rounded">npm run dev</code></li>
            </ol>
          </div>
          <a 
            href="https://ai.google.dev/gemini-api/docs/api-key" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
          >
            <ExternalLink size={18} /> Получить API ключ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200 font-sans">
      <nav className="border-b border-slate-800/50 bg-slate-900/60 backdrop-blur-xl h-20 flex items-center px-6 lg:px-10 justify-between sticky top-0 z-50 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
            <BrainCircuit className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              VideoMind AI
            </h1>
            <p className="text-[10px] text-slate-500 font-medium hidden sm:block">Глубокий анализ видео контента</p>
          </div>
        </div>
        <button 
          onClick={handleSelectKey} 
          className="text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-2 border border-slate-700/50 px-4 py-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 transition-all backdrop-blur-sm"
        >
          <Key size={14} /> Ключ API
        </button>
      </nav>

      <main className="max-w-[1600px] mx-auto p-4 lg:p-8 grid grid-cols-1 xl:grid-cols-[1.1fr,1fr] gap-6 lg:gap-8 min-h-[calc(100vh-5rem)]">
        {/* Левая колонка - Загрузка и управление */}
        <div className="flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 lg:p-6 shadow-xl">
            <VideoPlayer 
              video={video} 
              onVideoSelect={handleVideoSelect} 
              onRemoteUrlSelect={handleRemoteUrlSelect}
              onClear={handleClearVideo} 
            />
          </div>

          {video && (
            <div className={`p-4 rounded-xl border backdrop-blur-sm flex items-start gap-3 transition-all ${video.isRemote 
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-lg shadow-amber-500/10' 
              : 'bg-blue-500/10 border-blue-500/40 text-blue-200 shadow-lg shadow-blue-500/10'}`}>
              <div className={`p-2 rounded-lg ${video.isRemote ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
                <Info size={16} className={video.isRemote ? 'text-amber-400' : 'text-blue-400'} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm mb-1.5">
                  {video.isRemote ? '🔍 Режим поиска с метаданными' : '👁️ Мультимодальное видение'}
                </p>
                <p className="text-xs opacity-90 leading-relaxed">
                  {video.isRemote 
                    ? `Используются метаданные OEmbed${video.metadata?.title ? ' (успешно)' : ' (резервный режим)'} для точного поиска через Google Search.`
                    : "Прямой анализ визуальных данных из загруженного файла с использованием AI."}
                </p>
              </div>
            </div>
          )}

          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 lg:p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg border border-amber-500/30">
                <Sparkles size={16} className="text-amber-400" />
              </div>
              <h2 className="text-sm font-bold text-slate-300">Инструменты анализа</h2>
            </div>
            
            <div className="space-y-3">
              <button
                disabled={!video || analysis.isLoading || video?.isRemote}
                onClick={() => runAnalysis(AnalysisType.SHORTS_DNA)}
                className={`w-full group relative overflow-hidden p-4 rounded-xl border transition-all ${
                  !video || analysis.isLoading || video?.isRemote
                    ? 'bg-slate-800/30 border-slate-700/30 opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 border-pink-500/40 hover:border-pink-500/60 hover:shadow-lg hover:shadow-pink-500/20 cursor-pointer'
                }`}
                title={video?.isRemote ? "Доступно только для загруженных файлов" : "Запустить глубокий анализ видео"}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <div className="p-2 bg-pink-500/20 rounded-lg border border-pink-500/30">
                    <Dna size={20} className="text-pink-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm text-slate-100">Анализ</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Глубокий анализ структуры и стиля</p>
                  </div>
                  {!video || analysis.isLoading || video?.isRemote ? (
                    <div className="text-slate-500 text-xs">—</div>
                  ) : (
                    <div className="text-pink-400 group-hover:translate-x-1 transition-transform">→</div>
                  )}
                </div>
              </button>

              <div className="pt-4 border-t border-slate-800/50 mt-4">
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Кастомный запрос
                </label>
                <div className="flex gap-2">
                  <input
                    type="text" 
                    value={customPrompt} 
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Например: Опиши главные моменты видео..."
                    className="flex-1 bg-slate-950/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder:text-slate-600 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && video && customPrompt && !analysis.isLoading) {
                        e.preventDefault();
                        runAnalysis(customPrompt);
                      }
                    }}
                  />
                  <button
                    disabled={!video || !customPrompt || analysis.isLoading}
                    onClick={() => runAnalysis(customPrompt)}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-95"
                  >
                    {analysis.isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      'Спросить'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {progressMsg && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-sm font-medium backdrop-blur-sm shadow-lg">
              <Loader2 size={16} className="animate-spin text-blue-400" />
              <span className="flex-1">{progressMsg}</span>
            </div>
          )}
        </div>

        {/* Правая колонка - Результаты */}
        <div className="h-full min-h-[500px]">
          <AnalysisPanel state={analysis} videoUrl={video?.remoteUrl} />
        </div>
      </main>
    </div>
  );
}
