import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
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

// Путь к yt-dlp (используем системную установку)
// yt-dlp должен быть установлен через: pip install yt-dlp
// Или через pipx: pipx install yt-dlp
// Проверяем наличие в системе
const YT_DLP_CMD = 'yt-dlp'; // Системная команда
const YT_DLP_PYTHON = 'python'; // Для запуска через Python модуль (если установлен через pip)

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
app.post('/api/download-youtube', async (req, res) => {
  const { url } = req.body;
  let responseSent = false; // Защита от двойной отправки

  console.log(`📨 Получен запрос на скачивание: ${url}`);

  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }

  const videoId = extractVideoId(url);
  const filename = `${videoId}_${Date.now()}.mp4`;
  const filepath = path.join(TEMP_DIR, filename);
  
  // Определяем платформу для оптимизации параметров
  const platform = url.includes('instagram.com') ? 'instagram' : 
                   url.includes('tiktok.com') ? 'tiktok' : 'youtube';

  console.log(`📥 Скачиваю ${platform.toUpperCase()}: ${url}`);
  console.log(`📁 Файл: ${filename}`);

  try {
    // Для TikTok используем SSSTik API
    if (platform === 'tiktok') {
      console.log('🎵 Используем SSSTik для TikTok');
      
      const ssstikScript = path.join(__dirname, 'download_ssstik.py');
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

    // Для Instagram используем специальный Python downloader (instaloader)
    if (platform === 'instagram') {
      console.log('📸 Используем Instagram downloader (instaloader)');
      
      const instagramScript = path.join(__dirname, 'download_instagram.py');
      const instagram = spawn('python', [instagramScript, url, TEMP_DIR]);

      let stdoutData = '';
      let stderrData = '';

      instagram.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      instagram.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.log(`[Instagram] ${data.toString().trim()}`);
      });

      instagram.on('close', (code) => {
        if (responseSent) return;
        try {
          // Парсим JSON результат из stdout
          const lines = stdoutData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);

          if (!result.success) {
            console.error(`❌ Instagram ошибка: ${result.error}`);
            responseSent = true;
            return res.status(500).json({ 
              error: result.error.includes('фото') || result.error.includes('найти видео') 
                ? '📸 Это Instagram пост с фото, а не видео. Используйте ссылку на Instagram Reels (видео)' 
                : `Instagram: ${result.error}`
            });
          }

          // Получаем путь к скачанному файлу
          const downloadedPath = result.path;
          
          if (!fs.existsSync(downloadedPath)) {
            responseSent = true;
            return res.status(500).json({ error: 'Файл не найден после скачивания' });
          }

          console.log(`✅ Instagram скачан: ${downloadedPath}`);
          console.log(`📦 Размер: ${result.size_mb} MB`);

          // Читаем и отправляем
          const videoBuffer = fs.readFileSync(downloadedPath);
          const base64Video = videoBuffer.toString('base64');

          responseSent = true;
          res.json({
            success: true,
            filename: result.filename,
            size: videoBuffer.length,
            base64: base64Video,
            mimeType: 'video/mp4'
          });

          // Удаляем файл сразу после отправки
          setTimeout(() => {
            if (fs.existsSync(downloadedPath)) {
              fs.unlinkSync(downloadedPath);
              console.log(`🗑️  Удалён: ${result.filename}`);
            }
          }, 1000);

        } catch (parseError) {
          if (responseSent) return;
          console.error('❌ Ошибка парсинга результата Instagram:', parseError);
          console.error('stdout:', stdoutData);
          console.error('stderr:', stderrData);
          responseSent = true;
          res.status(500).json({ 
            error: 'Instagram: Ошибка обработки результата'
          });
        }
      });

      instagram.on('error', (err) => {
        if (responseSent) return;
        console.error('❌ Ошибка запуска Instagram downloader:', err);
        responseSent = true;
        res.status(500).json({ 
          error: 'Не удалось запустить Instagram downloader',
          details: err.message
        });
      });

      return; // Выходим, не запускаем yt-dlp для Instagram
    }

    // Для YouTube используем yt-dlp
    // Базовые параметры
    const baseArgs = [
      YT_DLP_PATH,
      '--no-warnings',
      '--no-check-certificates',
      '--output', filepath,
      '--no-playlist',
      '--max-filesize', '150M',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--extractor-args', 'youtube:player_client=android,web',
      '--format', 'best[ext=mp4][height<=720]/best[ext=mp4]/best',
      '--retries', '3',
      '--fragment-retries', '3'
    ];

    // Запускаем yt-dlp (системная команда)
    const ytdlp = spawn(YT_DLP_CMD, [...baseArgs, url], { shell: true });

    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      console.log(`[yt-dlp] ${data}`);
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[yt-dlp error] ${data}`);
    });

    ytdlp.on('close', (code) => {
      if (responseSent) return;
      if (code !== 0) {
        console.error(`❌ yt-dlp завершился с кодом ${code}`);
        console.error(`Ошибка: ${errorOutput}`);
        
        // Определяем тип ошибки
        let userMessage = 'Ошибка при скачивании видео';
        
        if (errorOutput.includes('There is no video in this post')) {
          userMessage = '📸 Это Instagram пост с фото, а не видео. Используйте ссылку на Instagram Reels (видео)';
        } else if (errorOutput.includes('HTTP Error 404') || errorOutput.includes('unable to download')) {
          userMessage = '⚠️ YouTube заблокировал запрос. Попробуйте другую ссылку или скачайте вручную (y2mate.com)';
        } else if (errorOutput.includes('Video unavailable') || errorOutput.includes('not available')) {
          userMessage = `Видео недоступно. Возможно, оно приватное или удалено`;
        } else if (errorOutput.includes('Private video') || errorOutput.includes('private')) {
          userMessage = 'Это приватное видео, доступ запрещён';
        } else if (errorOutput.includes('age-restricted')) {
          userMessage = 'Видео имеет возрастные ограничения';
        } else if (errorOutput.includes('Login required') || errorOutput.includes('Sign in')) {
          userMessage = 'Требуется авторизация. Попробуйте скачать вручную';
        }
        
        responseSent = true;
        return res.status(500).json({ 
          error: userMessage,
          platform: platform,
          technical: errorOutput.substring(0, 500)
        });
      }

      // Проверяем, что файл создан
      if (!fs.existsSync(filepath)) {
        console.error('❌ Файл не найден после скачивания');
        responseSent = true;
        return res.status(500).json({ error: 'Файл не создан' });
      }

      console.log(`✅ Видео скачано: ${filename}`);

      try {
        // Читаем файл и отправляем как base64
        const videoBuffer = fs.readFileSync(filepath);
        const base64Video = videoBuffer.toString('base64');
        
        console.log(`📦 Размер: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        responseSent = true;
        res.json({
          success: true,
          filename: filename,
          size: videoBuffer.length,
          base64: base64Video,
          mimeType: 'video/mp4'
        });

        // Удаляем файл через 5 минут
        setTimeout(() => {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log(`🗑️  Удалён: ${filename}`);
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
    console.error('❌ Ошибка:', error);
    responseSent = true;
    res.status(500).json({ 
      error: 'Не удалось скачать видео',
      details: error.message 
    });
  }
});

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
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        temperature: 0.7,
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
  
  return `⚠️ КРИТИЧЕСКИ ВАЖНО: Ты должен создать СЦЕНАРИЙ ВИДЕО, а НЕ паспорт стиля! Это НЕ анализ, а готовый сценарий для съемки!

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
✅ ОБЯЗАТЕЛЬНО ДЕЛАТЬ (DO) - ПРИМЕНЯЙ В КАЖДОМ СЕГМЕНТЕ:
═══════════════════════════════════════════════════════════════════
${doRules.length > 0 ? doRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n') : 'Нет правил Do'}
${doRules.length > 0 ? '\n⚠️ ВАЖНО: Каждое правило из списка DO должно быть применено хотя бы в одном сегменте сценария!' : ''}

═══════════════════════════════════════════════════════════════════
❌ СТРОГО ЗАПРЕЩЕНО (DON'T) - НИКОГДА НЕ ДЕЛАЙ ЭТОГО:
═══════════════════════════════════════════════════════════════════
${dontRules.length > 0 ? dontRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n') : 'Нет правил Don\'t'}
${dontRules.length > 0 ? '\n⚠️ ВАЖНО: Ни одно правило из списка DON\'T не должно появиться в сценарии!' : ''}

═══════════════════════════════════════════════════════════════════
📋 ПРАВИЛА ИМИТАЦИИ (GENERATION RULES) - ПРИМЕНЯЙ ВСЕ:
═══════════════════════════════════════════════════════════════════
${generationRules.length > 0 ? generationRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n') : 'Правила не указаны'}
${generationRules.length > 0 ? '\n⚠️ ВАЖНО: Каждое правило должно быть применено хотя бы в одном сегменте!' : ''}

═══════════════════════════════════════════════════════════════════
🎬 СТИЛЬ И ШАБЛОН АВТОРА (КОПИРУЙ ТОЧНО):
═══════════════════════════════════════════════════════════════════
1. ТОН И ГОЛОС:
   - Архетип: ${passport.tone_of_voice?.archetype || 'не указан'}
   - Настроение: ${passport.tone_of_voice?.mood?.join(', ') || 'не указано'}
   - Формальность: ${passport.tone_of_voice?.formality_level_0_10 || 5}/10
   - Сигнатурные фразы: ${passport.tone_of_voice?.signature_phrases?.join(', ') || 'нет'} ${passport.tone_of_voice?.signature_phrases?.length > 0 ? '← ОБЯЗАТЕЛЬНО используй эти фразы!' : ''}
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
📝 ФОРМАТ ВЫВОДА (ОБЯЗАТЕЛЬНО соблюдай этот формат, НЕ возвращай JSON!):
═══════════════════════════════════════════════════════════════════
[00:00-00:05]
Кадр: [Описание визуала в ТОЧНОМ стиле автора, используя его типы кадров и монтаж]
Текст: [Хук/текст в ТОЧНОМ стиле автора, используя его сигнатурные фразы, тон и темп речи]
Правила: [Список ВСЕХ примененных правил из DO, DON'T и GENERATION RULES, например: "DO 1: Начинать с крика", "Правило 1: Начинать с интригующей завязки"]

[00:05-00:15]
Кадр: [Описание визуала в стиле автора]
Текст: [Текст в стиле автора]
Правила: [Список примененных правил]

[00:15-00:30]
Кадр: [Описание визуала в стиле автора]
Текст: [Текст в стиле автора]
Правила: [Список примененных правил]

[00:30-00:45]
Кадр: [Описание визуала в стиле автора]
Текст: [Текст в стиле автора]
Правила: [Список примененных правил]

[00:45-00:60]
Кадр: [Описание визуала в стиле автора]
Текст: [Текст/CTA в стиле автора]
Правила: [Список примененных правил]

═══════════════════════════════════════════════════════════════════
⚠️ КРИТИЧЕСКИ ВАЖНЫЕ ТРЕБОВАНИЯ:
═══════════════════════════════════════════════════════════════════
1. ТЕКСТ ДОЛЖЕН БЫТЬ В ТОЧНОМ СТИЛЕ АВТОРА:
   - Используй сигнатурные фразы автора: ${passport.tone_of_voice?.signature_phrases?.join(', ') || 'нет'}
   - Копируй темп речи: ${passport.speech_pace?.pace_label || 'medium'}
   - Используй тот же тон: ${passport.tone_of_voice?.archetype || 'neutral'}
   ${speechPatterns?.common_phrases?.length > 0 ? `- Используй частые фразы автора: ${speechPatterns.common_phrases.join(', ')}` : ''}
   ${speechPatterns?.filler_words?.length > 0 ? `- Используй слова-паразиты автора: ${speechPatterns.filler_words.join(', ')}` : ''}

2. ВИЗУАЛ ДОЛЖЕН БЫТЬ В ТОЧНОМ СТИЛЕ АВТОРА:
   - Используй типы кадров: ${passport.visual_style?.shot_types?.join(', ') || 'разные планы'}
   - Применяй стиль монтажа: ${passport.visual_style?.editing || 'не указан'}
   - Добавляй текст на экран в стиле: ${passport.visual_style?.on_screen_text_style || 'белый текст'}

3. СТРУКТУРА ДОЛЖНА СЛЕДОВАТЬ ШАБЛОНУ АВТОРА:
   - Следуй структуре: ${passport.structure?.map(s => s.part).join(' → ') || 'hook → setup → main → climax → cta'}
   - Используй паттерны удержания в нужных местах

4. ПРАВИЛА DO/DON'T ОБЯЗАТЕЛЬНЫ:
   - ВСЕ правила из DO должны быть применены
   - НИ ОДНО правило из DON'T не должно появиться

5. В ПОЛЕ "Правила:" указывай:
   - Какие правила DO применены (например: "DO 1: Начинать с крика")
   - Какие правила GENERATION RULES применены (например: "Правило 1: Начинать с интригующей завязки")
   - НЕ указывай правила DON'T (они не должны применяться)

ВАРИАНТ ${version}: Создай ${version === 1 ? 'классический' : version === 2 ? 'более креативный' : 'альтернативный'} вариант сценария, но ВСЕГДА в стиле автора.

⚠️ НЕ ВОЗВРАЩАЙ JSON! ВОЗВРАЩАЙ ТОЛЬКО ТЕКСТОВЫЙ СЦЕНАРИЙ В ФОРМАТЕ ВЫШЕ!

Начни генерацию сценария прямо сейчас, полностью копируя стиль и шаблон автора:`;
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
  // Проверяем наличие yt-dlp в системе
  const { execSync } = require('child_process');
  let ytdlpStatus = 'not found';
  try {
    execSync(`${YT_DLP_CMD} --version`, { stdio: 'ignore' });
    ytdlpStatus = 'found';
  } catch (e) {
    // yt-dlp не найден
  }
  
  res.json({ 
    status: 'OK', 
    service: 'VideoMind API',
    ytdlp: ytdlpStatus
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Временные файлы: ${TEMP_DIR}`);
  
  // Проверяем наличие yt-dlp
  const { execSync } = require('child_process');
  try {
    const version = execSync(`${YT_DLP_CMD} --version`, { encoding: 'utf-8' }).trim();
    console.log(`✅ yt-dlp найден: версия ${version}`);
  } catch (e) {
    console.log(`❌ yt-dlp НЕ НАЙДЕН. Установите: pip install yt-dlp`);
  }
  
  console.log(`🔗 POST /api/download-youtube для скачивания`);
});
