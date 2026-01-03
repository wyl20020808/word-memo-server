/**
 * 将考研单词txt文件转换为JSON格式
 * 并通过API补充例句
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const INPUT_FILE = path.join(__dirname, '../5 考研-乱序.txt');
const OUTPUT_FILE = path.join(__dirname, '../data/all-words.json');

// 解析txt文件
function parseTxtFile() {
  const content = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const words = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 2) {
      const word = parts[0].trim();
      const meaning = parts[1].trim();
      if (word && meaning && /^[a-zA-Z]/.test(word)) {
        words.push({
          word: word,
          phonetic: '',
          meaning: meaning,
          example: ''
        });
      }
    }
  }
  return words;
}

// 从API获取单词详情（音标和例句）
function fetchWordDetails(word) {
  return new Promise((resolve) => {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
    
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (Array.isArray(json) && json.length > 0) {
            const entry = json[0];
            
            // 提取音标
            let phonetic = entry.phonetic || '';
            if (!phonetic && entry.phonetics) {
              const p = entry.phonetics.find(x => x.text);
              phonetic = p ? p.text : '';
            }
            
            // 提取例句
            let example = '';
            if (entry.meanings) {
              for (const m of entry.meanings) {
                for (const d of m.definitions) {
                  if (d.example) {
                    example = d.example;
                    break;
                  }
                }
                if (example) break;
              }
            }
            
            resolve({ phonetic, example });
          } else {
            resolve({ phonetic: '', example: '' });
          }
        } catch (e) {
          resolve({ phonetic: '', example: '' });
        }
      });
    });
    
    req.on('error', () => resolve({ phonetic: '', example: '' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ phonetic: '', example: '' });
    });
  });
}

// 延迟
const delay = ms => new Promise(r => setTimeout(r, ms));

// 主函数 - 只保存基础数据，不获取API
async function main() {
  console.log('读取单词文件...');
  const words = parseTxtFile();
  console.log(`解析到 ${words.length} 个单词\n`);
  
  // 直接保存基础数据（单词+释义）
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2));
  console.log(`\n完成！保存到 ${OUTPUT_FILE}`);
  console.log(`共 ${words.length} 个单词`);
}

main().catch(console.error);
