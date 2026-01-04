const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;

// 创建数据库连接池
async function createPool() {
  // 读取环境变量
  const mysqlAddr = process.env.MYSQL_ADDRESS;
  const mysqlUser = process.env.MYSQL_USERNAME || process.env.DB_USER || 'root';
  const mysqlPass = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
  const mysqlDb = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'word_memo';
  
  console.log('🔍 数据库配置检查:');
  console.log('  - MYSQL_ADDRESS:', mysqlAddr || '未设置');
  console.log('  - MYSQL_USERNAME:', mysqlUser);
  console.log('  - MYSQL_PASSWORD:', mysqlPass ? '已设置' : '未设置');
  console.log('  - MYSQL_DATABASE:', mysqlDb);
  
  if (!mysqlAddr || !mysqlPass) {
    throw new Error('缺少必要的数据库配置: MYSQL_ADDRESS 和 MYSQL_PASSWORD');
  }
  
  // 解析地址
  const parts = mysqlAddr.split(':');
  const host = parts[0];
  const port = parts[1] ? parseInt(parts[1]) : 3306;
  
  console.log('  - 解析后Host:', host);
  console.log('  - 解析后Port:', port);
  
  // 先创建数据库（如果不存在）
  const tempPool = mysql.createPool({
    host: host,
    user: mysqlUser,
    password: mysqlPass,
    port: port,
    waitForConnections: true,
    connectionLimit: 2,
    connectTimeout: 30000
  });
  
  console.log('🔧 正在创建数据库...');
  await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${mysqlDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log('✅ 数据库创建/确认成功:', mysqlDb);
  await tempPool.end();
  
  // 创建正式连接池
  pool = mysql.createPool({
    host: host,
    user: mysqlUser,
    password: mysqlPass,
    database: mysqlDb,
    port: port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000
  });
  
  // 测试连接
  const conn = await pool.getConnection();
  console.log('✅ MySQL连接池创建成功');
  conn.release();
  
  return pool;
}

// 创建表结构
async function createTables() {
  console.log('🔧 正在创建表结构...');
  
  const CREATE_TABLES_SQL = [
    // 用户表
    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      openid VARCHAR(100) UNIQUE NOT NULL,
      nickname VARCHAR(100) DEFAULT '',
      avatar_url VARCHAR(500) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // 单词表
    `CREATE TABLE IF NOT EXISTS words (
      id INT PRIMARY KEY AUTO_INCREMENT,
      word VARCHAR(100) NOT NULL,
      phonetic VARCHAR(200) DEFAULT '',
      translation TEXT,
      meaning TEXT,
      example TEXT,
      example_trans TEXT,
      category VARCHAR(50) DEFAULT 'kaoyan',
      difficulty INT DEFAULT 1,
      frequency INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_word (word),
      INDEX idx_category (category)
    )`,
    // 用户学习记录表
    `CREATE TABLE IF NOT EXISTS user_word_records (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      word_id INT NOT NULL,
      rating INT DEFAULT 0,
      learned_count INT DEFAULT 0,
      last_learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_word (user_id, word_id)
    )`,
    // 用户收藏表
    `CREATE TABLE IF NOT EXISTS user_collections (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      word_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_collection (user_id, word_id)
    )`,
    // 学习统计表
    `CREATE TABLE IF NOT EXISTS user_stats (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      learned_count INT DEFAULT 0,
      study_time INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_date (user_id, date)
    )`
  ];
  
  for (const sql of CREATE_TABLES_SQL) {
    try {
      await pool.execute(sql);
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log('表创建警告:', e.message);
      }
    }
  }
  console.log('✅ 表结构创建完成');
}

// 导入单词数据到MySQL（只导入前1000个）
async function importWordsToMySQL() {
  console.log('🔧 检查是否需要导入单词数据...');
  
  // 检查words表是否有足够数据（至少1000个才算导入完成）
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM words');
  const count = rows[0].count;
  
  if (count >= 1000) {
    console.log(`✅ 单词表已有 ${count} 条数据，跳过导入`);
    return;
  }
  
  console.log(`📚 单词表只有 ${count} 条数据，需要导入...`);
  
  // 先清空表
  console.log('🗑️ 清空现有数据...');
  await pool.execute('TRUNCATE TABLE words');
  
  console.log('📚 开始导入单词数据到MySQL...');
  
  // 读取单词文件
  const wordsFile = path.join(__dirname, '../data/all-words.json');
  if (!fs.existsSync(wordsFile)) {
    console.log('⚠️ 单词文件不存在:', wordsFile);
    return;
  }
  
  const content = fs.readFileSync(wordsFile, 'utf8');
  const allWords = JSON.parse(content);
  
  // 只取前1000个单词
  const words = allWords.slice(0, 1000);
  
  console.log(`📚 读取到 ${allWords.length} 个单词，只导入前 ${words.length} 个...`);
  
  // 批量插入（每次100个）
  const batchSize = 100;
  let imported = 0;
  
  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    
    // 构建批量插入SQL
    const values = batch.map(w => [
      w.word || '',
      w.phonetic || '',
      w.meaning || w.translation || '',
      w.meaning || '',
      w.example || '',
      '',  // example_trans
      'kaoyan'
    ]);
    
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flatValues = values.flat();
    
    try {
      await pool.execute(
        `INSERT IGNORE INTO words (word, phonetic, translation, meaning, example, example_trans, category) VALUES ${placeholders}`,
        flatValues
      );
      imported += batch.length;
      console.log(`  已导入 ${imported}/${words.length} 个单词...`);
    } catch (e) {
      console.error('批量插入失败:', e.message);
    }
  }
  
  console.log(`✅ 单词导入完成，共导入 ${imported} 个单词`);
}

// 测试数据库连接并初始化
async function testConnection() {
  try {
    await createPool();
    await createTables();
    await importWordsToMySQL();
    console.log('✅ 数据库初始化完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    throw error; // 不再降级到内存数据库，直接抛出错误
  }
}

// 统一的数据库接口
const db = {
  async execute(sql, params) {
    if (!pool) {
      throw new Error('数据库未初始化');
    }
    return await pool.execute(sql, params);
  },
  
  async getConnection() {
    if (!pool) {
      throw new Error('数据库未初始化');
    }
    return await pool.getConnection();
  }
};

module.exports = { pool: db, testConnection };
