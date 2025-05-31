import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'project-dump.txt');

const INCLUDED_FILES = [
  'index.html',
  'package.json',
  'setup.js',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts'
];

const INCLUDED_DIRS = ['src'];

function writeToFile(content) {
  fs.appendFileSync(OUTPUT_FILE, content + '\n', 'utf8');
}

function dumpFile(filePath, label = '') {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    writeToFile(`\n==== FILE: ${label || filePath} ====\n`);
    writeToFile(code);
  } catch (err) {
    writeToFile(`\n[ERROR READING FILE: ${filePath}]\n`);
  }
}

function dumpDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      dumpDirectory(fullPath);
    } else {
      dumpFile(fullPath, path.relative(ROOT_DIR, fullPath));
    }
  }
}

// حذف الملف إذا كان موجود
if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);

// أولاً: تصدير الملفات الفردية
INCLUDED_FILES.forEach(file => {
  const fullPath = path.join(ROOT_DIR, file);
  if (fs.existsSync(fullPath)) {
    dumpFile(fullPath, file);
  }
});

// ثانياً: تصدير ملفات src/
INCLUDED_DIRS.forEach(dir => {
  const fullPath = path.join(ROOT_DIR, dir);
  if (fs.existsSync(fullPath)) {
    dumpDirectory(fullPath);
  }
});

console.log(`✅ Dump completed. Output saved to ${OUTPUT_FILE}`);
