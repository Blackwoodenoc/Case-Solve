#!/usr/bin/env python3
"""
Извлечение комментариев из YouTube через youtube-comment-downloader
Более надежный метод для получения комментариев
"""

import sys
import json
import re

def extract_video_id(url):
    """Извлекает video_id из URL YouTube"""
    # YouTube Shorts
    if '/shorts/' in url:
        match = re.search(r'/shorts/([a-zA-Z0-9_-]+)', url)
        if match:
            return match.group(1)
    
    # youtu.be
    if 'youtu.be/' in url:
        match = re.search(r'youtu\.be/([a-zA-Z0-9_-]+)', url)
        if match:
            return match.group(1)
    
    # youtube.com/watch
    match = re.search(r'[?&]v=([a-zA-Z0-9_-]+)', url)
    if match:
        return match.group(1)
    
    return None

def extract_comments(url, sort_by='top', max_comments=500):
    """
    Извлекает комментарии из YouTube через youtube-comment-downloader
    
    Args:
        url: URL YouTube видео
        sort_by: 'top' или 'newest' (по умолчанию 'top')
        max_comments: Максимальное количество комментариев
    
    Returns:
        dict: Результат с комментариями или ошибкой
    """
    video_id = extract_video_id(url)
    
    if not video_id:
        return {
            "success": False,
            "error": "Неверный URL YouTube. Используйте формат: https://www.youtube.com/watch?v=... или https://www.youtube.com/shorts/..."
        }
    
    try:
        # Пробуем импортировать youtube-comment-downloader
        try:
            from youtube_comment_downloader import YoutubeCommentDownloader
        except ImportError:
            return {
                "success": False,
                "error": "youtube-comment-downloader не установлен. Установите: pip install youtube-comment-downloader",
                "help": "pip install youtube-comment-downloader"
            }
        
        print(f"📥 Извлекаю комментарии для видео: {video_id}", file=sys.stderr)
        print(f"🔍 Сортировка: {sort_by}, макс. комментариев: {max_comments}", file=sys.stderr)
        
        downloader = YoutubeCommentDownloader()
        
        # Определяем тип сортировки
        if sort_by == 'top' or sort_by == 'popular':
            sort_mode = 0  # SORT_BY_POPULAR
        elif sort_by == 'newest' or sort_by == 'new':
            sort_mode = 1  # SORT_BY_NEWEST
        else:
            sort_mode = 0  # По умолчанию популярные
        
        # Извлекаем комментарии
        comments_data = []
        comment_count = 0
        
        print(f"💬 Начинаю извлечение комментариев...", file=sys.stderr)
        
        try:
            comments = downloader.get_comments(video_id, sort_by=sort_mode)
            
            for comment in comments:
                if comment_count >= max_comments:
                    break
                
                try:
                    comment_data = {
                        "id": comment.get('cid', f"yt_{comment_count}"),
                        "author": comment.get('author', {}).get('name', 'Unknown') if isinstance(comment.get('author'), dict) else comment.get('author', 'Unknown'),
                        "text": comment.get('text', ''),
                        "like_count": comment.get('votes', 0) or 0,
                        "reply_count": comment.get('reply_count', 0) or 0,
                        "published_at": comment.get('time', ''),
                        "is_pinned": comment.get('is_pinned', False),
                        "creator_hearted": comment.get('is_hearted', False),
                        "replies": []
                    }
                    
                    # Обрабатываем ответы, если есть
                    if comment.get('replies') and len(comment.get('replies', [])) > 0:
                        reply_count = 0
                        for reply in comment.get('replies', [])[:10]:  # Максимум 10 ответов
                            try:
                                comment_data["replies"].append({
                                    "id": reply.get('cid', f"reply_{reply_count}"),
                                    "author": reply.get('author', {}).get('name', 'Unknown') if isinstance(reply.get('author'), dict) else reply.get('author', 'Unknown'),
                                    "text": reply.get('text', ''),
                                    "like_count": reply.get('votes', 0) or 0,
                                    "published_at": reply.get('time', '')
                                })
                                reply_count += 1
                            except Exception as e:
                                print(f"⚠️ Ошибка обработки ответа: {e}", file=sys.stderr)
                                continue
                    
                    comments_data.append(comment_data)
                    comment_count += 1
                    
                    # Прогресс каждые 50 комментариев
                    if comment_count % 50 == 0:
                        print(f"📊 Извлечено {comment_count} комментариев...", file=sys.stderr)
                        
                except Exception as e:
                    print(f"⚠️ Ошибка обработки комментария: {e}", file=sys.stderr)
                    continue
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Ошибка извлечения комментариев: {str(e)}",
                "error_type": type(e).__name__
            }
        
        # Сортируем комментарии по лайкам (топ комментарии)
        comments_data.sort(key=lambda x: x.get('like_count', 0), reverse=True)
        
        print(f"✅ Извлечено {len(comments_data)} комментариев", file=sys.stderr)
        
        # Выводим топ-5 для проверки
        if comments_data:
            print(f"🔥 Топ-5 комментариев по лайкам:", file=sys.stderr)
            for i, comment in enumerate(comments_data[:5], 1):
                text_preview = comment['text'][:60] + '...' if len(comment['text']) > 60 else comment['text']
                print(f"  {i}. {comment['author']}: {text_preview} ({comment['like_count']} лайков)", file=sys.stderr)
        else:
            print(f"⚠️ Комментарии не найдены", file=sys.stderr)
        
        return {
            "success": True,
            "video_id": video_id,
            "video_url": url,
            "count": len(comments_data),
            "comments": comments_data,
            "top_comments": comments_data[:20],  # Топ-20 для удобства
            "sorted_by": "likes",
            "metadata": {
                "method": "youtube-comment-downloader",
                "sort_mode": sort_by,
                "has_replies": any(c.get('replies') for c in comments_data)
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Неожиданная ошибка: {str(e)}",
            "error_type": type(e).__name__
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        result = {
            "success": False,
            "error": "URL не указан. Использование: python extract_youtube_comments_suite.py <URL> [sort_by] [max_comments]",
            "example": "python extract_youtube_comments_suite.py 'https://www.youtube.com/watch?v=...' top 500"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    url = sys.argv[1]
    sort_by = sys.argv[2] if len(sys.argv) > 2 else 'top'
    max_comments = int(sys.argv[3]) if len(sys.argv) > 3 else 500
    
    result = extract_comments(url, sort_by, max_comments)
    print(json.dumps(result, ensure_ascii=False, indent=2))


