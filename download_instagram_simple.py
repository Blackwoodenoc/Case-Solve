#!/usr/bin/env python3
"""
Instagram Downloader через альтернативные публичные API
"""

import sys
import json
import re
import requests
from pathlib import Path

def download_via_instadownloader(url, shortcode, output_dir):
    """Использует instadownloader.co API"""
    print(f"📡 Пробую InstaDownloader.co...", file=sys.stderr)
    
    try:
        # Этот сервис использует GraphQL запросы напрямую
        api_url = "https://www.instagram.com/graphql/query"
        
        # Получаем страницу напрямую
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            html = response.text
            
            # Простой парсинг video_url из HTML
            patterns = [
                r'"video_url":"(https://[^"]+\.mp4[^"]*)"',
                r'<meta property="og:video" content="([^"]+)"',
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, html)
                if matches:
                    video_url = matches[0].replace('\\u0026', '&').replace('&amp;', '&')
                    print(f"✅ Найден через прямой запрос", file=sys.stderr)
                    return download_video(video_url, shortcode, output_dir, "direct-html")
    except Exception as e:
        print(f"⚠️  Прямой метод: {e}", file=sys.stderr)
    
    return None

def download_video(video_url, shortcode, output_dir, method):
    """Скачивает видео по URL"""
    try:
        output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
        
        print(f"⬇️  Скачиваю видео...", file=sys.stderr)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
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
        
        print(f"✅ Скачано успешно!", file=sys.stderr)
        print(f"📦 Размер: {file_size:.2f} MB", file=sys.stderr)
        
        return {
            "success": True,
            "filename": output_path.name,
            "path": str(output_path),
            "size_mb": round(file_size, 2),
            "method": method
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
        print("Usage: python download_instagram_simple.py <instagram_url> <output_directory>", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    shortcode = extract_shortcode(url)
    if not shortcode:
        print(json.dumps({"success": False, "error": "Не удалось извлечь shortcode"}))
        sys.exit(1)
    
    print(f"🔍 Instagram Reels: {shortcode}", file=sys.stderr)
    print(f"⏳ Подождите, идёт загрузка...", file=sys.stderr)
    
    result = download_via_instadownloader(url, shortcode, output_dir)
    
    if not result:
        result = {"success": False, "error": "Не удалось загрузить видео. Попробуйте через 10-15 минут."}
    
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result.get("success") else 1)




