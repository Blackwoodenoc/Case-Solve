# 🚀 Быстрое решение проблем с Whisper

## ✅ Проверка установки

Запустите диагностику:
```bash
node scripts/check-whisper.js
```

## 🔧 Если Whisper не установлен

### Вариант 1: Стандартная установка
```bash
python -m pip install openai-whisper
```

### Вариант 2: С обновлением pip
```bash
python -m pip install --upgrade pip
python -m pip install openai-whisper
```

### Вариант 3: С правами пользователя
```bash
python -m pip install --user openai-whisper
```

### Вариант 4: От имени администратора
1. Откройте PowerShell или CMD от имени администратора
2. Выполните:
```bash
python -m pip install openai-whisper
```

## ⚠️ Важно!

**Если Whisper не устанавливается, система все равно будет работать!**

- Gemini может извлечь транскрипт из видео самостоятельно
- Анализ будет выполняться, но может быть менее точным
- Вы увидите предупреждение, но анализ продолжится

## 📚 Подробная помощь

См. [docs/WHISPER_TROUBLESHOOTING.md](docs/WHISPER_TROUBLESHOOTING.md) для детальных решений всех проблем.


