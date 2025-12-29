#!/usr/bin/env python3
"""
Скачивание TikTok через SSSTik API
SSSTik проще в использовании чем SnapTik
"""

import sys
import os
import json
import re
import requests
from urllib.parse import urlencode

def download_via_ssstik(tiktok_url, output_dir):
    """Скачивает TikTok видео через SSSTik"""
    
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        print(f'🎵 SSSTik: Обработка {tiktok_url}', file=sys.stderr, flush=True)
        
        # SSSTik API
        api_url = 'https://ssstik.io/abc?url=dl'
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://ssstik.io',
            'Referer': 'https://ssstik.io/',
            'HX-Request': 'true',
            'HX-Target': 'target',
            'HX-Current-URL': 'https://ssstik.io/en'
        }
        
        data = {
            'id': tiktok_url,
            'locale': 'en',
            'tt': 'RFBiZ3Bi'  # Токен SSSTik
        }
        
        print(f'⏳ Запрос к SSSTik API...', file=sys.stderr, flush=True)
        
        response = requests.post(api_url, headers=headers, data=data, timeout=15)
        
        if response.status_code != 200:
            raise Exception(f'SSSTik вернул HTTP {response.status_code}')
        
        html = response.text
        
        # Ищем download ссылку (без watermark)
        download_match = re.search(r'<a[^>]*href="([^"]+)"[^>]*>.*?without watermark', html, re.IGNORECASE | re.DOTALL)
        
        if not download_match:
            # Пробуем другой паттерн
            download_match = re.search(r'<a[^>]*href="([^"]+)"[^>]*download[^>]*>', html, re.IGNORECASE)
        
        if not download_match:
            # Ищем любую ссылку на tikcdn
            download_match = re.search(r'href="(https://[^"]*tikcdn[^"]*)"', html)
        
        if not download_match:
            print(f'❌ Не найдены ссылки на скачивание', file=sys.stderr, flush=True)
            print(f'HTML response (first 1000 chars): {html[:1000]}', file=sys.stderr, flush=True)
            raise Exception('Не удалось извлечь ссылку на видео из ответа SSSTik')
        
        download_url = download_match.group(1)
        download_url = download_url.replace('&amp;', '&')
        
        print(f'✅ Найдена ссылка: {download_url[:70]}...', file=sys.stderr, flush=True)
        print(f'⏳ Скачивание видео...', file=sys.stderr, flush=True)
        
        # Скачиваем видео
        video_response = requests.get(download_url, headers={
            'User-Agent': headers['User-Agent'],
            'Referer': 'https://ssstik.io/'
        }, timeout=30, stream=True)
        
        if video_response.status_code != 200:
            raise Exception(f'Ошибка скачивания: HTTP {video_response.status_code}')
        
        # Сохраняем
        video_id = re.search(r'/video/(\d+)', tiktok_url)
        video_id = video_id.group(1) if video_id else 'unknown'
        filename = f'tiktok_{video_id}.mp4'
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'wb') as f:
            for chunk in video_response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        file_size = os.path.getsize(filepath)
        file_size_mb = file_size / 1024 / 1024
        
        print(f'✅ Скачано: {filename} ({file_size_mb:.2f} MB)', file=sys.stderr, flush=True)
        
        print(json.dumps({
            'success': True,
            'file': filepath,
            'type': 'video',
            'size': file_size
        }), flush=True)
        
    except Exception as e:
        error_msg = str(e)
        print(f'❌ Ошибка: {error_msg}', file=sys.stderr, flush=True)
        
        print(json.dumps({
            'success': False,
            'error': f'SSSTik: {error_msg}'
        }), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': 'Использование: python download_ssstik.py <url> <output_dir>'
        }), flush=True)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    download_via_ssstik(url, output_dir)

