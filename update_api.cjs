const fs = require('fs');
const filePath = '/home/iredox/Desktop/personal-apps/quran-app/src/services/api/quranApi.js';
let content = fs.readFileSync(filePath, 'utf8');

const apiToAdd = `
export const getJuzs = async () => {
  const data = await fetchWithOfflineCache('/juzs');
  return data.juzs;
};
`;

if (!content.includes('export const getJuzs')) {
    content += apiToAdd;
    fs.writeFileSync(filePath, content);
    console.log("Added getJuzs to quranApi.js");
} else {
    console.log("getJuzs already exists");
}
