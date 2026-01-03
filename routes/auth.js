const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code, userInfo } = req.body;
    
    console.log('📱 收到登录请求:', { code: code ? '有' : '无', userInfo: userInfo ? '有' : '无' });
    
    // 生成唯一的openid（实际项目中应该调用微信API）
    // 为了简化，使用固定的openid便于测试
    const openid = code ? `wx_${code.substring(0, 10)}` : `demo_user_001`;
    
    console.log('🔑 生成openid:', openid);
    
    // 查找或创建用户
    let [users] = await pool.execute(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );
    
    console.log('👤 查询用户结果:', users.length > 0 ? '找到用户' : '新用户');
    
    let user;
    if (users.length === 0) {
      // 创建新用户
      const [result] = await pool.execute(
        'INSERT INTO users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
        [openid, userInfo?.nickName || '微信用户', userInfo?.avatarUrl || '']
      );
      
      user = {
        id: result.insertId,
        openid,
        nickname: userInfo?.nickName || '微信用户',
        avatar_url: userInfo?.avatarUrl || ''
      };
      console.log('✅ 创建新用户成功:', user.id);
    } else {
      user = users[0];
      
      // 更新用户信息
      if (userInfo) {
        await pool.execute(
          'UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?',
          [userInfo.nickName || user.nickname, userInfo.avatarUrl || user.avatar_url, user.id]
        );
      }
      console.log('✅ 用户已存在:', user.id);
    }
    
    // 生成JWT token
    const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_for_dev';
    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      jwtSecret,
      { expiresIn: '30d' }
    );
    
    console.log('🎫 生成token成功');
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar_url: user.avatar_url
        }
      }
    });
    
  } catch (error) {
    console.error('❌ 登录失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: '登录失败: ' + error.message
    });
  }
});

module.exports = router;