# 🆓 Render免费部署指南

## 🌟 Render优势
- ✅ 完全免费（无时间限制）
- ✅ 自动HTTPS域名
- ✅ 自动部署
- ✅ 750小时/月免费额度
- ✅ 无需信用卡

## 🚀 部署步骤

### 1. 注册Render
1. 访问 https://render.com/
2. 点击 "Get Started for Free"
3. 选择 "GitHub" 登录
4. 授权Render访问你的GitHub

### 2. 创建Web Service
1. 登录后点击 "New +"
2. 选择 "Web Service"
3. 连接你的GitHub仓库 `word-memo-server`
4. 点击 "Connect"

### 3. 配置部署设置
填写以下信息：
- **Name**: `word-memo-server`
- **Region**: `Oregon (US West)` 或就近选择
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 4. 配置环境变量
在 "Environment Variables" 部分添加：
```
NODE_ENV=production
JWT_SECRET=word_memo_jwt_secret_key_2024_very_secure_random_string_123456789
PORT=10000
```

### 5. 部署
1. 点击 "Create Web Service"
2. 等待部署完成（约3-5分钟）
3. 获得域名：`https://word-memo-server.onrender.com`

## 📱 更新小程序配置
```javascript
// utils/api.js
const API_CONFIGS = {
  local: 'http://localhost:3000/api',
  render: 'https://word-memo-server.onrender.com/api', // Render域名
  railway: 'https://word-memo-server-production.up.railway.app/api'
};

const API_BASE_URL = API_CONFIGS.render; // 使用Render
```

## 💡 Render免费限制
- 应用闲置15分钟后休眠
- 第一次访问需要几秒钟唤醒
- 每月750小时免费额度
- 512MB内存限制

## 🔄 自动唤醒方案
创建定时任务保持应用活跃：
```javascript
// 在app.js中添加
setInterval(() => {
  console.log('Keep alive ping');
}, 14 * 60 * 1000); // 每14分钟ping一次
```