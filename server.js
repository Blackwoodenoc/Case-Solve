import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения из .env файла
const envPath = path.join(__dirname, '.env');

// Сначала пробуем dotenv
const envResult = dotenv.config({ path: envPath });

// Всегда читаем .env напрямую для надежности
let loadedFromFile = false;
try {
  if (fs.existsSync(envPath)) {
    // Читаем файл как буфер, затем конвертируем в строку, удаляя BOM
    const envBuffer = fs.readFileSync(envPath);
    let envContent = envBuffer.toString('utf-8');
    // Удаляем BOM (UTF-8 BOM = EF BB BF или U+FEFF)
    if (envContent.charCodeAt(0) === 0xFEFF) {
      envContent = envContent.substring(1);
    }
    envContent = envContent.replace(/^\uFEFF/, '');
    
    console.log('📄 Содержимое .env (первые 100 символов):', envContent.substring(0, 100));
    
    // Разбиваем по любым вариантам переноса строки (Windows CRLF или Unix LF)
    const envLines = envContent.split(/\r?\n/).filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && trimmed.includes('=');
    });
    
    console.log('📋 Найдено строк в .env:', envLines.length);
    
    for (const line of envLines) {
      let trimmed = line.trim();
      // Удаляем BOM и другие невидимые символы
      trimmed = trimmed.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E]/g, '');
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        let key = trimmed.substring(0, equalIndex).trim();
        // Удаляем невидимые символы из ключа
        key = key.replace(/[^\x20-\x7E]/g, '');
        const value = trimmed.substring(equalIndex + 1).trim();
        
        // Удаляем кавычки если есть
        const cleanValue = value.replace(/^["']|["']$/g, '');
        
        if (key && cleanValue) {
          process.env[key] = cleanValue;
          loadedFromFile = true;
          console.log(`  ✅ Загружено: ${key} = ${cleanValue.substring(0, 10)}...`);
        }
      }
    }
  }
} catch (readError) {
  console.error('❌ Ошибка чтения .env файла:', readError.message);
}

// Проверяем результат
if (process.env.GEMINI_API_KEY) {
  console.log('✅ GEMINI_API_KEY загружен:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');
} else {
  console.error('❌ GEMINI_API_KEY НЕ НАЙДЕН в переменных окружения!');
  console.log('📁 Искал .env в:', envPath);
  console.log('📁 Файл существует:', fs.existsSync(envPath));
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    console.log('📄 Содержимое файла:', content);
  }
}

const app = express();
const PORT = 3003; // Backend API порт (Vite на 3000/3001)

// Middleware
app.use(cors());
app.use(express.json());

// Создаём папку для временных файлов
const TEMP_DIR = path.join(__dirname, 'temp_videos');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Создаём папку для скачанных видео
const DOWNLOADS_DIR = path.join(__dirname, 'downloaded_videos');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Путь к yt-dlp (используем системную установку или локальный бинарник)
// yt-dlp должен быть установлен через: pip install yt-dlp
// Или через pipx: pipx install yt-dlp
// Или скачать бинарник с https://github.com/yt-dlp/yt-dlp/releases
const YT_DLP_CMD = 'yt-dlp'; // Системная команда
const YT_DLP_PYTHON = 'python'; // Для запуска через Python модуль (если установлен через pip)
const YT_DLP_LOCAL = path.join(__dirname, 'tools', 'yt-dlp.exe'); // Локальный бинарник
const FFMPEG_LOCAL = path.join(__dirname, 'tools', 'ffmpeg', 'bin', 'ffmpeg.exe'); // Локальный ffmpeg

// Функция для проверки доступности yt-dlp
function checkYtDlpAvailable() {
  // 1. Пробуем локальный бинарник (приоритет)
  if (fs.existsSync(YT_DLP_LOCAL)) {
    try {
      // На Windows проверяем версию с помощью spawn, чтобы избежать проблем с кодировкой
      execSync(`"${YT_DLP_LOCAL}" --version`, { 
        stdio: 'ignore',
        timeout: 5000,
        windowsHide: true 
      });
      console.log(`✅ yt-dlp найден (локальный): ${YT_DLP_LOCAL}`);
      return { available: true, method: 'local', command: YT_DLP_LOCAL };
    } catch (e) {
      console.log(`⚠️ Локальный yt-dlp.exe найден, но не запускается: ${e.message}`);
      // Продолжаем проверку других методов
    }
  }
  
  // 2. Пробуем системную команду
  try {
    if (process.platform === 'win32') {
      execSync(`where ${YT_DLP_CMD} >nul 2>&1`, { shell: true, windowsHide: true });
    } else {
      execSync(`which ${YT_DLP_CMD}`, { stdio: 'ignore' });
    }
    execSync(`${YT_DLP_CMD} --version`, { stdio: 'ignore', timeout: 5000 });
    console.log(`✅ yt-dlp найден (системный): ${YT_DLP_CMD}`);
    return { available: true, method: 'system', command: YT_DLP_CMD };
  } catch (e) {
    // Пробуем через Python
    try {
      execSync(`${YT_DLP_PYTHON} -m yt_dlp --version`, { 
        stdio: 'ignore',
        timeout: 5000 
      });
      console.log(`✅ yt-dlp найден (python): ${YT_DLP_PYTHON} -m yt_dlp`);
      return { available: true, method: 'python', command: YT_DLP_PYTHON, args: ['-m', 'yt_dlp'] };
    } catch (e2) {
      console.log(`❌ yt-dlp не найден ни одним методом`);
      return { available: false, method: null };
    }
  }
}

// Функция для получения команды yt-dlp с правильными аргументами
function getYtDlpCommand(baseArgs) {
  const check = checkYtDlpAvailable();
  if (!check.available) {
    throw new Error('yt-dlp не найден. Установите: pip install yt-dlp или скачайте с https://github.com/yt-dlp/yt-dlp/releases');
  }
  
  // Если используем локальный бинарник, добавляем путь к ffmpeg если он есть
  if (check.method === 'local' && fs.existsSync(FFMPEG_LOCAL)) {
    const ffmpegDir = path.dirname(FFMPEG_LOCAL);
    // Добавляем путь к ffmpeg в переменные окружения для процесса
    baseArgs = ['--ffmpeg-location', ffmpegDir, ...baseArgs];
  }
  
  if (check.method === 'python') {
    return {
      command: check.command,
      args: [...(check.args || []), ...baseArgs]
    };
  } else {
    return {
      command: check.command,
      args: baseArgs
    };
  }
}

// Очистка старых файлов (старше 30 минут)
function cleanOldFiles() {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      if (age > 1800000) { // 30 минут
        fs.unlinkSync(filePath);
        console.log(`🗑️  Удалён старый файл: ${file}`);
      }
    });
  } catch (err) {
    console.error('Ошибка очистки:', err);
  }
}

// Запускаем очистку каждые 10 минут
setInterval(cleanOldFiles, 600000);

// API для получения комментариев с YouTube видео
app.post('/api/youtube-comments', async (req, res) => {
  const { url } = req.body;
  let responseSent = false;

  console.log(`📨 Получен запрос на извлечение комментариев: ${url}`);

  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Неверный YouTube URL' });
  }

  console.log(`📥 Извлекаю комментарии для видео: ${videoId}`);

  try {
    // Используем yt-dlp для извлечения комментариев
    // yt-dlp должен быть установлен: pip install yt-dlp
    const ytdlpArgs = [
      '--write-comments',
      '--write-info-json',
      '--skip-download',
      '--no-warnings',
      '--extractor-args', 'youtube:comment_sort=top',
      '-o', path.join(TEMP_DIR, `${videoId}_comments`),
      url
    ];

    // Пробуем использовать системную команду yt-dlp, если не найдена - используем python -m yt_dlp
    const ytdlp = spawn(YT_DLP_CMD, ytdlpArgs, { shell: true });

    let stdoutData = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`yt-dlp stderr: ${data}`);
    });

    ytdlp.on('close', (code) => {
      if (responseSent) return;

      if (code !== 0) {
        console.error(`❌ yt-dlp завершился с кодом ${code}`);
        console.error(`Ошибка: ${errorOutput}`);
        responseSent = true;
        return res.status(500).json({ 
          error: 'Не удалось извлечь комментарии',
          details: errorOutput
        });
      }

      try {
        // Читаем файл .info.json, который создал yt-dlp
        const infoJsonPath = path.join(TEMP_DIR, `${videoId}_comments.info.json`);
        
        if (!fs.existsSync(infoJsonPath)) {
          console.error(`❌ Файл .info.json не найден: ${infoJsonPath}`);
          responseSent = true;
          return res.status(500).json({ 
            error: 'Файл с комментариями не создан',
            details: `Ожидался файл: ${infoJsonPath}`
          });
        }

        // Парсим JSON файл
        const infoData = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
        const rawComments = infoData.comments || [];
        
        // Форматируем комментарии
        const comments = rawComments.map(comment => ({
          id: comment.id || 'unknown',
          author: comment.author || 'Unknown',
          text: comment.text || '',
          like_count: comment.like_count || 0,
          reply_count: comment.reply_count || 0,
          published_at: comment.timestamp || new Date().toISOString(),
          is_pinned: comment.is_favorited || false,
          creator_hearted: false
        }));

        console.log(`✅ Извлечено ${comments.length} комментариев`);
        
        responseSent = true;
        res.json({
          success: true,
          video_id: videoId,
          count: comments.length,
          comments: comments
        });

        // Удаляем временный файл через 10 секунд
        setTimeout(() => {
          if (fs.existsSync(infoJsonPath)) {
            fs.unlinkSync(infoJsonPath);
            console.log(`🗑️  Удалён файл комментариев: ${path.basename(infoJsonPath)}`);
          }
        }, 10000);

      } catch (error) {
        console.error('❌ Ошибка парсинга комментариев:', error);
        responseSent = true;
        res.status(500).json({ 
          error: 'Ошибка обработки комментариев',
          details: error.message
        });
      }
    });

    ytdlp.on('error', (err) => {
      if (responseSent) return;
      console.error('❌ Ошибка запуска yt-dlp:', err);
      responseSent = true;
      res.status(500).json({ 
        error: 'Не удалось запустить yt-dlp',
        details: err.message
      });
    });

  } catch (error) {
    if (responseSent) return;
    console.error('❌ Ошибка:', error);
    responseSent = true;
    res.status(500).json({ 
      error: 'Не удалось извлечь комментарии',
      details: error.message 
    });
  }
});

// Async wrapper для обработки ошибок в async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


// API для полной обработки YouTube видео: скачивание + метаданные + анализ
app.post('/api/youtube-full-analysis', asyncHandler(async (req, res) => {
  const { url } = req.body;
  let responseSent = false;

  console.log(`📨 Получен запрос на полную обработку YouTube: ${url}`);

  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }

  const videoId = extractVideoId(url);
  if (!videoId || !videoId.startsWith('yt_')) {
    return res.status(400).json({ error: 'Неверный YouTube URL' });
  }

  // Убираем префикс 'yt_' для чистого ID
  const cleanVideoId = videoId.replace(/^yt_/, '');
  const videoFolder = path.join(DOWNLOADS_DIR, cleanVideoId);
  
  // Создаём папку для этого видео
  if (!fs.existsSync(videoFolder)) {
    fs.mkdirSync(videoFolder, { recursive: true });
  }

  console.log(`📥 Начинаю полную обработку: ${cleanVideoId}`);
  console.log(`📁 Папка для видео: ${videoFolder}`);

  try {
    // Шаг 1: Скачиваем видео
    console.log(`🎬 Шаг 1: Скачиваю видео...`);
    const videoFilename = `${cleanVideoId}.%(ext)s`;
    const videoPath = path.join(videoFolder, videoFilename);
    
    const isShorts = url.includes('/shorts/');
    const downloadArgs = [
      '--no-warnings',
      '--no-check-certificates',
      '--output', videoPath,
      '--no-playlist',
      '--max-filesize', '500M',
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--extractor-args', 'youtube:player_client=android,web'
    ];

    if (isShorts) {
      downloadArgs.push('--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
    } else {
      downloadArgs.push('--format', 'best[ext=mp4][height<=1080]/best[ext=mp4]/best');
    }

    downloadArgs.push(url);

    const ytdlpConfig = getYtDlpCommand(downloadArgs);
    const downloadProcess = spawn(ytdlpConfig.command, ytdlpConfig.args, {
      cwd: videoFolder,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32'
    });

    let downloadStdout = '';
    let downloadStderr = '';

    downloadProcess.stdout.on('data', (data) => {
      downloadStdout += data.toString();
    });

    downloadProcess.stderr.on('data', (data) => {
      downloadStderr += data.toString();
    });

    await new Promise((resolve, reject) => {
      downloadProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`❌ yt-dlp завершился с кодом ${code}`);
          console.error(`📝 stderr: ${downloadStderr.substring(0, 500)}`);
          
          // Определяем тип ошибки
          let errorMessage = 'Ошибка при скачивании видео';
          if (downloadStderr.includes('HTTP Error 404') || downloadStderr.includes('HTTP 404')) {
            errorMessage = 'Видео не найдено или удалено. Проверьте ссылку';
          } else if (downloadStderr.includes('Video unavailable') || downloadStderr.includes('unavailable')) {
            errorMessage = 'Видео недоступно. Возможно, оно приватное или заблокировано';
          } else if (downloadStderr.includes('Private video') || downloadStderr.includes('private')) {
            errorMessage = 'Это приватное видео, доступ запрещён';
          } else if (downloadStderr.includes('age-restricted')) {
            errorMessage = 'Видео имеет возрастные ограничения';
          } else if (downloadStderr.includes('403') || downloadStderr.includes('Forbidden')) {
            errorMessage = 'Доступ запрещён. YouTube заблокировал запрос';
          } else if (downloadStderr.includes('429') || downloadStderr.includes('rate limit')) {
            errorMessage = 'Превышен лимит запросов. Подождите 2-3 минуты';
          } else if (downloadStderr.includes('Command not found') || downloadStderr.includes('not found')) {
            errorMessage = 'yt-dlp не установлен. Установите: pip install yt-dlp';
          }
          
          reject(new Error(errorMessage));
        } else {
          resolve(null);
        }
      });

      downloadProcess.on('error', (err) => {
        console.error('❌ Ошибка запуска yt-dlp:', err);
        reject(new Error(`Не удалось запустить yt-dlp: ${err.message}`));
      });
    });

    // Находим скачанный файл
    const files = fs.readdirSync(videoFolder);
    const videoFile = files.find(f => f.startsWith(cleanVideoId) && !f.endsWith('.info.json'));
    
    if (!videoFile) {
      throw new Error('Видео файл не найден после скачивания');
    }

    const videoFilePath = path.join(videoFolder, videoFile);
    const videoStats = fs.statSync(videoFilePath);
    
    console.log(`✅ Видео скачано: ${videoFile} (${(videoStats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Шаг 2: Извлекаем метаданные и комментарии
    console.log(`📊 Шаг 2: Извлекаю метаданные и комментарии...`);
    
    const metadataArgs = [
      '--write-comments',
      '--write-info-json',
      '--skip-download',
      '--no-warnings',
      '--extractor-args', 'youtube:comment_sort=newest',
      '--max-comments', '1000',
      '-o', path.join(videoFolder, `${cleanVideoId}_metadata`),
      url
    ];

    const metadataConfig = getYtDlpCommand(metadataArgs);
    const metadataProcess = spawn(metadataConfig.command, metadataConfig.args, {
      cwd: videoFolder,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32'
    });

    let metadataStdout = '';
    let metadataStderr = '';

    metadataProcess.stdout.on('data', (data) => {
      metadataStdout += data.toString();
    });

    metadataProcess.stderr.on('data', (data) => {
      metadataStderr += data.toString();
    });

    await new Promise((resolve, reject) => {
      metadataProcess.on('close', (code) => {
        if (code !== 0) {
          console.warn(`⚠️ Предупреждение при извлечении метаданных: ${metadataStderr.substring(0, 200)}`);
        }
        resolve(null);
      });

      metadataProcess.on('error', (err) => {
        console.warn(`⚠️ Ошибка извлечения метаданных: ${err.message}`);
        resolve(null);
      });
    });

    // Читаем метаданные
    const metadataPath = path.join(videoFolder, `${cleanVideoId}_metadata.info.json`);
    let metadata = null;
    let comments = [];
    let viewCount = 0;
    let likeCount = 0;
    let channelName = '';
    let videoTitle = '';
    let videoDescription = '';
    let duration = 0;
    let uploadDate = '';

    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        
        viewCount = metadata.view_count || 0;
        likeCount = metadata.like_count || 0;
        channelName = metadata.channel || metadata.uploader || metadata.channel_id || 'Unknown';
        videoTitle = metadata.title || 'Untitled';
        videoDescription = metadata.description || '';
        duration = metadata.duration || 0;
        uploadDate = metadata.upload_date || metadata.release_date || '';

         const rawComments = metadata.comments || [];
         comments = rawComments.map(comment => ({
           id: comment.id || 'unknown',
           author: comment.author || 'Unknown',
           text: comment.text || '',
           like_count: comment.like_count || 0,
           reply_count: comment.reply_count || 0,
           published_at: comment.timestamp || new Date().toISOString(),
           is_pinned: comment.is_favorited || false,
           creator_hearted: false
         }));

         // Сортируем комментарии по лайкам (топ комментарии)
         comments = comments.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));

         console.log(`✅ Извлечено метаданных: ${comments.length} комментариев, ${viewCount} просмотров, ${likeCount} лайков`);
         
         // Выводим топ-5 комментариев для проверки
         if (comments.length > 0) {
           console.log(`🔥 Топ-5 комментариев по лайкам:`);
           comments.slice(0, 5).forEach((c, i) => {
             const textPreview = c.text.length > 60 ? c.text.substring(0, 60) + '...' : c.text;
             console.log(`  ${i + 1}. ${c.author}: ${textPreview} (${c.like_count} лайков)`);
           });
         } else {
           console.log(`⚠️ Комментарии не найдены или не извлечены`);
         }
      } catch (parseError) {
        console.error('❌ Ошибка парсинга метаданных:', parseError);
      }
    }

    // Шаг 3: Анализируем последние 10 комментариев
    console.log(`🔍 Шаг 3: Анализирую последние 10 комментариев...`);
    
    const last10Comments = comments.slice(0, 10);
    const commentAnalysis = {
      total_comments: comments.length,
      analyzed_count: last10Comments.length,
      comments: last10Comments.map(comment => ({
        author: comment.author,
        text: comment.text,
        likes: comment.like_count,
        sentiment: analyzeCommentSentiment(comment.text),
        keywords: extractKeywords(comment.text)
      })),
      summary: {
        average_likes: last10Comments.length > 0 
          ? Math.round(last10Comments.reduce((sum, c) => sum + c.like_count, 0) / last10Comments.length)
          : 0,
        most_liked_comment: last10Comments.length > 0
          ? last10Comments.reduce((max, c) => c.like_count > max.like_count ? c : max, last10Comments[0])
          : null,
        common_words: extractCommonWords(last10Comments.map(c => c.text))
      }
    };

    const result = {
      success: true,
      video_id: cleanVideoId,
      video_info: {
        title: videoTitle,
        channel: channelName,
        description: videoDescription,
        duration: duration,
        upload_date: uploadDate,
        view_count: viewCount,
        like_count: likeCount,
        url: url
      },
      video_file: {
        filename: videoFile,
        path: videoFilePath,
        size: videoStats.size,
        size_mb: (videoStats.size / 1024 / 1024).toFixed(2),
        folder: videoFolder
      },
      metadata: {
        total_comments: comments.length,
        all_comments: comments,
        view_count: viewCount,
        like_count: likeCount
      },
      analysis: commentAnalysis,
      downloaded_at: new Date().toISOString()
    };

    console.log(`✅ Полная обработка завершена для ${cleanVideoId}`);
    
    responseSent = true;
    res.json(result);

  } catch (error) {
    if (responseSent) return;
    console.error('❌ Ошибка полной обработки:', error);
    console.error('Стек ошибки:', error.stack);
    responseSent = true;
    
    // Формируем понятное сообщение об ошибке
    let errorMessage = error.message || 'Ошибка обработки YouTube видео';
    let suggestions = [];
    
    // Добавляем рекомендации в зависимости от типа ошибки
    if (errorMessage.includes('yt-dlp не установлен') || errorMessage.includes('not found')) {
      suggestions = [
        'Установите yt-dlp: pip install yt-dlp',
        'Или скачайте бинарник: https://github.com/yt-dlp/yt-dlp/releases'
      ];
    } else if (errorMessage.includes('лимит запросов') || errorMessage.includes('rate limit')) {
      suggestions = [
        'Подождите 2-3 минуты перед повторной попыткой',
        'Используйте альтернативные сервисы (y2mate.com)'
      ];
    } else if (errorMessage.includes('403') || errorMessage.includes('запрещён')) {
      suggestions = [
        'Попробуйте позже',
        'Используйте альтернативные сервисы (y2mate.com)',
        'Обновите yt-dlp: pip install -U yt-dlp'
      ];
    } else if (errorMessage.includes('404') || errorMessage.includes('не найдено')) {
      suggestions = [
        'Проверьте, что ссылка правильная и видео существует',
        'Попробуйте использовать альтернативные сервисы'
      ];
    }
    
    res.status(500).json({
      error: errorMessage,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

// Вспомогательные функции для анализа комментариев
function analyzeCommentSentiment(text) {
  if (!text) return 'neutral';
  
  const lowerText = text.toLowerCase();
  const positiveWords = ['отлично', 'класс', 'супер', 'люблю', 'нравится', 'спасибо', 'great', 'awesome', 'love', 'amazing', 'best'];
  const negativeWords = ['плохо', 'ужасно', 'ненавижу', 'не нравится', 'bad', 'terrible', 'hate', 'worst', 'awful'];
  
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function extractKeywords(text) {
  if (!text) return [];
  
  const stopWords = new Set(['это', 'что', 'как', 'для', 'или', 'the', 'and', 'for', 'are', 'was', 'were', 'been', 'have', 'has', 'had']);
  const words = text.toLowerCase().match(/\b[a-zа-яё]{4,}\b/gi) || [];
  const keywords = words.filter(word => !stopWords.has(word.toLowerCase()));
  
  const wordCount = {};
  keywords.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function extractCommonWords(commentTexts) {
  const allWords = [];
  commentTexts.forEach(text => {
    if (text) {
      const words = text.toLowerCase().match(/\b[a-zа-яё]{3,}\b/gi) || [];
      allWords.push(...words);
    }
  });
  
  const wordCount = {};
  allWords.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

// API для создания "Паспорта стиля" на основе комментариев
app.post('/api/style-passport', async (req, res) => {
  const { url } = req.body;
  let responseSent = false;
  
  console.log(`📋 Получен запрос на создание паспорта стиля: ${url}`);
  
  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }
  
  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Неверный YouTube URL' });
  }
  
  console.log(`📥 Извлекаю комментарии для создания паспорта стиля: ${videoId}`);
  
  try {
    // Используем yt-dlp для извлечения комментариев И транскрипции
    // yt-dlp должен быть установлен: pip install yt-dlp
    const ytdlpArgs = [
      '--write-comments',
      '--write-info-json',
      '--write-sub',           // Извлекаем субтитры (если есть)
      '--write-auto-sub',      // Извлекаем автоматические субтитры
      '--sub-lang', 'ru,en',   // Приоритет: русский, затем английский
      '--sub-format', 'vtt',   // Формат WebVTT для удобного парсинга
      '--skip-download',
      '--no-warnings',
      '--extractor-args', 'youtube:comment_sort=top',
      '-o', path.join(TEMP_DIR, `${videoId}_passport`),
      url
    ];
    
    // Используем системную команду yt-dlp
    const ytdlp = spawn(YT_DLP_CMD, ytdlpArgs, { shell: true });
    
    let errorOutput = '';
    
    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    ytdlp.on('close', (code) => {
      if (responseSent) return;
      
      if (code !== 0) {
        console.error(`❌ yt-dlp завершился с кодом ${code}`);
        responseSent = true;
        return res.status(500).json({
          error: 'Не удалось извлечь комментарии для паспорта',
          details: errorOutput
        });
      }
      
      try {
        const infoJsonPath = path.join(TEMP_DIR, `${videoId}_passport.info.json`);
        
        if (!fs.existsSync(infoJsonPath)) {
          console.error(`❌ Файл .info.json не найден: ${infoJsonPath}`);
          responseSent = true;
          return res.status(500).json({
            error: 'Файл с комментариями не создан'
          });
        }
        
        const infoData = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
        const rawComments = infoData.comments || [];
        
        // Анализ комментариев для паспорта стиля
        const passport = analyzeStyleFromComments(rawComments, videoId, url, infoData);
        
        console.log(`✅ Паспорт стиля создан: ${rawComments.length} комментариев проанализировано`);
        
        responseSent = true;
        res.json({
          success: true,
          passport: passport
        });
        
        // Удаляем временный файл
        setTimeout(() => {
          if (fs.existsSync(infoJsonPath)) {
            fs.unlinkSync(infoJsonPath);
            console.log(`🗑️  Удалён файл паспорта: ${path.basename(infoJsonPath)}`);
          }
        }, 10000);
        
      } catch (parseError) {
        if (responseSent) return;
        console.error('❌ Ошибка создания паспорта:', parseError);
        responseSent = true;
        res.status(500).json({
          error: 'Ошибка обработки данных для паспорта',
          details: parseError.message
        });
      }
    });
    
    ytdlp.on('error', (err) => {
      if (responseSent) return;
      console.error('❌ Ошибка запуска yt-dlp:', err);
      responseSent = true;
      res.status(500).json({
        error: 'Не удалось запустить yt-dlp',
        details: err.message
      });
    });
    
  } catch (error) {
    if (responseSent) return;
    console.error('❌ Ошибка:', error);
    responseSent = true;
    res.status(500).json({
      error: 'Не удалось создать паспорт стиля',
      details: error.message
    });
  }
});

// Функция парсинга WebVTT субтитров
function parseWebVTT(content) {
  // Удаляем заголовок WEBVTT и метаданные
  const lines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && 
           !trimmed.startsWith('WEBVTT') && 
           !trimmed.startsWith('NOTE') &&
           !trimmed.match(/^\d{2}:\d{2}:\d{2}/) && // Пропускаем временные метки
           !trimmed.match(/^-->$/); // Пропускаем стрелки
  });
  
  // Объединяем все строки в один текст
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

// Функция парсинга SRT субтитров
function parseSRT(content) {
  // Разбиваем на блоки по пустым строкам
  const blocks = content.split(/\n\s*\n/);
  const textLines = [];
  
  for (const block of blocks) {
    const lines = block.split('\n');
    // Пропускаем номер и временные метки, берем только текст
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.match(/^\d{2}:\d{2}:\d{2}/)) {
        textLines.push(line);
      }
    }
  }
  
  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

// Функция анализа стиля из комментариев и транскрипции
function analyzeStyleFromComments(comments, videoId, videoUrl, videoInfo, transcript = '') {
  // Собираем все тексты комментариев
  const commentTexts = comments.map(c => c.text || '').filter(t => t.length > 0);
  
  // Анализ транскрипции для поиска паттернов речи
  let speechPatterns = {
    common_phrases: [],
    filler_words: [],
    question_patterns: [],
    exclamation_patterns: [],
    word_count: 0,
    average_sentence_length: 0
  };
  
  if (transcript && transcript.length > 0) {
    console.log(`📝 Анализирую транскрипцию (${transcript.length} символов) для поиска паттернов речи...`);
    
    // Разбиваем на предложения
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    speechPatterns.word_count = transcript.split(/\s+/).filter(w => w.length > 0).length;
    speechPatterns.average_sentence_length = sentences.length > 0 
      ? Math.round(speechPatterns.word_count / sentences.length) 
      : 0;
    
    // Поиск частых фраз (2-3 слова подряд, встречающиеся минимум 2 раза)
    const phraseFrequency = {};
    sentences.forEach(sentence => {
      const words = sentence.toLowerCase().match(/\b[a-zа-яё]+\b/gi) || [];
      for (let i = 0; i < words.length - 1; i++) {
        const phrase2 = `${words[i]} ${words[i + 1]}`;
        phraseFrequency[phrase2] = (phraseFrequency[phrase2] || 0) + 1;
        if (i < words.length - 2) {
          const phrase3 = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
          phraseFrequency[phrase3] = (phraseFrequency[phrase3] || 0) + 1;
        }
      }
    });
    
    speechPatterns.common_phrases = Object.entries(phraseFrequency)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase, _]) => phrase);
    
    // Поиск слов-паразитов (короткие слова, часто повторяющиеся)
    const fillerCandidates = ['ну', 'это', 'вот', 'как', 'типа', 'короче', 'значит', 'так', 'вообще', 'просто', 'well', 'like', 'you know', 'um', 'uh'];
    const fillerFrequency = {};
    const allWords = transcript.toLowerCase().match(/\b[a-zа-яё]+\b/gi) || [];
    allWords.forEach(word => {
      if (fillerCandidates.includes(word)) {
        fillerFrequency[word] = (fillerFrequency[word] || 0) + 1;
      }
    });
    
    speechPatterns.filler_words = Object.entries(fillerFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, _]) => word);
    
    // Поиск паттернов вопросов и восклицаний
    speechPatterns.question_patterns = sentences.filter(s => s.includes('?')).length;
    speechPatterns.exclamation_patterns = sentences.filter(s => s.includes('!')).length;
    
    console.log(`✅ Найдено паттернов речи: ${speechPatterns.common_phrases.length} фраз, ${speechPatterns.filler_words.length} слов-паразитов`);
  } else {
    console.log('⚠️  Транскрипция отсутствует, анализ паттернов речи будет ограничен');
  }
  
  // Анализ частотности слов (из комментариев)
  const wordFrequency = {};
  const phrasePatterns = [];
  const emotionalMarkers = {
    positive: 0,
    negative: 0,
    neutral: 0,
    aggressive: 0,
    funny: 0
  };
  
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'this', 'that', 'with', 'from', 'are', 'was', 'were']);
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  
  // Маркеры эмоций
  const positiveWords = ['love', 'amazing', 'great', 'beautiful', 'perfect', 'best', 'awesome'];
  const negativeWords = ['hate', 'bad', 'terrible', 'worst', 'awful', 'boring'];
  const aggressiveWords = ['wtf', 'damn', 'shit', 'fuck', 'stupid', 'idiot'];
  const funnyMarkers = ['lol', 'haha', 'lmao', 'rofl', '😂', '🤣'];
  
  commentTexts.forEach(comment => {
    const lowerComment = comment.toLowerCase();
    
    // Подсчет эмоциональных маркеров
    if (positiveWords.some(w => lowerComment.includes(w))) emotionalMarkers.positive++;
    if (negativeWords.some(w => lowerComment.includes(w))) emotionalMarkers.negative++;
    if (aggressiveWords.some(w => lowerComment.includes(w))) emotionalMarkers.aggressive++;
    if (funnyMarkers.some(w => lowerComment.includes(w))) emotionalMarkers.funny++;
    
    // Извлечение слов
    const words = comment.match(/\b[a-zа-яё]+\b/gi) || [];
    words.forEach(word => {
      const lowerWord = word.toLowerCase();
      if (word.length > 3 && !stopWords.has(lowerWord)) {
        wordFrequency[lowerWord] = (wordFrequency[lowerWord] || 0) + 1;
      }
    });
    
    // Поиск эмодзи
    const emojis = comment.match(emojiRegex) || [];
    emojis.forEach(emoji => {
      wordFrequency[emoji] = (wordFrequency[emoji] || 0) + 1;
    });
  });
  
  // Топ слова
  const topWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  
  // Топ комментарии (по лайкам)
  const topComments = [...comments]
    .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    .slice(0, 20)
    .map(c => ({
      author: c.author || 'Unknown',
      text: c.text || '',
      likes: c.like_count || 0
    }));
  
  // Определение общего тона
  const totalEmotional = emotionalMarkers.positive + emotionalMarkers.negative + emotionalMarkers.aggressive;
  emotionalMarkers.neutral = commentTexts.length - totalEmotional;
  
  const passport = {
    video_id: videoId,
    video_url: videoUrl,
    video_info: {
      title: videoInfo.title || 'Unknown',
      channel: videoInfo.channel || videoInfo.uploader || 'Unknown',
      duration: videoInfo.duration || 0,
      view_count: videoInfo.view_count || 0,
      like_count: videoInfo.like_count || 0
    },
    statistics: {
      total_comments: comments.length,
      analyzed_comments: commentTexts.length,
      transcript_available: transcript.length > 0,
      transcript_length: transcript.length,
      transcript_word_count: speechPatterns.word_count
    },
    style_analysis: {
      frequent_words: Object.fromEntries(topWords),
      emotional_tone: emotionalMarkers,
      dominant_emotion: Object.entries(emotionalMarkers).sort((a, b) => b[1] - a[1])[0][0],
      emoji_usage: topWords.filter(([word]) => /[\u{1F300}-\u{1F9FF}]/u.test(word)).slice(0, 10),
      // Данные из транскрипции
      speech_patterns: {
        common_phrases: speechPatterns.common_phrases,
        filler_words: speechPatterns.filler_words,
        question_count: speechPatterns.question_patterns,
        exclamation_count: speechPatterns.exclamation_patterns,
        average_sentence_length: speechPatterns.average_sentence_length,
        total_words: speechPatterns.word_count
      }
    },
    transcript: transcript.length > 0 ? transcript.substring(0, 5000) : '', // Сохраняем первые 5000 символов транскрипции
    top_comments: topComments,
    insights: {
      audience_language: detectLanguage(commentTexts),
      average_comment_length: Math.round(commentTexts.reduce((sum, c) => sum + c.length, 0) / commentTexts.length),
      engagement_level: comments.length > 100 ? 'high' : comments.length > 50 ? 'medium' : 'low',
      speech_style: transcript.length > 0 ? (
        speechPatterns.question_patterns > speechPatterns.exclamation_patterns ? 'вопросительный' :
        speechPatterns.exclamation_patterns > 5 ? 'эмоциональный' :
        speechPatterns.average_sentence_length > 15 ? 'развернутый' : 'лаконичный'
      ) : 'не определен'
    },
    created_at: new Date().toISOString()
  };
  
  return passport;
}

// Простое определение языка по комментариям
function detectLanguage(comments) {
  const russianChars = /[а-яА-ЯёЁ]/;
  const russianCount = comments.filter(c => russianChars.test(c)).length;
  const ratio = russianCount / comments.length;
  
  if (ratio > 0.5) return 'ru';
  if (ratio > 0.2) return 'mixed';
  return 'en';
}

// API для скачивания YouTube видео
app.post('/api/download-youtube', asyncHandler(async (req, res) => {
  const { url } = req.body;
  let responseSent = false; // Защита от двойной отправки

  console.log(`📨 Получен запрос на скачивание: ${url}`);

  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }

  try {
    const videoId = extractVideoId(url);
    const timestamp = Date.now();
    const filenameTemplate = `${videoId}_${timestamp}.%(ext)s`;
    const filepath = path.join(TEMP_DIR, filenameTemplate);
    
    // Определяем платформу для оптимизации параметров
    const platform = url.includes('instagram.com') ? 'instagram' : 
                     url.includes('tiktok.com') ? 'tiktok' : 'youtube';

    console.log(`📥 Скачиваю ${platform.toUpperCase()}: ${url}`);
    console.log(`📁 Шаблон файла: ${filenameTemplate}`);
    // Для TikTok используем SSSTik API
    if (platform === 'tiktok') {
      console.log('🎵 Используем SSSTik для TikTok');
      
      const ssstikScript = path.join(__dirname, 'scripts', 'download', 'download_ssstik.py');
      const ssstik = spawn('python', [ssstikScript, url, TEMP_DIR]);

      let stdoutData = '';
      let stderrData = '';

      ssstik.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      ssstik.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.log(`[SSSTik] ${data.toString().trim()}`);
      });

      ssstik.on('close', (code) => {
        if (responseSent) return;
        try {
          // Парсим JSON результат из stdout
          const lines = stdoutData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          
          if (!result.success) {
            console.error(`❌ SSSTik ошибка: ${result.error}`);
            responseSent = true;
            return res.status(500).json({ 
              error: `TikTok: ${result.error}. Попробуйте snaptik.app вручную`
            });
          }

          // Получаем путь к скачанному файлу
          const downloadedPath = result.file;
          
          if (!fs.existsSync(downloadedPath)) {
            responseSent = true;
            return res.status(500).json({ error: 'Файл не найден после скачивания' });
          }

          console.log(`✅ TikTok скачан: ${downloadedPath}`);

          // Читаем и отправляем
          const videoBuffer = fs.readFileSync(downloadedPath);
          const base64Video = videoBuffer.toString('base64');
          
          console.log(`📦 Размер: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

          responseSent = true;
          res.json({
            success: true,
            filename: path.basename(downloadedPath),
            size: videoBuffer.length,
            base64: base64Video,
            mimeType: 'video/mp4'
          });

          // Удаляем файл сразу после отправки
          setTimeout(() => {
            if (fs.existsSync(downloadedPath)) {
              fs.unlinkSync(downloadedPath);
              console.log(`🗑️  Удалён: ${path.basename(downloadedPath)}`);
            }
          }, 1000);

        } catch (parseError) {
          if (responseSent) return;
          console.error('❌ Ошибка парсинга результата:', parseError);
          console.error('stdout:', stdoutData);
          console.error('stderr:', stderrData);
          responseSent = true;
          res.status(500).json({ 
            error: 'TikTok: Ошибка обработки результата. Попробуйте snaptik.app вручную'
          });
        }
      });

      ssstik.on('error', (err) => {
        if (responseSent) return;
        console.error('❌ Ошибка запуска SSSTik:', err);
        responseSent = true;
        res.status(500).json({ 
          error: 'Не удалось запустить SSSTik. Попробуйте snaptik.app вручную',
          details: err.message
        });
      });

      return; // Выходим, не запускаем yt-dlp для TikTok
    }

    // Используем yt-dlp для YouTube и Instagram
    // Базовые параметры для всех платформ
    const baseArgs = [
      '--no-warnings',
      '--no-check-certificates',
      '--output', filepath, // Путь с шаблоном %(ext)s
      '--no-playlist',
      '--max-filesize', '150M',
      '--retries', '3',
      '--fragment-retries', '3',
      '--no-mtime', // Не изменять время модификации файла
      '--progress', // Показывать прогресс
    ];

    // Платформо-специфичные параметры
    if (platform === 'youtube') {
      const isShorts = url.includes('/shorts/');
      
      baseArgs.push(
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--extractor-args', 'youtube:player_client=android,web'
      );
      
      // Для Shorts используем более гибкие параметры формата
      if (isShorts) {
        baseArgs.push('--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
        console.log('📱 Обнаружен YouTube Shorts, используем специальные параметры');
      } else {
        baseArgs.push('--format', 'best[ext=mp4][height<=720]/best[ext=mp4]/best');
      }
    } else if (platform === 'instagram') {
      // Параметры для Instagram (Reels, посты, истории)
      baseArgs.push(
        '--referer', 'https://www.instagram.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--format', 'best[ext=mp4]/best', // Instagram может иметь разные форматы
        '--extractor-args', 'instagram:webpage_display=Desktop'
      );
    } else {
      // Для других платформ (TikTok через SSSTik, fallback)
      baseArgs.push('--format', 'best[ext=mp4]/best');
    }

    baseArgs.push(url);

    // Получаем правильную команду для yt-dlp
    let ytdlpConfig;
    try {
      ytdlpConfig = getYtDlpCommand(baseArgs);
      console.log(`🔧 Используем yt-dlp через: ${ytdlpConfig.command}`);
      console.log(`📋 Первые аргументы: ${ytdlpConfig.args.slice(0, 5).join(' ')}...`);
      console.log(`📁 Выходной файл: ${filepath}`);
    } catch (error) {
      if (responseSent) return;
      console.error('❌ yt-dlp не найден:', error.message);
      console.error('Проверка доступности:', checkYtDlpAvailable());
      responseSent = true;
      return res.status(500).json({ 
        error: error.message,
        help: 'Установите yt-dlp: pip install yt-dlp или скачайте с https://github.com/yt-dlp/yt-dlp/releases',
        check: checkYtDlpAvailable()
      });
    }

    // Запускаем yt-dlp
    console.log(`🚀 Запускаем: ${ytdlpConfig.command}`);
    console.log(`📋 Аргументы: ${ytdlpConfig.args.slice(0, 10).join(' ')}...`);
    console.log(`📁 Рабочая директория: ${TEMP_DIR}`);
    
    // Для Windows используем shell: true для более надежной работы с путями
    const useShell = process.platform === 'win32';
    console.log(`🔧 Используем shell: ${useShell} (платформа: ${process.platform})`);
    
    const spawnOptions = {
      cwd: TEMP_DIR, // Устанавливаем рабочую директорию
      stdio: ['ignore', 'pipe', 'pipe'], // stdin, stdout, stderr
      windowsHide: true, // Скрываем окно консоли на Windows
      shell: useShell
    };
    
    const ytdlp = spawn(ytdlpConfig.command, ytdlpConfig.args, spawnOptions);

    let errorOutput = '';
    let stdoutOutput = '';

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutOutput += output;
      console.log(`[yt-dlp stdout] ${output.trim()}`);
    });

    ytdlp.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      console.error(`[yt-dlp stderr] ${output.trim()}`);
    });

    ytdlp.on('close', (code) => {
      if (responseSent) return;
      console.log(`📊 yt-dlp завершился с кодом: ${code}`);
      
      if (code !== 0) {
        console.error(`❌ yt-dlp завершился с кодом ${code}`);
        console.error(`📝 stdout (первые 500 символов): ${stdoutOutput.substring(0, 500)}`);
        console.error(`📝 stderr (первые 500 символов): ${errorOutput.substring(0, 500)}`);
        
        // Определяем тип ошибки
        let userMessage = 'Ошибка при скачивании видео';
        let errorCode = 'UNKNOWN_ERROR';
        let suggestions = [];
        const isShorts = url.includes('/shorts/');
        
        // Instagram ошибки
        if (errorOutput.includes('There is no video in this post') || 
            errorOutput.includes('No video formats found') ||
            errorOutput.includes('This post does not contain a video')) {
          userMessage = '📸 Это Instagram пост с фото, а не видео. Используйте ссылку на Instagram Reels (видео)';
          errorCode = 'INSTAGRAM_NO_VIDEO';
        } else if (errorOutput.includes('Login required') && platform === 'instagram') {
          userMessage = 'Instagram требует авторизацию. Попробуйте публичную ссылку на Reels';
          errorCode = 'INSTAGRAM_LOGIN_REQUIRED';
        } else if (errorOutput.includes('Private') && platform === 'instagram') {
          userMessage = 'Это приватный Instagram пост. Используйте публичную ссылку';
          errorCode = 'INSTAGRAM_PRIVATE';
        }
        // YouTube ошибки
        else if (errorOutput.includes('HTTP Error 404') || 
                 errorOutput.includes('unable to download') ||
                 errorOutput.includes('HTTP 404') ||
                 errorOutput.includes('404 Not Found')) {
          if (platform === 'youtube' && isShorts) {
            userMessage = '⚠️ YouTube Shorts: Видео не найдено или удалено. Проверьте ссылку';
            errorCode = 'YOUTUBE_SHORTS_404';
            suggestions = [
              'Проверьте, что ссылка на Shorts правильная',
              'Попробуйте использовать y2mate.com для скачивания',
              'Попробуйте конвертировать ссылку Shorts в обычную ссылку YouTube'
            ];
          } else {
            userMessage = platform === 'youtube' 
              ? '⚠️ YouTube: Видео не найдено или удалено. Проверьте ссылку или попробуйте скачать вручную (y2mate.com)'
              : 'Видео недоступно или удалено';
            errorCode = 'YOUTUBE_404';
            if (platform === 'youtube') {
              suggestions = [
                'Проверьте, что ссылка правильная и видео существует',
                'Попробуйте использовать y2mate.com для скачивания',
                'Попробуйте другую ссылку на то же видео'
              ];
            }
          }
        } else if (errorOutput.includes('Video unavailable') || 
                   errorOutput.includes('not available') ||
                   errorOutput.includes('unavailable')) {
          userMessage = `Видео недоступно. Возможно, оно приватное, удалено или заблокировано в вашем регионе`;
          errorCode = 'YOUTUBE_UNAVAILABLE';
          suggestions = [
            'Проверьте, что видео публичное и доступно',
            'Попробуйте использовать VPN',
            'Используйте альтернативные сервисы (y2mate.com)'
          ];
        } else if (errorOutput.includes('Private video') || 
                   errorOutput.includes('private') ||
                   errorOutput.includes('Private')) {
          userMessage = 'Это приватное видео, доступ запрещён';
          errorCode = 'YOUTUBE_PRIVATE';
        } else if (errorOutput.includes('age-restricted') || 
                   errorOutput.includes('Age-restricted')) {
          userMessage = 'Видео имеет возрастные ограничения. yt-dlp не может скачать такие видео без авторизации';
          errorCode = 'YOUTUBE_AGE_RESTRICTED';
          suggestions = [
            'Используйте альтернативные сервисы (y2mate.com)',
            'Попробуйте скачать через браузер с авторизацией'
          ];
        } else if (errorOutput.includes('Login required') || 
                   errorOutput.includes('Sign in') ||
                   errorOutput.includes('authentication')) {
          userMessage = 'Требуется авторизация. Попробуйте скачать вручную через y2mate.com';
          errorCode = 'YOUTUBE_LOGIN_REQUIRED';
        } else if (errorOutput.includes('is not a valid URL') || 
                   errorOutput.includes('Invalid URL') ||
                   errorOutput.includes('ERROR: Unsupported URL')) {
          userMessage = 'Неверный URL. Проверьте ссылку на видео';
          errorCode = 'INVALID_URL';
        } else if (errorOutput.includes('ERROR') && errorOutput.includes('youtube')) {
          if (isShorts) {
            userMessage = 'Ошибка при скачивании YouTube Shorts. Возможно, YouTube временно заблокировал запрос';
            errorCode = 'YOUTUBE_SHORTS_ERROR';
            suggestions = [
              'Подождите 2-3 минуты и попробуйте снова',
              'Используйте альтернативные сервисы (y2mate.com, savefrom.net)',
              'Обновите yt-dlp: pip install -U yt-dlp'
            ];
          } else {
            userMessage = 'Ошибка при скачивании с YouTube. Возможно, YouTube временно заблокировал запрос';
            errorCode = 'YOUTUBE_ERROR';
            suggestions = [
              'Подождите 2-3 минуты и попробуйте снова',
              'Используйте альтернативные сервисы (y2mate.com, savefrom.net)',
              'Обновите yt-dlp: pip install -U yt-dlp'
            ];
          }
        } else if (errorOutput.includes('Command not found') || 
                   errorOutput.includes('not recognized') ||
                   errorOutput.includes('not found')) {
          userMessage = 'yt-dlp не установлен или не найден. Установите: pip install yt-dlp';
          errorCode = 'YTDLP_NOT_FOUND';
          suggestions = [
            'Установите yt-dlp: pip install yt-dlp',
            'Или скачайте бинарник: https://github.com/yt-dlp/yt-dlp/releases'
          ];
        } else if (errorOutput.includes('Unsupported URL') || 
                   errorOutput.includes('No video formats') ||
                   errorOutput.includes('No formats found')) {
          userMessage = platform === 'instagram'
            ? 'Не удалось найти видео в этом Instagram посте. Убедитесь, что это Reels или пост с видео'
            : 'Не удалось найти видео по этой ссылке. Возможно, формат не поддерживается';
          errorCode = 'NO_FORMATS';
        } else if (errorOutput.includes('429') || 
                   errorOutput.includes('Too Many Requests') ||
                   errorOutput.includes('rate limit')) {
          userMessage = 'Превышен лимит запросов. Подождите 2-3 минуты и попробуйте снова';
          errorCode = 'RATE_LIMIT';
          suggestions = [
            'Подождите 2-3 минуты перед повторной попыткой',
            'Используйте альтернативные сервисы'
          ];
        } else if (errorOutput.includes('403') || 
                   errorOutput.includes('Forbidden') ||
                   errorOutput.includes('HTTP 403')) {
          userMessage = 'Доступ запрещён. YouTube заблокировал запрос';
          errorCode = 'YOUTUBE_403';
          suggestions = [
            'Попробуйте позже',
            'Используйте альтернативные сервисы (y2mate.com)',
            'Обновите yt-dlp: pip install -U yt-dlp'
          ];
        } else if (errorOutput.includes('Network') || 
                   errorOutput.includes('Connection') ||
                   errorOutput.includes('timeout')) {
          userMessage = 'Ошибка сети. Проверьте подключение к интернету';
          errorCode = 'NETWORK_ERROR';
          suggestions = [
            'Проверьте подключение к интернету',
            'Попробуйте позже'
          ];
        } else {
          // Общая ошибка - показываем более детальную информацию
          if (platform === 'youtube' && isShorts) {
            userMessage = `Ошибка при скачивании YouTube Shorts. Попробуйте позже или используйте альтернативные сервисы`;
            errorCode = 'YOUTUBE_SHORTS_ERROR';
            suggestions = [
              'Попробуйте использовать y2mate.com или savefrom.net',
              'Обновите yt-dlp: pip install -U yt-dlp',
              'Проверьте, что Shorts доступен и не приватный',
              'Попробуйте конвертировать ссылку Shorts в обычную ссылку YouTube'
            ];
          } else {
            userMessage = `Ошибка при скачивании ${platform === 'youtube' ? 'YouTube' : platform === 'instagram' ? 'Instagram' : 'видео'}. Попробуйте позже или используйте альтернативные сервисы`;
            errorCode = 'GENERAL_ERROR';
            if (platform === 'youtube') {
              suggestions = [
                'Попробуйте использовать y2mate.com или savefrom.net',
                'Обновите yt-dlp: pip install -U yt-dlp',
                'Проверьте, что видео доступно и не приватное'
              ];
            }
          }
        }
        
        responseSent = true;
        return res.status(500).json({ 
          error: userMessage,
          platform: platform,
          errorCode: errorCode,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          technical: errorOutput.substring(0, 500)
        });
      }

      // Проверяем, что файл создан
      // yt-dlp использует шаблон %(ext)s, поэтому ищем файл с нужным префиксом
      const baseName = `${videoId}_${timestamp}`;
      console.log(`🔍 Ищем файл с префиксом: ${baseName}`);
      
      let files = [];
      try {
        files = fs.readdirSync(TEMP_DIR);
        console.log(`📁 Файлы в temp_videos: ${files.length} файлов`);
      } catch (dirError) {
        console.error('❌ Ошибка чтения директории:', dirError);
        if (responseSent) return;
        responseSent = true;
        return res.status(500).json({ 
          error: 'Ошибка доступа к папке временных файлов',
          details: dirError.message
        });
      }
      
      const matchingFile = files.find(f => f.startsWith(baseName));
      
      if (!matchingFile) {
        console.error('❌ Файл не найден после скачивания');
        console.error(`Искали файл с префиксом: ${baseName}`);
        console.error(`Доступные файлы (${files.length}):`, files.slice(0, 10).join(', '));
        console.error(`stdout: ${stdoutOutput.substring(0, 500)}`);
        console.error(`stderr: ${errorOutput.substring(0, 500)}`);
        if (responseSent) return;
        responseSent = true;
        return res.status(500).json({ 
          error: 'Файл не создан после скачивания',
          details: `Искали: ${baseName}, найдено файлов: ${files.length}`,
          stdout: stdoutOutput.substring(0, 200),
          stderr: errorOutput.substring(0, 200)
        });
      }
      
      const downloadedFile = path.join(TEMP_DIR, matchingFile);

      const actualFilename = path.basename(downloadedFile);
      console.log(`✅ Видео скачано: ${actualFilename}`);

      try {
        // Определяем MIME тип по расширению
        const ext = path.extname(downloadedFile).toLowerCase();
        const mimeTypes = {
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mkv': 'video/x-matroska',
          '.mov': 'video/quicktime',
          '.avi': 'video/x-msvideo',
          '.flv': 'video/x-flv'
        };
        const mimeType = mimeTypes[ext] || 'video/mp4';

        // Читаем файл и отправляем как base64
        const videoBuffer = fs.readFileSync(downloadedFile);
        const base64Video = videoBuffer.toString('base64');
        
        console.log(`📦 Размер: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📄 Формат: ${ext} (${mimeType})`);

        responseSent = true;
        res.json({
          success: true,
          filename: actualFilename,
          size: videoBuffer.length,
          base64: base64Video,
          mimeType: mimeType
        });

        // Удаляем файл через 5 минут
        setTimeout(() => {
          if (fs.existsSync(downloadedFile)) {
            fs.unlinkSync(downloadedFile);
            console.log(`🗑️  Удалён: ${actualFilename}`);
          }
        }, 300000);

      } catch (readError) {
        if (responseSent) return;
        console.error('❌ Ошибка чтения файла:', readError);
        responseSent = true;
        res.status(500).json({ error: 'Ошибка чтения видео' });
      }
    });

    ytdlp.on('error', (err) => {
      if (responseSent) return;
      console.error('❌ Ошибка запуска yt-dlp:', err);
      responseSent = true;
      res.status(500).json({ 
        error: 'Не удалось запустить yt-dlp',
        details: err.message
      });
    });

  } catch (error) {
    if (responseSent) return;
    console.error('❌ Ошибка в /api/download-youtube:', error);
    console.error('Стек ошибки:', error.stack);
    responseSent = true;
    res.status(500).json({ 
      error: 'Не удалось скачать видео',
      details: error.message || 'Неизвестная ошибка',
      type: error.constructor.name
    });
  }
}));

// Извлечение ID видео из URL
function extractVideoId(url) {
  try {
    const urlObj = new URL(url.includes('://') ? url : 'https://' + url);
    
    // YouTube Shorts
    if (urlObj.pathname.includes('/shorts/')) {
      return 'yt_' + urlObj.pathname.split('/shorts/')[1].split(/[?&#]/)[0];
    }
    
    // YouTube youtu.be
    if (urlObj.hostname.includes('youtu.be')) {
      return 'yt_' + urlObj.pathname.slice(1).split(/[?&#]/)[0];
    }
    
    // YouTube youtube.com/watch
    if (urlObj.searchParams.has('v')) {
      return 'yt_' + urlObj.searchParams.get('v');
    }
    
    // Instagram Reels
    if (urlObj.hostname.includes('instagram.com')) {
      if (urlObj.pathname.includes('/reel/')) {
        return 'ig_' + urlObj.pathname.split('/reel/')[1].split(/[?&#]/)[0];
      }
      if (urlObj.pathname.includes('/p/')) {
        return 'ig_' + urlObj.pathname.split('/p/')[1].split(/[?&#]/)[0];
      }
      return 'ig_post';
    }
    
    // TikTok
    if (urlObj.hostname.includes('tiktok.com')) {
      if (urlObj.pathname.includes('/video/')) {
        return 'tt_' + urlObj.pathname.split('/video/')[1].split(/[?&#]/)[0];
      }
      // vm.tiktok.com короткие ссылки
      if (urlObj.hostname.includes('vm.tiktok.com')) {
        return 'tt_' + urlObj.pathname.slice(1).split(/[?&#]/)[0];
      }
      return 'tt_video';
    }
    
    // Fallback
    return 'video_' + Date.now();
  } catch {
    return 'video_' + Date.now();
  }
}

// API для генерации сценария на основе Паспорта стиля (Уровень 3)
app.post('/api/generate-scenario', async (req, res) => {
  const { passport, topic, version = 1 } = req.body;
  
  console.log(`📝 Генерация сценария: "${topic}" (вариант ${version})`);
  
  if (!passport || !topic) {
    return res.status(400).json({ 
      error: 'Необходимы паспорт стиля и тема сценария' 
    });
  }
  
  try {
    // Получаем API ключ из переменных окружения
    let finalApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    // Отладочный вывод
    console.log('🔍 Проверка переменных окружения:');
    console.log('  - process.env.GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'найден (' + process.env.GEMINI_API_KEY.substring(0, 10) + '...)' : 'НЕ НАЙДЕН');
    console.log('  - process.env.API_KEY:', process.env.API_KEY ? 'найден (' + process.env.API_KEY.substring(0, 10) + '...)' : 'НЕ НАЙДЕН');
    console.log('  - Итоговый finalApiKey:', finalApiKey ? 'найден' : 'НЕ НАЙДЕН');
    
    if (!finalApiKey) {
      // Попробуем загрузить напрямую из файла как последнюю попытку
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        try {
          // Читаем файл как буфер, затем конвертируем в строку, удаляя BOM
          const envBuffer = fs.readFileSync(envPath);
          let envContent = envBuffer.toString('utf-8');
          // Удаляем BOM (UTF-8 BOM = EF BB BF или U+FEFF)
          if (envContent.charCodeAt(0) === 0xFEFF) {
            envContent = envContent.substring(1);
          }
          envContent = envContent.replace(/^\uFEFF/, '');
          
          // Парсим построчно с учетом CRLF (\r\n)
          const lines = envContent.split(/\r?\n/);
          for (const line of lines) {
            let trimmed = line.trim();
            // Удаляем BOM из начала строки
            trimmed = trimmed.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E]/g, '');
            
            if (trimmed.startsWith('GEMINI_API_KEY=')) {
              const loadedKey = trimmed.substring('GEMINI_API_KEY='.length).trim();
              // Удаляем кавычки если есть и остатки \r
              const cleanKey = loadedKey.replace(/^["']|["']$/g, '').replace(/\r$/, '');
              if (cleanKey) {
                console.log('✅ Ключ загружен напрямую из .env файла в endpoint');
                process.env.GEMINI_API_KEY = cleanKey;
                finalApiKey = cleanKey;
                break;
              }
            }
          }
        } catch (readError) {
          console.error('❌ Ошибка чтения .env:', readError);
        }
      }
      
      if (!finalApiKey) {
        return res.status(500).json({ 
          error: 'GEMINI_API_KEY не настроен в переменных окружения',
          debug: {
            envPath: path.join(__dirname, '.env'),
            envExists: fs.existsSync(path.join(__dirname, '.env')),
            allEnvKeys: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API_KEY'))
          }
        });
      }
    }
    
    console.log('🔑 Используемый API ключ:', finalApiKey.substring(0, 10) + '...');
    const ai = new GoogleGenAI({ apiKey: finalApiKey });
    
    // Формируем промпт на основе Паспорта стиля
    const prompt = createScenarioPrompt(passport, topic, version);
    
    console.log('🤖 Отправка запроса в Gemini...');
    
    // Используем правильный API как в geminiService.ts
    // ВАЖНО: Снижаем температуру для строгого следования правилам из паспорта стиля
    // Небольшая вариативность между версиями, но всегда LOW для точности
    const temperature = version === 1 ? 0.2 : version === 2 ? 0.3 : 0.4;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        temperature: temperature,
      }
    });
    
    let text = response.text || '';
    
    if (!text) {
      throw new Error('Пустой ответ от Gemini API');
    }
    
    // Проверяем, что это не JSON паспорта стиля
    text = text.trim();
    if (text.startsWith('{') && (text.includes('"style_passport_version"') || text.includes('"tone_of_voice"'))) {
      console.error('❌ Gemini вернул паспорт стиля вместо сценария!');
      throw new Error('Gemini вернул паспорт стиля вместо сценария. Попробуйте еще раз или измените тему.');
    }
    
    // Удаляем markdown обёртки если есть
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```\s*$/, '');
    }
    
    console.log('📝 Получен ответ от Gemini (первые 200 символов):', text.substring(0, 200));
    
    // Парсим ответ в формат сценария
    const scenario = parseScenarioResponse(text, topic, version);
    
    console.log(`✅ Сценарий сгенерирован: ${scenario.segments.length} сегментов`);
    
    res.json({
      success: true,
      scenario: scenario
    });
    
  } catch (error) {
    console.error('❌ Ошибка генерации сценария:', error);
    res.status(500).json({
      error: 'Ошибка генерации сценария',
      details: error.message || String(error)
    });
  }
});

// Функция создания промпта для генерации сценария
function createScenarioPrompt(passport, topic, version) {
  const insights = extractInsights(passport);
  
  // Формируем список Do/Don't правил
  const doRules = passport.do_dont?.do || [];
  const dontRules = passport.do_dont?.dont || [];
  const generationRules = passport.generation_rules || [];
  
  // Извлекаем паттерны речи из транскрипции, если есть
  const speechPatterns = passport.style_analysis?.speech_patterns;
  const transcript = passport.transcript || '';
  
  return `⚠️⚠️⚠️ КРИТИЧЕСКИ ВАЖНО: Ты должен создать СЦЕНАРИЙ ВИДЕО, а НЕ паспорт стиля! Это НЕ анализ, а готовый сценарий для съемки!

Ты — профессиональный сценарист для коротких видео (Shorts/Reels/TikTok).

ЗАДАЧА: Создай посекундный СЦЕНАРИЙ для видео на тему "${topic}" в ТОЧНОМ стиле автора, полностью копируя его шаблон и паттерны.

═══════════════════════════════════════════════════════════════════
🎯 ГЛАВНОЕ ПРАВИЛО: ТЫ ДОЛЖЕН ПОЛНОСТЬЮ КОПИРОВАТЬ СТИЛЬ АВТОРА!
═══════════════════════════════════════════════════════════════════

ПАСПОРТ СТИЛЯ АВТОРА (используй эти данные для создания сценария):
${insights}

${transcript ? `\n📝 ТРАНСКРИПЦИЯ ОРИГИНАЛЬНОГО ВИДЕО (изучи стиль речи автора):\n${transcript.substring(0, 2000)}${transcript.length > 2000 ? '...' : ''}\n` : ''}

${speechPatterns ? `\n🗣️ ПАТТЕРНЫ РЕЧИ АВТОРА:\n- Частые фразы: ${speechPatterns.common_phrases?.join(', ') || 'нет'}\n- Слова-паразиты: ${speechPatterns.filler_words?.join(', ') || 'нет'}\n- Средняя длина предложения: ${speechPatterns.average_sentence_length || 0} слов\n` : ''}

═══════════════════════════════════════════════════════════════════
✅ ОБЯЗАТЕЛЬНО ДЕЛАТЬ (DO) - СТРОГО ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:
═══════════════════════════════════════════════════════════════════
${doRules.length > 0 ? doRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n') : 'Нет правил Do'}
${doRules.length > 0 ? `

🚨 КРИТИЧЕСКИ ВАЖНО - ПРОВЕРКА ПРАВИЛ DO:
Ты ОБЯЗАН применить КАЖДОЕ правило из списка DO.
- Каждое правило должно быть явно указано в поле "Правила:" соответствующего сегмента
- В конце сценария ОБЯЗАТЕЛЬНО добавь секцию "ПРОВЕРКА СОБЛЮДЕНИЯ ПРАВИЛ DO:" где перечислишь:
  * Какое правило DO применено
  * В каком сегменте (таймкод)
  * Как именно применено (цитата из сценария)
- Если хотя бы ОДНО правило DO не применено - сценарий считается НЕПРАВИЛЬНЫМ!` : ''}

═══════════════════════════════════════════════════════════════════
❌ СТРОГО ЗАПРЕЩЕНО (DON'T) - АБСОЛЮТНЫЙ ЗАПРЕТ:
═══════════════════════════════════════════════════════════════════
${dontRules.length > 0 ? dontRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n') : 'Нет правил Don\'t'}
${dontRules.length > 0 ? `

🚨 КРИТИЧЕСКИ ВАЖНО - ПРОВЕРКА ПРАВИЛ DON'T:
Ты НЕ ДОЛЖЕН делать НИЧЕГО из списка DON'T.
- Если хотя бы ОДНО действие из списка DON'T появится в сценарии - сценарий ПРОВАЛЕН!
- Перед отправкой ответа ОБЯЗАТЕЛЬНО перечитай сценарий и убедись, что НИ ОДНО правило DON'T не нарушено!` : ''}

═══════════════════════════════════════════════════════════════════
📋 ПРАВИЛА ИМИТАЦИИ (GENERATION RULES) - СТРОГО ОБЯЗАТЕЛЬНЫЕ:
═══════════════════════════════════════════════════════════════════
${generationRules.length > 0 ? generationRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n') : 'Правила не указаны'}
${generationRules.length > 0 ? `

🚨 КРИТИЧЕСКИ ВАЖНО - ПРОВЕРКА GENERATION RULES:
Ты ОБЯЗАН применить КАЖДОЕ правило имитации.
- Каждое правило должно быть явно указано в поле "Правила:" соответствующего сегмента
- В конце сценария ОБЯЗАТЕЛЬНО добавь секцию "ПРОВЕРКА СОБЛЮДЕНИЯ GENERATION RULES:" где перечислишь:
  * Какое правило применено
  * В каком сегменте (таймкод)
  * Как именно применено (цитата из сценария)
- Если хотя бы ОДНО правило не применено - сценарий считается НЕПРАВИЛЬНЫМ!` : ''}

═══════════════════════════════════════════════════════════════════
🎬 ОБЯЗАТЕЛЬНЫЕ ФОРМУЛЫ АВТОРА (СТРОГО ПРИМЕНЯЙ):
═══════════════════════════════════════════════════════════════════
${passport.style_template?.hook_formula ? `🎣 HOOK (00:00-00:05): ${passport.style_template.hook_formula}
   👉 Это ОБЯЗАТЕЛЬНАЯ формула для hook! Применяй ТОЧНО так!` : ''}

${passport.style_template?.climax_formula ? `🔥 CLIMAX: ${passport.style_template.climax_formula}
   👉 Это ОБЯЗАТЕЛЬНАЯ формула для кульминации! Применяй ТОЧНО так!` : ''}

${passport.style_template?.cta_formula ? `📢 CTA (финал): ${passport.style_template.cta_formula}
   👉 Это ОБЯЗАТЕЛЬНАЯ формула для CTA! Применяй ТОЧНО так!` : ''}

${passport.style_template?.mandatory_elements?.length > 0 ? `⚡ ОБЯЗАТЕЛЬНЫЕ ЭЛЕМЕНТЫ (должны быть в сценарии):
${passport.style_template.mandatory_elements.map((elem, idx) => `   ${idx + 1}. ${elem}`).join('\n')}` : ''}

═══════════════════════════════════════════════════════════════════
🎬 СТИЛЬ И ШАБЛОН АВТОРА (КОПИРУЙ ТОЧНО):
═══════════════════════════════════════════════════════════════════
1. ТОН И ГОЛОС:
   - Архетип: ${passport.tone_of_voice?.archetype || 'не указан'}
   - Настроение: ${passport.tone_of_voice?.mood?.join(', ') || 'не указано'}
   - Формальность: ${passport.tone_of_voice?.formality_level_0_10 || 5}/10
   - Сигнатурные фразы: ${passport.tone_of_voice?.signature_phrases?.join(', ') || 'нет'} ${passport.tone_of_voice?.signature_phrases?.length > 0 ? '← ОБЯЗАТЕЛЬНО используй минимум ' + Math.min(3, passport.tone_of_voice.signature_phrases.length) + ' фразы!' : ''}
   - Обращения к зрителю: ${passport.tone_of_voice?.direct_address_patterns?.join(', ') || 'нет'}

2. ТЕМП РЕЧИ:
   - Темп: ${passport.speech_pace?.pace_label || 'medium'} (${passport.speech_pace?.wpm_estimate || 150} слов/мин)
   - Стиль пауз: ${passport.speech_pace?.pause_style || 'не указан'}

3. СТРУКТУРА ВИДЕО (следуй ТОЧНО этому порядку):
${passport.structure?.map(s => `   - ${s.part}: ${s.t_start}-${s.t_end} (${s.description || 'без описания'})`).join('\n') || '   - Стандартная структура: hook, setup, main, climax, cta'}

4. ВИЗУАЛЬНЫЙ СТИЛЬ:
   - Типы кадров: ${passport.visual_style?.shot_types?.join(', ') || 'разные планы'}
   - Монтаж: ${passport.visual_style?.editing || 'не указан'}
   - Текст на экране: ${passport.visual_style?.on_screen_text_style || 'белый текст'}
   - Типичные действия: ${passport.visual_style?.typical_actions?.join(', ') || 'нет'}

5. ПАТТЕРНЫ УДЕРЖАНИЯ (используй в сценарии):
${passport.retention_patterns?.map(p => `   - ${p.pattern}: ${p.how_it_looks_in_text} (${p.where_in_video.join(', ')})`).join('\n') || '   - Нет паттернов'}

═══════════════════════════════════════════════════════════════════
📝 ФОРМАТ ВЫВОДА (СТРОГО ОБЯЗАТЕЛЬНЫЙ, НЕ возвращай JSON!):
═══════════════════════════════════════════════════════════════════

Для КАЖДОГО сегмента сценария используй этот формат:

[00:00-00:05] HOOK
Кадр: [Описание визуала в ТОЧНОМ стиле автора: тип кадра, движение камеры, объекты, действия]
Текст: [Хук/текст в ТОЧНОМ стиле автора со всеми сигнатурными фразами и паттернами речи]
Текст на экране: [Если есть - точный текст, стиль, позиция, как в стиле автора]
Примененные DO: [DO 1 - как применено, DO 3 - как применено, ...]
Примененные GENERATION RULES: [Правило 2 - как применено, Правило 5 - как применено, ...]
Паттерны удержания: [Какие паттерны из passport.retention_patterns использованы]

[00:05-00:15] SETUP
Кадр: [...]
Текст: [...]
Текст на экране: [...]
Примененные DO: [...]
Примененные GENERATION RULES: [...]
Паттерны удержания: [...]

[00:15-00:30] MAIN (часть 1)
Кадр: [...]
Текст: [...]
Текст на экране: [...]
Примененные DO: [...]
Примененные GENERATION RULES: [...]
Паттерны удержания: [...]

[00:30-00:45] MAIN (часть 2)
Кадр: [...]
Текст: [...]
Текст на экране: [...]
Примененные DO: [...]
Примененные GENERATION RULES: [...]
Паттерны удержания: [...]

[00:45-00:60] CLIMAX + CTA
Кадр: [...]
Текст: [...]
Текст на экране: [...]
Примененные DO: [...]
Примененные GENERATION RULES: [...]
Паттерны удержания: [...]

═══════════════════════════════════════════════════════════════════
🔍 ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА СОБЛЮДЕНИЯ ПРАВИЛ (добавь в конце):
═══════════════════════════════════════════════════════════════════

✅ ПРОВЕРКА DO ПРАВИЛ:
${doRules.length > 0 ? doRules.map((rule, idx) => `DO ${idx + 1}: [укажи в каком сегменте и как применено]`).join('\n') : 'Нет DO правил'}

✅ ПРОВЕРКА GENERATION RULES:
${generationRules.length > 0 ? generationRules.map((rule, idx) => `Правило ${idx + 1}: [укажи в каком сегменте и как применено]`).join('\n') : 'Нет Generation Rules'}

❌ ПРОВЕРКА DON'T ПРАВИЛ (убедись, что НИ ОДНО не нарушено):
${dontRules.length > 0 ? dontRules.map((rule, idx) => `DON'T ${idx + 1}: [подтверди, что НЕ нарушено]`).join('\n') : 'Нет DON\'T правил'}

═══════════════════════════════════════════════════════════════════
🚨🚨🚨 КРИТИЧЕСКИ ВАЖНЫЕ ТРЕБОВАНИЯ (НЕСОБЛЮДЕНИЕ = ПРОВАЛ):
═══════════════════════════════════════════════════════════════════

1. СТРОГОЕ СОБЛЮДЕНИЕ СТИЛЯ АВТОРА В ТЕКСТЕ:
   ${passport.tone_of_voice?.signature_phrases?.length > 0 ? `✓ ОБЯЗАТЕЛЬНО используй сигнатурные фразы: ${passport.tone_of_voice.signature_phrases.join(', ')}
   ✓ Минимум ${Math.min(3, passport.tone_of_voice.signature_phrases.length)} фразы должны появиться в сценарии` : ''}
   ✓ Темп речи СТРОГО: ${passport.speech_pace?.pace_label || 'medium'} (${passport.speech_pace?.wpm_estimate || 150} слов/мин)
   ✓ Тон и архетип: ${passport.tone_of_voice?.archetype || 'neutral'}
   ✓ Формальность: ${passport.tone_of_voice?.formality_level_0_10 || 5}/10 - НЕ отклоняйся!
   ${speechPatterns?.common_phrases?.length > 0 ? `✓ Используй частые фразы: ${speechPatterns.common_phrases.join(', ')}` : ''}
   ${speechPatterns?.filler_words?.length > 0 ? `✓ Добавляй слова-паразиты автора: ${speechPatterns.filler_words.join(', ')}` : ''}
   ${passport.tone_of_voice?.direct_address_patterns?.length > 0 ? `✓ Обращайся к зрителю как автор: ${passport.tone_of_voice.direct_address_patterns.join(', ')}` : ''}

2. СТРОГОЕ СОБЛЮДЕНИЕ ВИЗУАЛЬНОГО СТИЛЯ:
   ✓ Типы кадров ТОЛЬКО: ${passport.visual_style?.shot_types?.join(', ') || 'крупный план, средний план'}
   ✓ Стиль монтажа: ${passport.visual_style?.editing || 'быстрые переходы'}
   ✓ Текст на экране: ${passport.visual_style?.on_screen_text_style || 'белый текст с тенью'}
   ✓ Действия персонажа: ${passport.visual_style?.typical_actions?.join(', ') || 'энергичные жесты'}

3. СТРОГОЕ СЛЕДОВАНИЕ СТРУКТУРЕ:
   ✓ Структура ТОЧНО: ${passport.structure?.map(s => `${s.part} (${s.t_start}-${s.t_end})`).join(' → ') || 'hook → setup → main → climax → cta'}
   ${passport.structure?.length > 0 ? `✓ Для каждого сегмента применяй описанные приемы удержания:
${passport.structure.map(s => `   - ${s.part}: ${s.why_it_holds?.slice(0, 2).join(', ') || 'удерживает внимание'}`).join('\n')}` : ''}

4. АБСОЛЮТНАЯ ОБЯЗАТЕЛЬНОСТЬ DO/DON'T/GENERATION RULES:
   🚨 ВСЕ ${doRules.length} правил DO ОБЯЗАНЫ быть применены
   🚨 ВСЉ ${generationRules.length} GENERATION RULES ОБЯЗАНЫ быть применены
   🚨 НИ ОДНО из ${dontRules.length} правил DON'T НЕ ДОЛЖНО появиться
   🚨 Каждое примененное правило ОБЯЗАТЕЛЬНО указывай в соответствующем поле сегмента

5. ОБЯЗАТЕЛЬНАЯ СТРУКТУРА КАЖДОГО СЕГМЕНТА:
   Каждый сегмент ОБЯЗАН содержать:
   ✓ Кадр: детальное описание визуала
   ✓ Текст: речь в стиле автора
   ✓ Текст на экране: если используется
   ✓ Примененные DO: конкретные номера и как применены
   ✓ Примененные GENERATION RULES: конкретные номера и как применены
   ✓ Паттерны удержания: какие из ${passport.retention_patterns?.length || 0} паттернов использованы

6. ФИНАЛЬНАЯ ПРОВЕРКА (ОБЯЗАТЕЛЬНА В КОНЦЕ СЦЕНАРИЯ):
   ✓ Секция "ПРОВЕРКА DO ПРАВИЛ" - для КАЖДОГО DO правила
   ✓ Секция "ПРОВЕРКА GENERATION RULES" - для КАЖДОГО правила
   ✓ Секция "ПРОВЕРКА DON'T ПРАВИЛ" - подтверждение что НИ ОДНО не нарушено

═══════════════════════════════════════════════════════════════════
🎨 ВАРИАНТ ${version} - УНИКАЛЬНОСТЬ В РАМКАХ СТРОГИХ ПРАВИЛ:
═══════════════════════════════════════════════════════════════════
${version === 1 ? 
  'Это ПЕРВЫЙ (эталонный) вариант сценария. Создай сценарий, который МАКСИМАЛЬНО ТОЧНО следует ВСЕМ правилам и шаблону автора. Это должен быть эталонный пример применения ВСЕХ DO, GENERATION RULES и паттернов.' :
  version === 2 ?
  'Это ВТОРОЙ (креативный) вариант сценария. ОБЯЗАТЕЛЬНО применяй ВСЕ DO и GENERATION RULES, но используй более неожиданные примеры и повороты темы. ПРАВИЛА НЕИЗМЕННЫ - меняется только тема и примеры!' :
  version === 3 ?
  'Это ТРЕТИЙ (альтернативный) вариант сценария. ОБЯЗАТЕЛЬНО применяй ВСЕ DO и GENERATION RULES, экспериментируй с углом зрения на тему, но СТРОГО соблюдай все правила и стиль автора!' :
  `Это ВАРИАНТ ${version}. ОБЯЗАТЕЛЬНО применяй ВСЕ DO и GENERATION RULES. Уникальность в ${version % 2 === 0 ? 'динамике подачи' : 'деталях примеров'}, но ПРАВИЛА и СТИЛЬ неизменны!`
}

🚨🚨🚨 КРИТИЧЕСКИ ВАЖНО ПЕРЕД НАЧАЛОМ ГЕНЕРАЦИИ - КОНТРОЛЬНЫЙ СПИСОК:
1. ✅ Прочитай ВСЕ ${doRules.length} правил DO - КАЖДОЕ должно быть применено
2. ✅ Прочитай ВСЕ ${generationRules.length} GENERATION RULES - КАЖДОЕ должно быть применено  
3. ✅ Прочитай ВСЕ ${dontRules.length} правил DON'T - НИ ОДНО не должно появиться
4. ✅ Прочитай ВСЕ ${passport.retention_patterns?.length || 0} паттернов удержания - используй их
5. ✅ ОБЯЗАТЕЛЬНО применяй ФОРМУЛЫ из style_template:
   ${passport.style_template?.hook_formula ? `- HOOK FORMULA: ${passport.style_template.hook_formula}` : '- Нет hook formula'}
   ${passport.style_template?.climax_formula ? `- CLIMAX FORMULA: ${passport.style_template.climax_formula}` : '- Нет climax formula'}
   ${passport.style_template?.cta_formula ? `- CTA FORMULA: ${passport.style_template.cta_formula}` : '- Нет cta formula'}
6. ✅ ОБЯЗАТЕЛЬНО включи ${passport.style_template?.mandatory_elements?.length || 0} обязательных элементов
7. ✅ Используй минимум ${passport.tone_of_voice?.signature_phrases?.length > 0 ? Math.min(3, passport.tone_of_voice.signature_phrases.length) : 0} сигнатурных фраз автора
8. ✅ Соблюдай темп речи: ${passport.speech_pace?.wpm_estimate || 150} слов/мин (${passport.speech_pace?.pace_label || 'medium'})

⚠️⚠️⚠️ НЕ ВОЗВРАЩАЙ JSON! ВОЗВРАЩАЙ ТОЛЬКО ТЕКСТОВЫЙ СЦЕНАРИЙ!
⚠️⚠️⚠️ В КОНЦЕ ОБЯЗАТЕЛЬНО добавь секции ПРОВЕРКИ ПРАВИЛ!
⚠️⚠️⚠️ КАЖДЫЙ сегмент должен содержать поля "Примененные DO:" и "Примененные GENERATION RULES:"!

Начни генерацию сценария прямо сейчас. Сначала мысленно составь список всех правил, которые нужно применить, затем создай сценарий, применяя КАЖДОЕ правило:`;
}

// Извлечение инсайтов из паспорта для промпта
function extractInsights(passport) {
  let insights = [];
  
  // Тон и голос
  if (passport.tone_of_voice) {
    insights.push(`- Архетип: ${passport.tone_of_voice.archetype}`);
    insights.push(`- Настроение: ${passport.tone_of_voice.mood?.join(', ')}`);
    insights.push(`- Формальность: ${passport.tone_of_voice.formality_level_0_10}/10`);
    if (passport.tone_of_voice.signature_phrases?.length > 0) {
      insights.push(`- Сигнатурные фразы: ${passport.tone_of_voice.signature_phrases.join(', ')}`);
    }
    if (passport.tone_of_voice.direct_address_patterns?.length > 0) {
      insights.push(`- Обращения: ${passport.tone_of_voice.direct_address_patterns.join(', ')}`);
    }
  }
  
  // Темп речи
  if (passport.speech_pace) {
    insights.push(`- Темп: ${passport.speech_pace.pace_label} (${passport.speech_pace.wpm_estimate} слов/мин)`);
    insights.push(`- Паузы: ${passport.speech_pace.pause_style}`);
  }
  
  // Структура
  if (passport.structure?.length > 0) {
    insights.push(`- Структура видео: ${passport.structure.map(s => `${s.part} (${s.t_start}-${s.t_end})`).join(', ')}`);
  }
  
  // Паттерны удержания
  if (passport.retention_patterns?.length > 0) {
    insights.push(`- Паттерны удержания: ${passport.retention_patterns.map(p => p.pattern).join(', ')}`);
  }
  
  // Визуальный стиль
  if (passport.visual_style) {
    insights.push(`- Типы кадров: ${passport.visual_style.shot_types?.join(', ')}`);
    insights.push(`- Монтаж: ${passport.visual_style.editing}`);
  }
  
  // Do/Don't (детально)
  if (passport.do_dont) {
    if (passport.do_dont.do?.length > 0) {
      insights.push(`- ✅ ОБЯЗАТЕЛЬНО ДЕЛАТЬ (DO):`);
      passport.do_dont.do.forEach((rule, idx) => {
        insights.push(`  ${idx + 1}. ${rule}`);
      });
    }
    if (passport.do_dont.dont?.length > 0) {
      insights.push(`- ❌ СТРОГО ЗАПРЕЩЕНО (DON'T):`);
      passport.do_dont.dont.forEach((rule, idx) => {
        insights.push(`  ${idx + 1}. ${rule}`);
      });
    }
  }
  
  // Правила генерации (детально)
  if (passport.generation_rules?.length > 0) {
    insights.push(`- 📋 ПРАВИЛА ИМИТАЦИИ (GENERATION RULES):`);
    passport.generation_rules.forEach((rule, idx) => {
      insights.push(`  ${idx + 1}. ${rule}`);
    });
  }
  
  // Паттерны речи из транскрипции
  if (passport.style_analysis?.speech_patterns) {
    const sp = passport.style_analysis.speech_patterns;
    if (sp.common_phrases?.length > 0) {
      insights.push(`- 🗣️ Частые фразы автора: ${sp.common_phrases.join(', ')}`);
    }
    if (sp.filler_words?.length > 0) {
      insights.push(`- 🗣️ Слова-паразиты автора: ${sp.filler_words.join(', ')}`);
    }
    if (sp.average_sentence_length > 0) {
      insights.push(`- 🗣️ Средняя длина предложения: ${sp.average_sentence_length} слов`);
    }
  }
  
  // Шаблон стиля (style_template) - критически важно для точного копирования
  if (passport.style_template) {
    insights.push(`\n🎯 ШАБЛОН СТИЛЯ АВТОРА (ТОЧНАЯ ФОРМУЛА УСПЕХА):`);
    if (passport.style_template.template_description) {
      insights.push(`  📖 Описание: ${passport.style_template.template_description}`);
    }
    if (passport.style_template.hook_formula) {
      insights.push(`  🎣 HOOK FORMULA (ОБЯЗАТЕЛЬНО применяй): ${passport.style_template.hook_formula}`);
    }
    if (passport.style_template.climax_formula) {
      insights.push(`  🔥 CLIMAX FORMULA (ОБЯЗАТЕЛЬНО применяй): ${passport.style_template.climax_formula}`);
    }
    if (passport.style_template.cta_formula) {
      insights.push(`  📢 CTA FORMULA (ОБЯЗАТЕЛЬНО применяй): ${passport.style_template.cta_formula}`);
    }
    if (passport.style_template.mandatory_elements?.length > 0) {
      insights.push(`  ⚡ ОБЯЗАТЕЛЬНЫЕ ЭЛЕМЕНТЫ В КАЖДОМ ВИДЕО:`);
      passport.style_template.mandatory_elements.forEach((elem, idx) => {
        insights.push(`    ${idx + 1}. ${elem}`);
      });
    }
    if (passport.style_template.step_by_step_structure?.length > 0) {
      insights.push(`  📝 ПОШАГОВАЯ СТРУКТУРА АВТОРА:`);
      passport.style_template.step_by_step_structure.forEach((step, idx) => {
        insights.push(`    Шаг ${idx + 1}: ${step}`);
      });
    }
  }
  
  // Целевая аудитория - важно для тона и стиля
  if (passport.target_audience) {
    insights.push(`\n👥 ЦЕЛЕВАЯ АУДИТОРИЯ (учитывай при создании): ${passport.target_audience}`);
  }
  
  return insights.join('\n');
}

// Парсинг ответа Gemini в структурированный сценарий
function parseScenarioResponse(text, topic, version) {
  const segments = [];
  
  // Улучшенное регулярное выражение для парсинга формата [00:00-00:05] с правилами
  // Поддерживает разные варианты форматирования
  const segmentRegex = /\[(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\]\s*\n?\s*(?:Кадр|Frame|кадр|frame)[:\s]+(.+?)\s*\n?\s*(?:Текст|Text|текст|text)[:\s]+(.+?)\s*\n?\s*(?:Правила|Rules|правила|rules)[:\s]*(.+?)(?=\n\s*\[|\n*$)/gis;
  
  let match;
  while ((match = segmentRegex.exec(text)) !== null) {
    // Парсим правила (могут быть через запятую, точку с запятой или на новых строках)
    const rulesText = match[6]?.trim() || '';
    let appliedRules = [];
    
    if (rulesText) {
      // Пробуем разные разделители
      appliedRules = rulesText
        .split(/[,;]\s*|\n(?=\s*(?:Правило|Rule|\d+\.))/)
        .map(r => r.trim())
        .filter(r => {
        // Фильтруем пустые и невалидные правила (поддерживаем DO, DON'T, Правило, Rule)
        return r.length > 0 && 
               !r.match(/^\[|\]$/) && 
               (r.match(/(?:DO|DON'T)\s*\d+[:\s]+/i) || r.includes('Правило') || r.includes('Rule') || r.match(/^\d+\./));
        });
      
      // Если правила не найдены, но есть текст, пробуем извлечь по паттерну (включая DO, DON'T)
      if (appliedRules.length === 0) {
        const rulePattern = /(?:DO\s*\d+[:\s]+|DON'T\s*\d+[:\s]+|Правило\s*\d+[:\s]+|Rule\s*\d+[:\s]+|^\d+\.\s*)(.+?)(?=[,;]|$)/gi;
        const ruleMatches = rulesText.matchAll(rulePattern);
        for (const ruleMatch of ruleMatches) {
          if (ruleMatch[0]) {
            appliedRules.push(ruleMatch[0].trim());
          }
        }
      }
    }
    
    segments.push({
      time_start: match[1],
      time_end: match[2],
      frame_description: match[3].trim(),
      text: match[4].trim(),
      applied_rules: appliedRules.length > 0 ? appliedRules : []
    });
  }
  
  // Если регулярка не сработала, пробуем более гибкий парсинг построчно
  if (segments.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentSegment = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Ищем временную метку
      const timeMatch = line.match(/\[(\d{2}:\d{2})\s*[-–—]\s*(\d{2}:\d{2})\]/);
      if (timeMatch) {
        if (currentSegment && (currentSegment.frame_description || currentSegment.text)) {
          segments.push(currentSegment);
        }
        currentSegment = {
          time_start: timeMatch[1],
          time_end: timeMatch[2],
          frame_description: '',
          text: '',
          applied_rules: []
        };
      } else if (currentSegment) {
        // Ищем "Кадр:" или "Frame:"
        if (/^(кадр|frame)[:\s]+/i.test(line)) {
          currentSegment.frame_description = line.replace(/^(кадр|frame)[:\s]+/i, '').trim();
        }
        // Ищем "Текст:" или "Text:"
        else if (/^(текст|text)[:\s]+/i.test(line)) {
          currentSegment.text = line.replace(/^(текст|text)[:\s]+/i, '').trim();
        }
        // Ищем "Правила:" или "Rules:"
        else if (/^(правила|rules)[:\s]+/i.test(line)) {
          const rulesText = line.replace(/^(правила|rules)[:\s]+/i, '').trim();
          // Парсим правила с учетом разных форматов
          let rules = rulesText
            .split(/[,;]\s*/)
            .map(r => r.trim())
            .filter(r => r.length > 0);
          
          // Если правила не найдены, пробуем извлечь по паттерну (включая DO, DON'T, Правило, Rule)
          if (rules.length === 0 || rules.some(r => !r.match(/(?:DO|DON'T|Правило|Rule)\s*\d+[:\s]+/i))) {
            const rulePattern = /(?:DO\s*\d+[:\s]+|DON'T\s*\d+[:\s]+|Правило\s*\d+[:\s]+|Rule\s*\d+[:\s]+|^\d+\.\s*)(.+?)(?=[,;]|$)/gi;
            const ruleMatches = rulesText.matchAll(rulePattern);
            const extractedRules = [];
            for (const ruleMatch of ruleMatches) {
              if (ruleMatch[0]) {
                extractedRules.push(ruleMatch[0].trim());
              }
            }
            if (extractedRules.length > 0) {
              rules = extractedRules;
            }
          }
          
          currentSegment.applied_rules = rules;
        }
        // Если нет метки, но есть текущий сегмент, добавляем к описанию или тексту
        else {
          if (!currentSegment.frame_description) {
            currentSegment.frame_description = line;
          } else if (!currentSegment.text) {
            currentSegment.text = line;
          } else if (currentSegment.applied_rules.length === 0 && (line.includes('Правило') || line.includes('Rule') || line.match(/^\d+\./))) {
            // Если это похоже на правило, добавляем к правилам
            let rules = line
              .split(/[,;]\s*/)
              .map(r => r.trim())
              .filter(r => r.length > 0 && (r.includes('Правило') || r.includes('Rule') || r.match(/^\d+\./)));
            
            // Если правила не найдены, пробуем извлечь по паттерну
            if (rules.length === 0) {
              const rulePattern = /(?:Правило\s*\d+[:\s]+|Rule\s*\d+[:\s]+|^\d+\.\s*)(.+?)(?=[,;]|$)/gi;
              const ruleMatches = line.matchAll(rulePattern);
              for (const ruleMatch of ruleMatches) {
                if (ruleMatch[1]) {
                  rules.push(ruleMatch[1].trim());
                }
              }
            }
            
            currentSegment.applied_rules = rules;
          } else {
            // Добавляем к тексту, если уже есть и кадр, и текст
            currentSegment.text += ' ' + line;
          }
        }
      }
    }
    
    // Добавляем последний сегмент
    if (currentSegment && (currentSegment.frame_description || currentSegment.text)) {
      segments.push(currentSegment);
    }
  }
  
  // Если всё ещё нет сегментов, создаём один из всего текста
  if (segments.length === 0) {
    console.warn('⚠️ Не удалось распарсить сценарий, создаю fallback сегмент');
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const firstPart = lines.slice(0, Math.floor(lines.length / 2)).join(' ');
    const secondPart = lines.slice(Math.floor(lines.length / 2)).join(' ');
    
    segments.push({
      time_start: '00:00',
      time_end: '00:30',
      frame_description: firstPart.substring(0, 200) || 'Описание визуала',
      text: firstPart.substring(0, 200) || 'Текст сценария',
      applied_rules: []
    });
    
    if (secondPart) {
      segments.push({
        time_start: '00:30',
        time_end: '01:00',
        frame_description: secondPart.substring(0, 200) || 'Описание визуала',
        text: secondPart.substring(0, 200) || 'Текст сценария',
        applied_rules: []
      });
    }
  }
  
  return {
    id: `scenario_${Date.now()}_v${version}`,
    topic: topic,
    segments: segments,
    created_at: new Date().toISOString(),
    version: version
  };
}

// Health check
app.get('/health', (req, res) => {
  const check = checkYtDlpAvailable();
  let version = 'unknown';
  
  if (check.available) {
    try {
      if (check.method === 'python') {
        version = execSync(`${check.command} -m yt_dlp --version`, { encoding: 'utf-8' }).trim();
      } else if (check.method === 'local') {
        version = execSync(`"${check.command}" --version`, { encoding: 'utf-8' }).trim();
      } else {
        version = execSync(`${check.command} --version`, { encoding: 'utf-8' }).trim();
      }
    } catch (e) {
      version = 'unknown';
    }
  }
  
  // Проверяем ffmpeg
  let ffmpegAvailable = false;
  let ffmpegMethod = 'none';
  if (fs.existsSync(FFMPEG_LOCAL)) {
    ffmpegAvailable = true;
    ffmpegMethod = 'local';
  } else {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      ffmpegAvailable = true;
      ffmpegMethod = 'system';
    } catch (e) {
      // ffmpeg не найден
    }
  }
  
  res.json({ 
    status: 'OK', 
    service: 'VideoMind API',
    ytdlp: {
      available: check.available,
      method: check.method || 'none',
      version: version
    },
    ffmpeg: {
      available: ffmpegAvailable,
      method: ffmpegMethod
    }
  });
});

// Глобальный обработчик ошибок для всех маршрутов
app.use((err, req, res, next) => {
  console.error('❌ Необработанная ошибка:', err);
  console.error('Стек ошибки:', err.stack);
  if (!res.headersSent) {
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Временные файлы: ${TEMP_DIR}`);
  
  // Проверяем наличие yt-dlp
  const check = checkYtDlpAvailable();
  if (check.available) {
    try {
      let version;
      if (check.method === 'python') {
        version = execSync(`${check.command} -m yt_dlp --version`, { encoding: 'utf-8' }).trim();
      } else if (check.method === 'local') {
        version = execSync(`"${check.command}" --version`, { encoding: 'utf-8' }).trim();
      } else {
        version = execSync(`${check.command} --version`, { encoding: 'utf-8' }).trim();
      }
      console.log(`✅ yt-dlp найден (${check.method}): версия ${version}`);
      
      // Проверяем ffmpeg
      if (fs.existsSync(FFMPEG_LOCAL)) {
        console.log(`✅ ffmpeg найден (локальный): ${FFMPEG_LOCAL}`);
      } else {
        try {
          execSync('ffmpeg -version', { stdio: 'ignore' });
          console.log(`✅ ffmpeg найден (системный)`);
        } catch (e) {
          console.log(`⚠️  ffmpeg не найден (не критично, но может понадобиться для некоторых форматов)`);
        }
      }
    } catch (e) {
      console.log(`✅ yt-dlp найден (${check.method}), но версию определить не удалось`);
    }
  } else {
    console.log(`❌ yt-dlp НЕ НАЙДЕН. Установите: pip install yt-dlp`);
    console.log(`   Или скачайте бинарник: https://github.com/yt-dlp/yt-dlp/releases`);
    if (fs.existsSync(YT_DLP_LOCAL)) {
      console.log(`   ⚠️  Локальный yt-dlp.exe найден, но не запускается. Проверьте права доступа.`);
    }
  }
  
  console.log(`🔗 POST /api/download-youtube для скачивания`);
});
