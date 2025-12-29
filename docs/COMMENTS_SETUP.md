# 🚀 Установка и настройка извлечения комментариев

## ✅ Что реализовано

### YouTube
- ✅ **yt-dlp** - уже работает
- Эндпоинт: `POST /api/youtube-comments`

### Instagram  
- ✅ **instaloader** - реализовано
- Эндпоинт: `POST /api/instagram-comments`
- Скрипт: `scripts/download/extract_instagram_comments.py`

### TikTok
- ✅ **Playwright** - реализовано
- Эндпоинт: `POST /api/tiktok-comments`
- Скрипт: `scripts/download/extract_tiktok_comments_playwright.py`

### Универсальный эндпоинт
- ✅ `POST /api/comments` - автоматически определяет платформу

---

## 📦 Установка зависимостей

### 1. Instagram (instaloader)
```bash
# Уже должно быть установлено, но если нет:
pip install instaloader
```

### 2. TikTok (Playwright)
```bash
# Установка Playwright
pip install playwright

# Установка браузера Chromium
playwright install chromium

# Для Windows может потребоваться:
playwright install-deps chromium
```

---

## 🔧 Настройка

### Instagram (опционально)
Для приватных постов нужна авторизация. Добавьте в `.env`:
```env
INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password
```

**⚠️ Внимание:** Использование логина/пароля может привести к блокировке аккаунта. Рекомендуется использовать сессию instaloader.

### TikTok
Дополнительная настройка не требуется. Playwright работает автоматически.

---

## 📡 Использование API

### Универсальный эндпоинт (рекомендуется)
```javascript
// Автоматически определяет платформу
POST /api/comments
Body: {
  "url": "https://www.instagram.com/reel/...",
  "maxComments": 500  // опционально
}
```

### Прямые эндпоинты

#### YouTube
```javascript
POST /api/youtube-comments
Body: {
  "url": "https://www.youtube.com/watch?v=..."
}
```

#### Instagram
```javascript
POST /api/instagram-comments
Body: {
  "url": "https://www.instagram.com/reel/...",
  "username": "optional",  // для приватных постов
  "password": "optional",  // для приватных постов
  "maxComments": 500
}
```

#### TikTok
```javascript
POST /api/tiktok-comments
Body: {
  "url": "https://www.tiktok.com/@username/video/...",
  "maxComments": 500
}
```

---

## 📋 Формат ответа

Все эндпоинты возвращают одинаковый формат:

```json
{
  "success": true,
  "video_id": "shortcode_or_id",
  "video_url": "original_url",
  "count": 150,
  "comments": [
    {
      "id": "comment_id",
      "author": "username",
      "text": "Текст комментария",
      "like_count": 42,
      "created_at": "2024-01-01T12:00:00",
      "is_pinned": false,
      "replies": []
    }
  ],
  "metadata": {
    // Дополнительные метаданные в зависимости от платформы
  }
}
```

---

## ⚠️ Troubleshooting

### Instagram

**Ошибка: "Требуется авторизация"**
- Решение: Укажите `username` и `password` в запросе
- Или используйте сессию instaloader

**Ошибка: "Приватный профиль"**
- Решение: Нужна авторизация и подписка на профиль

**Ошибка: "Неверные учетные данные"**
- Решение: Проверьте логин/пароль
- Или используйте сессию вместо логина/пароля

### TikTok

**Ошибка: "Playwright не найден"**
```bash
pip install playwright
playwright install chromium
```

**Ошибка: "Браузер не запускается"**
```bash
# Для Linux может потребоваться:
playwright install-deps chromium

# Для Windows обычно работает из коробки
```

**Ошибка: "Комментарии не найдены"**
- TikTok может блокировать автоматизацию
- Попробуйте позже или используйте fallback вариант (TikTokApi)

---

## 🔄 Fallback варианты (если основной не работает)

### Instagram → instagrapi
Если instaloader не работает, можно использовать instagrapi:
```bash
pip install instagrapi
```
См. `docs/COMMENTS_CODE_EXAMPLES.md` → Вариант 2

### TikTok → TikTokApi
Если Playwright не работает, можно использовать TikTokApi:
```bash
pip install TikTokApi
```
См. `docs/COMMENTS_CODE_EXAMPLES.md` → Вариант 2

---

## 🧪 Тестирование

### Тест Instagram
```bash
curl -X POST http://localhost:3003/api/instagram-comments \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/..."}'
```

### Тест TikTok
```bash
curl -X POST http://localhost:3003/api/tiktok-comments \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@username/video/..."}'
```

### Тест универсального эндпоинта
```bash
curl -X POST http://localhost:3003/api/comments \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/..."}'
```

---

## 📊 Производительность

- **YouTube**: ~5-10 секунд для 200-500 комментариев
- **Instagram**: ~10-30 секунд для 500 комментариев (зависит от авторизации)
- **TikTok**: ~30-60 секунд для 500 комментариев (зависит от скорости прокрутки)

---

## 🔒 Безопасность

- **Не храните** логины/пароли в коде
- Используйте переменные окружения для чувствительных данных
- Instagram может заблокировать аккаунт при частых запросах
- TikTok может блокировать IP при подозрительной активности

---

## 📝 Примечания

- Instagram комментарии требуют авторизацию для приватных постов
- TikTok комментарии извлекаются через браузер (медленнее, но надежнее)
- Все скрипты логируют прогресс в stderr для отладки

---

**Готово к использованию!** 🎉


