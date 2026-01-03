# 🆓 Vercel免费部署指南

## 🌟 Vercel优势
- ✅ 完全免费
- ✅ 无休眠限制
- ✅ 全球CDN加速
- ✅ 自动HTTPS
- ✅ 无需信用卡

## 🚀 部署步骤

### 1. 注册Vercel
1. 访问 https://vercel.com/
2. 点击 "Start Deploying"
3. 选择 "Continue with GitHub"
4. 授权Vercel访问GitHub

### 2. 导入项目
1. 点击 "Add New..." → "Project"
2. 找到你的 `word-memo-server` 仓库
3. 点击 "Import"

### 3. 配置项目
- **Framework Preset**: Other
- **Root Directory**: `./` (默认)
- **Build Command**: `npm run build`
- **Output Directory**: `./` (默认)
- **Install Command**: `npm install`

### 4. 配置环境变量
在 "Environment Variables" 添加：
```
NODE_ENV=production
JWT_SECRET=word_memo_jwt_secret_key_2024_very_secure_random_string_123456789
```

### 5. 部署
1. 点击 "Deploy"
2. 等待部署完成
3. 获得域名：`https://word-memo-server.vercel.app`

## 📝 Vercel配置文件
创建 `vercel.json`：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/app.js"
    }
  ]
}
```