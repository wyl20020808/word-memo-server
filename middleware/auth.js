const jwt = require('jsonwebtoken');

// JWT密钥（与auth.js中保持一致）
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_for_dev';

// JWT认证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  console.log('🔐 认证检查:');
  console.log('  - Authorization头:', authHeader ? '存在' : '不存在');
  console.log('  - Token:', token ? token.substring(0, 20) + '...' : '无');
  
  if (!token) {
    console.log('❌ 缺少访问令牌');
    return res.status(401).json({
      success: false,
      message: '缺少访问令牌'
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token验证失败:', err.message);
      return res.status(403).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }
    
    console.log('✅ Token验证成功, 用户ID:', user.userId);
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };