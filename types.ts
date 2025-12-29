
export interface AnalysisState {
  isLoading: boolean;
  result: string | null;
  error: string | null;
  groundingUrls?: Array<{uri: string, title?: string}>;
  stylePassport?: StylePassport | null;
}

export interface VideoMetadata {
  title?: string;
  author?: string;
  views?: string;
  likes?: string;
  comments?: string;
  publishDate?: string;
  thumbnail?: string;
}

export interface VideoFile {
  file: File | null;
  url: string | null;
  name: string;
  type: string;
  isRemote?: boolean;
  remoteUrl?: string;
  metadata?: VideoMetadata;
}

export enum AnalysisType {
  SUMMARY = "Подробно расскажи о содержании этого видео.",
  OBJECTS = "Перечисли все основные объекты и людей, обнаруженных в этом видео, с временными метками, если возможно.",
  CODE = "Извлеки все фрагменты кода или технический текст, видимый в видео.",
  SHORTS_DNA = "SHORTS_DNA",
  CUSTOM = "CUSTOM"
}

// Shorts DNA Analysis Types
export interface ToneOfVoice {
  archetype: string;
  mood: string[];
  formality_level_0_10: number;
  direct_address_patterns: string[];
  signature_phrases: string[];
  filler_words: string[];
}

export interface SpeechPace {
  wpm_estimate: number;
  pace_label: "low" | "medium" | "high";
  pause_style: string;
}

export interface VideoStructurePart {
  part: "hook" | "setup" | "main" | "climax" | "cta";
  t_start: string;
  t_end: string;
  what_happens: string;
  why_it_holds: string[];
}

export interface RetentionPattern {
  pattern: string;
  how_it_looks_in_text: string;
  where_in_video: string[];
  reuse_rule: string;
}

export interface VisualStyle {
  editing: string;
  shot_types: string[];
  on_screen_text_style: string;
  typical_actions: string[];
}

export interface DoAndDont {
  do: string[];
  dont: string[];
}

export interface StyleTemplate {
  // Четкий шаблон структуры видео от начала до конца
  template_description: string; // Полное описание шаблона как "формулы успеха"
  step_by_step_structure: string[]; // Пошаговое описание каждого этапа от начала до конца
  mandatory_elements: string[]; // Обязательные элементы, которые должны быть в каждом видео
  transition_patterns: string[]; // Как автор переходит между сегментами
  hook_formula: string; // Формула хука (что всегда делает в начале)
  climax_formula: string; // Формула кульминации (что всегда делает в кульминации)
  cta_formula: string; // Формула CTA (как всегда заканчивает видео)
}

export interface StylePassport {
  language: string;
  style_passport_version: string;
  overall_summary: string;
  target_audience?: string; // На какую аудиторию рассчитано видео
  tone_of_voice: ToneOfVoice;
  speech_pace: SpeechPace;
  structure: VideoStructurePart[];
  retention_patterns: RetentionPattern[];
  visual_style: VisualStyle;
  do_dont: DoAndDont;
  generation_rules: string[];
  style_template?: StyleTemplate; // Четкий шаблон стиля - формула успеха автора от начала до конца
  // Дополнительные поля из анализа комментариев и транскрипции
  video_id?: string;
  video_url?: string;
  video_info?: {
    title: string;
    channel: string;
    duration: number;
    view_count: number;
    like_count: number;
  };
  statistics?: {
    total_comments: number;
    analyzed_comments: number;
    transcript_available?: boolean;
    transcript_length?: number;
    transcript_word_count?: number;
  };
  style_analysis?: {
    frequent_words: { [key: string]: number };
    emotional_tone: {
      positive: number;
      negative: number;
      neutral: number;
      aggressive: number;
      funny: number;
    };
    dominant_emotion: string;
    emoji_usage: [string, number][];
    speech_patterns?: {
      common_phrases: string[];
      filler_words: string[];
      question_count: number;
      exclamation_count: number;
      average_sentence_length: number;
      total_words: number;
    };
  };
  transcript?: string;
  top_comments?: {
    author: string;
    text: string;
    likes: number;
  }[];
  insights?: {
    audience_language: string;
    average_comment_length: number;
    engagement_level: string;
    speech_style?: string;
  };
  created_at?: string;
}

// Уровень 3: Генерация сценариев
export interface ScenarioSegment {
  time_start: string;  // "00:00"
  time_end: string;    // "00:05"
  frame_description: string;  // Описание визуала в стиле автора
  text: string;        // Текст/хук в стиле автора
  applied_rules: string[];  // Правила из паспорта стиля, которые были применены в этом сегменте
}

export interface GeneratedScenario {
  id: string;
  topic: string;
  segments: ScenarioSegment[];
  created_at: string;
  version: number;  // Номер варианта (1, 2, 3...)
}

