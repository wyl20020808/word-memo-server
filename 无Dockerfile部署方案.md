# 无Dockerfile部署方案

## 🎯 如果Dockerfile一直有问题

### 方案：使用Buildpack自动构建

1. **在微信云托管选择部署方式时**：
   - 不选择"Dockerfile部署"
   - 选择"自动检测"或"Node.js"

2. **配置构建参数**：
   - **构建命令**：`npm install`
   - **启动命令**：`node app.js`
   - **端口**：`80`

3. **环境变量**：
   ```
   NODE_ENV=production
   PORT=80
   JWT_SECRET=word_memo_jwt_secret_key_2024_very_secure_random_string_123456789
   ```

## 🔧 修改app.js以适配

确保app.js中端口配置正确：
```javascript
const PORT = process.env.PORT || 80;
```

## ✅ 这种方式的优势

- 无需Dockerfile
- 微信云托管自动识别Node.js项目
- 自动安装依赖
- 更简单的配置