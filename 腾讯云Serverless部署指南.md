# 腾讯云Serverless部署指南

## 🌟 为什么选择腾讯云Serverless

### 优势
- ✅ **官方支持**：腾讯自家产品，与微信小程序完美兼容
- ✅ **自动域名白名单**：部署后域名自动加入小程序白名单
- ✅ **按量付费**：用多少付多少，个人使用很便宜
- ✅ **免费额度**：每月有一定免费额度
- ✅ **国内访问快**：服务器在国内，速度快

### 费用
- **免费额度**：每月40万GB·秒免费
- **超出费用**：约0.0000167元/GB·秒
- **预估费用**：个人使用约20-50元/月

## 🚀 部署步骤

### 第1步：注册腾讯云
1. 访问 https://cloud.tencent.com/
2. 注册账号并完成实名认证
3. 开通云函数服务

### 第2步：安装Serverless CLI
```bash
npm install -g serverless
```

### 第3步：配置项目
创建 `serverless.yml` 配置文件

### 第4步：部署
```bash
serverless deploy
```

### 第5步：获取域名
部署成功后获得类似域名：
```
https://service-xxx.gz.apigw.tencentcs.com
```

## 📁 项目配置文件

### serverless.yml
```yaml
service: word-memo-server

provider:
  name: tencent
  runtime: Nodejs18.15
  region: ap-guangzhou
  memorySize: 128
  timeout: 30

functions:
  app:
    handler: index.main
    events:
      - apigw:
          path: /
          method: ANY
      - apigw:
          path: /{proxy+}
          method: ANY

plugins:
  - serverless-tencent-scf
```

### index.js (入口文件)
```javascript
const serverless = require('serverless-http');
const app = require('./app');

module.exports.main = serverless(app);
```

## 💰 费用预估

### 免费额度（每月）
- **调用次数**：100万次
- **计算资源**：40万GB·秒
- **外网出流量**：1GB

### 个人使用预估
- **月调用次数**：约1-5万次
- **月费用**：0-30元
- **完全在免费额度内**

## 🔧 配置环境变量
在腾讯云控制台配置：
```
NODE_ENV=production
JWT_SECRET=your_secret_key
```

## 🌐 域名配置
1. **使用默认域名**：自动加入小程序白名单
2. **绑定自定义域名**：更专业，需要备案

## 📊 监控和日志
- 实时查看函数调用情况
- 详细的错误日志
- 性能监控图表