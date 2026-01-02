# 背单词小程序后端服务

## 功能特性

- 用户认证（微信登录）
- 单词管理（获取、学习记录、收藏）
- 学习统计（每日、总计、历史记录）
- MySQL数据库存储
- RESTful API设计

## 快速开始

### 1. 安装依赖
```bash
cd server
npm install
```

### 2. 配置数据库
1. 安装MySQL（推荐使用XAMPP或WAMP）
2. 创建数据库：
```sql
CREATE DATABASE word_memo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
3. 导入初始数据：
```bash
mysql -u root -p word_memo < sql/init.sql
```

### 3. 配置环境变量
复制 `.env` 文件并修改数据库密码：
```bash
DB_PASSWORD=your_mysql_password
JWT_SECRET=your_random_secret_key
```

### 4. 启动服务
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务将在 http://localhost:3000 启动

## API接口

### 认证相关
- `POST /api/auth/login` - 微信登录

### 单词相关
- `GET /api/words` - 获取单词列表
- `POST /api/words/learn` - 记录学习进度
- `POST /api/words/collect` - 收藏/取消收藏
- `GET /api/words/collections` - 获取收藏列表

### 用户相关
- `GET /api/user/stats` - 获取学习统计
- `GET /api/user/history` - 获取学习历史

## 部署方案

### 方案1：本地电脑做服务器
1. 设置电脑不休眠（仅关闭显示器）
2. 配置路由器端口转发（3000端口）
3. 使用动态DNS服务（如花生壳）

### 方案2：云服务器
推荐使用腾讯云轻量应用服务器（24元/月）

## 数据库表结构

- `users` - 用户表
- `words` - 单词表
- `user_word_records` - 学习记录表
- `user_collections` - 收藏表
- `user_stats` - 学习统计表