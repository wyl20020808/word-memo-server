const mysql = require('mysql2/promise');
const MemoryDB = require('./memory-db');
require('dotenv').config();

let pool;
let memoryDB;
let useMemoryDB = false;

// 创建数据库连接池
if (process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_PASSWORD)) {
  // 使用真实数据库
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'word_memo',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    // 云数据库SSL配置
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  });
} else {
  // 使用内存数据库
  console.log('⚠️  未检测到数据库配置，使用内存数据库模式');
  memoryDB = new MemoryDB();
  useMemoryDB = true;
}

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
  try {
    if (useMemoryDB) {
      console.log('✅ 内存数据库连接成功');
      return true;
    } else {
      const connection = await pool.getConnection();
      console.log('✅ MySQL数据库连接成功');
      connection.release();
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