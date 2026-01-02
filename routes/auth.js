const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code, userInfo } = req.body;
    
    // 这里应该调用微信API获取openid，为了演示简化处理
    // 实际项目中需要调用 https://api.weixin.qq.com/sns/jscode2session
    const openid = `demo_${Date.now()}`; // 演示用的openid
    
    // 查找或创建用户
    let [users] = await pool.execute(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );
    
    let user;
    if (users.length === 0) {
      // 创建新用户
      const [result] = await pool.execute(
        'INSERT INTO users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
        [openid, userInfo?.nickName || '', userInfo?.avatarUrl || '']
      );
      
      user = {
        id: result.insertId,
        openid,
        nickname: userInfo?.nickName || '',
        avatar_url: userInfo?.avatarUrl || ''
      };
    } else {
      user = users[0];
      
      // 更新用户信息
      if (userInfo) {
        await pool.execute(
          'UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?',
          [userInfo.nickName || user.nickname, userInfo.avatarUrl || user.avatar_url, user.id]
        );
      }
    }
    
    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
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
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败'
    });
  }
});

module.exports = router;