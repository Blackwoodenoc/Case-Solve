#!/usr/bin/env python3
"""
Instagram Reels Downloader with V2Ray Proxy support
5-уровневая система: Proxy → Instaloader → yt-dlp → API → Browser
"""

import sys
import json
import re
import subprocess
import requests
from pathlib import Path
import instaloader

# Конфигурация прокси V2Ray/VLESS
PROXY_CONFIG = {
    "enabled": True,  # Включить прокси
    "socks5": "socks5://127.0.0.1:10808",
    "http": "http://127.0.0.1:10809"
}

def check_proxy_available():
    """Проверяет доступность прокси"""
    if not PROXY_CONFIG['enabled']:
        return False
    
    try:
        proxies = {
            'http': PROXY_CONFIG['http'],
            'https': PROXY_CONFIG['http']
        }
        response = requests.get('https://api.ipify.org?format=json', proxies=proxies, timeout=3)
        if response.status_code == 200:
            ip_data = response.json()
            print(f"✅ V2Ray прокси активен! IP: {ip_data['ip']}", file=sys.stderr)
            return True
    except:
        pass
    return False

def download_with_proxy(url, shortcode, output_dir):
    """Уровень 0: Скачивание через V2Ray прокси (обход блокировок)"""
    print(f"🌐 Использую V2Ray прокси для обхода блокировки...", file=sys.stderr)
    
    try:
        proxies = {
            'http': PROXY_CONFIG['http'],
            'https': PROXY_CONFIG['http']
        }
        
        print(f"📡 Запрос к Instagram через прокси...", file=sys.stderr)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        
        response = requests.get(url, headers=headers, proxies=proxies, timeout=15)
        response.raise_for_status()
        
        html = response.text
        print(f"✅ Страница загружена через прокси ({len(html)} байт)", file=sys.stderr)
        
        # Ищем видео URL в HTML
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
                print(f"✅ Найден video_url через прокси", file=sys.stderr)
                break
        
        if not video_url:
            return {
                "success": False,
                "error": "Видео URL не найден (возможно пост с фото или приватный)"
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
        
        print(f"✅ Скачано через V2Ray прокси!", file=sys.stderr)
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
        print(f"⚠️  Прокси метод не сработал: {e}", file=sys.stderr)
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

def download_via_public_api(url, shortcode, output_dir):
    """Третий уровень fallback - использование публичных API"""
    print(f"🌐 Пробую публичные API...", file=sys.stderr)
    
    output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
    attempted_methods = []
    
    # Метод 1: Прямой scraping HTML страницы Instagram
    try:
        print(f"📡 Пробую прямой scraping...", file=sys.stderr)
        attempted_methods.append("HTML Scraping")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        # Получаем страницу Instagram
        page_response = requests.get(url, headers=headers, timeout=15)
        
        if page_response.status_code == 200:
            html = page_response.text
            
            # Ищем video_url в различных форматах
            video_patterns = [
                r'"video_url":"(https://[^"]+\.mp4[^"]*)"',
                r'<meta property="og:video" content="([^"]+)"',
                r'"playback_url":"(https://[^"]+\.mp4[^"]*)"',
                r'https://scontent[^"\']*\.cdninstagram\.com[^"\']*/[^"\']*\.mp4[^"\']+'
            ]
            
            for pattern in video_patterns:
                matches = re.findall(pattern, html)
                if matches:
                    video_url = matches[0]
                    # Декодируем escaped символы
                    video_url = video_url.replace('\\u0026', '&').replace('&amp;', '&')
                    
                    print(f"✅ Найден URL через прямой scraping", file=sys.stderr)
                    return download_video_from_url(video_url, output_path, "direct-scraping")
        elif page_response.status_code == 429:
            attempted_methods.append("HTML Scraping (429 - Rate Limited)")
    except Exception as e:
        print(f"⚠️  Прямой scraping ошибка: {e}", file=sys.stderr)
        attempted_methods.append(f"HTML Scraping (ошибка)")
    
    # Метод 2: Использование Insta Save API
    try:
        print(f"📡 Пробую альтернативный API...", file=sys.stderr)
        attempted_methods.append("Alternative API")
        
        api_url = "https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/get-info-rapidapi"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        params = {'url': url}
        
        response = requests.get(api_url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if 'download_url' in data or 'video_url' in data:
                video_url = data.get('download_url') or data.get('video_url')
                print(f"✅ Найден URL через API", file=sys.stderr)
                return download_video_from_url(video_url, output_path, "api")
    except Exception as e:
        print(f"⚠️  API метод ошибка: {e}", file=sys.stderr)
        attempted_methods.append(f"Alternative API (ошибка)")
    
    # Уровень 4: Браузерный перехват (последняя попытка)
    print(f"🌐 Последняя попытка: браузерный перехват...", file=sys.stderr)
    try:
        # Импортируем и вызываем браузерный модуль
        import subprocess
        script_dir = Path(__file__).parent
        capture_script = script_dir / 'download_instagram_capture.py'
        
        if capture_script.exists():
            print(f"🚀 Запускаю браузерный захват...", file=sys.stderr)
            result = subprocess.run(
                ['python', str(capture_script), url, output_dir],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                # Парсим результат
                output_lines = result.stdout.strip().split('\n')
                json_line = output_lines[-1]
                browser_result = json.loads(json_line)
                
                if browser_result.get('success'):
                    print(f"✅ Браузерный перехват сработал!", file=sys.stderr)
                    return browser_result
                else:
                    attempted_methods.append(f"Browser Capture ({browser_result.get('error', 'ошибка')})")
            else:
                attempted_methods.append("Browser Capture (ошибка запуска)")
        else:
            attempted_methods.append("Browser Capture (скрипт не найден)")
    except Exception as e:
        print(f"⚠️  Браузерный перехват ошибка: {e}", file=sys.stderr)
        attempted_methods.append(f"Browser Capture (исключение)")
    
    # Формируем детальное сообщение об ошибке
    methods_tried = "\n• ".join(["Попробовано методов:"] + attempted_methods)
    
    return {
        "success": False,
        "error": f"🚫 Instagram временно ограничил доступ с вашего IP\n\n💡 Что делать:\n1. Подождите 10-15 минут\n2. Попробуйте другой Reels\n3. Используйте saveinsta.app или snapinsta.app\n\n{methods_tried}",
        "attempted_methods": attempted_methods
    }

def download_video_from_url(video_url, output_path, method_name):
    """Скачивает видео по прямой ссылке"""
    try:
        print(f"⬇️  Скачивание видео ({method_name})...", file=sys.stderr)
        
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
        
        print("", file=sys.stderr)  # Новая строка
        
        file_size = output_path.stat().st_size / (1024 * 1024)  # MB
        
        print(f"✅ Скачано через {method_name}: {output_path}", file=sys.stderr)
        print(f"📦 Размер: {file_size:.2f} MB", file=sys.stderr)
        
        return {
            "success": True,
            "filename": output_path.name,
            "path": str(output_path),
            "size_mb": round(file_size, 2),
            "title": "",
            "owner": "",
            "method": method_name
        }
    except Exception as e:
        print(f"❌ Ошибка скачивания: {e}", file=sys.stderr)
        return {
            "success": False,
            "error": f"Ошибка скачивания: {str(e)}"
        }

def download_with_ytdlp(url, shortcode, output_dir):
    """Fallback метод через yt-dlp"""
    print(f"🔄 Используем yt-dlp fallback", file=sys.stderr)
    
    output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
    
    try:
        # Используем системную установку yt-dlp
        # yt-dlp должен быть установлен: pip install yt-dlp
        cmd = [
            'yt-dlp',
            '--no-warnings',
            '--no-check-certificate',
            '--output', str(output_path),
            '--format', 'best',
            '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            '--retries', '3',
            url
        ]
        
        print(f"⬇️  Скачивание через yt-dlp...", file=sys.stderr)
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            error_output = result.stderr
            if "There is no video in this post" in error_output:
                return {
                    "success": False,
                    "error": "Это пост с фото, а не видео. Используйте ссылку на Instagram Reels"
                }
            elif "Private video" in error_output or "private" in error_output:
                return {
                    "success": False,
                    "error": "Это приватное видео, доступ запрещён"
                }
            elif "429" in error_output or "Too Many Requests" in error_output:
                print(f"⚠️  yt-dlp rate limited, пробую публичные API...", file=sys.stderr)
                return download_via_public_api(url, shortcode, output_dir)
            elif "401" in error_output or "403" in error_output:
                print(f"⚠️  yt-dlp blocked, пробую публичные API...", file=sys.stderr)
                return download_via_public_api(url, shortcode, output_dir)
            else:
                print(f"⚠️  yt-dlp failed, пробую публичные API...", file=sys.stderr)
                return download_via_public_api(url, shortcode, output_dir)
        
        # Проверяем, что файл создан
        if not output_path.exists():
            return {
                "success": False,
                "error": "Файл не был скачан"
            }
        
        file_size = output_path.stat().st_size / (1024 * 1024)  # MB
        
        print(f"✅ Скачано через yt-dlp: {output_path}", file=sys.stderr)
        print(f"📦 Размер: {file_size:.2f} MB", file=sys.stderr)
        
        return {
            "success": True,
            "filename": output_path.name,
            "path": str(output_path),
            "size_mb": round(file_size, 2),
            "title": "",
            "owner": "",
            "method": "yt-dlp"
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Превышено время ожидания при скачивании"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"yt-dlp fallback ошибка: {str(e)}"
        }

def download_instagram_video(url, output_dir):
    """Скачивает Instagram видео используя instaloader"""
    
    print(f"🔍 Обработка: {url}", file=sys.stderr)
    
    # Извлекаем shortcode
    shortcode = extract_shortcode(url)
    if not shortcode:
        return {
            "success": False,
            "error": "Не удалось извлечь ID из URL"
        }
    
    print(f"📋 Shortcode: {shortcode}", file=sys.stderr)
    
    # Уровень 0: V2Ray Proxy (если доступен - обходим все блокировки)
    if check_proxy_available():
        proxy_result = download_with_proxy(url, shortcode, output_dir)
        if proxy_result and proxy_result.get('success'):
            return proxy_result
        print(f"⚠️  Прокси не помог, пробую другие методы...", file=sys.stderr)
    
    # Список попыток для диагностики
    attempted_methods = ["Instaloader"]
    
    try:
        # Создаем экземпляр Instaloader (упрощенная версия)
        L = instaloader.Instaloader(
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            post_metadata_txt_pattern='',
            quiet=False  # Показываем прогресс
        )
        
        # (Опционально) Можно добавить авторизацию для закрытых постов
        # L.login("username", "password")
        
        print("📥 Instaloader: загрузка поста...", file=sys.stderr)
        
        # Получаем пост по shortcode (как в вашем примере)
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        # Проверяем, что это видео
        if not post.is_video:
            return {
                "success": False,
                "error": "📸 Это Instagram пост с фото, а не видео. Используйте ссылку на Instagram Reels (видео)",
                "attempted_methods": attempted_methods
            }
        
        print(f"🎬 Найдено видео от @{post.owner_username}", file=sys.stderr)
        print(f"📏 Размер: {post.video_view_count or 'N/A'} просмотров", file=sys.stderr)
        
        # Скачиваем используя встроенный метод (как в вашем примере)
        # Это надёжнее чем ручное скачивание
        temp_target = Path(output_dir) / "temp_insta"
        temp_target.mkdir(exist_ok=True)
        
        print("⬇️  Скачивание через Instaloader...", file=sys.stderr)
        L.download_post(post, target=str(temp_target))
        
        # Находим скачанный файл
        downloaded_files = list(temp_target.glob(f"*{shortcode}*.mp4"))
        
        if not downloaded_files:
            # Fallback: ищем любой mp4
            downloaded_files = list(temp_target.glob("*.mp4"))
        
        if not downloaded_files:
            return {
                "success": False,
                "error": "Instaloader скачал файлы, но .mp4 не найден",
                "attempted_methods": attempted_methods
            }
        
        # Берём первый найденный mp4
        source_file = downloaded_files[0]
        output_path = Path(output_dir) / f"instagram_{shortcode}.mp4"
        
        # Перемещаем в нужное место
        import shutil
        shutil.move(str(source_file), str(output_path))
        
        # Удаляем временную папку
        try:
            shutil.rmtree(temp_target)
        except:
            pass
        
        file_size = output_path.stat().st_size / (1024 * 1024)  # MB
        
        print(f"✅ Скачано через Instaloader: {output_path.name}", file=sys.stderr)
        print(f"📦 Размер: {file_size:.2f} MB", file=sys.stderr)
        
        return {
            "success": True,
            "filename": output_path.name,
            "path": str(output_path),
            "size_mb": round(file_size, 2),
            "title": post.caption[:100] if post.caption else "",
            "owner": post.owner_username,
            "method": "instaloader"
        }
        
    except instaloader.exceptions.InstaloaderException as e:
        error_msg = str(e)
        attempted_methods[-1] = f"Instaloader ({error_msg[:50]})"
        
        # Если 401/403 - это rate limiting, пробуем альтернативный метод
        if "401" in error_msg or "403" in error_msg or "Please wait" in error_msg:
            print(f"⚠️  Instaloader rate limited (401/403), пробую yt-dlp...", file=sys.stderr)
            attempted_methods.append("yt-dlp (fallback)")
            ytdlp_result = download_with_ytdlp(url, shortcode, output_dir)
            if ytdlp_result and isinstance(ytdlp_result, dict):
                ytdlp_result['attempted_methods'] = attempted_methods + ytdlp_result.get('attempted_methods', [])
            return ytdlp_result
        
        if "not find" in error_msg or "doesn't exist" in error_msg:
            error_msg = "Пост не найден или приватный"
        elif "Login" in error_msg or "logged" in error_msg:
            error_msg = "Требуется авторизация (закрытый аккаунт)"
        
        print(f"❌ Instaloader ошибка: {error_msg}", file=sys.stderr)
        return {
            "success": False,
            "error": error_msg,
            "attempted_methods": attempted_methods
        }
        
    except Exception as e:
        error_str = str(e)
        attempted_methods[-1] = f"Instaloader (exception: {error_str[:30]})"
        print(f"❌ Ошибка: {error_str}", file=sys.stderr)
        
        # Проверяем на rate limiting
        if "429" in error_str or "Too Many Requests" in error_str:
            return {
                "success": False,
                "error": "⏳ Instagram временно ограничил доступ. Подождите 2-3 минуты и попробуйте снова.",
                "attempted_methods": attempted_methods
            }
        
        # Пробуем альтернативные методы
        print(f"🔄 Пробую альтернативный метод (yt-dlp)...", file=sys.stderr)
        attempted_methods.append("yt-dlp (fallback)")
        ytdlp_result = download_with_ytdlp(url, shortcode, output_dir)
        if ytdlp_result and isinstance(ytdlp_result, dict):
            ytdlp_result['attempted_methods'] = attempted_methods + ytdlp_result.get('attempted_methods', [])
        return ytdlp_result

def main():
    if len(sys.argv) < 3:
        print("Usage: python download_instagram.py <instagram_url> <output_directory>", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    result = download_instagram_video(url, output_dir)
    print(json.dumps(result))
    
    sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    main()

