# Railway 部署指南 - 5分钟获得HTTPS域名

## 🚀 快速部署步骤

### 1. 准备GitHub仓库
```bash
# 在server目录下执行
git init
git add .
git commit -m "Initial commit"

# 创建GitHub仓库（在GitHub网站上创建）
# 然后关联远程仓库
git remote add origin https://github.com/你的用户名/word-memo-server.git
git branch -M main
git push -u origin main
```

### 2. Railway部署
1. 访问 https://railway.app/
2. 点击 "Start a New Project"
3. 选择 "Deploy from GitHub repo"
4. 登录GitHub并授权Railway
5. 选择你刚创建的仓库
6. Railway会自动检测Node.js项目并开始部署

### 3. 配置环境变量
在Railway项目面板中：
1. 点击 "Variables" 选项卡
2. 添加以下环境变量：
```
NODE_ENV=production
PORT=3000
JWT_SECRET=your_random_jwt_secret_here_make_it_long_and_secure
DB_HOST=（暂时不填，使用内存模式）
```

### 4. 获取域名
部署成功后，Railway会提供一个域名，类似：
`https://word-memo-server-production-xxxx.up.railway.app`

### 5. 修改小程序API地址
```javascript
// utils/api.js
const API_BASE_URL = 'https://word-memo-server-production-xxxx.up.railway.app/api';
```

## 🗄️ 数据库方案

### 方案1：Railway PostgreSQL（推荐）
1. 在Railway项目中点击 "Add Service"
2. 选择 "PostgreSQL"
3. Railway会自动创建数据库并提供连接信息
4. 修改代码使用PostgreSQL而不是MySQL

### 方案2：免费MySQL云数据库
**PlanetScale（推荐）**：
1. 注册 https://planetscale.com/
2. 创建免费数据库
3. 获取连接字符串
4. 在Railway中配置环境变量

**Aiven MySQL**：
1. 注册 https://aiven.io/
2. 创建免费MySQL实例
3. 配置连接信息

### 方案3：暂时使用内存数据（测试用）
当前代码已支持无数据库模式，可以先测试API功能

## 📝 完整部署脚本

创建一个自动化脚本：

```bash
#!/bin/bash
echo "🚀 开始部署到Railway..."

# 检查git状态
if [ ! -d ".git" ]; then
    echo "初始化Git仓库..."
    git init
fi

# 添加所有文件
git add .

# 提交更改
echo "提交代码..."
git commit -m "Deploy to Railway: $(date)"

# 推送到GitHub
echo "推送到GitHub..."
git push origin main

echo "✅ 代码已推送到GitHub"
echo "📝 接下来请在Railway网站上部署项目"
echo "🌐 部署完成后，记得更新小程序中的API地址"
```

## 🔧 Railway配置文件

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health"
  }
}
```

### Procfile
```
web: npm start
```

## 🌟 优势
- ✅ 5分钟内获得HTTPS域名
- ✅ 自动SSL证书
- ✅ 免费500小时/月
- ✅ 自动部署
- ✅ 支持环境变量
- ✅ 内置监控

## 💰 费用说明
- **免费额度**：500小时/月
- **超出后**：约$5/月
- **数据库**：PostgreSQL免费1GB

## 🔄 后续升级方案

### 当需要更多资源时：
1. **升级Railway**：$5-20/月
2. **购买域名**：绑定自定义域名
3. **云服务器**：迁移到阿里云/腾讯云

### 域名绑定（可选）
1. 购买域名（约50元/年）
2. 在Railway中添加自定义域名
3. 配置DNS CNAME记录
4. 自动获得SSL证书

## 🚨 注意事项
1. Railway免费版有500小时/月限制
2. 应用闲置30分钟后会休眠
3. 第一次访问可能需要几秒钟唤醒
4. 建议配置数据库持久化数据

## 📞 技术支持
如果部署遇到问题：
1. 检查GitHub仓库是否公开
2. 确认package.json中有start脚本
3. 查看Railway部署日志
4. 检查环境变量配置

现在就可以开始部署了！整个过程大约5-10分钟。