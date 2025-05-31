import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إنشاء مجلد assets/opencascade إذا لم يكن موجوداً
const assetsDir = path.join(__dirname, 'public', 'assets', 'opencascade');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log('✓ تم إنشاء مجلد assets/opencascade');
}

// نسخ ملفات OpenCASCADE
const sourceDir = path.join(__dirname, 'node_modules', 'opencascade.js', 'dist');

if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir);
    
    files.forEach(file => {
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(assetsDir, file);
        
        try {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✓ تم نسخ ${file}`);
        } catch (error) {
            console.error(`❌ فشل نسخ ${file}:`, error.message);
        }
    });
    
    console.log('✅ تم إعداد OpenCASCADE بنجاح');
} else {
    console.error('❌ مجلد opencascade.js غير موجود');
    console.log('تشغيل: npm install opencascade.js --force');
}