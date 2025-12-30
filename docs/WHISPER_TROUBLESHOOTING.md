# 🔧 Устранение проблем с Whisper

## ❌ Проблема: "Не могу установить Whisper"

### Решение 1: Обновление pip

```bash
python -m pip install --upgrade pip
python -m pip install openai-whisper
```

### Решение 2: Установка с правами пользователя

```bash
python -m pip install --user openai-whisper
```

### Решение 3: Установка через pipx (изолированная среда)

```bash
pip install pipx
pipx install openai-whisper
```

### Решение 4: Установка зависимостей вручную

Whisper требует несколько зависимостей. Установите их по отдельности:

```bash
python -m pip install torch torchvision torchaudio
python -m pip install openai-whisper
```

### Решение 5: Использование conda (если установлен)

```bash
conda install -c conda-forge openai-whisper
```

## ❌ Проблема: "ModuleNotFoundError: No module named 'whisper'"

### Причина:
Whisper установлен в другом окружении Python, чем то, которое использует сервер.

### Решение:

1. **Проверьте, какой Python использует сервер:**
   ```bash
   python --version
   python3 --version
   ```

2. **Установите Whisper в правильное окружение:**
   ```bash
   python -m pip install openai-whisper
   # или
   python3 -m pip install openai-whisper
   ```

3. **Проверьте установку:**
   ```bash
   python -c "import whisper; print('OK')"
   ```

## ❌ Проблема: "Permission denied" или "Access denied"

### Решение 1: Использование --user флага

```bash
python -m pip install --user openai-whisper
```

### Решение 2: Запуск от имени администратора

На Windows:
1. Откройте PowerShell или CMD от имени администратора
2. Выполните: `python -m pip install openai-whisper`

## ❌ Проблема: "pip не найден"

### Решение:

1. **Переустановите Python** с опцией "Add Python to PATH"
2. Или добавьте Python в PATH вручную:
   - Найдите путь к Python (обычно `C:\Python3X\` или `C:\Users\YourName\AppData\Local\Programs\Python\`)
   - Добавьте в переменную PATH

## ❌ Проблема: Медленная установка или таймаут

### Решение:

1. **Используйте зеркало PyPI:**
   ```bash
   python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple openai-whisper
   ```

2. **Увеличьте таймаут:**
   ```bash
   python -m pip install --default-timeout=100 openai-whisper
   ```

## ❌ Проблема: Ошибки компиляции (особенно на Windows)

### Решение:

1. **Установите Visual C++ Build Tools:**
   - Скачайте с https://visualstudio.microsoft.com/downloads/
   - Установите "Desktop development with C++"

2. **Или используйте предкомпилированные пакеты:**
   ```bash
   python -m pip install --only-binary :all: openai-whisper
   ```

## ✅ Диагностика проблем

Запустите диагностический скрипт:

```bash
node scripts/check-whisper.js
```

Скрипт проверит:
- ✅ Наличие Python
- ✅ Наличие pip
- ✅ Установку Whisper
- ✅ Наличие скрипта транскрипции

## 🔄 Альтернативное решение: Node.js версия

Если Python версия не работает, можно использовать Node.js версию Whisper через `@xenova/transformers`.

### Установка:

```bash
npm install @xenova/transformers
```

### Преимущества:
- ✅ Не требует Python
- ✅ Работает полностью в Node.js
- ✅ Легче установить

### Недостатки:
- ⚠️ Может быть медленнее
- ⚠️ Требует больше памяти

## 📞 Если ничего не помогает

1. **Проверьте версию Python:**
   ```bash
   python --version
   ```
   Должна быть 3.8 или выше.

2. **Проверьте pip:**
   ```bash
   python -m pip --version
   ```

3. **Попробуйте виртуальное окружение:**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   pip install openai-whisper
   ```

4. **Проверьте логи ошибок:**
   - Скопируйте полный текст ошибки
   - Проверьте, есть ли упоминания о конкретных модулях

5. **Используйте альтернативу:**
   - Система будет работать без Whisper (Gemini извлечет транскрипт сам)
   - Или используйте Node.js версию

## 💡 Полезные команды

```bash
# Проверка установки
python -c "import whisper; print(whisper.__version__)"

# Переустановка
python -m pip uninstall openai-whisper
python -m pip install openai-whisper

# Обновление
python -m pip install --upgrade openai-whisper

# Список установленных пакетов
python -m pip list | findstr whisper
```





