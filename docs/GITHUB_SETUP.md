# 📦 Инструкция: Загрузка проекта на GitHub

## Шаг 1: Установка Git

Если Git не установлен, скачайте и установите его:

1. Перейдите на https://git-scm.com/download/win
2. Скачайте установщик для Windows
3. Запустите установщик и следуйте инструкциям (можно оставить настройки по умолчанию)
4. Перезапустите терминал/PowerShell после установки

## Шаг 2: Настройка Git (первый раз)

Откройте PowerShell или Git Bash и выполните:

```bash
git config --global user.name "Ваше Имя"
git config --global user.email "ваш.email@example.com"
```

## Шаг 3: Инициализация репозитория

В папке проекта выполните:

```bash
cd C:\Users\Admin\Desktop\4
git init
```

## Шаг 4: Добавление файлов

```bash
git add .
```

## Шаг 5: Первый коммит

```bash
git commit -m "Initial commit: VideoMind AI - анализ и генерация сценариев для коротких видео"
```

## Шаг 6: Создание репозитория на GitHub

1. Перейдите на https://github.com
2. Войдите в свой аккаунт (или создайте новый)
3. Нажмите кнопку **"+"** в правом верхнем углу → **"New repository"**
4. Заполните:
   - **Repository name**: `videomind-ai` (или другое имя)
   - **Description**: `AI-powered video analysis and script generation for Shorts/Reels/TikTok`
   - Выберите **Public** или **Private**
   - **НЕ** ставьте галочки на "Add a README file", "Add .gitignore", "Choose a license" (у нас уже есть эти файлы)
5. Нажмите **"Create repository"**

## Шаг 7: Подключение к GitHub

После создания репозитория GitHub покажет инструкции. Выполните:

```bash
git remote add origin https://github.com/ВАШ_USERNAME/videomind-ai.git
git branch -M main
git push -u origin main
```

**Важно:** Замените `ВАШ_USERNAME` на ваш GitHub username.

## Шаг 8: Аутентификация

При первом push GitHub может запросить аутентификацию:

- **Рекомендуется:** Использовать Personal Access Token (PAT)
  1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. Generate new token (classic)
  3. Выберите права: `repo` (полный доступ к репозиториям)
  4. Скопируйте токен
  5. При push используйте токен как пароль (username = ваш GitHub username)

Или используйте GitHub CLI:
```bash
gh auth login
```

## ✅ Готово!

После успешного push ваш проект будет доступен на GitHub.

---

## 📝 Полезные команды Git

```bash
# Проверить статус
git status

# Добавить изменения
git add .

# Создать коммит
git commit -m "Описание изменений"

# Отправить на GitHub
git push

# Получить изменения с GitHub
git pull

# Посмотреть историю коммитов
git log

# Создать новую ветку
git checkout -b feature/новая-функция

# Переключиться на ветку
git checkout main
```

## ⚠️ Важные замечания

1. **НЕ коммитьте файл `.env`** — он содержит API ключи и уже добавлен в `.gitignore`
2. **Проверьте `.gitignore`** перед первым коммитом
3. **Используйте понятные сообщения коммитов** на русском или английском

## 🔐 Безопасность

### Проблема: GitHub Push Protection (GH013)

Если при push вы получили ошибку о найденных секретах (AWS ключи, токены и т.д.):

**Причина:** В репозиторий попали внешние зависимости (например, `yt-dlp-master/`), которые содержат строки, похожие на секреты.

**Решение (автоматическое):**

1. Запустите скрипт исправления:
```powershell
.\fix-git-secrets.ps1
```

2. Если у вас уже есть remote, выполните force push:
```bash
git push -u origin main --force
```

**Решение (ручное):**

1. Убедитесь, что `.gitignore` содержит исключения для внешних репозиториев:
   - `yt-dlp-master/`
   - `youtube_tool-master/`
   - `*-master/`
   - `*-main/`
   - `node_modules/`

2. Удалите папки из индекса Git (файлы останутся на диске):
```bash
git rm -r --cached yt-dlp-master
git rm -r --cached youtube_tool-master
git rm -r --cached youtube-comment-suite-main
git rm -r --cached Instagram-reels-downloader-master
git rm -r --cached ttsave-main
git rm -r --cached node_modules
```

3. Пересоздайте первый коммит:
```bash
git reset --soft HEAD~1
git add .
git commit -m "Initial commit: VideoMind AI - анализ и генерация сценариев для коротких видео"
```

4. Force push:
```bash
git push -u origin main --force
```

### Если случайно закоммитили `.env` с API ключами:

1. Удалите файл из истории:
```bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
```

2. Сгенерируйте новый API ключ в Google AI Studio
3. Обновите `.env` файл
4. Сделайте force push (осторожно!):
```bash
git push origin --force --all
```


