/**
 * 合并所有单词文件
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const outputFile = path.join(dataDir, 'all-words.json');

// 读取所有JSON文件
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'all-words.json');

let allWords = [];

for (const file of files) {
  const filePath = path.join(dataDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const words = JSON.parse(content);
  allWords = allWords.concat(words);
  console.log(`Loaded ${words.length} words from ${file}`);
}

// 去重
const uniqueWords = [];
const seen = new Set();
for (const word of allWords) {
  if (!seen.has(word.word.toLowerCase())) {
    seen.add(word.word.toLowerCase());
    uniqueWords.push(word);
  }
}

// 按字母排序
uniqueWords.sort((a, b) => a.word.localeCompare(b.word));

// 写入合并文件
fs.writeFileSync(outputFile, JSON.stringify(uniqueWords, null, 2));
console.log(`\nTotal: ${uniqueWords.length} unique words saved to all-words.json`);
