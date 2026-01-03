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

console.log('🔍 数据库配置检测:');
console.log('  - MYSQL_ADDRESS:', MYSQL_ADDRESS || '未设置');
console.log('  - MYSQL_USERNAME:', MYSQL_USERNAME || '未设置');
console.log('  - MYSQL_PASSWORD:', MYSQL_PASSWORD ? '已设置' : '未设置');
console.log('  - 解析后的Host:', mysqlHost);
console.log('  - 解析后的Port:', mysqlPort);

// 创建数据库连接池
if (MYSQL_ADDRESS || process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_PASSWORD)) {
  console.log('✅ 检测到MySQL配置，使用MySQL数据库');
  
  // 微信云托管默认数据库名为 nodejs（或者你创建的数据库名）
  const dbName = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'word_memo';
  console.log('  - 数据库名:', dbName);
  
  // 使用真实数据库
  pool = mysql.createPool({
    host: mysqlHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: mysqlPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000,
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