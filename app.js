const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const wordRoutes = require('./routes/words');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/words', wordRoutes);
app.use('/api/user', userRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '背单词服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '接口不存在' 
  });
});

// 启动服务器
async function startServer() {
  try {
    await testConnection();
    app.listen(PORT, '0.0.0.0', () => { // 监听所有网络接口
      console.log(`🚀 服务器启动成功！`);
      console.log(`📍 本地访问: http://localhost:${PORT}`);
      console.log(`🌐 外网访问: http://183.220.117.142:${PORT}`);
      console.log(`🏥 健康检查: http://183.220.117.142:${PORT}/health`);
      console.log(`📚 API文档: http://183.220.117.142:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();