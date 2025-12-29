
import React from 'react';
import { AnalysisState } from '../types';
import { Bot, AlertCircle, Loader2, Copy, ExternalLink, Lightbulb, BarChart3, CheckCircle2, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { StylePassportViewer } from './StylePassportViewer';
import { CommentBlueprintViewer } from './CommentBlueprintViewer';

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
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
        <Bot size={48} className="mb-4 opacity-50" />
        <p className="text-center text-sm">Загрузите видео или вставьте ссылку для глубокой аналитики.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col h-full border border-slate-700">
      <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider">
          <BarChart3 size={16} className="text-blue-400" /> Результат анализа
        </h3>
        {result && !stylePassport && (
          <button onClick={copyToClipboard} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
            <Copy size={14} /> Копировать
          </button>
        )}
      </div>

      <div className="p-6 flex-1 overflow-y-auto bg-slate-800 custom-scrollbar">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="relative">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-300" size={16} />
            </div>
            <div className="text-center">
              <p className="text-slate-200 text-sm font-medium">Выполняется глубокий поиск...</p>
              <p className="text-slate-500 text-[10px] mt-1 italic uppercase tracking-tighter">Обход шума профиля для поиска метаданных поста</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg flex gap-3 shadow-lg">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm leading-relaxed">{error}</p>
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
