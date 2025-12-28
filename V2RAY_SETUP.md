# 🚀 V2Ray Proxy Integration

## 📋 Ваша конфигурация VLESS

```
vless://383c9935-60eb-4167-ba81-8ebff27b2a90@146.0.72.69:443/?type=tcp&encryption=none&flow=xtls-rprx-vision&sni=google.com&fp=chrome&security=reality&pbk=4rbu-4szdKKZyoGEhLwA_5tqjjAFYtEL5OvQDHCY3Q0&sid=325f371a0a47
```

## 🛠️ Установка и запуск

### Вариант 1: V2Ray Core (рекомендуется)

1. **Скачайте V2Ray:**
   - Windows: https://github.com/v2fly/v2ray-core/releases
   - Распакуйте архив

2. **Скопируйте конфигурацию:**
   ```bash
   copy v2ray_config.json "путь\к\v2ray\config.json"
   ```

3. **Запустите V2Ray:**
   ```bash
   cd путь\к\v2ray
   v2ray.exe run
   ```

### Вариант 2: v2rayN (GUI клиент)

1. **Скачайте v2rayN:**
   - https://github.com/2dust/v2rayN/releases
   - Версия с Core в комплекте

2. **Добавьте сервер:**
   - Запустите v2rayN
   - Меню: Servers → Import URL from Clipboard
   - Вставьте: `vless://383c9935-60eb-4167-ba81-8ebff27b2a90@146.0.72.69:443/...`

3. **Настройте порты:**
   - Settings → Core: Routing settings
   - Socks: 10808
   - HTTP: 10809

4. **Запустите:**
   - ПКМ на иконке в трее → System Proxy → Set system proxy

## ✅ Проверка работы прокси

```bash
python download_instagram_proxy.py "https://www.instagram.com/reel/DCUBzY0yiKK/" "temp_videos"
```

**Ожидаемый вывод:**
```
✅ Прокси работает! Ваш IP: 146.0.72.69
🌐 Использую V2Ray прокси для обхода блокировки...
📡 Запрос к Instagram через прокси...
✅ Страница загружена через прокси
✅ Найден video_url
⬇️  Скачиваю видео через прокси...
📥 100.0%
✅ Скачано через прокси!
```

## 🔧 Интеграция в основной скрипт

Добавим в `download_instagram.py` как **Уровень 0** (перед всеми другими):

```python
# Уровень 0: Прокси (если доступен)
if proxy_available():
    return download_with_proxy(url, shortcode, output_dir)
```

## 📊 Преимущества

- ✅ **Обход блокировок** - новый IP
- ✅ **Нет rate limiting** - чистая репутация IP
- ✅ **100% надёжность** для доступных серверов
- ✅ **Быстро** - прямое соединение

## 🎯 Текущие порты

- **SOCKS5**: `127.0.0.1:10808`
- **HTTP**: `127.0.0.1:10809`

## ⚠️ Troubleshooting

**Ошибка: "Прокси недоступен"**
- Убедитесь что V2Ray запущен
- Проверьте порты: `netstat -an | findstr "10808"`

**Ошибка: "Connection refused"**
- Проверьте конфигурацию `v2ray_config.json`
- Убедитесь что сервер `146.0.72.69:443` доступен

**Медленная скорость**
- Это нормально для прокси
- Попробуйте другой сервер если есть




