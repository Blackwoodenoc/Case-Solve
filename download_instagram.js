/**
 * Instagram Reels Downloader - Node.js wrapper
 * Использует методы из Instagram-reels-downloader-master
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Извлекаем Post ID из URL
function extractPostId(url) {
  const patterns = [
    /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/reels?\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Получаем HTML страницы Instagram
async function getInstagramPageHTML(postId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.instagram.com',
      port: 443,
      path: `/p/${postId}/`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Извлекаем URL видео из HTML
function extractVideoUrl(html) {
  // Метод 1: og:video meta tag
  const ogVideoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
  if (ogVideoMatch && ogVideoMatch[1]) {
    return ogVideoMatch[1].replace(/&amp;/g, '&');
  }

  // Метод 2: Прямой поиск URL в HTML
  const directMatch = html.match(/https:\/\/[^"']+\.cdninstagram\.com[^"']*\.mp4[^"']*/);
  if (directMatch && directMatch[0]) {
    return directMatch[0].replace(/&amp;/g, '&');
  }

  // Метод 3: Поиск в JSON структурах
  const jsonMatches = html.match(/"video_url":"([^"]+)"/g);
  if (jsonMatches && jsonMatches.length > 0) {
    const firstMatch = jsonMatches[0].match(/"video_url":"([^"]+)"/);
    if (firstMatch && firstMatch[1]) {
      // Декодируем unicode escapes
      return firstMatch[1].replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
      });
    }
  }

  return null;
}

// Скачиваем видео
async function downloadVideo(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(videoUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Range': 'bytes=0-'
      }
    };

    const req = protocol.request(options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Следуем редиректу
        downloadVideo(res.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      let downloaded = 0;
      const totalSize = parseInt(res.headers['content-length'] || '0');

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize > 0) {
          const progress = (downloaded / totalSize * 100).toFixed(1);
          console.error(`📥 ${progress}%`);
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });

      fileStream.on('error', (error) => {
        fs.unlink(outputPath, () => {});
        reject(error);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Download timeout'));
    });

    req.end();
  });
}

// Главная функция
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node download_instagram.js <instagram_url> <output_directory>');
    process.exit(1);
  }

  const instagramUrl = args[0];
  const outputDir = args[1];

  console.error(`🔍 Обработка: ${instagramUrl}`);

  try {
    // Извлекаем Post ID
    const postId = extractPostId(instagramUrl);
    if (!postId) {
      console.log(JSON.stringify({
        success: false,
        error: 'Не удалось извлечь ID поста из URL'
      }));
      process.exit(1);
    }

    console.error(`📋 Post ID: ${postId}`);

    // Получаем HTML
    console.error('🌐 Загрузка страницы Instagram...');
    const html = await getInstagramPageHTML(postId);
    console.error(`📄 Получено ${html.length} байт HTML`);

    // Извлекаем URL видео
    const videoUrl = extractVideoUrl(html);
    if (!videoUrl) {
      console.log(JSON.stringify({
        success: false,
        error: 'Не удалось найти видео. Возможно, это пост с фото или приватный контент.'
      }));
      process.exit(1);
    }

    console.error('🎬 Найден URL видео');

    // Скачиваем видео
    const outputFilename = `instagram_${postId}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    console.error('⬇️  Скачивание видео...');
    await downloadVideo(videoUrl, outputPath);

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.error(`✅ Видео скачано: ${outputPath}`);
    console.error(`📦 Размер: ${sizeMB} MB`);

    console.log(JSON.stringify({
      success: true,
      filename: outputFilename,
      path: outputPath,
      size_mb: parseFloat(sizeMB),
      video_url: videoUrl
    }));

    process.exit(0);

  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

main();




