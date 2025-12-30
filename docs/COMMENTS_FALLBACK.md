# 🔄 Fallback варианты извлечения комментариев

Если основной метод не работает, используйте эти альтернативные варианты.

---

## 📸 Instagram

### Текущий: instaloader ✅
**Статус:** Реализовано и работает

### Fallback 1: instagrapi
**Когда использовать:** Если instaloader не работает или заблокирован

**Установка:**
```bash
pip install instagrapi
```

**Создать скрипт:** `scripts/download/extract_instagram_comments_instagrapi.py`

**Код:** См. `docs/COMMENTS_CODE_EXAMPLES.md` → Instagram → Вариант 2

**Добавить в server.js:**
```javascript
// Альтернативный эндпоинт
app.post('/api/instagram-comments-v2', async (req, res) => {
  // Использовать instagrapi скрипт
});
```

---

### Fallback 2: Playwright (для публичных постов)
**Когда использовать:** Если нужны комментарии без авторизации

**Установка:**
```bash
pip install playwright
playwright install chromium
```

**Создать скрипт:** `scripts/download/extract_instagram_comments_playwright.py`

**Преимущества:**
- Не требует авторизацию для публичных постов
- Работает как браузер

**Недостатки:**
- Медленнее
- Может быть заблокирован

---

## 🎵 TikTok

### Текущий: Playwright ✅
**Статус:** Реализовано и работает

### Fallback 1: TikTokApi
**Когда использовать:** Если Playwright не работает или слишком медленно

**Установка:**
```bash
pip install TikTokApi
```

**Создать скрипт:** `scripts/download/extract_tiktok_comments_api.py`

**Код:** См. `docs/COMMENTS_CODE_EXAMPLES.md` → TikTok → Вариант 2

**Добавить в server.js:**
```javascript
// Альтернативный эндпоинт
app.post('/api/tiktok-comments-v2', async (req, res) => {
  // Использовать TikTokApi скрипт
});
```

**Преимущества:**
- Быстрее чем Playwright
- Не требует браузер

**Недостатки:**
- Менее надежно (может сломаться при обновлении TikTok)
- Может быть заблокирован

---

### Fallback 2: requests + парсинг HTML
**Когда использовать:** Если TikTokApi не работает

**Сложность:** ⭐⭐⭐ Высокая

**Требует:**
- Обратную инженерию TikTok API
- Эмуляцию JavaScript запросов
- Постоянное обновление при изменениях TikTok

**Не рекомендуется** из-за сложности поддержки

---

## 📺 YouTube

### Текущий: yt-dlp ✅
**Статус:** Работает

### Fallback 1: YouTube Data API v3
**Когда использовать:** Если нужны все комментарии (больше 500)

**Установка:**
```bash
npm install googleapis
```

**Настройка:**
1. Получить API ключ: https://console.cloud.google.com/
2. Добавить в `.env`: `YOUTUBE_API_KEY=your_key`

**Код:** См. `docs/COMMENTS_CODE_EXAMPLES.md` → YouTube → Вариант 2

**Добавить в server.js:**
```javascript
// Альтернативный эндпоинт
app.post('/api/youtube-comments-api', async (req, res) => {
  // Использовать YouTube Data API
});
```

**Преимущества:**
- Официальный API
- Можно получить все комментарии
- Поддержка пагинации

**Недостатки:**
- Требует API ключ
- Лимит: 10,000 запросов/день (бесплатно)

---

### Fallback 2: youtube-comment-downloader
**Когда использовать:** Если yt-dlp не работает

**Установка:**
```bash
pip install youtube-comment-downloader
```

**Создать скрипт:** `scripts/download/extract_youtube_comments_downloader.py`

**Код:**
```python
from youtube_comment_downloader import YoutubeCommentDownloader

downloader = YoutubeCommentDownloader()
comments = downloader.get_comments(video_id, sort_by=SORT_BY_POPULAR)
```

---

## 🔄 Автоматический fallback

Можно реализовать автоматический переход на fallback:

```javascript
app.post('/api/comments-with-fallback', async (req, res) => {
  const { url, platform } = req.body;
  
  try {
    // Пробуем основной метод
    return await tryMainMethod(url, platform);
  } catch (error) {
    console.log('⚠️ Основной метод не сработал, пробуем fallback...');
    
    // Пробуем fallback
    try {
      return await tryFallbackMethod(url, platform);
    } catch (fallbackError) {
      return res.status(500).json({
        error: 'Все методы не сработали',
        main_error: error.message,
        fallback_error: fallbackError.message
      });
    }
  }
});
```

---

## 📋 Чеклист для перехода на fallback

### Instagram
- [ ] instaloader не работает
- [ ] Установлен instagrapi: `pip install instagrapi`
- [ ] Создан скрипт `extract_instagram_comments_instagrapi.py`
- [ ] Добавлен эндпоинт `/api/instagram-comments-v2`
- [ ] Протестирован на реальных постах

### TikTok
- [ ] Playwright не работает или слишком медленно
- [ ] Установлен TikTokApi: `pip install TikTokApi`
- [ ] Создан скрипт `extract_tiktok_comments_api.py`
- [ ] Добавлен эндпоинт `/api/tiktok-comments-v2`
- [ ] Протестирован на реальных видео

### YouTube
- [ ] yt-dlp не работает
- [ ] Установлен googleapis: `npm install googleapis`
- [ ] Получен API ключ YouTube
- [ ] Добавлен эндпоинт `/api/youtube-comments-api`
- [ ] Протестирован на реальных видео

---

## 🎯 Рекомендации

1. **Всегда начинайте с основного метода** (уже реализовано)
2. **Если не работает** - проверьте логи и ошибки
3. **Переходите на fallback** только если основной метод действительно не работает
4. **Документируйте** какой метод используется для каждого случая

---

**Готово к использованию fallback вариантов!** 🔄





