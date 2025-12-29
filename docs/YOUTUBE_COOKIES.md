# Если YouTube блокирует запросы, экспортируйте cookies из браузера

## Шаг 1: Установите расширение для экспорта cookies

### Chrome/Edge:
- Установите "Get cookies.txt LOCALLY" из Chrome Web Store

### Firefox:
- Установите "cookies.txt" расширение

## Шаг 2: Экспортируйте cookies

1. Откройте youtube.com в браузере (войдите в аккаунт)
2. Нажмите на расширение
3. Экспортируйте cookies для youtube.com
4. Сохраните как `youtube_cookies.txt` в папку проекта

## Шаг 3: Обновите server.js

Добавьте в параметры yt-dlp:
```javascript
'--cookies', path.join(__dirname, 'youtube_cookies.txt'),
```

## Альтернатива: Онлайн сервисы

Если не хотите возиться с cookies, используйте:

1. **y2mate.com**
   - Быстрый и надёжный
   - Поддерживает Shorts

2. **savefrom.net**
   - Простой интерфейс
   - MP4 скачивание

3. **loader.to**
   - Работает с Shorts
   - Без регистрации

Скачайте видео и загрузите через "Загрузить видео файл" в приложении.

