# 服务器部署指南

## 方案1：本地电脑做服务器（推荐新手）

### 1. 安装必要软件
```bash
# 安装Node.js (https://nodejs.org/)
# 安装MySQL (推荐使用XAMPP: https://www.apachefriends.org/)
```

### 2. 设置MySQL数据库
1. 启动XAMPP，开启MySQL服务
2. 访问 http://localhost/phpmyadmin
3. 创建数据库 `word_memo`
4. 导入初始数据：
```bash
# 在server目录下执行
mysql -u root -p word_memo < sql/init.sql
```

### 3. 配置环境变量
修改 `.env` 文件：
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=word_memo
PORT=3000
JWT_SECRET=随机生成的密钥
```

### 4. 启动服务
```bash
cd server
npm install
npm run dev
```

### 5. 配置网络访问
1. **路由器设置**：
   - 登录路由器管理界面
   - 找到"端口转发"或"虚拟服务器"
   - 添加规则：外部端口3000 → 内部IP:3000

2. **防火墙设置**：
   - Windows：允许Node.js通过防火墙
   - 开放3000端口

3. **获取外网IP**：
   - 访问 http://ip.cn 查看公网IP
   - 小程序中修改API地址为：`http://你的公网IP:3000/api`

### 6. 保持电脑不休眠
**Windows设置**：
- 控制面板 → 电源选项 → 更改计划设置
- 设置"使计算机进入睡眠状态"为"从不"
- 可以设置"关闭显示器"为较短时间以节能

**节能建议**：
- 关闭显示器但保持系统运行
- 降低CPU性能模式
- 关闭不必要的后台程序

## 方案2：云服务器部署

### 推荐服务商
1. **腾讯云轻量应用服务器**：24元/月
2. **阿里云ECS突发性能实例**：30元/月
3. **华为云耀云服务器**：25元/月

### 部署步骤
```bash
# 1. 连接服务器
ssh root@你的服务器IP

# 2. 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 安装MySQL
sudo apt update
sudo apt install mysql-server

# 4. 上传代码
# 使用git clone或者直接上传文件

# 5. 安装依赖并启动
cd server
npm install
npm start
```

## 方案3：免费云平台

### Railway (推荐)
1. 注册 https://railway.app
2. 连接GitHub仓库
3. 自动部署，每月500小时免费

### Render
1. 注册 https://render.com
2. 连接GitHub仓库
3. 免费版有限制但够个人使用

## 小程序配置

修改 `utils/api.js` 中的API地址：
```javascript
// 本地开发
const API_BASE_URL = 'http://localhost:3000/api';

// 生产环境（替换为你的实际地址）
const API_BASE_URL = 'http://你的域名或IP:3000/api';
```

## 常见问题

### Q: 电脑休眠后服务停止？
A: 设置电脑不进入睡眠状态，只关闭显示器

### Q: 小程序无法连接服务器？
A: 检查防火墙、路由器端口转发、网络连接

### Q: 数据库连接失败？
A: 检查MySQL服务是否启动，用户名密码是否正确

### Q: 想要域名访问？
A: 可以使用花生壳等动态DNS服务，或购买域名

## 监控和维护

### 服务监控
```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart app
```

### 数据备份
```bash
# 备份数据库
mysqldump -u root -p word_memo > backup.sql

# 恢复数据库
mysql -u root -p word_memo < backup.sql
```