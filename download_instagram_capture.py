#!/usr/bin/env python3
"""
Instagram Video Capturer - Уровень 4
Открывает Instagram в браузере, перехватывает видео поток и сохраняет
"""

import sys
import json
import re
import time
from pathlib import Path

def capture_instagram_video(url, shortcode, output_dir):
    """
    Открывает браузер, загружает Instagram, перехватывает видео
    """
    print(f"🌐 Запускаю браузер...", file=sys.stderr)
    
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        import requests
        
        # Настройки Chrome
        chrome_options = Options()
        
        # ВАЖНО: Добавляем возможность перехвата сети
        chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL', 'browser': 'ALL'})
        
        # Эмуляция мобильного устройства (Instagram лучше работает с мобильной версией)
        mobile_emulation = {
            "deviceMetrics": { "width": 375, "height": 812, "pixelRatio": 3.0 },
            "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        }
        chrome_options.add_experimental_option("mobileEmulation", mobile_emulation)
        
        # Отключаем автоматизацию detection
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        
        print(f"📱 Открываю Instagram...", file=sys.stderr)
        
        # Используем webdriver_manager для автоматической установки ChromeDriver
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Скрываем WebDriver
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        # Открываем Instagram
        driver.get(url)
        
        print(f"⏳ Жду загрузки страницы...", file=sys.stderr)
        time.sleep(5)
        
        # Пытаемся запустить видео
        try:
            video_element = driver.find_element(By.TAG_NAME, "video")
            driver.execute_script("arguments[0].play();", video_element)
            print(f"▶️  Запустил воспроизведение видео", file=sys.stderr)
            time.sleep(3)
        except:
            print(f"⚠️  Не удалось запустить видео автоматически", file=sys.stderr)
            time.sleep(3)
        
        # Получаем логи Performance для перехвата Network запросов
        print(f"🔍 Анализирую Network запросы...", file=sys.stderr)
        
        logs = driver.get_log('performance')
        video_urls = []
        video_candidates = {}  # URL -> размер
        
        for entry in logs:
            try:
                log = json.loads(entry['message'])
                message = log.get('message', {})
                method = message.get('method', '')
                
                # Ищем Network.responseReceived
                if method == 'Network.responseReceived':
                    params = message.get('params', {})
                    response = params.get('response', {})
                    response_url = response.get('url', '')
                    mime_type = response.get('mimeType', '')
                    headers = response.get('headers', {})
                    
                    # Получаем размер контента
                    content_length = headers.get('content-length', headers.get('Content-Length', 0))
                    try:
                        content_length = int(content_length)
                    except:
                        content_length = 0
                    
                    # Проверяем что это видео от Instagram
                    if 'cdninstagram.com' in response_url and ('.mp4' in response_url or 'video' in mime_type.lower()):
                        # Фильтруем маленькие файлы (индексы, превью)
                        if content_length > 100000:  # Больше 100 KB
                            video_candidates[response_url] = content_length
                            print(f"✅ Видео: {content_length / 1024 / 1024:.2f} MB", file=sys.stderr)
                        else:
                            print(f"⚠️  Пропускаю маленький: {content_length} байт", file=sys.stderr)
            except:
                continue
        
        # Сортируем по размеру (берём самый большой)
        if video_candidates:
            video_urls = [url for url, size in sorted(video_candidates.items(), key=lambda x: x[1], reverse=True)]
            print(f"📊 Найдено {len(video_urls)} видео, берём самое большое", file=sys.stderr)
        
        # Альтернативный метод: получить src напрямую из video элемента
        if not video_urls:
            print(f"🔄 Пробую альтернативный метод...", file=sys.stderr)
            try:
                video_element = driver.find_element(By.TAG_NAME, "video")
                video_src = video_element.get_attribute('src')
                if video_src and ('cdninstagram.com' in video_src or 'video' in video_src):
                    video_urls.append(video_src)
                    print(f"✅ Получен URL из video.src", file=sys.stderr)
            except:
                pass
        
        # Получаем HTML страницы для парсинга
        if not video_urls:
            print(f"🔄 Парсю HTML страницы...", file=sys.stderr)
            page_source = driver.page_source
            
            # Ищем video_url в HTML
            patterns = [
                r'"video_url":"(https://[^"]+\.mp4[^"]*)"',
                r'"playback_url":"(https://[^"]+\.mp4[^"]*)"',
                r'https://scontent[^"\']*\.cdninstagram\.com[^"\']*/[^"\']*\.mp4[^"\']+'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, page_source)
                if matches:
                    video_url = matches[0].replace('\\u0026', '&').replace('&amp;', '&')
                    video_urls.append(video_url)
                    print(f"✅ Найден URL в HTML", file=sys.stderr)
                    break
        
        driver.quit()
        
        if not video_urls:
            return {
                "success": False,
                "error": "Не удалось перехватить видео URL. Instagram может требовать авторизацию или это приватный пост."
            }
        
        # Берём первый найденный URL
        video_url = video_urls[0]
        print(f"🎬 Перехвачен URL: {video_url[:80]}...", file=sys.stderr)
        
        # Скачиваем видео
        output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
        
        print(f"⬇️  Скачиваю видео...", file=sys.stderr)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'video/mp4,video/*,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Referer': 'https://www.instagram.com/',
            'Origin': 'https://www.instagram.com',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
        }
        
        print(f"🔗 URL: {video_url[:100]}...", file=sys.stderr)
        
        # Следуем редиректам
        response = requests.get(video_url, headers=headers, stream=True, timeout=30, allow_redirects=True)
        
        # Проверяем статус
        if response.status_code not in [200, 206]:
            print(f"❌ HTTP {response.status_code}", file=sys.stderr)
            return {
                "success": False,
                "error": f"Ошибка скачивания: HTTP {response.status_code}"
            }
        
        # Проверяем что это действительно видео
        content_type = response.headers.get('content-type', '')
        if 'video' not in content_type.lower() and 'octet-stream' not in content_type.lower():
            print(f"⚠️  Content-Type: {content_type} (ожидалось video/*)", file=sys.stderr)
            # Продолжаем, но предупреждаем
        
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
        
        file_size_bytes = output_path.stat().st_size
        file_size = file_size_bytes / (1024 * 1024)
        
        # Проверяем что файл не пустой (минимум 10 KB)
        if file_size_bytes < 10240:
            print(f"❌ Файл слишком маленький: {file_size_bytes} байт", file=sys.stderr)
            print(f"⚠️  Возможно это ошибка или редирект", file=sys.stderr)
            
            # Читаем содержимое для диагностики
            with open(output_path, 'rb') as f:
                content = f.read(200)
                print(f"📄 Содержимое: {content[:100]}", file=sys.stderr)
            
            return {
                "success": False,
                "error": f"Скачан неправильный файл ({file_size_bytes} байт). Возможно это редирект или ошибка."
            }
        
        print(f"✅ Видео перехвачено и сохранено!", file=sys.stderr)
        print(f"📦 Размер: {file_size:.2f} MB", file=sys.stderr)
        
        return {
            "success": True,
            "filename": output_path.name,
            "path": str(output_path),
            "size_mb": round(file_size, 2),
            "title": "",
            "owner": "",
            "method": "browser-capture"
        }
        
    except ImportError:
        return {
            "success": False,
            "error": "Selenium не установлен. Установите: pip install selenium"
        }
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Ошибка: {error_msg}", file=sys.stderr)
        
        if 'chromedriver' in error_msg.lower() or 'chrome' in error_msg.lower():
            return {
                "success": False,
                "error": "ChromeDriver не найден. Установите Chrome и ChromeDriver."
            }
        
        return {
            "success": False,
            "error": f"Ошибка браузерного перехвата: {error_msg[:200]}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python download_instagram_capture.py <instagram_url> <output_directory>", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Извлекаем shortcode
    import re
    patterns = [
        r'instagram\.com/p/([a-zA-Z0-9_-]+)',
        r'instagram\.com/reel/([a-zA-Z0-9_-]+)',
        r'instagram\.com/reels/([a-zA-Z0-9_-]+)',
    ]
    
    shortcode = None
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            shortcode = match.group(1)
            break
    
    if not shortcode:
        print(json.dumps({"success": False, "error": "Не удалось извлечь shortcode из URL"}))
        sys.exit(1)
    
    result = capture_instagram_video(url, shortcode, output_dir)
    print(json.dumps(result, ensure_ascii=False))
    
    sys.exit(0 if result["success"] else 1)

