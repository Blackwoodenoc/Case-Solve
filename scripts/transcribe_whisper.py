#!/usr/bin/env python3
"""
Whisper транскрипция аудио файла
Использует openai-whisper для транскрипции
"""

import sys
import json
import os

try:
    import whisper
except ImportError:
    print(json.dumps({
        "error": "Whisper не установлен. Установите: pip install openai-whisper",
        "code": "WHISPER_NOT_INSTALLED"
    }), file=sys.stderr)
    sys.exit(1)

def transcribe_audio(audio_path, model_name="base", language=None):
    """
    Транскрибирует аудио файл используя Whisper
    
    Args:
        audio_path: Путь к аудио файлу
        model_name: Модель Whisper (tiny, base, small, medium, large)
        language: Язык (None для автоопределения)
    
    Returns:
        dict с транскриптом и метаданными
    """
    try:
        # Проверяем существование файла
        if not os.path.exists(audio_path):
            return {
                "error": f"Аудио файл не найден: {audio_path}",
                "code": "FILE_NOT_FOUND"
            }
        
        # Загружаем модель
        print(f"Загружаю модель Whisper: {model_name}...", file=sys.stderr)
        model = whisper.load_model(model_name)
        
        # Транскрибируем
        print(f"Транскрибирую аудио: {audio_path}...", file=sys.stderr)
        result = model.transcribe(
            audio_path,
            language=language,
            task="transcribe",
            verbose=False
        )
        
        # Извлекаем текст
        text = result["text"].strip()
        
        # Собираем сегменты с временными метками
        segments = []
        if "segments" in result:
            for seg in result["segments"]:
                segments.append({
                    "start": seg.get("start", 0),
                    "end": seg.get("end", 0),
                    "text": seg.get("text", "").strip()
                })
        
        return {
            "success": True,
            "text": text,
            "language": result.get("language", "unknown"),
            "segments": segments,
            "duration": result.get("duration", 0)
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "code": "TRANSCRIPTION_ERROR"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Использование: python transcribe_whisper.py <audio_path> [model] [language]",
            "code": "INVALID_ARGS"
        }), file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    language = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = transcribe_audio(audio_path, model_name, language)
    print(json.dumps(result, ensure_ascii=False))



