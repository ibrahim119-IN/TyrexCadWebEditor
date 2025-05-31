import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, 'public', 'assets', 'opencascade');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

const sourceDir = path.join(__dirname, 'node_modules', 'opencascade.js', 'dist');

if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir);
    files.forEach(file => {
        if (file.includes('opencascade') || file.endsWith('.wasm')) {
            const src = path.join(sourceDir, file);
            const dest = path.join(assetsDir, file);
            fs.copyFileSync(src, dest);
            console.log(`✓ ${file}`);
        }
    });
}