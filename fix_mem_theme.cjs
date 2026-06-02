const fs = require('fs');
const filePath = '/home/iredox/Desktop/personal-apps/quran-app/src/pages/MemorizeIndex.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
    'var(--mem-ink-muted)': 'var(--text-secondary)',
    'var(--mem-bone-dark)': 'var(--glass-border)',
    'var(--mem-teal)': 'var(--accent-primary)',
    'var(--mem-ink)': 'var(--text-primary)',
    'var(--mem-teal-mid)': 'var(--accent-hover)',
    'var(--mem-cream)': 'var(--glass-bg)',
    'var(--mem-gold)': '#b8924a',
    'var(--mem-gold-soft)': 'rgba(184, 146, 74, 0.1)',
    'var(--mem-green)': '#10b981',
    'var(--mem-green-soft)': 'rgba(16, 185, 129, 0.1)',
    'var(--mem-teal-soft)': 'var(--bg-secondary)',
    'var(--mem-white)': 'var(--bg-surface)',
    'var(--mem-bone)': 'var(--bg-secondary)',
    'var(--mem-ink-mid)': 'var(--text-secondary)'
};

for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
}

// Ensure cards have shadow
content = content.replace(/bg-\[var\(--glass-bg\)\] px-3/g, 'bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md px-3');
content = content.replace(/bg-\[var\(--glass-bg\)\] p-4/g, 'bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-4');

fs.writeFileSync(filePath, content);
console.log("Replaced themes in MemorizeIndex.jsx");
