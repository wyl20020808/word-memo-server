const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const https = require('https');
const { pool } = require('../config/database');

const router = express.Router();

// 微信小程序配置
const WX_APPID = process.env.WX_APPID || 'wx33b87738625a8459';
const WX_SECRET = process.env.WX_SECRET || '';

// 创建一个忽略SSL证书验证的axios实例（用于微信云托管环境）
const wxAxios = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code, userInfo } = req.body;
    
    console.log('📱 收到登录请求:', { code: code ? '有' : '无', userInfo: userInfo ? '有' : '无' });
    
    let openid;
    let sessionKey;
    
    // 检查WX_SECRET是否配置
    if (!WX_SECRET) {
      console.error('❌ WX_SECRET未配置！请在环境变量中配置');
      return res.status(500).json({
        success: false,
        message: '服务器配置错误：WX_SECRET未配置'
      });
    }
    
    // 如果有code，调用微信接口获取openid
    if (code) {
      try {
        console.log('🔑 调用微信接口获取openid...');
        console.log('🔑 AppID:', WX_APPID);
        console.log('🔑 Secret:', WX_SECRET ? '已配置' : '未配置');
        
        const wxRes = await wxAxios.get('https://api.weixin.qq.com/sns/jscode2session', {
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
          console.log('✅ 获取openid成功:', openid);
        } else {
          console.error('❌ 微信登录失败:', wxRes.data);
          return res.status(400).json({
            success: false,
            message: '微信登录失败: ' + (wxRes.data.errmsg || '未知错误')
          });
        }
      } catch (wxError) {
        console.error('❌ 调用微信接口失败:', wxError.message);
        return res.status(500).json({
          success: false,
          message: '调用微信接口失败: ' + wxError.message
        });
      }
    } else {
      console.error('❌ 缺少code参数');
      return res.status(400).json({
        success: false,
        message: '缺少code参数'
      });
    }
    
    console.log('🔑 最终openid:', openid);
    
    // 查找或创建用户
    let [users] = await pool.execute(
      'SELECT id, openid, nickname, avatar_url FROM users WHERE openid = ?',
      [openid]
    );
    
    console.log('👤 查询用户结果:', users.length > 0 ? '找到用户' : '新用户');
    
    let user;
    if (users.length === 0) {
      // 创建新用户 - 使用基础字段，兼容旧表结构
      const nickname = userInfo?.nickName || '微信用户';
      const avatarUrl = userInfo?.avatarUrl || '';
      
      try {
        // 尝试使用完整字段
        const [result] = await pool.execute(
          'INSERT INTO users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
          [openid, nickname, avatarUrl]
        );
        
        user = {
          id: result.insertId,
          openid,
          nickname,
          avatar_url: avatarUrl
        };
      } catch (insertError) {
        console.error('插入用户失败:', insertError.message);
        throw insertError;
      }
      
      console.log('✅ 创建新用户成功:', user.id);
    } else {
      user = users[0];
      console.log('👤 用户对象:', user);
      
      // 更新用户信息
      try {
        if (userInfo?.nickName || userInfo?.avatarUrl) {
          await pool.execute(
            'UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?',
            [userInfo?.nickName || user.nickname, userInfo?.avatarUrl || user.avatar_url, user.id]
          );
          
          // 更新本地user对象
          if (userInfo?.nickName) user.nickname = userInfo.nickName;
          if (userInfo?.avatarUrl) user.avatar_url = userInfo.avatarUrl;
        }
      } catch (updateError) {
        console.error('更新用户信息失败:', updateError.message);
        // 不抛出错误，继续登录流程
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