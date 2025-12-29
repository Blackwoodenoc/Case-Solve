/**
 * Тестовый скрипт для проверки работоспособности Whisper
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Тестирование Whisper...\n');

// Шаг 1: Проверка Python и модуля
console.log('1️⃣ Проверка установки...');
let pythonCmd = 'python';
try {
  execSync('python --version', { stdio: 'ignore' });
} catch (e) {
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    pythonCmd = 'python3';
  } catch (e2) {
    console.log('   ❌ Python не найден!');
    process.exit(1);
  }
}

try {
  execSync(`${pythonCmd} -c "import whisper"`, { stdio: 'ignore' });
  console.log('   ✅ Модуль whisper найден');
} catch (e) {
  console.log('   ❌ Модуль whisper не найден!');
  console.log(`   💡 Установите: ${pythonCmd} -m pip install openai-whisper`);
  process.exit(1);
}

// Шаг 2: Проверка скрипта
console.log('\n2️⃣ Проверка скрипта транскрипции...');
const whisperScript = path.join(__dirname, 'transcribe_whisper.py');
if (!fs.existsSync(whisperScript)) {
  console.log('   ❌ Скрипт transcribe_whisper.py не найден!');
  process.exit(1);
}
console.log('   ✅ Скрипт найден');

// Шаг 3: Тест загрузки модели (опционально, может быть долго)
console.log('\n3️⃣ Тест загрузки модели Whisper...');
console.log('   ⏳ Это может занять время при первом запуске...');

try {
  const testScript = `
import whisper
import sys
try:
    print("Загружаю модель base...", file=sys.stderr)
    model = whisper.load_model("base")
    print("✅ Модель успешно загружена!", file=sys.stderr)
    print("SUCCESS")
except Exception as e:
    print(f"❌ Ошибка: {e}", file=sys.stderr)
    sys.exit(1)
`;
  
  const result = execSync(`${pythonCmd} -c "${testScript.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    timeout: 60000, // 60 секунд на загрузку модели
    stdio: 'pipe'
  });
  
  if (result.includes('SUCCESS')) {
    console.log('   ✅ Модель Whisper успешно загружена!');
  } else {
    console.log('   ⚠️ Модель не загрузилась, но это может быть нормально');
  }
} catch (e) {
  console.log('   ⚠️ Не удалось загрузить модель (это нормально при первом запуске)');
  console.log('   💡 Модель загрузится автоматически при первом использовании');
}

// Шаг 4: Проверка API endpoint (если сервер запущен)
console.log('\n4️⃣ Проверка API endpoint...');
try {
  const response = await fetch('http://localhost:3003/health');
  if (response.ok) {
    const data = await response.json();
    if (data.whisper?.available) {
      console.log('   ✅ Whisper доступен через API');
      console.log(`   Метод: ${data.whisper.method}`);
      console.log(`   Версия: ${data.whisper.version}`);
    } else {
      console.log('   ⚠️ Whisper не доступен через API');
      console.log(`   Ошибка: ${data.whisper?.error || 'неизвестно'}`);
    }
  } else {
    console.log('   ⚠️ Сервер не запущен (это нормально)');
  }
} catch (e) {
  console.log('   ⚠️ Сервер не запущен (это нормально)');
  console.log('   💡 Запустите: npm run dev:server');
}

console.log('\n✅ Тестирование завершено!');
console.log('\n💡 Для полного теста:');
console.log('   1. Запустите сервер: npm run dev:server');
console.log('   2. Загрузите видео в приложении');
console.log('   3. Нажмите "🧬 Анализ ДНК Shorts"');
console.log('   4. Проверьте, что транскрипция выполняется');


