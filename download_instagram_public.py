#!/usr/bin/env python3
"""
Instagram Downloader через публичные API сервисы
Использует saveinsta.app, snapinsta.app и другие
"""

import sys
import json
import re
import requests
from pathlib import Path

def download_via_saveinsta(url, shortcode, output_dir):
    """Использует SaveInsta API"""
    print(f"📡 Пробую SaveInsta API...", file=sys.stderr)
    
    try:
        api_url = "https://v3.saveinsta.app/api/ajaxSearch"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://saveinsta.app',
            'Referer': 'https://saveinsta.app/'
        }
        
        data = {
            'q': url,
            't': 'media',
            'lang': 'en'
        }
        
        response = requests.post(api_url, data=data, headers=headers, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            
            if result.get('status') == 'ok' and 'data' in result:
                html_data = result['data']
                
                # Ищем download URL
                download_pattern = r'href="([^"]+)"[^>]*class="abutton[^>]*>Download'
                match = re.search(download_pattern, html_data)
                
                if not match:
                    # Альтернативный поиск
                    match = re.search(r'href="(https://[^"]+\.mp4[^"]*)"', html_data)
                
                if match:
                    video_url = match.group(1).replace('&amp;', '&')
                    print(f"✅ Найден через SaveInsta", file=sys.stderr)
                    return download_video(video_url, shortcode, output_dir, "saveinsta")
    except Exception as e:
        print(f"⚠️  SaveInsta: {e}", file=sys.stderr)
    
    return None

def download_via_snapinsta(url, shortcode, output_dir):
    """Использует SnapInsta API"""
    print(f"📡 Пробую SnapInsta API...", file=sys.stderr)
    
    try:
        api_url = "https://snapinsta.app/api/ajaxSearch"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://snapinsta.app',
            'Referer': 'https://snapinsta.app/'
        }
        
        data = {
            'q': url,
            't': 'media',
            'lang': 'en'
        }
        
        response = requests.post(api_url, data=data, headers=headers, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            
            if result.get('status') == 'ok' and 'data' in result:
                html_data = result['data']
                
                # Ищем download URL
                video_pattern = r'href="(https://[^"]+\.mp4[^"]*)"'
                matches = re.findall(video_pattern, html_data)
                
                if matches:
                    video_url = matches[0].replace('&amp;', '&')
                    print(f"✅ Найден через SnapInsta", file=sys.stderr)
                    return download_video(video_url, shortcode, output_dir, "snapinsta")
    except Exception as e:
        print(f"⚠️  SnapInsta: {e}", file=sys.stderr)
    
    return None

def download_via_instasave(url, shortcode, output_dir):
    """Использует InstaSave через прямое извлечение"""
    print(f"📡 Пробую InstaSave метод...", file=sys.stderr)
    
    try:
        # InstaSave использует простой scraping
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        
        # Используем их прокси-сервер
        proxy_url = f"https://instasave.website/download?url={url}"
        
        response = requests.get(proxy_url, headers=headers, timeout=15, allow_redirects=True)
        
        if response.status_code == 200:
            html = response.text
            
            # Ищем прямую ссылку на видео
            patterns = [
                r'href="(https://[^"]+\.cdninstagram\.com[^"]*\.mp4[^"]*)"',
                r'src="(https://[^"]+\.cdninstagram\.com[^"]*\.mp4[^"]*)"',
                r'"videoUrl":"([^"]+)"'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, html)
                if matches:
                    video_url = matches[0].replace('\\u0026', '&').replace('&amp;', '&')
                    print(f"✅ Найден через InstaSave", file=sys.stderr)
                    return download_video(video_url, shortcode, output_dir, "instasave")
    except Exception as e:
        print(f"⚠️  InstaSave: {e}", file=sys.stderr)
    
    return None

def download_video(video_url, shortcode, output_dir, method):
    """Скачивает видео по URL"""
    try:
        output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
        
        print(f"⬇️  Скачиваю через {method}...", file=sys.stderr)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Range': 'bytes=0-',
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
        
        print(f"✅ Скачано через {method}!", file=sys.stderr)
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

def download_via_public_services(url, shortcode, output_dir):
    """Пробует все публичные сервисы по очереди"""
    print(f"🌐 Использую публичные сервисы для обхода блокировок...", file=sys.stderr)
    
    services = [
        ("SaveInsta", download_via_saveinsta),
        ("SnapInsta", download_via_snapinsta),
        ("InstaSave", download_via_instasave)
    ]
    
    for service_name, service_func in services:
        try:
            result = service_func(url, shortcode, output_dir)
            if result and result.get('success'):
                return result
        except Exception as e:
            print(f"⚠️  {service_name} провалился: {e}", file=sys.stderr)
            continue
    
    return {
        "success": False,
        "error": "Все публичные сервисы не смогли скачать видео"
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
        print("Usage: python download_instagram_public.py <instagram_url> <output_directory>", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    shortcode = extract_shortcode(url)
    if not shortcode:
        print(json.dumps({"success": False, "error": "Не удалось извлечь shortcode из URL"}))
        sys.exit(1)
    
    print(f"🔍 Instagram Reels: {shortcode}", file=sys.stderr)
    
    result = download_via_public_services(url, shortcode, output_dir)
    print(json.dumps(result, ensure_ascii=False))
    
    sys.exit(0 if result.get("success") else 1)




