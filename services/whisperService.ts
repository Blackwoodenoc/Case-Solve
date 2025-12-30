/**
 * Сервис для транскрипции аудио через Whisper
 */

export interface TranscriptionResult {
  success: boolean;
  transcript: string;
  language: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  duration: number;
}

export interface TranscriptionError {
  error: string;
  code: string;
  hint?: string;
}

/**
 * Транскрибирует видео файл через Whisper API
 * @param videoFile - Файл видео для транскрипции
 * @param model - Модель Whisper (tiny, base, small, medium, large). По умолчанию 'base'
 * @param language - Язык (опционально, для автоопределения оставить null)
 * @param onProgress - Callback для отслеживания прогресса
 * @returns Promise с результатом транскрипции
 */
export const transcribeVideo = async (
  videoFile: File,
  model: string = 'base',
  language: string | null = null,
  onProgress?: (message: string) => void
): Promise<TranscriptionResult> => {
  try {
    if (onProgress) onProgress('📤 Загружаю видео на сервер...');
    
    // Читаем файл как ArrayBuffer
    const arrayBuffer = await videoFile.arrayBuffer();
    
    // Создаем заголовки
    const headers: HeadersInit = {
      'Content-Type': 'application/octet-stream',
      'X-Whisper-Model': model,
    };
    
    if (language) {
      headers['X-Whisper-Language'] = language;
    }
    
    if (onProgress) onProgress('🎵 Извлекаю аудио из видео...');
    
    // Отправляем запрос
    const response = await fetch('http://localhost:3003/api/transcribe-video', {
      method: 'POST',
      headers: headers,
      body: arrayBuffer,
    });
    
    if (!response.ok) {
      const errorData: TranscriptionError = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (onProgress) onProgress('🎤 Транскрибирую через Whisper...');
    
    const result: TranscriptionResult = await response.json();
    
    if (!result.success) {
      throw new Error('Транскрипция не удалась');
    }
    
    if (onProgress) onProgress(`✅ Транскрипция завершена (${result.transcript.length} символов)`);
    
    return result;
  } catch (error: any) {
    console.error('❌ Ошибка транскрипции:', error);
    throw error;
  }
};

/**
 * Транскрибирует аудио файл через Whisper API (если аудио уже извлечено)
 * @param audioPath - Путь к аудио файлу на сервере
 * @param model - Модель Whisper
 * @param language - Язык
 * @param onProgress - Callback для отслеживания прогресса
 * @returns Promise с результатом транскрипции
 */
export const transcribeAudio = async (
  audioPath: string,
  model: string = 'base',
  language: string | null = null,
  onProgress?: (message: string) => void
): Promise<TranscriptionResult> => {
  try {
    if (onProgress) onProgress('🎤 Транскрибирую аудио через Whisper...');
    
    const response = await fetch('http://localhost:3003/api/transcribe-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioPath,
        model,
        language,
      }),
    });
    
    if (!response.ok) {
      const errorData: TranscriptionError = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result: TranscriptionResult = await response.json();
    
    if (!result.success) {
      throw new Error('Транскрипция не удалась');
    }
    
    if (onProgress) onProgress(`✅ Транскрипция завершена (${result.transcript.length} символов)`);
    
    return result;
  } catch (error: any) {
    console.error('❌ Ошибка транскрипции:', error);
    throw error;
  }
};

/**
 * Проверяет доступность Whisper на сервере
 * @returns Promise с информацией о доступности
 */
export const checkWhisperAvailability = async (): Promise<{
  available: boolean;
  method: string | null;
  version: string;
  error: string | null;
}> => {
  try {
    const response = await fetch('http://localhost:3003/health');
    if (!response.ok) {
      return {
        available: false,
        method: null,
        version: 'unknown',
        error: `HTTP ${response.status}`,
      };
    }
    
    const data = await response.json();
    return {
      available: data.whisper?.available || false,
      method: data.whisper?.method || null,
      version: data.whisper?.version || 'unknown',
      error: data.whisper?.error || null,
    };
  } catch (error: any) {
    return {
      available: false,
      method: null,
      version: 'unknown',
      error: error.message || 'Не удалось проверить доступность Whisper',
    };
  }
};





