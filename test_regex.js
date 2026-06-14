const html = '<span class="ghunnah">مَّا</span> <span class="qalaqah">قِنْ</span>';
const words = html.match(/(?:<[^>]+>|\S)+/g);
console.log(words);
