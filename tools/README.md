# 🛠️ Инструменты (Tools)

Эта папка содержит локальные версии инструментов для скачивания видео.

## 📦 Что здесь должно быть:

### yt-dlp.exe
Бинарник yt-dlp для Windows. Скачайте с:
- https://github.com/yt-dlp/yt-dlp/releases
- Выберите `yt-dlp.exe` для Windows

### ffmpeg/
Папка с ffmpeg (опционально, но рекомендуется). Содержит:
- `bin/ffmpeg.exe` - основной инструмент
- `bin/ffprobe.exe` - для анализа медиафайлов

Скачайте с:
- https://www.gyan.dev/ffmpeg/builds/ (Windows)
- Или https://ffmpeg.org/download.html

## ✅ Автоматическое использование

Приложение автоматически использует локальные инструменты, если они найдены в этой папке. Если локальные версии не найдены, приложение попытается использовать системные версии (через PATH).

## 🔍 Проверка

После размещения файлов, проверьте:

```bash
# Проверка yt-dlp
node scripts/test-ytdlp.js https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Проверка через health endpoint
curl http://localhost:3003/health
```

## 📝 Примечание

Эти файлы не коммитятся в Git (добавлены в .gitignore), так как они большие и могут быть скачаны отдельно.



