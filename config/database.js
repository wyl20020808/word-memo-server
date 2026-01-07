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
  
  // 创建正式连接池 - 优化配置以处理长时间异步任务
  pool = mysql.createPool({
    host: host,
    user: mysqlUser,
    password: mysqlPass,
    database: mysqlDb,
    port: port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000,
    // 连接保活配置
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000  // 10秒后开始保活
  });
  
  // 测试连接
  const conn = await pool.getConnection();
  console.log('✅ MySQL连接池创建成功');
  conn.release();
  
  return pool;
}

// 带重试的数据库执行函数
async function executeWithRetry(sql, params, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await pool.execute(sql, params);
    } catch (error) {
      lastError = error;
      // 如果是连接重置错误，等待后重试
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log(`⚠️ 数据库连接重置，重试 ${i + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
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
    )`,
    // ==================== AI智能学习功能表 ====================
    // 用户设置表
    `CREATE TABLE IF NOT EXISTS user_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      vocabulary_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
      daily_goal INT DEFAULT 50,
      exam_date DATE,
      target_words INT DEFAULT 5000,
      reminder_time TIME DEFAULT '20:00:00',
      reminder_enabled TINYINT DEFAULT 1,
      preferred_mode ENUM('card', 'quiz', 'spell') DEFAULT 'card',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_user (user_id)
    )`,
    // 单词掌握度表（SM-2算法核心）
    `CREATE TABLE IF NOT EXISTS word_mastery (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      word_id INT NOT NULL,
      easiness_factor DECIMAL(4,2) DEFAULT 2.50,
      repetition INT DEFAULT 0,
      interval_days INT DEFAULT 1,
      next_review_date DATE,
      last_quality INT DEFAULT 0,
      correct_count INT DEFAULT 0,
      wrong_count INT DEFAULT 0,
      error_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_user_word (user_id, word_id),
      INDEX idx_next_review (user_id, next_review_date),
      INDEX idx_easiness (user_id, easiness_factor)
    )`,
    // 学习日志表
    `CREATE TABLE IF NOT EXISTS learning_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      word_id INT NOT NULL,
      action ENUM('learn', 'review', 'quiz', 'spell') NOT NULL,
      quality INT DEFAULT 0,
      time_spent INT DEFAULT 0,
      is_correct TINYINT DEFAULT 0,
      error_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_date (user_id, created_at),
      INDEX idx_word (word_id)
    )`,
    // 诊断结果表
    `CREATE TABLE IF NOT EXISTS diagnosis_results (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      total_questions INT DEFAULT 20,
      correct_count INT DEFAULT 0,
      accuracy DECIMAL(5,2) DEFAULT 0,
      vocabulary_level ENUM('beginner', 'intermediate', 'advanced'),
      estimated_vocabulary INT DEFAULT 0,
      weak_areas JSON,
      details JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_created (created_at)
    )`,
    // 学习计划表
    `CREATE TABLE IF NOT EXISTS learning_plans (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      plan_name VARCHAR(100) DEFAULT '默认计划',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      target_words INT DEFAULT 5000,
      daily_new_words INT DEFAULT 50,
      daily_review_words INT DEFAULT 25,
      is_active TINYINT DEFAULT 1,
      progress_percent DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_active (user_id, is_active)
    )`,
    // ==================== 复盘记录功能表 ====================
    // 复盘记录表
    `CREATE TABLE IF NOT EXISTS ai_notes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      original_content TEXT NOT NULL,
      category VARCHAR(50) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_created (user_id, created_at)
    )`,
    // AI分析结果表
    `CREATE TABLE IF NOT EXISTS ai_notes_analysis (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      summary TEXT,
      key_points JSON,
      suggestions JSON,
      activity_summary TEXT COMMENT 'AI活动总结',
      activity_categories JSON COMMENT '活动分类',
      recent_highlights JSON COMMENT '近期亮点',
      notes_count INT DEFAULT 0,
      analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_analyzed (user_id, analyzed_at)
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
  
  // 执行表结构迁移（添加新字段）
  await migrateTableStructure();
}

// 表结构迁移（添加新字段）
async function migrateTableStructure() {
  console.log('🔧 检查表结构迁移...');
  
  // 需要添加到 ai_notes_analysis 表的列
  const columnsToAdd = [
    { name: 'activity_summary', definition: "TEXT COMMENT 'AI活动总结'" },
    { name: 'activity_categories', definition: "JSON COMMENT '活动分类'" },
    { name: 'recent_highlights', definition: "JSON COMMENT '近期亮点'" }
  ];
  
  for (const col of columnsToAdd) {
    try {
      // 检查列是否存在
      const [columns] = await pool.execute(
        `SHOW COLUMNS FROM ai_notes_analysis LIKE ?`,
        [col.name]
      );
      
      if (columns.length === 0) {
        // 列不存在，添加它
        await pool.execute(`ALTER TABLE ai_notes_analysis ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ 添加列: ai_notes_analysis.${col.name}`);
      } else {
        console.log(`⏭️  列已存在: ai_notes_analysis.${col.name}`);
      }
    } catch (e) {
      console.log(`⚠️  迁移警告: ${col.name} - ${e.message}`);
    }
  }
}

// 导入单词数据到MySQL（全部导入）
async function importWordsToMySQL() {
  console.log('🔧 检查是否需要导入单词数据...');
  
  // 检查words表数据量
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM words');
  const count = rows[0].count;
  
  if (count >= 1000) {
    console.log(`✅ 单词表已有 ${count} 条数据，跳过导入`);
    return;
  }
  
  console.log(`📚 单词表只有 ${count} 条数据，需要导入全部单词...`);
  
  // 先清空表
  console.log('🗑️ 清空现有数据...');
  await pool.execute('TRUNCATE TABLE words');
  
  console.log('📚 开始导入全部单词数据到MySQL...');
  
  // 读取单词文件
  const wordsFile = path.join(__dirname, '../data/all-words.json');
  if (!fs.existsSync(wordsFile)) {
    console.log('⚠️ 单词文件不存在:', wordsFile);
    return;
  }
  
  const content = fs.readFileSync(wordsFile, 'utf8');
  const words = JSON.parse(content);
  
  console.log(`📚 读取到 ${words.length} 个单词，开始全部导入...`);
  
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
      
      if (imported % 1000 === 0) {
        console.log(`  已导入 ${imported}/${words.length} 个单词...`);
      }
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
  
  // 带重试的执行（用于异步任务中的数据库操作）
  async executeWithRetry(sql, params, maxRetries = 3) {
    if (!pool) {
      throw new Error('数据库未初始化');
    }
    return await executeWithRetry(sql, params, maxRetries);
  },
  
  async getConnection() {
    if (!pool) {
      throw new Error('数据库未初始化');
    }
    return await pool.getConnection();
  }
};

module.exports = { pool: db, testConnection };
