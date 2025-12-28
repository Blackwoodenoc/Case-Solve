#!/usr/bin/env python3
"""
Instagram Downloader через InstaSave.website
Автоматическое использование публичного сервиса
"""

import sys
import json
import re
import requests
from pathlib import Path
from urllib.parse import quote

def download_via_instasave(url, shortcode, output_dir):
    """Использует InstaSave.website для скачивания"""
    print(f"🌐 Использую InstaSave.website...", file=sys.stderr)
    
    try:
        # InstaSave использует POST запрос с Instagram URL
        api_url = "https://instasave.website/download"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://instasave.website',
            'Referer': 'https://instasave.website/'
        }
        
        # Отправляем запрос как на сайте
        data = {
            'url': url
        }
        
        print(f"📡 Отправляю запрос к InstaSave API...", file=sys.stderr)
        
        response = requests.post(api_url, data=data, headers=headers, timeout=20, allow_redirects=True)
        
        if response.status_code == 200:
            html = response.text
            print(f"✅ Получен ответ от InstaSave ({len(html)} байт)", file=sys.stderr)
            
            # Ищем download ссылку в HTML ответе
            # InstaSave возвращает страницу с кнопкой Download
            patterns = [
                r'href="(https://[^"]+\.cdninstagram\.com[^"]*\.mp4[^"]*)"',
                r'src="(https://[^"]+\.cdninstagram\.com[^"]*\.mp4[^"]*)"',
                r'<a[^>]+href="([^"]+)"[^>]*download[^>]*>',
                r'"url":"(https://[^"]+\.mp4[^"]*)"',
                r'data-url="([^"]+)"'
            ]
            
            video_url = None
            for pattern in patterns:
                matches = re.findall(pattern, html)
                if matches:
                    # Берем первый найденный URL
                    for match in matches:
                        if 'cdninstagram.com' in match or '.mp4' in match:
                            video_url = match.replace('&amp;', '&').replace('\\/', '/')
                            break
                    if video_url:
                        break
            
            if video_url:
                print(f"✅ Найден video URL через InstaSave", file=sys.stderr)
                return download_video(video_url, shortcode, output_dir)
            else:
                # Пробуем альтернативный метод - прямой парсинг Instagram через InstaSave как прокси
                print(f"🔄 Пробую альтернативный метод...", file=sys.stderr)
                return download_direct_html(url, shortcode, output_dir)
        
    except Exception as e:
        print(f"⚠️  InstaSave ошибка: {e}", file=sys.stderr)
    
    return None

def download_direct_html(url, shortcode, output_dir):
    """Прямой парсинг HTML Instagram (как резерв)"""
    print(f"📡 Прямой запрос к Instagram...", file=sys.stderr)
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'DNT': '1',
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            html = response.text
            
            # Ищем video_url в HTML
            patterns = [
                r'"video_url":"(https://[^"]+\.mp4[^"]*)"',
                r'<meta property="og:video" content="([^"]+)"',
                r'"playback_url":"(https://[^"]+\.mp4[^"]*)"',
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, html)
                if matches:
                    video_url = matches[0].replace('\\u0026', '&').replace('&amp;', '&')
                    print(f"✅ Найден через HTML парсинг", file=sys.stderr)
                    return download_video(video_url, shortcode, output_dir)
    except Exception as e:
        print(f"⚠️  HTML парсинг: {e}", file=sys.stderr)
    
    return None

def download_video(video_url, shortcode, output_dir):
    """Скачивает видео по прямой ссылке"""
    try:
        output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
        
        print(f"⬇️  Скачиваю видео...", file=sys.stderr)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.instagram.com/',
            'Origin': 'https://www.instagram.com'
        }
        
        response = requests.get(video_url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        print(f"📥 {progress:.1f}%", file=sys.stderr, end='\r')
        
        print("", file=sys.stderr)
        
        file_size = output_path.stat().st_size / (1024 * 1024)
        
        print(f"✅ Видео скачано успешно!", file=sys.stderr)
        print(f"📦 Размер: {file_size:.2f} MB", file=sys.stderr)
        
        return {
            "success": True,
            "filename": output_path.name,
            "path": str(output_path),
            "size_mb": round(file_size, 2),
            "method": "instasave"
        }
    except Exception as e:
        print(f"❌ Ошибка скачивания: {e}", file=sys.stderr)
        return None

def extract_shortcode(url):
    """Извлекает shortcode из Instagram URL"""
    patterns = [
        r'instagram\.com/p/([a-zA-Z0-9_-]+)',
        r'instagram\.com/reel/([a-zA-Z0-9_-]+)',
        r'instagram\.com/reels/([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python download_instagram_instasave.py <instagram_url> <output_directory>", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    shortcode = extract_shortcode(url)
    if not shortcode:
        print(json.dumps({"success": False, "error": "Не удалось извлечь shortcode из URL"}))
        sys.exit(1)
    
    print(f"🔍 Instagram Reels: {shortcode}", file=sys.stderr)
    print(f"🌐 Сервис: InstaSave.website", file=sys.stderr)
    
    result = download_via_instasave(url, shortcode, output_dir)
    
    if not result:
        result = {
            "success": False,
            "error": "InstaSave не смог обработать это видео. Возможно оно приватное или это пост с фото."
        }
    
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result.get("success") else 1)




