# 🎤 Настройка Whisper для транскрипции аудио

Whisper используется для точной транскрипции речи из видео, что значительно улучшает качество анализа "Паспорта стиля".

## 📋 Требования

- Python 3.8 или выше
- pip (менеджер пакетов Python)
- ffmpeg (уже включен в проект в `tools/ffmpeg/`)

## 🚀 Установка

### Шаг 1: Установите Whisper

```bash
pip install openai-whisper
```

Или через pipx (рекомендуется для изоляции):

```bash
pipx install openai-whisper
```

### Шаг 2: Проверьте установку

```bash
python -c "import whisper; print('Whisper установлен успешно!')"
```

### Шаг 3: Проверьте доступность в проекте

Запустите сервер и проверьте health endpoint:

```bash
npm run dev:server
```

Затем откройте в браузере: `http://localhost:3003/health`

В ответе должно быть:

```json
{
  "whisper": {
    "available": true,
    "method": "python",
    "version": "installed"
  }
}
```

## 🎯 Использование

Whisper автоматически используется при анализе "ДНК Shorts":

1. Загрузите видео файл
2. Нажмите "🧬 Анализ ДНК Shorts"
3. Система автоматически:
   - Извлечет аудио из видео через ffmpeg
   - Транскрибирует через Whisper
   - Использует транскрипт для улучшения анализа паспорта стиля

## 📊 Модели Whisper

Доступные модели (от меньшей к большей, от быстрой к точной):

- `tiny` - самая быстрая, наименее точная (~39 MB)
- `base` - баланс скорости и точности (~74 MB, **по умолчанию**)
- `small` - более точная (~244 MB)
- `medium` - высокая точность (~769 MB)
- `large` - максимальная точность (~1550 MB)

Модель загружается автоматически при первом использовании.

## ⚙️ Настройка модели

По умолчанию используется модель `base`. Чтобы изменить модель, отредактируйте вызов в `App.tsx`:

```typescript
const transcriptionResult = await transcribeVideo(video.file, 'small', null, setProgressMsg);
```

## 🔧 Устранение проблем

### 🔍 Диагностика проблем

**Запустите диагностический скрипт:**
```bash
node scripts/check-whisper.js
```

Скрипт проверит все компоненты и покажет, что именно не работает.

### ❌ Ошибка: "Whisper не установлен"

**Решение 1 (стандартное):**
```bash
python -m pip install openai-whisper
```

**Решение 2 (если не работает):**
```bash
python -m pip install --upgrade pip
python -m pip install openai-whisper
```

**Решение 3 (с правами пользователя):**
```bash
python -m pip install --user openai-whisper
```

**Решение 4 (через pipx - изолированная среда):**
```bash
pip install pipx
pipx install openai-whisper
```

### ❌ Ошибка: "Python не найден"

**Решение:**
- Убедитесь, что Python установлен: `python --version`
- Или используйте `python3`: `python3 --version`
- Добавьте Python в PATH
- Переустановите Python с опцией "Add Python to PATH"

### ❌ Ошибка: "Permission denied" или "Access denied"

**Решение:**
```bash
python -m pip install --user openai-whisper
```

Или запустите командную строку от имени администратора.

### ❌ Ошибка: "ffmpeg не найден"

**Решение:**
- Проект уже содержит ffmpeg в `tools/ffmpeg/`
- Или установите системный ffmpeg

### ⚠️ Медленная транскрипция

**Решение:**
- Используйте меньшую модель (`tiny` или `base`)
- Или используйте GPU версию Whisper (требует CUDA)

### 📚 Подробное руководство

Если ничего не помогает, см. подробное руководство: **[WHISPER_TROUBLESHOOTING.md](./WHISPER_TROUBLESHOOTING.md)**

### 💡 Важно

**Если Whisper не установлен, система все равно будет работать!**
- Gemini может извлечь транскрипт из видео самостоятельно
- Анализ будет выполняться, но может быть менее точным

## 📝 Технические детали

### Процесс транскрипции:

1. **Извлечение аудио** (`server.js`):
   - Использует ffmpeg для извлечения аудио в WAV формат
   - Частота дискретизации: 16kHz (оптимально для Whisper)
   - Моно канал

2. **Транскрипция** (`scripts/transcribe_whisper.py`):
   - Загружает модель Whisper
   - Транскрибирует аудио
   - Возвращает текст и сегменты с временными метками

3. **Использование в анализе** (`services/geminiService.ts`):
   - Транскрипт передается в промпт для Gemini
   - Используется для точного анализа tone_of_voice, speech_pace
   - Сохраняется в паспорте стиля

### API Endpoints:

- `POST /api/transcribe-video` - транскрипция загруженного видео файла
- `POST /api/transcribe-audio` - транскрипция аудио файла на сервере

## 🎓 Дополнительная информация

- [Документация Whisper](https://github.com/openai/whisper)
- [Модели и их характеристики](https://github.com/openai/whisper#available-models-and-languages)

