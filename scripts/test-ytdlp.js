/**
 * Простой скрипт для тестирования yt-dlp
 * Использование: node scripts/test-ytdlp.js <URL>
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const YT_DLP_CMD = 'yt-dlp';
const YT_DLP_PYTHON = 'python';

function checkYtDlpAvailable() {
  try {
    execSync(`where ${YT_DLP_CMD} >nul 2>&1`, { shell: true });
    return { available: true, method: 'system', command: YT_DLP_CMD };
  } catch (e) {
    try {
      execSync(`${YT_DLP_PYTHON} -m yt_dlp --version`, { stdio: 'ignore' });
      return { available: true, method: 'python', command: YT_DLP_PYTHON, args: ['-m', 'yt_dlp'] };
    } catch (e2) {
      return { available: false, method: null };
    }
  }
}

const url = process.argv[2];

if (!url) {
  console.log('❌ Укажите URL видео');
  console.log('Использование: node scripts/test-ytdlp.js <URL>');
  console.log('Пример: node scripts/test-ytdlp.js https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  process.exit(1);
}

console.log('🔍 Проверяем наличие yt-dlp...');
const check = checkYtDlpAvailable();

if (!check.available) {
  console.error('❌ yt-dlp не найден!');
  console.error('Установите: pip install yt-dlp');
  console.error('Или скачайте: https://github.com/yt-dlp/yt-dlp/releases');
  process.exit(1);
}

console.log(`✅ yt-dlp найден (метод: ${check.method})`);

// Получаем версию
try {
  let version;
  if (check.method === 'python') {
    version = execSync(`${check.command} -m yt_dlp --version`, { encoding: 'utf-8' }).trim();
  } else {
    version = execSync(`${check.command} --version`, { encoding: 'utf-8' }).trim();
  }
  console.log(`📦 Версия: ${version}`);
} catch (e) {
  console.log('⚠️ Не удалось определить версию');
}

console.log(`\n📥 Скачиваем: ${url}\n`);

// Формируем команду
const args = [
  '--no-warnings',
  '--format', 'best[ext=mp4][height<=720]/best[ext=mp4]/best',
  '--output', `test_video_%(id)s.%(ext)s`,
  url
];

let command = check.command;
let commandArgs = check.method === 'python' ? [...(check.args || []), ...args] : args;

console.log(`🚀 Команда: ${command} ${commandArgs.join(' ')}\n`);

const ytdlp = spawn(command, commandArgs, { shell: true });

ytdlp.stdout.on('data', (data) => {
  process.stdout.write(data);
});

ytdlp.stderr.on('data', (data) => {
  process.stderr.write(data);
});

ytdlp.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Видео успешно скачано!');
  } else {
    console.log(`\n❌ Ошибка (код: ${code})`);
  }
  process.exit(code);
});

ytdlp.on('error', (err) => {
  console.error('❌ Ошибка запуска:', err.message);
  process.exit(1);
});


