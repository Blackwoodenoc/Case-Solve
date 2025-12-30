/**
 * Диагностический скрипт для проверки установки Whisper
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Проверка установки Whisper...\n');

// Проверка 1: Python
console.log('1️⃣ Проверка Python...');
try {
  const pythonVersion = execSync('python --version', { encoding: 'utf-8' }).trim();
  console.log(`   ✅ Python найден: ${pythonVersion}`);
  var pythonCmd = 'python';
} catch (e) {
  try {
    const pythonVersion = execSync('python3 --version', { encoding: 'utf-8' }).trim();
    console.log(`   ✅ Python3 найден: ${pythonVersion}`);
    var pythonCmd = 'python3';
  } catch (e2) {
    console.log('   ❌ Python не найден!');
    console.log('   💡 Решение: Установите Python с https://www.python.org/downloads/');
    process.exit(1);
  }
}

// Проверка 2: pip
console.log('\n2️⃣ Проверка pip...');
try {
  const pipVersion = execSync(`${pythonCmd} -m pip --version`, { encoding: 'utf-8' }).trim();
  console.log(`   ✅ pip найден: ${pipVersion.split(' ')[1]}`);
} catch (e) {
  console.log('   ❌ pip не найден!');
  console.log('   💡 Решение: Переустановите Python с опцией "Add Python to PATH"');
  process.exit(1);
}

// Проверка 3: Whisper модуль
console.log('\n3️⃣ Проверка модуля whisper...');
try {
  execSync(`${pythonCmd} -c "import whisper; print('Whisper версия:', whisper.__version__)"`, { 
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  console.log('   ✅ Whisper установлен!');
} catch (e) {
  console.log('   ❌ Whisper не установлен!');
  console.log('\n   💡 Попробуйте установить:');
  console.log(`      ${pythonCmd} -m pip install openai-whisper`);
  console.log('\n   Если не работает, попробуйте:');
  console.log(`      ${pythonCmd} -m pip install --upgrade pip`);
  console.log(`      ${pythonCmd} -m pip install openai-whisper`);
  console.log('\n   Или с правами администратора:');
  console.log(`      ${pythonCmd} -m pip install --user openai-whisper`);
  
  // Показываем ошибку если есть
  if (e.stderr) {
    console.log('\n   📋 Детали ошибки:');
    console.log('   ' + e.stderr.toString().split('\n').slice(0, 5).join('\n   '));
  }
  
  process.exit(1);
}

// Проверка 4: Скрипт транскрипции
console.log('\n4️⃣ Проверка скрипта транскрипции...');
const whisperScript = path.join(__dirname, 'transcribe_whisper.py');
if (fs.existsSync(whisperScript)) {
  console.log('   ✅ Скрипт transcribe_whisper.py найден');
} else {
  console.log('   ❌ Скрипт transcribe_whisper.py не найден!');
  console.log(`   Ожидался по пути: ${whisperScript}`);
  process.exit(1);
}

// Проверка 5: Тестовая транскрипция (опционально)
console.log('\n5️⃣ Все проверки пройдены! ✅');
console.log('\n💡 Для тестирования запустите сервер:');
console.log('   npm run dev:server');
console.log('\n💡 Затем проверьте health endpoint:');
console.log('   http://localhost:3003/health');





