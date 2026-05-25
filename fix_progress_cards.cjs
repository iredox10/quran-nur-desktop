const fs = require('fs');
const filePath = '/home/iredox/Desktop/personal-apps/quran-app/src/pages/Progress.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace card classes
content = content.replace(/bg-\[var\(--bg-primary\)\]/g, 'bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md');
content = content.replace(/border-\[var\(--border-color\)\]/g, 'border-[var(--glass-border)]');

// Fix Recharts tooltip backgrounds
content = content.replace(/backgroundColor:\s*'var\(--bg-primary\)'/g, "backgroundColor: 'var(--glass-bg)'");

fs.writeFileSync(filePath, content);
console.log("Replaced card themes in Progress.jsx");
