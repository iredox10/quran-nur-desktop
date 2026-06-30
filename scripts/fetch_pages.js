import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_DIR = path.join(__dirname, '..', 'public', 'data', 'pages');

if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

async function fetchPage(pageNumber) {
    const params = new URLSearchParams({
        language: 'en',
        words: 'true',
        translations: '85',
        audio: '7',
        fields: 'text_qpc_hafs,text_uthmani,page_number',
        word_fields: 'text_qpc_hafs,text_uthmani,page_number,line_number,translation,text_uthmani_tajweed',
        mushaf: '5',
        per_page: '300'
    });

    const url = `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?${params.toString()}`;
    
    return new Promise((resolve, reject) => {
        https.get(url, { family: 4 }, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Status: ${res.statusCode}`));
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                const destFile = path.join(DEST_DIR, `${pageNumber}.json`);
                fs.writeFileSync(destFile, JSON.stringify(parsed.verses));
                if (pageNumber % 50 === 0) console.log(`Saved Page ${pageNumber}/604`);
                resolve();
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log("Starting page-by-page download...");
    for (let i = 1; i <= 604; i++) {
        await fetchPage(i);
        await new Promise(r => setTimeout(r, 50));
    }
    console.log("Done! All 604 pages downloaded.");
}

main();
