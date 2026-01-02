# 微信小程序域名配置指南

## 开发阶段解决方案

### 1. 开发者工具设置（推荐）
1. 打开微信开发者工具
2. 点击右上角"详情"
3. 选择"本地设置"选项卡
4. 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"

### 2. 使用本地开发
- 确保你的电脑和手机在同一局域网
- 启动本地服务器：`npm run dev`
- 小程序使用 `http://localhost:3000/api`

## 生产环境解决方案

### 1. 购买域名和SSL证书
```
推荐域名注册商：
- 阿里云：https://wanwang.aliyun.com/
- 腾讯云：https://dnspod.cloud.tencent.com/
- GoDaddy：https://www.godaddy.com/

域名价格：约50-100元/年
SSL证书：免费（Let's Encrypt）或付费
```

### 2. 配置HTTPS
微信小程序要求所有网络请求必须使用HTTPS协议

```nginx
# Nginx配置示例
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 微信公众平台配置
1. 登录 https://mp.weixin.qq.com/
2. 进入"开发" -> "开发管理" -> "开发设置"
3. 在"服务器域名"中添加：
   - request合法域名：`https://yourdomain.com`
   - socket合法域名：`wss://yourdomain.com`（如需要）
   - uploadFile合法域名：`https://yourdomain.com`（如需要）
   - downloadFile合法域名：`https://yourdomain.com`（如需要）

## 免费HTTPS解决方案

### 1. 使用Cloudflare（推荐）
1. 注册 https://cloudflare.com/
2. 添加你的域名
3. 修改DNS服务器到Cloudflare
4. 开启SSL/TLS加密
5. 设置页面规则转发到你的服务器

### 2. 使用内网穿透 + HTTPS
```bash
# 使用ngrok（需要付费版本支持自定义域名）
ngrok http 3000 --hostname=yourdomain.com

# 使用frp + 自己的服务器
# 配置frp客户端和服务端
```

## 当前推荐方案

### 开发阶段
1. 使用开发者工具的"不校验合法域名"选项
2. 本地启动服务器测试功能
3. 使用 `http://localhost:3000/api`

### 测试阶段
1. 购买便宜的域名（约50元/年）
2. 使用Cloudflare免费SSL
3. 配置域名解析到你的公网IP
4. 在微信公众平台添加合法域名

### 生产阶段
1. 使用云服务器（稳定性更好）
2. 配置专业的SSL证书
3. 设置CDN加速
4. 配置监控和备份

## 临时测试方案

如果只是想快速测试，可以：
1. 保持使用 `http://localhost:3000/api`
2. 在开发者工具中关闭域名校验
3. 功能测试完成后再考虑域名配置