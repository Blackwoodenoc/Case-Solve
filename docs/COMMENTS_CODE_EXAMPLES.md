# 💻 Примеры кода для извлечения комментариев

## 📺 YouTube

### Вариант 1: yt-dlp (уже реализовано)
```javascript
// server.js - уже есть
app.post('/api/youtube-comments', async (req, res) => {
  const { url } = req.body;
  const videoId = extractVideoId(url);
  
  const ytdlpArgs = [
    '--write-comments',
    '--write-info-json',
    '--skip-download',
    '--extractor-args', 'youtube:comment_sort=top',
    '-o', path.join(TEMP_DIR, `${videoId}_comments`),
    url
  ];
  
  // ... существующий код
});
```

### Вариант 2: YouTube Data API v3
```javascript
// Установка: npm install googleapis
const { google } = require('googleapis');

// Новый эндпоинт в server.js
app.post('/api/youtube-comments-api', async (req, res) => {
  const { url, maxResults = 100 } = req.body;
  const videoId = extractVideoId(url);
  
  if (!process.env.YOUTUBE_API_KEY) {
    return res.status(500).json({ 
      error: 'YOUTUBE_API_KEY не настроен' 
    });
  }
  
  try {
    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
    
    let allComments = [];
    let nextPageToken = null;
    
    do {
      const response = await youtube.commentThreads.list({
        part: 'snippet,replies',
        videoId: videoId,
        maxResults: Math.min(maxResults, 100),
        order: 'relevance',
        pageToken: nextPageToken
      });
      
      const comments = response.data.items.map(item => ({
        id: item.id,
        author: item.snippet.topLevelComment.snippet.authorDisplayName,
        text: item.snippet.topLevelComment.snippet.textDisplay,
        like_count: item.snippet.topLevelComment.snippet.likeCount,
        reply_count: item.snippet.totalReplyCount || 0,
        published_at: item.snippet.topLevelComment.snippet.publishedAt,
        is_pinned: item.snippet.isPublic,
        replies: (item.replies?.comments || []).map(reply => ({
          id: reply.id,
          author: reply.snippet.authorDisplayName,
          text: reply.snippet.textDisplay,
          like_count: reply.snippet.likeCount,
          published_at: reply.snippet.publishedAt
        }))
      }));
      
      allComments = allComments.concat(comments);
      nextPageToken = response.data.nextPageToken;
      
    } while (nextPageToken && allComments.length < maxResults);
    
    res.json({
      success: true,
      video_id: videoId,
      count: allComments.length,
      comments: allComments
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Ошибка получения комментариев',
      details: error.message 
    });
  }
});
```

---

## 📸 Instagram

### Вариант 1: instaloader (уже в проекте)
```python
# scripts/download/extract_instagram_comments.py
#!/usr/bin/env python3
import sys
import json
import instaloader
from pathlib import Path

def extract_comments(url, username=None, password=None):
    """
    Извлекает комментарии из Instagram Reels/поста
    """
    L = instaloader.Instaloader()
    
    # Авторизация (если нужно)
    if username and password:
        try:
            L.login(username, password)
        except Exception as e:
            print(f"⚠️ Ошибка авторизации: {e}", file=sys.stderr)
            # Продолжаем без авторизации для публичных постов
    
    # Извлекаем shortcode из URL
    shortcode = url.split('/p/')[-1].split('/')[0] if '/p/' in url else \
                url.split('/reel/')[-1].split('/')[0] if '/reel/' in url else None
    
    if not shortcode:
        return {"success": False, "error": "Неверный URL Instagram"}
    
    try:
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        comments_data = []
        comment_count = 0
        max_comments = 500  # Лимит комментариев
        
        for comment in post.get_comments():
            if comment_count >= max_comments:
                break
                
            comments_data.append({
                "id": comment.id,
                "author": comment.owner.username,
                "text": comment.text,
                "like_count": comment.likes_count,
                "created_at": comment.created_at_utc.isoformat() if comment.created_at_utc else None,
                "is_pinned": False,  # instaloader не поддерживает
                "replies": []  # Можно добавить получение ответов
            })
            comment_count += 1
        
        return {
            "success": True,
            "video_id": shortcode,
            "count": len(comments_data),
            "comments": comments_data
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL не указан"}))
        sys.exit(1)
    
    url = sys.argv[1]
    username = sys.argv[2] if len(sys.argv) > 2 else None
    password = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = extract_comments(url, username, password)
    print(json.dumps(result, ensure_ascii=False))
```

```javascript
// Добавить в server.js
app.post('/api/instagram-comments', async (req, res) => {
  const { url, username, password } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }
  
  const scriptPath = path.join(__dirname, 'scripts', 'download', 'extract_instagram_comments.py');
  const args = [scriptPath, url];
  
  if (username) args.push(username);
  if (password) args.push(password);
  
  const python = spawn('python', args);
  
  let stdoutData = '';
  let stderrData = '';
  
  python.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });
  
  python.stderr.on('data', (data) => {
    stderrData += data.toString();
  });
  
  python.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        error: 'Ошибка извлечения комментариев',
        details: stderrData
      });
    }
    
    try {
      const result = JSON.parse(stdoutData);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Ошибка парсинга результата',
        details: error.message
      });
    }
  });
});
```

### Вариант 2: instagrapi
```python
# scripts/download/extract_instagram_comments_instagrapi.py
#!/usr/bin/env python3
import sys
import json
from instagrapi import Client

def extract_comments(url, username, password):
    """
    Извлекает комментарии через instagrapi
    """
    cl = Client()
    
    try:
        cl.login(username, password)
    except Exception as e:
        return {"success": False, "error": f"Ошибка авторизации: {e}"}
    
    # Извлекаем shortcode
    shortcode = url.split('/p/')[-1].split('/')[0] if '/p/' in url else \
                url.split('/reel/')[-1].split('/')[0] if '/reel/' in url else None
    
    if not shortcode:
        return {"success": False, "error": "Неверный URL"}
    
    try:
        media_id = cl.media_id(shortcode)
        comments = cl.media_comments(media_id, amount=500)
        
        comments_data = [{
            "id": comment.pk,
            "author": comment.user.username,
            "text": comment.text,
            "like_count": comment.like_count,
            "created_at": comment.created_at_utc.isoformat() if comment.created_at_utc else None,
            "is_pinned": comment.is_pinned,
            "replies": []  # Можно добавить получение ответов
        } for comment in comments]
        
        return {
            "success": True,
            "video_id": shortcode,
            "count": len(comments_data),
            "comments": comments_data
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Недостаточно параметров"}))
        sys.exit(1)
    
    url = sys.argv[1]
    username = sys.argv[2]
    password = sys.argv[3]
    
    result = extract_comments(url, username, password)
    print(json.dumps(result, ensure_ascii=False))
```

---

## 🎵 TikTok

### Вариант 1: Playwright
```python
# scripts/download/extract_tiktok_comments_playwright.py
#!/usr/bin/env python3
import sys
import json
import time
from playwright.sync_api import sync_playwright

def extract_comments(url, max_comments=500):
    """
    Извлекает комментарии из TikTok через Playwright
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            page.goto(url, wait_until='networkidle')
            time.sleep(3)  # Ждем загрузки
            
            comments_data = []
            scroll_count = 0
            max_scrolls = 20
            
            # Прокручиваем для загрузки комментариев
            while len(comments_data) < max_comments and scroll_count < max_scrolls:
                # Ищем комментарии в DOM
                comment_elements = page.query_selector_all('[data-e2e="comment-item"]')
                
                for element in comment_elements:
                    try:
                        author = element.query_selector('[data-e2e="comment-username"]')
                        text = element.query_selector('[data-e2e="comment-level-1"]')
                        likes = element.query_selector('[data-e2e="comment-like-count"]')
                        
                        if author and text:
                            comment_id = element.get_attribute('data-comment-id') or f"tt_{len(comments_data)}"
                            
                            # Проверяем, не добавлен ли уже
                            if not any(c['id'] == comment_id for c in comments_data):
                                comments_data.append({
                                    "id": comment_id,
                                    "author": author.inner_text(),
                                    "text": text.inner_text(),
                                    "like_count": int(likes.inner_text()) if likes else 0,
                                    "created_at": None,  # Сложно извлечь без API
                                    "is_pinned": False,
                                    "replies": []
                                })
                    except Exception as e:
                        continue
                
                # Прокручиваем вниз
                page.evaluate("window.scrollBy(0, 1000)")
                time.sleep(2)
                scroll_count += 1
                
                # Если не появилось новых комментариев, прекращаем
                if len(comment_elements) == len(comments_data):
                    break
            
            # Извлекаем video_id из URL
            video_id = url.split('/video/')[-1].split('?')[0] if '/video/' in url else 'unknown'
            
            return {
                "success": True,
                "video_id": video_id,
                "count": len(comments_data),
                "comments": comments_data[:max_comments]
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            browser.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL не указан"}))
        sys.exit(1)
    
    url = sys.argv[1]
    max_comments = int(sys.argv[2]) if len(sys.argv) > 2 else 500
    
    result = extract_comments(url, max_comments)
    print(json.dumps(result, ensure_ascii=False))
```

```javascript
// Добавить в server.js
app.post('/api/tiktok-comments', async (req, res) => {
  const { url, maxComments = 500 } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }
  
  const scriptPath = path.join(__dirname, 'scripts', 'download', 'extract_tiktok_comments_playwright.py');
  const python = spawn('python', [scriptPath, url, maxComments.toString()]);
  
  let stdoutData = '';
  let stderrData = '';
  
  python.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });
  
  python.stderr.on('data', (data) => {
    stderrData += data.toString();
  });
  
  python.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        error: 'Ошибка извлечения комментариев',
        details: stderrData
      });
    }
    
    try {
      const result = JSON.parse(stdoutData);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Ошибка парсинга результата',
        details: error.message
      });
    }
  });
});
```

### Вариант 2: TikTokApi
```python
# scripts/download/extract_tiktok_comments_api.py
#!/usr/bin/env python3
import sys
import json
from TikTokApi import TikTokApi

def extract_comments(url, max_comments=500):
    """
    Извлекает комментарии через TikTokApi
    """
    try:
        api = TikTokApi()
        
        # Извлекаем video_id из URL
        video_id = url.split('/video/')[-1].split('?')[0] if '/video/' in url else None
        
        if not video_id:
            return {"success": False, "error": "Неверный URL TikTok"}
        
        video = api.video(id=video_id)
        comments = video.comments(count=max_comments)
        
        comments_data = [{
            "id": comment.get('cid', f"tt_{i}"),
            "author": comment.get('user', {}).get('nickname', 'Unknown'),
            "text": comment.get('text', ''),
            "like_count": comment.get('digg_count', 0),
            "created_at": None,  # API может не предоставлять
            "is_pinned": comment.get('is_pinned', False),
            "replies": []  # Можно добавить получение ответов
        } for i, comment in enumerate(comments)]
        
        return {
            "success": True,
            "video_id": video_id,
            "count": len(comments_data),
            "comments": comments_data
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL не указан"}))
        sys.exit(1)
    
    url = sys.argv[1]
    max_comments = int(sys.argv[2]) if len(sys.argv) > 2 else 500
    
    result = extract_comments(url, max_comments)
    print(json.dumps(result, ensure_ascii=False))
```

---

## 🔧 Универсальный эндпоинт

```javascript
// Добавить в server.js - универсальный эндпоинт для всех платформ
app.post('/api/comments', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }
  
  // Определяем платформу
  let platform = 'unknown';
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    platform = 'youtube';
  } else if (url.includes('instagram.com')) {
    platform = 'instagram';
  } else if (url.includes('tiktok.com')) {
    platform = 'tiktok';
  }
  
  // Перенаправляем на соответствующий эндпоинт
  switch (platform) {
    case 'youtube':
      // Используем существующий /api/youtube-comments
      // или новый /api/youtube-comments-api
      return res.redirect(307, '/api/youtube-comments');
      
    case 'instagram':
      return res.redirect(307, '/api/instagram-comments');
      
    case 'tiktok':
      return res.redirect(307, '/api/tiktok-comments');
      
    default:
      return res.status(400).json({ 
        error: 'Неподдерживаемая платформа',
        supported: ['youtube', 'instagram', 'tiktok']
      });
  }
});
```

---

## 📦 Установка зависимостей

### Python библиотеки:
```bash
# Для Instagram
pip install instaloader
# или
pip install instagrapi

# Для TikTok
pip install playwright
playwright install chromium
# или
pip install TikTokApi

# Для YouTube (уже есть)
pip install yt-dlp
```

### Node.js библиотеки:
```bash
# Для YouTube API
npm install googleapis
```

---

## ⚙️ Настройка переменных окружения

Добавить в `.env`:
```env
# YouTube Data API (опционально)
YOUTUBE_API_KEY=your_api_key_here

# Instagram (опционально, для авторизации)
INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password
```

---

## 🎯 Следующие шаги

1. Выберите варианты из `COMMENTS_QUICK_GUIDE.md`
2. Используйте примеры кода из этого файла
3. Настройте зависимости
4. Протестируйте на реальных видео

**Готов помочь с реализацией выбранных вариантов!** 🚀



