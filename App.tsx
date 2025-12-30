
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md h-16 flex items-center px-8 justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-blue-500" size={28} />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">VideoMind AI - Анализ Видео</h1>
        </div>
        <button 
          onClick={handleSelectKey} 
          className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-2 border border-slate-700 px-3 py-1.5 rounded-lg bg-slate-800/50 transition-colors"
        >
          <Key size={12} /> СМЕНИТЬ КЛЮЧ
        </button>
      </nav>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-4rem)]">
        <div className="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          <VideoPlayer 
            video={video} 
            onVideoSelect={handleVideoSelect} 
            onRemoteUrlSelect={handleRemoteUrlSelect}
            onClear={handleClearVideo} 
          />

          {video && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-[11px] ${video.isRemote ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-blue-500/10 border-blue-500/30 text-blue-200'}`}>
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold uppercase tracking-wider mb-0.5">
                  {video.isRemote ? 'Режим: Поиск с метаданными' : 'Режим: Мультимодальное видение'}
                </p>
                <p className="opacity-80">
                  {video.isRemote 
                    ? `Используются метаданные OEmbed (${video.metadata?.title ? 'Успех' : 'Резерв'}) для направления Google Search с высокой точностью.`
                    : "Анализируются визуальные данные напрямую из файла."}
                </p>
              </div>
            </div>
          )}

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-inner">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" /> Панель анализа
            </h2>
            
            <div className="space-y-3">
              <button
                disabled={!video || analysis.isLoading || video?.isRemote}
                onClick={() => runAnalysis(AnalysisType.SHORTS_DNA)}
                className="w-full text-left p-3.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg flex items-center gap-3 transition-all disabled:opacity-40"
                title={video?.isRemote ? "Доступно только для загруженных файлов" : ""}
              >
                <Dna size={18} className="text-pink-400" />
                <span className="font-medium text-xs">Анализ</span>
              </button>

              <div className="pt-4 border-t border-slate-800/50 mt-4 flex gap-2">
                <input
                  type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Задай свой вопрос..."
                  className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                />
                <button
                  disabled={!video || !customPrompt || analysis.isLoading}
                  onClick={() => runAnalysis(customPrompt)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
                >
                  Спросить AI
                </button>
              </div>
            </div>
          </div>
          
          {progressMsg && (
            <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-blue-400 text-[11px] font-medium italic">
              <Loader2 size={12} className="animate-spin" />
              {progressMsg}
            </div>
          )}
        </div>

        <div className="h-full">
          <AnalysisPanel state={analysis} videoUrl={video?.remoteUrl} />
        </div>
      </main>
    </div>
  );
}
