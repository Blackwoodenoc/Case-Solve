
import React from 'react';
import { AnalysisState } from '../types';
import { Bot, AlertCircle, Loader2, Copy, ExternalLink, Lightbulb, BarChart3, CheckCircle2, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { StylePassportViewer } from './StylePassportViewer';

interface AnalysisPanelProps {
  state: AnalysisState;
  videoUrl?: string;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ state, videoUrl }) => {
  const { isLoading, result, error, groundingUrls, stylePassport } = state;

  const copyToClipboard = () => {
    if (result) navigator.clipboard.writeText(result);
  };

  const isProfileFallback = result?.toLowerCase().includes("profile data") || result?.toLowerCase().includes("not indexed");

  if (!isLoading && !result && !error && !stylePassport) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-800/50 rounded-2xl bg-slate-900/20 backdrop-blur-sm">
        <div className="p-4 bg-slate-800/50 rounded-2xl mb-4 border border-slate-700/50">
          <Bot size={40} className="text-slate-600" />
        </div>
        <p className="text-center text-sm font-medium text-slate-300 mb-1">Готов к анализу</p>
        <p className="text-center text-xs text-slate-500">Загрузите видео или вставьте ссылку для начала</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden flex flex-col h-full border border-slate-800/50">
      <div className="p-5 border-b border-slate-800/50 bg-slate-900/60 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg border border-blue-500/30">
            <BarChart3 size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Результат анализа</h3>
            <p className="text-[10px] text-slate-500 font-medium">Детальная аналитика и инсайты</p>
          </div>
        </div>
        {result && !stylePassport && (
          <button 
            onClick={copyToClipboard} 
            className="text-xs text-slate-400 hover:text-white flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 transition-all"
          >
            <Copy size={14} /> Копировать
          </button>
        )}
      </div>

      <div className="p-6 flex-1 overflow-y-auto bg-slate-900/20 custom-scrollbar">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full space-y-5">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
              <div className="relative p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/30">
                <Loader2 className="animate-spin text-blue-400" size={48} />
                <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-300" size={20} />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-slate-100 text-base font-semibold">Выполняется глубокий анализ...</p>
              <p className="text-slate-400 text-xs mt-1">Обработка видео и извлечение инсайтов</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-500/50 text-red-200 p-5 rounded-xl flex gap-4 shadow-xl backdrop-blur-sm">
            <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/30 flex-shrink-0">
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-300 mb-1">Ошибка анализа</p>
              <p className="text-sm leading-relaxed text-red-200/90">{error}</p>
            </div>
          </div>
        )}

        {stylePassport && (
          <StylePassportViewer passport={stylePassport} videoUrl={videoUrl} />
        )}

        {result && !stylePassport && (
          <div className="space-y-6">
            {!isProfileFallback && (
              <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 p-2 rounded border border-emerald-500/20 mb-2">
                <CheckCircle2 size={12} /> Данные поста проверены
              </div>
            )}

            <div className="prose prose-invert prose-sm max-w-none 
              prose-headings:text-blue-400 prose-strong:text-slate-100 prose-table:border prose-table:border-slate-700
              prose-th:bg-slate-900/50 prose-th:p-2 prose-td:p-2 prose-td:border-t prose-td:border-slate-700">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>

            {isProfileFallback && (
              <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-lg flex items-start gap-3 text-xs text-amber-200/80 leading-relaxed shadow-sm">
                <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-amber-400" />
                <div>
                  <p className="font-bold text-amber-400 mb-1 uppercase tracking-tight">Обнаружена задержка индексации</p>
                  <p>ID поста не найден в последних результатах Google Search. Это происходит, если пост очень новый (менее 12ч) или установлена высокая приватность. Отображаемые данные могут быть усреднёнными по профилю.</p>
                </div>
              </div>
            )}

            {groundingUrls && groundingUrls.length > 0 && (
              <div className="pt-6 border-t border-slate-700/50">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Источники проверки</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groundingUrls.map((link, idx) => (
                    <a 
                      key={idx} 
                      href={link.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-slate-900/50 hover:bg-slate-700/50 text-blue-400 text-[10px] rounded-lg border border-slate-700/50 transition-all truncate group"
                    >
                      <ExternalLink size={12} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="truncate">{link.title || 'Источник'}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
