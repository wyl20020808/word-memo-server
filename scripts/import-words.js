/**
 * 考研英语词汇导入脚本
 * 从网络获取考研大纲词汇并导入到数据库
 */

const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置
const dbConfig = {
  host: process.env.MYSQL_ADDRESS?.split(':')[0] || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_ADDRESS?.split(':')[1]) || process.env.DB_PORT || 3306,
  user: process.env.MYSQL_USERNAME || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'word_memo'
};

console.log('📚 考研词汇导入脚本');
console.log('数据库配置:', { ...dbConfig, password: '***' });

// 导入完整考研词汇表
const KAOYAN_WORDS = require('./kaoyan-words-data');

// 使用免费词典API获取单词详情
async function getWordDetails(word) {
  try {
    // 使用免费的Dictionary API
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      { timeout: 10000 }
    );
    
    const data = response.data[0];
    
    // 提取音标
    let phonetic = '';
    if (data.phonetic) {
      phonetic = data.phonetic;
    } else if (data.phonetics && data.phonetics.length > 0) {
      phonetic = data.phonetics.find(p => p.text)?.text || '';
    }
    
    // 提取发音URL
    let audioUrl = '';
    if (data.phonetics && data.phonetics.length > 0) {
      audioUrl = data.phonetics.find(p => p.audio)?.audio || '';
    }
    
    // 提取释义和例句
    let meanings = [];
    let examples = [];
    
    if (data.meanings) {
      for (const meaning of data.meanings) {
        const partOfSpeech = meaning.partOfSpeech;
        for (const def of meaning.definitions.slice(0, 2)) {
          meanings.push(`${partOfSpeech}. ${def.definition}`);
          if (def.example) {
            examples.push(def.example);
          }
        }
      }
    }
    
    return {
      word: word,
      phonetic: phonetic,
      audio_url: audioUrl,
      meaning: meanings.slice(0, 3).join('\n'),
      example: examples.slice(0, 2).join('\n'),
      success: true
    };
  } catch (error) {
    console.log(`  ⚠️ 获取 ${word} 失败:`, error.message);
    return {
      word: word,
      phonetic: '',
      audio_url: '',
      meaning: '',
      example: '',
      success: false
    };
  }
}

// 使用有道词典API作为备用（中文释义）
async function getYoudaoDetails(word) {
  try {
    const response = await axios.get(
      `https://dict.youdao.com/suggest?num=1&ver=3.0&doctype=json&cache=false&le=en&q=${word}`,
      { timeout: 5000 }
    );
    
    if (response.data && response.data.data && response.data.data.entries) {
      const entry = response.data.data.entries[0];
      return entry?.explain || '';
    }
    return '';
  } catch (error) {
    return '';
  }
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主导入函数
async function importWords() {
  let connection;
  
  try {
    console.log('\n🔗 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 确保words表存在
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS words (
        id INT AUTO_INCREMENT PRIMARY KEY,
        word VARCHAR(100) NOT NULL UNIQUE,
        phonetic VARCHAR(100),
        meaning TEXT,
        example TEXT,
        audio_url VARCHAR(500),
        difficulty INT DEFAULT 1,
        category VARCHAR(50) DEFAULT '考研',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ 数据表准备完成');
    
    console.log(`\n📖 开始导入 ${KAOYAN_WORDS.length} 个单词...\n`);
    
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < KAOYAN_WORDS.length; i++) {
      const word = KAOYAN_WORDS[i];
      
      // 检查是否已存在
      const [existing] = await connection.execute(
        'SELECT id FROM words WHERE word = ?',
        [word]
      );
      
      if (existing.length > 0) {
        console.log(`⏭️  [${i + 1}/${KAOYAN_WORDS.length}] ${word} - 已存在，跳过`);
        skipCount++;
        continue;
      }
      
      console.log(`📝 [${i + 1}/${KAOYAN_WORDS.length}] 获取 ${word}...`);
      
      // 获取单词详情
      const details = await getWordDetails(word);
      
      // 如果英文API失败，尝试有道
      let chineseMeaning = '';
      if (!details.meaning) {
        chineseMeaning = await getYoudaoDetails(word);
      }
      
      const finalMeaning = details.meaning || chineseMeaning || '暂无释义';
      
      // 插入数据库
      try {
        await connection.execute(
          `INSERT INTO words (word, phonetic, meaning, example, audio_url, category) 
           VALUES (?, ?, ?, ?, ?, '考研')`,
          [word, details.phonetic, finalMeaning, details.example, details.audio_url]
        );
        console.log(`  ✅ ${word} 导入成功`);
        successCount++;
      } catch (insertError) {
        console.log(`  ❌ ${word} 插入失败:`, insertError.message);
        failCount++;
      }
      
      // 避免请求过快
      await delay(500);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 导入完成统计:');
    console.log(`  ✅ 成功: ${successCount}`);
    console.log(`  ⏭️  跳过: ${skipCount}`);
    console.log(`  ❌ 失败: ${failCount}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ 导入失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 运行导入
importWords();
