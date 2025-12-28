
import { GoogleGenAI } from "@google/genai";
import { VideoMetadata } from "../types";

const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

/**
 * Fetches an image from a URL and converts it to base64 via proxy
 */
const fetchImageAsBase64 = async (imageUrl: string): Promise<{ data: string, mimeType: string } | null> => {
  for (const proxyFn of PROXIES) {
    try {
      const response = await fetch(proxyFn(imageUrl));
      if (!response.ok) continue;
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      return { data: base64, mimeType: blob.type || 'image/jpeg' };
    } catch (e) {
      console.warn("Proxy failed to fetch image", e);
    }
  }
  return null;
};

const extractPostId = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    if (url.includes('instagram.com')) {
      const idx = pathParts.findIndex(p => p === 'p' || p === 'reels' || p === 'reel');
      return idx !== -1 ? pathParts[idx + 1] : pathParts[pathParts.length - 1] || '';
    }
    if (url.includes('tiktok.com')) {
      const idx = pathParts.findIndex(p => p === 'video');
      return idx !== -1 ? pathParts[idx + 1] : pathParts[pathParts.length - 1] || '';
    }
    return '';
  } catch {
    return '';
  }
};

export const fetchVideoMetadata = async (url: string): Promise<VideoMetadata | null> => {
  try {
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data.title || "Social Media Content",
      author: data.author_name || "Unknown Creator",
      thumbnail: data.thumbnail_url
    };
  } catch (e) {
    console.warn("Could not fetch OEmbed metadata", e);
    return null;
  }
};

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export interface AnalysisResponse {
  text: string;
  groundingUrls?: Array<{uri: string, title?: string}>;
  stylePassport?: any;
}

export const analyzeVideoContent = async (
  videoFile: File,
  prompt: string,
  onProgress?: (message: string) => void
): Promise<AnalysisResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (onProgress) onProgress("Загружаю видео для анализа всех кадров...");
    const videoPart = await fileToGenerativePart(videoFile);
    
    const enhancedPrompt = `ВАЖНО: Проанализируй ВСЕ кадры видео последовательно, а не только ключевые кадры. 
Просматривай каждый кадр от начала до конца для максимально детального анализа.

${prompt}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [videoPart, { text: enhancedPrompt }]
      }
    });
    return { text: response.text || "Нет ответа." };
  } catch (error: any) { throw processGeminiError(error); }
};

export const analyzeRemoteLink = async (
  url: string,
  prompt: string,
  onProgress?: (message: string) => void,
  prefetchedMetadata?: VideoMetadata
): Promise<AnalysisResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const postId = extractPostId(url);
    const platform = url.includes('instagram.com') ? 'Instagram' : url.includes('tiktok.com') ? 'TikTok' : 'YouTube';
    
    let visualPart: any = null;
    if (prefetchedMetadata?.thumbnail) {
      if (onProgress) onProgress("Scanning visual thumbnail...");
      const imageData = await fetchImageAsBase64(prefetchedMetadata.thumbnail);
      if (imageData) {
        visualPart = { inlineData: imageData };
      }
    }

    if (onProgress) onProgress(`Deep Search: Correlating visual and metadata for ${postId}...`);

    const contents: any = {
      parts: [
        { text: `TASK: ANALYZE THIS SOCIAL MEDIA POST.
        URL: ${url}
        ID: ${postId}
        PLATFORM: ${platform}
        
        INSTRUCTIONS:
        1. IF AN IMAGE IS PROVIDED: This is the thumbnail or the post itself. Describe what you see in detail (colors, people, setting, objects).
        2. IF NO IMAGE: Use search to find a description of the content.
        3. SEARCH FOR METRICS: Use Google Search to find exact Likes and Comments for ID "${postId}".
        4. VERIFY: Ensure metrics belong to this post, not the user's total follower count.
        
        USER QUERY: ${prompt}` }
      ]
    };

    if (visualPart) {
      contents.parts.unshift(visualPart);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const urls = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({ uri: chunk.web.uri, title: chunk.web.title }));

    return {
      text: response.text || "Analysis complete but no text returned.",
      groundingUrls: urls.length > 0 ? urls : undefined
    };
  } catch (error: any) { throw processGeminiError(error); }
};

const processGeminiError = (error: any) => {
  console.error("Gemini Error Context:", error);
  
  // Extract error message from various possible SDK formats
  const errorString = typeof error === 'string' ? error : JSON.stringify(error);
  const errorMessage = error?.message || errorString;
  
  // Check for permission denied or not found which indicates key/billing issues
  const isAuthError = 
    errorMessage.includes("PERMISSION_DENIED") || 
    errorMessage.includes("permission") || 
    errorMessage.includes("Requested entity was not found") ||
    errorMessage.includes("403") ||
    errorMessage.includes("404");

  if (isAuthError) {
    return new Error("API_KEY_INVALID");
  }
  
  if (errorMessage.includes("Safety")) return new Error("Content flagged by safety filters.");
  return new Error(errorMessage || "An unexpected error occurred.");
};

export const analyzeShortsDNA = async (
  videoFile: File,
  transcript?: string,
  visualNotes?: string,
  meta?: { language?: string; duration?: number; platform?: string; topic?: string },
  onProgress?: (message: string) => void
): Promise<AnalysisResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const shortsAnalysisPrompt = `Ты — AI-аналитик коротких видео (Shorts/Reels/TikTok). Твоя задача: по транскрипту и визуальным данным деконструировать ролик и извлечь «ДНК успеха» (повторяющиеся паттерны удержания), а затем выдать СТРОГО валидный JSON «паспорт стиля» автора.

⚠️ КРИТИЧЕСКИ ВАЖНО: Проанализируй ВСЕ кадры видео последовательно от начала до конца. НЕ используй только ключевые кадры — просмотри каждый кадр для максимально детального понимания структуры, визуальных переходов, текста на экране, жестов и эмоций.

${transcript ? `ТРАНСКРИПТ:\n${transcript}\n` : "ТРАНСКРИПТ: Извлеки транскрипт из видео автоматически используя аудио и визуальные данные, просматривая ВСЕ кадры последовательно.\n"}

${visualNotes ? `ВИЗУАЛЬНЫЕ ЗАМЕТКИ:\n${visualNotes}\n` : "ВИЗУАЛЬНЫЕ ЗАМЕТКИ: Анализируй визуальный ряд по ВСЕМ кадрам видео последовательно. Не пропускай кадры — каждый кадр важен для понимания структуры и паттернов.\n"}

${meta ? `МЕТАДАННЫЕ:
Язык: ${meta.language || "определи автоматически"}
Длительность: ${meta.duration ? `${meta.duration} секунд` : "определи по видео"}
Платформа: ${meta.platform || "не указана"}
Тема: ${meta.topic || "определи по контенту"}
` : "МЕТАДАННЫЕ: Определи автоматически из видео.\n"}

ЧТО НУЖНО ПРОАНАЛИЗИРОВАТЬ:
A) Структура ролика по сегментам с таймкодами:
- Hook/Завязка → Основная часть → Кульминация → CTA
B) Паттерны удержания:
- типы крючков (вопрос/обещание/шок/конфликт/личная история/цифры/ошибка)
- темп (ускорения/паузы), смена смысловых блоков
- «открытые петли», клиффхэнгеры, "подожди/сейчас покажу"
- повторяющиеся приёмы (списки, контраст, "до/после", миф/правда)
C) Tone of Voice:
- настроение (агрессивно/иронично/познавательно/дружелюбно/саркастично и т.п.)
- степень разговорности, сленг, обращения к зрителю, юмор
- коронные выражения, фразы-паразиты, типичные связки
D) Скорость речи:
- оцени WPM (слов/мин) по транскрипту и длительности
E) Visual Context:
- статично/динамично, крупность, "говорящая голова" vs нарезка, наличие текста на экране, жесты/эмоции
F) «Правила имитации»:
- 8–15 чётких правил, которые можно применить в генерации нового сценария

ФОРМАТ ВЫХОДА (СТРОГО JSON, БЕЗ markdown оформления, БЕЗ обёрток типа \`\`\`json):
{
  "language": "...",
  "style_passport_version": "1.0",
  "overall_summary": "...",
  "tone_of_voice": {
    "archetype": "...",
    "mood": ["..."],
    "formality_level_0_10": 0,
    "direct_address_patterns": ["..."],
    "signature_phrases": ["..."],
    "filler_words": ["..."]
  },
  "speech_pace": {
    "wpm_estimate": 0,
    "pace_label": "low|medium|high",
    "pause_style": "..."
  },
  "structure": [
    {"part": "hook", "t_start": "00:00", "t_end": "00:05", "what_happens": "...", "why_it_holds": ["..."]},
    {"part": "setup", "t_start": "00:05", "t_end": "00:15", "what_happens": "...", "why_it_holds": ["..."]},
    {"part": "main", "t_start": "00:15", "t_end": "00:45", "what_happens": "...", "why_it_holds": ["..."]},
    {"part": "climax", "t_start": "00:45", "t_end": "00:55", "what_happens": "...", "why_it_holds": ["..."]},
    {"part": "cta", "t_start": "00:55", "t_end": "01:00", "what_happens": "...", "why_it_holds": ["..."]}
  ],
  "retention_patterns": [
    {"pattern": "...", "how_it_looks_in_text": "...", "where_in_video": ["00:00-00:05"], "reuse_rule": "..."}
  ],
  "visual_style": {
    "editing": "...",
    "shot_types": ["..."],
    "on_screen_text_style": "...",
    "typical_actions": ["..."]
  },
  "do_dont": {
    "do": ["..."],
    "dont": ["..."]
  },
  "generation_rules": [
    "Правило 1: ...",
    "Правило 2: ...",
    "Правило 3: ...",
    "... (всего 8–15 правил)"
  ]
}

КРИТИЧЕСКИ ВАЖНО:
- Выведи ТОЛЬКО чистый JSON без каких-либо markdown обёрток
- JSON должен быть валидным и парсимым
- Все правила должны быть конкретными и исполняемыми
- В структуре обязательно должны быть hook и CTA
- Если длительность неизвестна, оцени примерно по количеству кадров`;

    if (onProgress) onProgress("🧬 Загружаю видео для анализа всех кадров...");
    const videoPart = await fileToGenerativePart(videoFile);
    
    if (onProgress) onProgress("🎬 Анализирую ВСЕ кадры последовательно (не только ключевые)...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [videoPart, { text: shortsAnalysisPrompt }]
      },
      config: {
        temperature: 0.3,
      }
    });

    const responseText = response.text || "{}";
    
    // Попытка извлечь JSON из ответа (на случай если модель обернула в markdown)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
    }

    try {
      const stylePassport = JSON.parse(jsonText);
      return { 
        text: "✅ Паспорт стиля успешно сгенерирован", 
        stylePassport 
      };
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      return { 
        text: `⚠️ Получен ответ, но JSON невалидный:\n\n${responseText}`,
        stylePassport: null
      };
    }
  } catch (error: any) { 
    throw processGeminiError(error); 
  }
};
