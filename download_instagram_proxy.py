#!/usr/bin/env python3
"""
Instagram Downloader with V2Ray/VLESS Proxy support
Обходит блокировки через прокси
"""

import sys
import json
import re
from pathlib import Path
import subprocess
import time

# Конфигурация прокси
PROXY_CONFIG = {
    "enabled": True,
    "socks5": "socks5://127.0.0.1:10808",
    "http": "http://127.0.0.1:10809"
}

def check_proxy():
    """Проверяет доступность прокси"""
    try:
        import requests
        proxies = {
            'http': PROXY_CONFIG['http'],
            'https': PROXY_CONFIG['http']
        }
        response = requests.get('https://api.ipify.org?format=json', proxies=proxies, timeout=5)
        if response.status_code == 200:
            ip_data = response.json()
            print(f"✅ Прокси работает! Ваш IP: {ip_data['ip']}", file=sys.stderr)
            return True
    except Exception as e:
        print(f"⚠️  Прокси недоступен: {e}", file=sys.stderr)
        return False
    return False

def download_with_proxy(url, shortcode, output_dir):
    """Скачивает Instagram через прокси"""
    print(f"🌐 Использую V2Ray прокси для обхода блокировки...", file=sys.stderr)
    
    try:
        import requests
        from pathlib import Path
        
        # Настраиваем прокси
        proxies = {
            'http': PROXY_CONFIG['http'],
            'https': PROXY_CONFIG['http']
        }
        
        print(f"📡 Запрос к Instagram через прокси...", file=sys.stderr)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'DNT': '1',
            'Connection': 'keep-alive',
        }
        
        # Получаем страницу через прокси
        response = requests.get(url, headers=headers, proxies=proxies, timeout=15)
        response.raise_for_status()
        
        html = response.text
        print(f"✅ Страница загружена через прокси ({len(html)} байт)", file=sys.stderr)
        
        # Ищем видео URL
        video_patterns = [
            r'"video_url":"(https://[^"]+\.mp4[^"]*)"',
            r'<meta property="og:video" content="([^"]+)"',
            r'"playback_url":"(https://[^"]+\.mp4[^"]*)"',
            r'https://scontent[^"\']*\.cdninstagram\.com[^"\']*/[^"\']*\.mp4[^"\']+'
        ]
        
        video_url = None
        for pattern in video_patterns:
            matches = re.findall(pattern, html)
            if matches:
                video_url = matches[0]
                video_url = video_url.replace('\\u0026', '&').replace('&amp;', '&')
                print(f"✅ Найден video_url", file=sys.stderr)
                break
        
        if not video_url:
            return {
                "success": False,
                "error": "Видео URL не найден в HTML. Возможно это пост с фото или приватный контент."
            }
        
        # Скачиваем видео через прокси
        output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
        
        print(f"⬇️  Скачиваю видео через прокси...", file=sys.stderr)
        
        video_response = requests.get(video_url, headers=headers, proxies=proxies, stream=True, timeout=30)
        video_response.raise_for_status()
        
        total_size = int(video_response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(output_path, 'wb') as f:
            for chunk in video_response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        print(f"📥 {progress:.1f}%", file=sys.stderr, end='\r')
        
        print("", file=sys.stderr)
        
        file_size = output_path.stat().st_size / (1024 * 1024)
        
        print(f"✅ Скачано через прокси!", file=sys.stderr)
        print(f"📦 Размер: {file_size:.2f} MB", file=sys.stderr)
        
        return {
            "success": True,
            "filename": output_path.name,
            "path": str(output_path),
            "size_mb": round(file_size, 2),
            "title": "",
            "owner": "",
            "method": "v2ray-proxy"
        }
        
    except Exception as e:
        print(f"❌ Ошибка прокси: {e}", file=sys.stderr)
        return {
            "success": False,
            "error": f"Ошибка при использовании прокси: {str(e)}"
        }

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
        print("Usage: python download_instagram_proxy.py <instagram_url> <output_directory>", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Извлекаем shortcode
    shortcode = extract_shortcode(url)
    if not shortcode:
        print(json.dumps({"success": False, "error": "Не удалось извлечь shortcode из URL"}))
        sys.exit(1)
    
    print(f"🔍 Instagram Reels: {shortcode}", file=sys.stderr)
    
    # Проверяем прокси
    if PROXY_CONFIG['enabled']:
        if check_proxy():
            result = download_with_proxy(url, shortcode, output_dir)
        else:
            result = {
                "success": False,
                "error": "Прокси недоступен. Убедитесь что V2Ray запущен на порту 10808."
            }
    else:
        result = {
            "success": False,
            "error": "Прокси отключен в конфигурации"
        }
    
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result["success"] else 1)




