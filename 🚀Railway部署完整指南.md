# 🚀 Railway部署完整指南（5分钟搞定）

## 📋 准备工作检查清单
- [ ] 有GitHub账号
- [ ] 电脑已安装Git
- [ ] 在server目录下

## 🎯 第1步：上传代码到GitHub

### 1.1 运行部署脚本
```bash
# 在server目录下运行
deploy-to-github.bat
```

### 1.2 创建GitHub仓库
1. 访问 https://github.com/new
2. 仓库名：`word-memo-server`
3. 设为**公开仓库**（Public）
4. **不要**勾选任何初始化选项
5. 点击"Create repository"

### 1.3 关联远程仓库
复制GitHub给出的命令，类似：
```bash
git remote add origin https://github.com/你的用户名/word-memo-server.git
git push -u origin main
```

## 🚀 第2步：Railway部署

### 2.1 注册Railway
1. 访问 https://railway.app/
2. 点击"Login"
3. 选择"Login with GitHub"
4. 授权Railway访问你的GitHub

### 2.2 创建新项目
1. 点击"New Project"
2. 选择"Deploy from GitHub repo"
3. 找到并选择`word-memo-server`仓库
4. 点击"Deploy Now"

### 2.3 等待部署完成
- Railway会自动检测Node.js项目
- 安装依赖包
- 启动服务器
- 大约2-3分钟完成

### 2.4 配置环境变量
1. 在项目面板中点击"Variables"
2. 添加以下变量：
```
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_make_it_very_long_and_random_123456789
PORT=3000
```

### 2.5 获取域名
部署成功后，你会看到类似这样的域名：
```
https://word-memo-server-production-a1b2.up.railway.app
```

## 🔧 第3步：配置小程序

### 3.1 修改API地址
在 `utils/api.js` 中：
```javascript
const API_CONFIGS = {
  local: 'http://localhost:3000/api',
  railway: 'https://你的railway域名.up.railway.app/api', // 替换这里
  custom: 'https://183.220.117.142:3000/api'
};

const API_BASE_URL = API_CONFIGS.railway; // 使用Railway域名
```

### 3.2 测试连接
1. 在浏览器访问：`https://你的域名.up.railway.app/health`
2. 应该看到：`{"status":"ok","message":"背单词服务运行正常"}`

## 🎉 第4步：测试小程序

### 4.1 开发者工具设置
1. 打开微信开发者工具
2. 点击"详情" -> "本地设置"
3. 勾选"不校验合法域名..."（开发阶段）

### 4.2 测试功能
1. 重新编译小程序
2. 进入背单词页面
3. 检查是否能正常加载单词

## 🔍 故障排除

### 问题1：部署失败
**解决方案**：
1. 检查package.json是否有start脚本
2. 查看Railway部署日志
3. 确认代码已推送到GitHub

### 问题2：服务器启动失败
**解决方案**：
1. 检查环境变量配置
2. 查看Railway日志中的错误信息
3. 确认端口配置正确

### 问题3：小程序无法连接
**解决方案**：
1. 确认API地址正确
2. 检查Railway服务是否运行
3. 在浏览器测试API接口

### 问题4：数据不持久化
**说明**：当前使用内存数据库，重启后数据会丢失
**解决方案**：后续可以添加PostgreSQL数据库

## 📊 Railway使用情况

### 免费额度
- **运行时间**：500小时/月
- **内存**：512MB
- **CPU**：共享
- **带宽**：100GB/月

### 监控使用量
1. 在Railway项目面板查看使用统计
2. 接近限额时会收到邮件通知
3. 可以升级到付费计划（$5/月起）

## 🔄 后续优化

### 添加数据库
1. 在Railway项目中添加PostgreSQL服务
2. 修改代码支持PostgreSQL
3. 数据持久化存储

### 自定义域名
1. 购买域名（可选）
2. 在Railway中绑定自定义域名
3. 自动获得SSL证书

### 性能优化
1. 启用Railway的缓存功能
2. 优化数据库查询
3. 添加CDN加速

## 🎯 完成检查清单

部署完成后，确认以下功能正常：
- [ ] 服务器健康检查：`/health`
- [ ] 用户登录功能
- [ ] 单词列表加载
- [ ] 学习记录保存
- [ ] 收藏功能
- [ ] 统计数据显示

## 📞 获取帮助

如果遇到问题：
1. 查看Railway部署日志
2. 检查浏览器开发者工具
3. 查看小程序调试控制台
4. 参考Railway官方文档

恭喜！你现在有了一个完全免费的HTTPS API服务器！🎉