# 微信云托管GitHub部署指南

## 🎯 GitHub部署优势
- ✅ **自动同步**：代码更新自动部署
- ✅ **版本管理**：支持分支和版本控制
- ✅ **更稳定**：比代码包上传更可靠
- ✅ **易调试**：可以查看详细的构建日志

## 🚀 GitHub部署步骤

### 第1步：准备GitHub仓库
确保你的server代码已经上传到GitHub：
```bash
# 如果还没上传，运行：
cd server
git init
git add .
git commit -m "Initial commit for WeChat Cloud"
git remote add origin https://github.com/你的用户名/word-memo-server.git
git push -u origin main
```

### 第2步：在微信云托管选择GitHub部署
1. 在服务创建页面选择 **"Git仓库部署"**
2. 选择 **"GitHub"**
3. 授权微信云托管访问你的GitHub

### 第3步：配置仓库信息
- **仓库**：选择 `word-memo-server`
- **分支**：`main`
- **构建目录**：`./`（根目录）
- **Dockerfile路径**：`./Dockerfile`

### 第4步：配置构建参数
- **构建命令**：`npm install`
- **启动命令**：`npm start`
- **端口**：`80`

### 第5步：配置环境变量
```
NODE_ENV=production
JWT_SECRET=word_memo_jwt_secret_key_2024_very_secure_random_string_123456789
```

## 📁 必需的文件结构

确保你的GitHub仓库包含以下文件：
```
word-memo-server/
├── package.json          ✅ 必需
├── app.js               ✅ 必需
├── Dockerfile           ✅ 必需
├── config/              ✅ 必需
├── routes/              ✅ 必需
├── middleware/          ✅ 必需
└── .dockerignore        ✅ 推荐
```

## 🔧 如果GitHub部署失败

### 检查Dockerfile
确保Dockerfile内容正确：
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 80
CMD ["npm", "start"]
```

### 检查package.json
确保有正确的start脚本：
```json
{
  "scripts": {
    "start": "node app.js"
  }
}
```

### 检查端口配置
确保app.js使用80端口：
```javascript
const PORT = process.env.PORT || 80;
```

## 🎉 部署成功标志
- 构建日志显示 "Build successful"
- 服务状态显示 "运行中"
- 可以访问健康检查接口