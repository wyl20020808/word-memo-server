const mysql = require('mysql2/promise');
const MemoryDB = require('./memory-db');
require('dotenv').config();

let pool;
let memoryDB;
let useMemoryDB = false;

// 微信云托管MySQL环境变量
const MYSQL_ADDRESS = process.env.MYSQL_ADDRESS; // 格式: 10.21.101.77:3306
const MYSQL_USERNAME = process.env.MYSQL_USERNAME;
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;

// 解析MySQL地址
let mysqlHost = process.env.DB_HOST || 'localhost';
let mysqlPort = process.env.DB_PORT || 3306;

if (MYSQL_ADDRESS) {
  const parts = MYSQL_ADDRESS.split(':');
  mysqlHost = parts[0];
  mysqlPort = parts[1] ? parseInt(parts[1]) : 3306;
}

// 获取数据库用户名和密码
const dbUser = MYSQL_USERNAME || process.env.DB_USER || 'root';
const dbPassword = MYSQL_PASSWORD || process.env.DB_PASSWORD;
const dbName = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'word_memo';

console.log('🔍 数据库配置检测:');
console.log('  - MYSQL_ADDRESS:', MYSQL_ADDRESS || '未设置');
console.log('  - MYSQL_USERNAME:', MYSQL_USERNAME || '未设置');
console.log('  - MYSQL_PASSWORD:', MYSQL_PASSWORD ? '已设置' : '未设置');
console.log('  - 解析后的Host:', mysqlHost);
console.log('  - 解析后的Port:', mysqlPort);
console.log('  - 数据库名:', dbName);

// 自动创建数据库和表的SQL
const CREATE_DATABASE_SQL = `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

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

// 自动迁移：添加可能缺失的字段
const MIGRATE_SQL = [
  `ALTER TABLE words ADD COLUMN IF NOT EXISTS meaning TEXT AFTER translation`,
  `ALTER TABLE words ADD COLUMN IF NOT EXISTS example_trans TEXT AFTER example`,
  `ALTER TABLE words ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
];

// 初始化数据库（创建数据库和表）
async function initDatabase() {
  if (!MYSQL_ADDRESS && !process.env.DATABASE_URL && !(process.env.DB_HOST && process.env.DB_PASSWORD)) {
    return false;
  }
  
  try {
    // 先连接不指定数据库，创建数据库
    const tempPool = mysql.createPool({
      host: mysqlHost,
      user: dbUser,
      password: dbPassword,
      port: mysqlPort,
      waitForConnections: true,
      connectionLimit: 2,
      connectTimeout: 30000
    });
    
    console.log('🔧 正在初始化数据库...');
    
    // 创建数据库
    await tempPool.execute(CREATE_DATABASE_SQL);
    console.log('✅ 数据库创建/确认成功:', dbName);
    
    // 关闭临时连接
    await tempPool.end();
    
    return true;
  } catch (error) {
    console.error('❌ 初始化数据库失败:', error.message);
    return false;
  }
}

// 创建表和执行迁移
async function createTables() {
  if (useMemoryDB) return true;
  
  try {
    console.log('🔧 正在创建/更新表结构...');
    
    for (const sql of CREATE_TABLES_SQL) {
      try {
        await pool.execute(sql);
      } catch (e) {
        // 忽略表已存在的错误
        if (!e.message.includes('already exists')) {
          console.log('表创建警告:', e.message);
        }
      }
    }
    console.log('✅ 表结构创建/确认成功');
    
    // 执行迁移（添加新字段）
    for (const sql of MIGRATE_SQL) {
      try {
        await pool.execute(sql);
      } catch (e) {
        // 忽略字段已存在等错误
        if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
          // MySQL 不支持 IF NOT EXISTS 语法，尝试直接添加
          try {
            const alterSql = sql.replace(' IF NOT EXISTS', '');
            await pool.execute(alterSql);
          } catch (e2) {
            // 字段已存在，忽略
          }
        }
      }
    }
    console.log('✅ 数据库迁移完成');
    
    return true;
  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
    return false;
  }
}

// 创建数据库连接池
async function createPool() {
  // 重新读取环境变量（确保在运行时读取）
  const mysqlAddr = process.env.MYSQL_ADDRESS;
  const mysqlUser = process.env.MYSQL_USERNAME || process.env.DB_USER || 'root';
  const mysqlPass = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
  const mysqlDb = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'word_memo';
  
  console.log('🔍 createPool - 环境变量检查:');
  console.log('  - MYSQL_ADDRESS:', mysqlAddr || '未设置');
  console.log('  - MYSQL_USERNAME:', mysqlUser);
  console.log('  - MYSQL_PASSWORD:', mysqlPass ? '已设置' : '未设置');
  console.log('  - MYSQL_DATABASE:', mysqlDb);
  
  if (mysqlAddr && mysqlPass) {
    console.log('✅ 检测到MySQL配置，使用MySQL数据库');
    
    // 解析地址
    const parts = mysqlAddr.split(':');
    const host = parts[0];
    const port = parts[1] ? parseInt(parts[1]) : 3306;
    
    console.log('  - 解析后Host:', host);
    console.log('  - 解析后Port:', port);
    
    try {
      // 先初始化数据库（创建数据库）
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
      
      useMemoryDB = false;
      return true;
      
    } catch (error) {
      console.error('❌ MySQL连接失败:', error.message);
      console.log('🔄 降级到内存数据库模式');
      memoryDB = new MemoryDB();
      useMemoryDB = true;
      return true;
    }
  } else {
    console.log('⚠️  未检测到完整的数据库配置');
    console.log('  需要: MYSQL_ADDRESS 和 MYSQL_PASSWORD');
    console.log('🔄 使用内存数据库模式');
    memoryDB = new MemoryDB();
    useMemoryDB = true;
    return true;
  }
}

// 不要立即执行，等待 testConnection 调用
// createPool().catch(console.error);

// 统一的数据库接口
const db = {
  async execute(sql, params) {
    if (useMemoryDB) {
      return await memoryDB.execute(sql, params);
    } else {
      return await pool.execute(sql, params);
    }
  },
  
  async getConnection() {
    if (useMemoryDB) {
      return {
        execute: (sql, params) => memoryDB.execute(sql, params),
        release: () => {}
      };
    } else {
      return await pool.getConnection();
    }
  }
};

// 测试数据库连接
async function testConnection() {
  // 先创建连接池
  await createPool();
  
  try {
    if (useMemoryDB) {
      console.log('✅ 内存数据库连接成功');
      return true;
    } else {
      const connection = await pool.getConnection();
      console.log('✅ MySQL数据库连接成功');
      connection.release();
      
      // 创建表和执行迁移
      await createTables();
      
      return true;
    }
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    
    // 降级到内存数据库
    if (!useMemoryDB) {
      console.log('🔄 降级到内存数据库模式');
      memoryDB = new MemoryDB();
      useMemoryDB = true;
      return true;
    }
    return false;
  }
}

module.exports = { pool: db, testConnection };