import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_DIR = path.join(__dirname, '..', 'public', 'data', 'surahs');

if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

async function fetchSurah(chapterId) {
    const params = new URLSearchParams({
        language: 'en',
        words: 'true',
        translations: '85',
        audio: '7',
        fields: 'text_qpc_hafs,text_uthmani,page_number',
        word_fields: 'text_qpc_hafs,text_uthmani,page_number,line_number,translation,text_uthmani_tajweed',
        mushaf: '5',
        page: '1',
        per_page: '300'
    });

    const url = `https://api.quran.com/api/v4/verses/by_chapter/${chapterId}?${params.toString()}`;
    const destFile = path.join(DEST_DIR, `${chapterId}.json`);

    if (fs.existsSync(destFile) && fs.statSync(destFile).size > 100) {
        console.log(`Skipping Surah ${chapterId} (already downloaded)`);
        return Promise.resolve();
    }
    
    console.log(`Fetching Surah ${chapterId}...`);
    return new Promise((resolve, reject) => {
        https.get(url, { family: 4 }, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Status: ${res.statusCode}`));
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                const destFile = path.join(DEST_DIR, `${chapterId}.json`);
                fs.writeFileSync(destFile, JSON.stringify(parsed.verses));
                console.log(`Saved Surah ${chapterId} (${parsed.verses.length} ayahs)`);
                resolve();
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log("Starting full Quran download for offline bundle...");
    for (let i = 1; i <= 114; i++) {
        await fetchSurah(i);
        // Add a tiny delay to be polite to the API
        await new Promise(r => setTimeout(r, 100));
    }
    console.log("Done! All 114 Surahs downloaded.");
}

main();
