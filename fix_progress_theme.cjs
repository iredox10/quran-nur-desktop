const fs = require('fs');
const filePath = '/home/iredox/Desktop/personal-apps/quran-app/src/pages/Progress.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Remove the inline style variable definitions
content = content.replace(/style=\{\{\s*'--prog-teal':[^}]+\}\}/, 'className="mx-auto mb-20 max-w-[1200px] px-4 pb-20 text-[var(--text-primary)]"');

// Replace class names
const replacements = {
    'var(--prog-ink)': 'var(--text-primary)',
    'var(--prog-ink-muted)': 'var(--text-secondary)',
    'var(--prog-cream)': 'var(--bg-primary)',
    'var(--prog-bone-dark)': 'var(--border-color)',
    'var(--prog-bone)': 'var(--bg-surface)',
    'var(--prog-teal)': 'var(--accent-primary)',
    'var(--prog-teal-soft)': 'var(--accent-light)',
    'var(--prog-gold)': 'var(--accent-hover)',
    'var(--prog-gold-soft)': 'var(--bg-secondary)',
    'var(--prog-green)': '#10b981',
    'var(--prog-green-soft)': 'rgba(16,185,129,0.1)'
};

for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
}

// Fix Recharts hardcoded colors
// Tooltips
content = content.replace(/background:\s*'#FAFAF5'/g, "backgroundColor: 'var(--bg-primary)'");
content = content.replace(/border:\s*'1\.5px solid #DDD7C7'/g, "border: '1px solid var(--border-color)'");
content = content.replace(/color:\s*'#2B3F3C'/g, "color: 'var(--text-primary)'");

// Axes
content = content.replace(/stroke="#8E9B97"/g, 'stroke="var(--text-secondary)"');

// Lines/Bars
content = content.replace(/stroke="#2E4F4A"/g, 'stroke="var(--accent-primary)"');
content = content.replace(/fill:\s*'#2E4F4A'/g, "fill: 'var(--accent-primary)'");
content = content.replace(/fill="#2E4F4A"/g, 'fill="var(--accent-primary)"');
content = content.replace(/fill="#B8924A"/g, 'fill="var(--accent-hover)"');
content = content.replace(/fill:\s*'#B8924A'/g, "fill: 'var(--accent-hover)'");

// Heatmap hardcoded
content = content.replace(/'rgba\(46,79,74,0\.35\)'/g, "'var(--accent-light)'");

// Cursor
content = content.replace(/cursor=\{\{\s*fill:\s*'rgba\(46,79,74,0\.06\)'\s*\}\}/g, "cursor={{ fill: 'var(--bg-surface)' }}");

// Pie Colors
content = content.replace(/const COLORS = \['#2E4F4A', '#DDD7C7'\];/, "const COLORS = ['var(--accent-primary)', 'var(--bg-surface)'];");

// Fix classnames merging issues if any
content = content.replace(/className="mx-auto mb-20 max-w-\[1200px\] px-4 pb-20 text-\[var\(--text-primary\)\]" className="mx-auto mb-20 max-w-\[1200px\] px-4 pb-20"/g, 'className="mx-auto mb-20 max-w-[1200px] px-4 pb-20"');

fs.writeFileSync(filePath, content);
console.log("Replaced themes in Progress.jsx");
