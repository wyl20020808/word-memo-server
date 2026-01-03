/**
 * 导入考研词汇到微信云托管数据库
 * 
 * 使用方法：
 * 1. 设置环境变量或直接修改下面的配置
 * 2. 运行: node scripts/import-to-cloud.js
 */

const axios = require('axios');
const mysql = require('mysql2/promise');

// ⚠️ 修改为你的微信云托管MySQL配置
const dbConfig = {
  host: '10.21.101.77',      // 从微信云托管控制台获取
  port: 3306,
  user: 'root',
  password: '6seijsJT',       // 从微信云托管控制台获取
  database: 'word_memo'       // 数据库名称
};

// 导入词汇表
const KAOYAN_WORDS = require('./kaoyan-words-data');

console.log('📚 考研词汇导入脚本（云数据库版）');
console.log('数据库:', dbConfig.host);
console.log('词汇数量:', KAOYAN_WORDS.length);

// 获取单词详情
async function getWordDetails(word) {
  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      { timeout: 10000 }
    );
    const data = response.data[0];
    
    let phonetic = data.phonetic || '';
    if (!phonetic && data.phonetics?.length > 0) {
      phonetic = data.phonetics.find(p => p.text)?.text || '';
    }
    
    let audioUrl = '';
    if (data.phonetics?.length > 0) {
      audioUrl = data.phonetics.find(p => p.audio)?.audio || '';
    }
    
    let meanings = [];
    let examples = [];
    if (data.meanings) {
      for (const meaning of data.meanings) {
        for (const def of meaning.definitions.slice(0, 2)) {
          meanings.push(`${meaning.partOfSpeech}. ${def.definition}`);
          if (def.example) examples.push(def.example);
        }
      }
    }
    
    return {
      phonetic, audio_url: audioUrl,
      meaning: meanings.slice(0, 3).join('\n'),
      example: examples.slice(0, 2).join('\n'),
      success: true
    };
  } catch (error) {
    return { phonetic: '', audio_url: '', meaning: '', example: '', success: false };
  }
}

// 主导入函数
async function importWords() {
  let connection;
  
  try {
    console.log('\n🔗 连接云数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 创建数据库（如果不存在）
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.execute(`USE ${dbConfig.database}`);
    
    // 创建words表
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
    
    // 创建其他必要的表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        openid VARCHAR(100) NOT NULL UNIQUE,
        nickname VARCHAR(100),
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS learning_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        word_id INT NOT NULL,
        rating INT DEFAULT 0,
        review_count INT DEFAULT 0,
        next_review_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_word (user_id, word_id)
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS collections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        word_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_collection (user_id, word_id)
      )
    `);
    
    console.log('✅ 数据表准备完成');
    console.log(`\n📖 开始导入 ${KAOYAN_WORDS.length} 个单词...\n`);
    
    let successCount = 0, failCount = 0, skipCount = 0;
    
    for (let i = 0; i < KAOYAN_WORDS.length; i++) {
      const word = KAOYAN_WORDS[i];
      
      // 检查是否已存在
      const [existing] = await connection.execute('SELECT id FROM words WHERE word = ?', [word]);
      if (existing.length > 0) {
        skipCount++;
        if (i % 50 === 0) console.log(`⏭️  [${i + 1}/${KAOYAN_WORDS.length}] 进度更新...`);
        continue;
      }
      
      console.log(`📝 [${i + 1}/${KAOYAN_WORDS.length}] 获取 ${word}...`);
      const details = await getWordDetails(word);
      const meaning = details.meaning || '暂无释义';
      
      try {
        await connection.execute(
          `INSERT INTO words (word, phonetic, meaning, example, audio_url, category) VALUES (?, ?, ?, ?, ?, '考研')`,
          [word, details.phonetic, meaning, details.example, details.audio_url]
        );
        console.log(`  ✅ ${word} 导入成功`);
        successCount++;
      } catch (err) {
        console.log(`  ❌ ${word} 失败:`, err.message);
        failCount++;
      }
      
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 导入完成:');
    console.log(`  ✅ 成功: ${successCount}`);
    console.log(`  ⏭️  跳过: ${skipCount}`);
    console.log(`  ❌ 失败: ${failCount}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ 导入失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

importWords();
