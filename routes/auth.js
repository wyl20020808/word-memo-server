const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { pool } = require('../config/database');

const router = express.Router();

// 微信小程序配置
const WX_APPID = process.env.WX_APPID || 'wx4eac6ffa18778ebe';
const WX_SECRET = process.env.WX_SECRET || ''; // 需要在环境变量中配置

// 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code, userInfo } = req.body;
    
    console.log('📱 收到登录请求:', { code: code ? '有' : '无', userInfo: userInfo ? '有' : '无' });
    
    let openid;
    let sessionKey;
    
    // 如果有code，调用微信接口获取openid
    if (code && WX_SECRET) {
      try {
        const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
          params: {
            appid: WX_APPID,
            secret: WX_SECRET,
            js_code: code,
            grant_type: 'authorization_code'
          }
        });
        
        console.log('🔑 微信接口返回:', wxRes.data);
        
        if (wxRes.data.openid) {
          openid = wxRes.data.openid;
          sessionKey = wxRes.data.session_key;
        } else {
          console.error('微信登录失败:', wxRes.data);
          // 如果微信接口失败，使用code生成临时openid
          openid = `wx_${code.substring(0, 16)}_${Date.now()}`;
        }
      } catch (wxError) {
        console.error('调用微信接口失败:', wxError.message);
        // 降级处理：使用code生成临时openid
        openid = `wx_${code.substring(0, 16)}_${Date.now()}`;
      }
    } else {
      // 没有code或secret，生成临时openid（开发测试用）
      openid = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log('⚠️ 使用临时openid（未配置WX_SECRET）');
    }
    
    console.log('🔑 最终openid:', openid);
    
    // 查找或创建用户
    let [users] = await pool.execute(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );
    
    console.log('👤 查询用户结果:', users.length > 0 ? '找到用户' : '新用户');
    
    let user;
    if (users.length === 0) {
      // 创建新用户
      const nickname = userInfo?.nickName || '微信用户';
      const avatarUrl = userInfo?.avatarUrl || '';
      
      const [result] = await pool.execute(
        'INSERT INTO users (openid, nickname, avatar_url, session_key, created_at) VALUES (?, ?, ?, ?, NOW())',
        [openid, nickname, avatarUrl, sessionKey || '']
      );
      
      user = {
        id: result.insertId,
        openid,
        nickname,
        avatar_url: avatarUrl
      };
      console.log('✅ 创建新用户成功:', user.id);
    } else {
      user = users[0];
      
      // 更新用户信息和session_key
      const updateFields = [];
      const updateValues = [];
      
      if (userInfo?.nickName) {
        updateFields.push('nickname = ?');
        updateValues.push(userInfo.nickName);
      }
      if (userInfo?.avatarUrl) {
        updateFields.push('avatar_url = ?');
        updateValues.push(userInfo.avatarUrl);
      }
      if (sessionKey) {
        updateFields.push('session_key = ?');
        updateValues.push(sessionKey);
      }
      updateFields.push('last_login_at = NOW()');
      
      if (updateFields.length > 0) {
        updateValues.push(user.id);
        await pool.execute(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
        
        // 更新本地user对象
        if (userInfo?.nickName) user.nickname = userInfo.nickName;
        if (userInfo?.avatarUrl) user.avatar_url = userInfo.avatarUrl;
      }
      console.log('✅ 用户已存在，已更新信息:', user.id);
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
          avatar_url: user.avatar_url,
          openid: user.openid
        }
      }
    });
    
  } catch (error) {
    console.error('❌ 登录失败:', error);
    console.error('错误详情:', error.message);
    res.status(500).json({
      success: false,
      message: '登录失败: ' + error.message
    });
  }
});

// 获取当前用户信息
router.get('/userinfo', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_for_dev';
    const decoded = jwt.verify(token, jwtSecret);
    
    const [users] = await pool.execute(
      'SELECT id, nickname, avatar_url, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(401).json({ success: false, message: '登录已过期' });
  }
});

// 更新用户信息
router.put('/userinfo', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_for_dev';
    const decoded = jwt.verify(token, jwtSecret);
    
    const { nickname, avatarUrl } = req.body;
    
    await pool.execute(
      'UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?',
      [nickname, avatarUrl, decoded.userId]
    );
    
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

module.exports = router;