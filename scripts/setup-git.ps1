# Скрипт для инициализации Git репозитория
# Запустите после установки Git: .\setup-git.ps1

Write-Host "🚀 Инициализация Git репозитория..." -ForegroundColor Cyan

# Проверка наличия Git
try {
    $gitVersion = git --version
    Write-Host "✅ Git найден: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git не установлен!" -ForegroundColor Red
    Write-Host "📥 Скачайте Git с https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "После установки перезапустите PowerShell и запустите этот скрипт снова." -ForegroundColor Yellow
    exit 1
}

# Проверка, не инициализирован ли уже репозиторий
if (Test-Path .git) {
    Write-Host "⚠️  Git репозиторий уже инициализирован" -ForegroundColor Yellow
    $continue = Read-Host "Продолжить? (y/n)"
    if ($continue -ne "y") {
        exit 0
    }
} else {
    Write-Host "📦 Инициализация нового репозитория..." -ForegroundColor Cyan
    git init
    Write-Host "✅ Репозиторий инициализирован" -ForegroundColor Green
}

# Проверка конфигурации Git
$userName = git config --global user.name
$userEmail = git config --global user.email

if (-not $userName -or -not $userEmail) {
    Write-Host "⚠️  Git не настроен. Настройте имя и email:" -ForegroundColor Yellow
    $name = Read-Host "Введите ваше имя"
    $email = Read-Host "Введите ваш email"
    git config --global user.name $name
    git config --global user.email $email
    Write-Host "✅ Git настроен" -ForegroundColor Green
} else {
    Write-Host "✅ Git настроен: $userName <$userEmail>" -ForegroundColor Green
}

# Добавление файлов
Write-Host "📁 Добавление файлов..." -ForegroundColor Cyan
git add .
Write-Host "✅ Файлы добавлены" -ForegroundColor Green

# Проверка статуса
Write-Host "`n📊 Статус репозитория:" -ForegroundColor Cyan
git status --short

# Создание первого коммита
Write-Host "`n💾 Создание первого коммита..." -ForegroundColor Cyan
$commitMessage = "Initial commit: VideoMind AI - анализ и генерация сценариев для коротких видео"
git commit -m $commitMessage
Write-Host "✅ Коммит создан" -ForegroundColor Green

Write-Host "`n✅ Готово! Репозиторий инициализирован." -ForegroundColor Green
Write-Host "`n📝 Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Создайте репозиторий на GitHub: https://github.com/new" -ForegroundColor Yellow
Write-Host "2. Подключите удаленный репозиторий:" -ForegroundColor Yellow
Write-Host "   git remote add origin https://github.com/ВАШ_USERNAME/videomind-ai.git" -ForegroundColor White
Write-Host "3. Отправьте код:" -ForegroundColor Yellow
Write-Host "   git branch -M main" -ForegroundColor White
Write-Host "   git push -u origin main" -ForegroundColor White
Write-Host "`n📖 Подробная инструкция в файле GITHUB_SETUP.md" -ForegroundColor Cyan




