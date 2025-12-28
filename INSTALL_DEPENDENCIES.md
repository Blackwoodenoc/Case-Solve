# 📦 Установка зависимостей

## Python зависимости

### yt-dlp (обязательно)

`yt-dlp` используется для скачивания видео с YouTube и Instagram, а также для извлечения комментариев и субтитров.

**Установка:**

```bash
pip install yt-dlp
```

Или через pipx (рекомендуется для изоляции):

```bash
pipx install yt-dlp
```

**Проверка установки:**

```bash
yt-dlp --version
```

### instaloader (для Instagram)

Используется для скачивания Instagram Reels.

**Установка:**

```bash
pip install instaloader
```

### Другие Python зависимости

```bash
pip install selenium requests
```

## Node.js зависимости

Все зависимости уже указаны в `package.json`. Установите их командой:

```bash
npm install
```

## Настройка переменных окружения

1. Создайте файл `.env` в корне проекта:

```env
GEMINI_API_KEY=ваш_api_ключ_здесь
```

2. Получите API ключ Google Gemini:
   - Перейдите на https://aistudio.google.com/apikey
   - Создайте новый API ключ
   - Скопируйте его в `.env`

## Проверка установки

После установки всех зависимостей запустите сервер:

```bash
npm run dev:all
```

Сервер автоматически проверит наличие `yt-dlp` и выведет статус в консоль.

## Устранение проблем

### yt-dlp не найден

Если сервер сообщает, что `yt-dlp` не найден:

1. Убедитесь, что Python установлен: `python --version`
2. Установите yt-dlp: `pip install yt-dlp`
3. Проверьте, что yt-dlp доступен в PATH: `yt-dlp --version`
4. Если используете виртуальное окружение, убедитесь, что оно активировано

### Проблемы с правами доступа

На Windows может потребоваться запуск PowerShell от имени администратора для установки пакетов.

### Альтернативная установка yt-dlp

Если `pip install yt-dlp` не работает, попробуйте:

```bash
# Через pipx (рекомендуется)
pipx install yt-dlp

# Или скачайте standalone версию с GitHub
# https://github.com/yt-dlp/yt-dlp/releases
```


