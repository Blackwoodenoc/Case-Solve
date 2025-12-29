
import React, { useState } from 'react';
import { StylePassport, GeneratedScenario } from '../types';
import { Dna, Copy, Download, ChevronDown, ChevronRight, Clock, MessageCircle, Film, Zap, CheckCircle2, XCircle, FileText, Loader2, Sparkles, Plus, Trash2 } from 'lucide-react';

interface StylePassportViewerProps {
  passport: StylePassport;
  videoUrl?: string;
}

export const StylePassportViewer: React.FC<StylePassportViewerProps> = ({ passport, videoUrl }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'structure']));
  const [viewMode, setViewMode] = useState<'structured' | 'text'>('structured');
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  
  // Уровень 3: Генерация сценариев
  const [scenarioTopic, setScenarioTopic] = useState('');
  const [scenarios, setScenarios] = useState<GeneratedScenario[]>([]);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  
  const isYouTube = videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };
  
  const loadComments = async () => {
    if (!videoUrl || !isYouTube) return;
    
    setIsLoadingComments(true);
    setCommentsError(null);
    
    try {
      const response = await fetch('http://localhost:3003/api/youtube-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка загрузки комментариев');
      }
      
      const data = await response.json();
      setComments(data.comments || []);
      if (!expandedSections.has('comments')) {
        toggleSection('comments');
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Ошибка загрузки комментариев';
      
      // Специальная обработка ошибки подключения
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch')) {
        errorMessage = 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен на порту 3003. Запустите: npm run dev:server';
      }
      
      setCommentsError(errorMessage);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Генерация сценария (Уровень 3)
  const generateScenario = async (version: number = 1) => {
    if (!scenarioTopic.trim()) {
      setScenarioError('Введите тему для сценария');
      return;
    }
    
    setIsGeneratingScenario(true);
    setScenarioError(null);
    
    try {
      const response = await fetch('http://localhost:3003/api/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passport: passport,
          topic: scenarioTopic.trim(),
          version: version
        })
      });
      
      // Проверяем Content-Type перед парсингом
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Сервер вернул не JSON:', text.substring(0, 200));
        throw new Error('Сервер вернул неверный формат ответа. Проверьте, что сервер запущен на порту 3003.');
      }
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        throw new Error(errorData.error || errorData.details || 'Ошибка генерации сценария');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.scenario) {
        throw new Error(data.error || 'Сценарий не был сгенерирован');
      }
      
      const newScenario = data.scenario;
      
      // Добавляем новый сценарий в список
      setScenarios(prev => [...prev, newScenario]);
      setSelectedScenarioId(newScenario.id);
      
      // Раскрываем секцию сценариев
      if (!expandedSections.has('scenarios')) {
        toggleSection('scenarios');
      }
    } catch (err: any) {
      console.error('❌ Ошибка генерации сценария:', err);
      let errorMessage = err.message || 'Неизвестная ошибка при генерации сценария';
      
      // Специальная обработка ошибки подключения
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch')) {
        errorMessage = 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен на порту 3003. Запустите: npm run dev:server';
      }
      
      setScenarioError(errorMessage);
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const deleteScenario = (scenarioId: string) => {
    setScenarios(prev => prev.filter(s => s.id !== scenarioId));
    if (selectedScenarioId === scenarioId) {
      setSelectedScenarioId(scenarios.find(s => s.id !== scenarioId)?.id || null);
    }
  };

  const convertToText = (): string => {
    let text = '';
    
    text += '═══════════════════════════════════════════════════════\n';
    text += '           📊 ПАСПОРТ СТИЛЯ АВТОРА\n';
    text += '═══════════════════════════════════════════════════════\n\n';
    
    text += `Язык: ${passport.language}\n`;
    text += `Версия: ${passport.style_passport_version}\n\n`;
    
    text += '───────────────────────────────────────────────────────\n';
    text += '📝 ОБЩЕЕ ОПИСАНИЕ\n';
    text += '───────────────────────────────────────────────────────\n';
    text += `${passport.overall_summary}\n\n`;
    
    if (passport.target_audience) {
      text += '───────────────────────────────────────────────────────\n';
      text += '🎯 ЦЕЛЕВАЯ АУДИТОРИЯ\n';
      text += '───────────────────────────────────────────────────────\n';
      text += `${passport.target_audience}\n\n`;
    }
    
    text += '───────────────────────────────────────────────────────\n';
    text += '🎭 ТОН И ГОЛОС\n';
    text += '───────────────────────────────────────────────────────\n';
    text += `Архетип: ${passport.tone_of_voice.archetype}\n`;
    text += `Настроение: ${passport.tone_of_voice.mood.join(', ')}\n`;
    text += `Уровень формальности: ${passport.tone_of_voice.formality_level_0_10}/10\n`;
    text += `\nПаттерны обращения:\n`;
    passport.tone_of_voice.direct_address_patterns.forEach((p, i) => {
      text += `  ${i + 1}. ${p}\n`;
    });
    text += `\nСигнатурные фразы:\n`;
    passport.tone_of_voice.signature_phrases.forEach((p, i) => {
      text += `  ${i + 1}. "${p}"\n`;
    });
    if (passport.tone_of_voice.filler_words.length > 0) {
      text += `\nСлова-паразиты: ${passport.tone_of_voice.filler_words.join(', ')}\n`;
    }
    text += '\n';
    
    text += '───────────────────────────────────────────────────────\n';
    text += '⏱️ ТЕМП РЕЧИ\n';
    text += '───────────────────────────────────────────────────────\n';
    text += `Скорость: ${passport.speech_pace.wpm_estimate} слов/мин (${passport.speech_pace.pace_label})\n`;
    text += `Стиль пауз: ${passport.speech_pace.pause_style}\n\n`;
    
    text += '───────────────────────────────────────────────────────\n';
    text += '🎬 СТРУКТУРА ВИДЕО\n';
    text += '───────────────────────────────────────────────────────\n';
    passport.structure.forEach((part, i) => {
      const partEmoji = {
        hook: '🎣',
        setup: '🎯',
        main: '📖',
        climax: '⚡',
        cta: '👆'
      }[part.part] || '•';
      
      text += `\n${partEmoji} ${part.part.toUpperCase()} (${part.t_start} - ${part.t_end})\n`;
      text += `   Что происходит: ${part.what_happens}\n`;
      text += `   Почему держит:\n`;
      part.why_it_holds.forEach((reason) => {
        text += `     • ${reason}\n`;
      });
    });
    text += '\n';
    
    text += '───────────────────────────────────────────────────────\n';
    text += '🧬 ПАТТЕРНЫ УДЕРЖАНИЯ\n';
    text += '───────────────────────────────────────────────────────\n';
    passport.retention_patterns.forEach((pattern, i) => {
      text += `\n${i + 1}. ${pattern.pattern}\n`;
      text += `   В тексте: ${pattern.how_it_looks_in_text}\n`;
      text += `   Где: ${pattern.where_in_video.join(', ')}\n`;
      text += `   Правило: ${pattern.reuse_rule}\n`;
    });
    text += '\n';
    
    text += '───────────────────────────────────────────────────────\n';
    text += '🎥 ВИЗУАЛЬНЫЙ СТИЛЬ\n';
    text += '───────────────────────────────────────────────────────\n';
    text += `Монтаж: ${passport.visual_style.editing}\n`;
    text += `Типы кадров: ${passport.visual_style.shot_types.join(', ')}\n`;
    text += `Стиль текста: ${passport.visual_style.on_screen_text_style}\n`;
    text += `Типичные действия:\n`;
    passport.visual_style.typical_actions.forEach((action, i) => {
      text += `  ${i + 1}. ${action}\n`;
    });
    text += '\n';
    
    text += '───────────────────────────────────────────────────────\n';
    text += '✅ ЧТО ДЕЛАТЬ / ❌ ЧЕГО НЕ ДЕЛАТЬ\n';
    text += '───────────────────────────────────────────────────────\n';
    text += '✅ ДЕЛАТЬ:\n';
    passport.do_dont.do.forEach((item, i) => {
      text += `  ${i + 1}. ${item}\n`;
    });
    text += '\n❌ НЕ ДЕЛАТЬ:\n';
    passport.do_dont.dont.forEach((item, i) => {
      text += `  ${i + 1}. ${item}\n`;
    });
    text += '\n';
    
    // Шаблон стиля (если есть)
    if (passport.style_template) {
      text += '───────────────────────────────────────────────────────\n';
      text += '🔥 ШАБЛОН СТИЛЯ (ФОРМУЛА УСПЕХА)\n';
      text += '───────────────────────────────────────────────────────\n';
      if (passport.style_template.template_description) {
        text += `Описание: ${passport.style_template.template_description}\n\n`;
      }
      if (passport.style_template.step_by_step_structure && passport.style_template.step_by_step_structure.length > 0) {
        text += 'Пошаговая структура:\n';
        passport.style_template.step_by_step_structure.forEach((step, i) => {
          text += `  ${i + 1}. ${step}\n`;
        });
        text += '\n';
      }
      if (passport.style_template.mandatory_elements && passport.style_template.mandatory_elements.length > 0) {
        text += 'Обязательные элементы:\n';
        passport.style_template.mandatory_elements.forEach((elem, i) => {
          text += `  ${i + 1}. ${elem}\n`;
        });
        text += '\n';
      }
      if (passport.style_template.hook_formula) {
        text += `🎣 Формула хука: ${passport.style_template.hook_formula}\n`;
      }
      if (passport.style_template.climax_formula) {
        text += `💥 Формула кульминации: ${passport.style_template.climax_formula}\n`;
      }
      if (passport.style_template.cta_formula) {
        text += `📢 Формула CTA: ${passport.style_template.cta_formula}\n`;
      }
      text += '\n';
    }
    
    text += '───────────────────────────────────────────────────────\n';
    text += '📋 ПРАВИЛА ГЕНЕРАЦИИ\n';
    text += '───────────────────────────────────────────────────────\n';
    passport.generation_rules.forEach((rule, i) => {
      text += `${i + 1}. ${rule}\n`;
    });
    text += '\n';
    
    // Транскрипция и паттерны речи
    if (passport.transcript && passport.transcript.length > 0) {
      text += '───────────────────────────────────────────────────────\n';
      text += '📝 ТРАНСКРИПЦИЯ И ПАТТЕРНЫ РЕЧИ\n';
      text += '───────────────────────────────────────────────────────\n';
      
      if (passport.statistics) {
        text += `Символов: ${passport.statistics.transcript_length || 0}\n`;
        text += `Слов: ${passport.statistics.transcript_word_count || 0}\n`;
        text += '\n';
      }
      
      if (passport.style_analysis?.speech_patterns) {
        const sp = passport.style_analysis.speech_patterns;
        if (sp.common_phrases.length > 0) {
          text += 'Частые фразы:\n';
          sp.common_phrases.forEach((phrase, i) => {
            text += `  ${i + 1}. ${phrase}\n`;
          });
          text += '\n';
        }
        
        if (sp.filler_words.length > 0) {
          text += 'Слова-паразиты:\n';
          sp.filler_words.forEach((word, i) => {
            text += `  ${i + 1}. ${word}\n`;
          });
          text += '\n';
        }
        
        text += `Вопросов: ${sp.question_count}\n`;
        text += `Восклицаний: ${sp.exclamation_count}\n`;
        text += `Средняя длина предложения: ${sp.average_sentence_length} слов\n`;
        text += '\n';
      }
      
      text += 'Транскрипция:\n';
      text += passport.transcript.substring(0, 5000);
      if (passport.transcript.length > 5000) {
        text += '\n... (обрезано)';
      }
      text += '\n\n';
    }
    
    text += '═══════════════════════════════════════════════════════\n';
    text += `Дата создания: ${new Date().toLocaleString('ru-RU')}\n`;
    text += '═══════════════════════════════════════════════════════\n';
    
    return text;
  };

  const copyText = () => {
    navigator.clipboard.writeText(convertToText());
  };

  const downloadText = () => {
    const blob = new Blob([convertToText()], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `style-passport-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(passport, null, 2));
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `style-passport-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Section: React.FC<{ id: string; title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ id, title, icon, children }) => {
    const isExpanded = expandedSections.has(id);
    return (
      <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900/30">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-4 py-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            {icon}
            {title}
          </div>
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {isExpanded && <div className="p-4 space-y-3">{children}</div>}
      </div>
    );
  };

  const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'blue' }) => {
    const colors = {
      blue: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      green: 'bg-green-500/10 text-green-300 border-green-500/30',
      amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      red: 'bg-red-500/10 text-red-300 border-red-500/30',
    };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${colors[color as keyof typeof colors] || colors.blue}`}>
        {children}
      </span>
    );
  };

  const getPaceColor = (pace: string) => {
    switch (pace) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-amber-400';
      case 'low': return 'text-green-400';
      default: return 'text-slate-400';
    }
  };

  const getPartIcon = (part: string) => {
    switch (part) {
      case 'hook': return '🎣';
      case 'setup': return '⚙️';
      case 'main': return '📖';
      case 'climax': return '🔥';
      case 'cta': return '📢';
      default: return '•';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Dna className="text-purple-400" size={24} />
            <h3 className="text-lg font-bold text-white">Паспорт Стиля</h3>
            <Badge color="purple">v{passport.style_passport_version}</Badge>
            <Badge color="blue">{passport.language.toUpperCase()}</Badge>
          </div>
          <div className="flex gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('structured')}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  viewMode === 'structured' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Структурированный вид"
              >
                <Dna size={16} />
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  viewMode === 'text' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Текстовый формат"
              >
                <FileText size={16} />
              </button>
            </div>
            
            {viewMode === 'text' ? (
              <>
                <button
                  onClick={copyText}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                  title="Скопировать текст"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={downloadText}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                  title="Скачать .txt"
                >
                  <Download size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={copyJSON}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                  title="Скопировать JSON"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={downloadJSON}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                  title="Скачать JSON"
                >
                  <Download size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Text View */}
      {viewMode === 'text' && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {convertToText()}
          </pre>
        </div>
      )}

      {/* Structured View */}
      {viewMode === 'structured' && (
        <>
          {/* Summary */}
          <Section id="summary" title="Общая сводка" icon={<Film size={16} className="text-blue-400" />}>
            <p className="text-sm text-slate-300 leading-relaxed">{passport.overall_summary}</p>
          </Section>

          {/* Target Audience */}
          {passport.target_audience && (
            <Section id="audience" title="Целевая аудитория" icon={<MessageCircle size={16} className="text-cyan-400" />}>
              <p className="text-sm text-slate-300 leading-relaxed">{passport.target_audience}</p>
            </Section>
          )}

      {/* Tone of Voice */}
      <Section id="tone" title="Tone of Voice" icon={<MessageCircle size={16} className="text-purple-400" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Архетип</p>
            <Badge color="purple">{passport.tone_of_voice.archetype}</Badge>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Формальность</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${passport.tone_of_voice.formality_level_0_10 * 10}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-300">{passport.tone_of_voice.formality_level_0_10}/10</span>
            </div>
          </div>
        </div>
        
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Настроение</p>
          <div className="flex flex-wrap gap-1">
            {passport.tone_of_voice.mood.map((m, i) => <Badge key={i} color="blue">{m}</Badge>)}
          </div>
        </div>

        {passport.tone_of_voice.signature_phrases.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Коронные фразы</p>
            <div className="space-y-1">
              {passport.tone_of_voice.signature_phrases.map((phrase, i) => (
                <p key={i} className="text-xs text-slate-300 italic">"{phrase}"</p>
              ))}
            </div>
          </div>
        )}

        {passport.tone_of_voice.direct_address_patterns.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Обращения к зрителю</p>
            <div className="flex flex-wrap gap-1">
              {passport.tone_of_voice.direct_address_patterns.map((p, i) => <Badge key={i} color="amber">{p}</Badge>)}
            </div>
          </div>
        )}
      </Section>

      {/* Speech Pace */}
      <Section id="pace" title="Скорость речи" icon={<Clock size={16} className="text-amber-400" />}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-2xl font-bold text-white">{passport.speech_pace.wpm_estimate} <span className="text-sm text-slate-500">WPM</span></p>
            <p className={`text-xs font-semibold uppercase tracking-wider ${getPaceColor(passport.speech_pace.pace_label)}`}>
              {passport.speech_pace.pace_label}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Стиль пауз</p>
            <p className="text-xs text-slate-300">{passport.speech_pace.pause_style}</p>
          </div>
        </div>
      </Section>

      {/* Structure */}
      <Section id="structure" title="Структура видео" icon={<Film size={16} className="text-green-400" />}>
        <div className="space-y-2">
          {passport.structure.map((seg, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getPartIcon(seg.part)}</span>
                  <span className="text-xs font-bold uppercase text-slate-300">{seg.part}</span>
                </div>
                <Badge color="green">{seg.t_start} - {seg.t_end}</Badge>
              </div>
              <p className="text-xs text-slate-400 mb-2">{seg.what_happens}</p>
              {seg.why_it_holds.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Почему удерживает:</p>
                  {seg.why_it_holds.map((reason, j) => (
                    <p key={j} className="text-[10px] text-emerald-300 flex items-start gap-1">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      {reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Retention Patterns */}
      <Section id="retention" title="Паттерны удержания" icon={<Zap size={16} className="text-yellow-400" />}>
        <div className="space-y-3">
          {passport.retention_patterns.map((pattern, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <Badge color="amber">{pattern.pattern}</Badge>
                <span className="text-[9px] text-slate-500">{pattern.where_in_video.join(', ')}</span>
              </div>
              <p className="text-xs text-slate-400 mb-1">
                <span className="text-slate-500">Как выглядит:</span> "{pattern.how_it_looks_in_text}"
              </p>
              <p className="text-[10px] text-emerald-300">
                <span className="text-slate-500">Правило:</span> {pattern.reuse_rule}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Visual Style */}
      <Section id="visual" title="Визуальный стиль" icon={<Film size={16} className="text-cyan-400" />}>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Монтаж</p>
            <p className="text-xs text-slate-300">{passport.visual_style.editing}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Типы кадров</p>
            <div className="flex flex-wrap gap-1">
              {passport.visual_style.shot_types.map((type, i) => <Badge key={i} color="blue">{type}</Badge>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Текст на экране</p>
            <p className="text-xs text-slate-300">{passport.visual_style.on_screen_text_style}</p>
          </div>
        </div>
      </Section>

      {/* Do's and Don'ts */}
      <Section id="dodont" title="Do / Don't" icon={<CheckCircle2 size={16} className="text-green-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} className="text-green-400" />
              <p className="text-[10px] text-green-400 uppercase tracking-wider font-bold">Do</p>
            </div>
            <ul className="space-y-1">
              {passport.do_dont.do.map((item, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={14} className="text-red-400" />
              <p className="text-[10px] text-red-400 uppercase tracking-wider font-bold">Don't</p>
            </div>
            <ul className="space-y-1">
              {passport.do_dont.dont.map((item, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Style Template - Шаблон стиля */}
      {passport.style_template && (
        <Section id="template" title="🔥 Шаблон стиля (Формула успеха)" icon={<Zap size={16} className="text-yellow-400" />}>
          <div className="space-y-4">
            {/* Описание шаблона */}
            {passport.style_template.template_description && (
              <div>
                <p className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-2">Описание шаблона</p>
                <p className="text-xs text-slate-300 leading-relaxed">{passport.style_template.template_description}</p>
              </div>
            )}

            {/* Пошаговая структура */}
            {passport.style_template.step_by_step_structure && passport.style_template.step_by_step_structure.length > 0 && (
              <div>
                <p className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-2">Пошаговая структура</p>
                <ol className="space-y-2">
                  {passport.style_template.step_by_step_structure.map((step, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 bg-yellow-500/20 border border-yellow-500/40 rounded-full flex items-center justify-center text-[10px] font-bold text-yellow-300">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Обязательные элементы */}
            {passport.style_template.mandatory_elements && passport.style_template.mandatory_elements.length > 0 && (
              <div>
                <p className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-2">Обязательные элементы</p>
                <ul className="space-y-1">
                  {passport.style_template.mandatory_elements.map((elem, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>{elem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Паттерны переходов */}
            {passport.style_template.transition_patterns && passport.style_template.transition_patterns.length > 0 && (
              <div>
                <p className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-2">Паттерны переходов</p>
                <ul className="space-y-1">
                  {passport.style_template.transition_patterns.map((pattern, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">↗</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Формулы */}
            <div className="grid grid-cols-1 gap-3">
              {passport.style_template.hook_formula && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-1">🎣 Формула хука (00:00-00:05)</p>
                  <p className="text-xs text-slate-300">{passport.style_template.hook_formula}</p>
                </div>
              )}
              {passport.style_template.climax_formula && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-1">💥 Формула кульминации (00:45-00:55)</p>
                  <p className="text-xs text-slate-300">{passport.style_template.climax_formula}</p>
                </div>
              )}
              {passport.style_template.cta_formula && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-1">📢 Формула CTA (00:55-01:00)</p>
                  <p className="text-xs text-slate-300">{passport.style_template.cta_formula}</p>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Generation Rules */}
      <Section id="rules" title="Правила имитации" icon={<Dna size={16} className="text-purple-400" />}>
        <ol className="space-y-2">
          {passport.generation_rules.map((rule, i) => (
            <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-purple-500/20 border border-purple-500/40 rounded-full flex items-center justify-center text-[10px] font-bold text-purple-300">
                {i + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* Транскрипция и паттерны речи */}
      {passport.transcript && passport.transcript.length > 0 && (
        <Section id="transcript" title="📝 Транскрипция и паттерны речи" icon={<FileText size={16} className="text-cyan-400" />}>
          <div className="space-y-4">
            {/* Статистика транскрипции */}
            {passport.statistics && (
              <div className="bg-slate-900/50 rounded-lg p-3 border border-cyan-500/20">
                <p className="text-cyan-300 text-[10px] font-bold mb-2">📊 Статистика транскрипции</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400">Символов:</span>
                    <span className="text-slate-200 ml-2">{passport.statistics.transcript_length?.toLocaleString() || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Слов:</span>
                    <span className="text-slate-200 ml-2">{passport.statistics.transcript_word_count?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Паттерны речи */}
            {passport.style_analysis?.speech_patterns && (
              <div className="space-y-3">
                {passport.style_analysis.speech_patterns.common_phrases.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Частые фразы</p>
                    <div className="flex flex-wrap gap-1">
                      {passport.style_analysis.speech_patterns.common_phrases.map((phrase, i) => (
                        <Badge key={i} color="cyan">{phrase}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {passport.style_analysis.speech_patterns.filler_words.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Слова-паразиты</p>
                    <div className="flex flex-wrap gap-1">
                      {passport.style_analysis.speech_patterns.filler_words.map((word, i) => (
                        <Badge key={i} color="purple">{word}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400">Вопросов:</span>
                    <span className="text-slate-200 ml-1">{passport.style_analysis.speech_patterns.question_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Восклицаний:</span>
                    <span className="text-slate-200 ml-1">{passport.style_analysis.speech_patterns.exclamation_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Средняя длина предложения:</span>
                    <span className="text-slate-200 ml-1">{passport.style_analysis.speech_patterns.average_sentence_length} слов</span>
                  </div>
                </div>
              </div>
            )}

            {/* Транскрипция (первые 1000 символов) */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Транскрипция</p>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 max-h-48 overflow-y-auto">
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {passport.transcript.length > 1000 
                    ? passport.transcript.substring(0, 1000) + '...' 
                    : passport.transcript}
                </p>
                {passport.transcript.length > 1000 && (
                  <p className="text-[10px] text-slate-500 mt-2">
                    Показано 1000 из {passport.transcript.length} символов
                  </p>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Секция комментариев */}
      {isYouTube && (
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-400" />
              <h3 className="text-sm font-bold text-blue-400">💬 Комментарии аудитории</h3>
            </div>
            <button
              onClick={loadComments}
              disabled={isLoadingComments}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded-lg transition-all flex items-center gap-2"
            >
              {isLoadingComments ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <MessageCircle size={14} />
                  {comments.length > 0 ? 'Обновить' : 'Загрузить комментарии'}
                </>
              )}
            </button>
          </div>

          {commentsError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
              ❌ {commentsError}
            </div>
          )}

          {comments.length > 0 && (
            <div className="bg-slate-900/30 border border-blue-500/20 rounded-lg p-3">
              <div className="mb-2 text-[10px] text-slate-400">
                Загружено комментариев: <span className="text-blue-400 font-bold">{comments.length}</span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comments.slice(0, 20).map((comment, idx) => (
                  <div key={idx} className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-blue-400 text-[10px] font-bold truncate flex-1">
                        {comment.author || 'Аноним'}
                      </span>
                      {comment.like_count > 0 && (
                        <span className="text-slate-500 text-[9px] flex items-center gap-1">
                          👍 {comment.like_count}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {comment.text || comment.content}
                    </p>
                  </div>
                ))}
                {comments.length > 20 && (
                  <p className="text-center text-[10px] text-slate-500 py-2">
                    ... и еще {comments.length - 20} комментариев
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Уровень 3: Генерация сценариев */}
      <div className="mt-6 border-t border-slate-700 pt-6">
        <div 
          className="flex items-center justify-between cursor-pointer mb-4"
          onClick={() => toggleSection('scenarios')}
        >
          <div className="flex items-center gap-2">
            {expandedSections.has('scenarios') ? (
              <ChevronDown size={16} className="text-emerald-400" />
            ) : (
              <ChevronRight size={16} className="text-emerald-400" />
            )}
            <Sparkles size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-emerald-400">
              🎬 Уровень 3: Генерация сценариев
            </h3>
          </div>
        </div>

        {expandedSections.has('scenarios') && (
          <div className="space-y-4">
            {/* Поле ввода темы */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Тема для сценария:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scenarioTopic}
                  onChange={(e) => setScenarioTopic(e.target.value)}
                  placeholder="Например: Обзор нового iPhone или Как я проспал работу"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isGeneratingScenario) {
                      generateScenario(1);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const existingForTopic = scenarios.filter(s => s.topic === scenarioTopic.trim());
                    const version = existingForTopic.length === 0 ? 1 : existingForTopic.length + 1;
                    generateScenario(version);
                  }}
                  disabled={isGeneratingScenario || !scenarioTopic.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  {isGeneratingScenario ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      {scenarios.filter(s => s.topic === scenarioTopic.trim()).length === 0 
                        ? 'Вариант 1' 
                        : `Вариант ${scenarios.filter(s => s.topic === scenarioTopic.trim()).length + 1}`}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const existingForTopic = scenarios.filter(s => s.topic === scenarioTopic.trim());
                    const nextVersion = existingForTopic.length + 1;
                    generateScenario(nextVersion);
                  }}
                  disabled={isGeneratingScenario || !scenarioTopic.trim()}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-slate-300 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                  title="Создать еще один вариант на эту же тему"
                >
                  <Plus size={14} />
                </button>
              </div>
              {scenarioError && (
                <p className="text-xs text-red-400">{scenarioError}</p>
              )}
            </div>

            {/* Список сценариев */}
            {scenarios.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400">
                    Созданные сценарии ({scenarios.length}):
                  </p>
                </div>
                
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer ${
                      selectedScenarioId === scenario.id
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                    onClick={() => setSelectedScenarioId(scenario.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200 mb-1">
                          {scenario.topic}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Вариант {scenario.version} • {scenario.segments.length} сегментов • {new Date(scenario.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScenario(scenario.id);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="Удалить сценарий"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>

                    {selectedScenarioId === scenario.id && (
                      <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
                        {scenario.segments.map((segment, idx) => (
                          <div key={idx} className="bg-slate-900/50 rounded p-3 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock size={12} className="text-emerald-400" />
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                [{segment.time_start} - {segment.time_end}]
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-400">Кадр:</span>
                                <p className="text-xs text-slate-300 mt-1">
                                  {segment.frame_description}
                                </p>
                              </div>
                              <div>
                                <span className="text-[10px] font-semibold text-slate-400">Текст:</span>
                                <p className="text-xs text-slate-200 mt-1 font-medium">
                                  {segment.text}
                                </p>
                              </div>
                              {segment.applied_rules && segment.applied_rules.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-700">
                                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                                    <FileText size={10} />
                                    Примененные правила:
                                  </span>
                                  <ul className="mt-2 space-y-1">
                                    {segment.applied_rules.map((rule, ruleIdx) => (
                                      <li key={ruleIdx} className="text-[10px] text-slate-300 flex items-start gap-2">
                                        <span className="text-emerald-400 mt-0.5">•</span>
                                        <span>{rule}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

