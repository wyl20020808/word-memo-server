# 语音识别功能配置指南

## 概述
本指南说明如何配置微信小程序的语音识别功能。使用微信云开发的云函数 + 百度语音识别API。

## 前置条件
1. 已开通微信云开发
2. 已有百度语音识别API的API Key和Secret Key
3. 微信开发者工具已安装

## 步骤1：获取百度语音识别凭证

### 1.1 注册百度账号
访问 https://ai.baidu.com/ 并注册账号

### 1.2 创建应用
1. 登录百度AI开放平台
2. 进入"控制台" → "应用列表"
3. 点击"创建应用"
4. 选择"语音技术" → "语音识别"
5. 填写应用名称，选择应用类型为"服务端"
6. 创建完成后，获取：
   - API Key
   - Secret Key

### 1.3 获取配额
- 免费版本每天有一定的免费调用次数
- 如需更多配额，可升级为付费版本

## 步骤2：配置云函数环境变量

### 2.1 在微信云开发控制台配置
1. 打开微信开发者工具
2. 进入"云开发" → "云函数"
3. 找到 `voiceToText` 函数
4. 点击"函数配置"
5. 在"环境变量"中添加：
   ```
   BAIDU_API_KEY=你的百度API Key
   BAIDU_SECRET_KEY=你的百度Secret Key
   ```

### 2.2 或在 .env 文件中配置
在项目根目录创建 `.env` 文件：
```
BAIDU_API_KEY=your_api_key_here
BAIDU_SECRET_KEY=your_secret_key_here
```

## 步骤3：部署云函数

### 3.1 使用微信开发者工具部署
1. 打开微信开发者工具
2. 进入"云开发"面板
3. 右键点击"云函数"文件夹
4. 选择"上传并部署：云端安装依赖"
5. 选择 `server/cloud-functions/voiceToText` 目录
6. 等待部署完成

### 3.2 或使用命令行部署
```bash
# 进入云函数目录
cd server/cloud-functions/voiceToText

# 安装依赖
npm install

# 使用微信开发者工具的CLI部署
# 具体命令参考微信官方文档
```

## 步骤4：测试云函数

### 4.1 在微信开发者工具中测试
1. 在云函数列表中找到 `voiceToText`
2. 点击"测试"
3. 输入测试参数：
```json
{
  "filePath": "cloud://your-env-id/test-audio.wav"
}
```
4. 点击"执行"查看结果

### 4.2 在小程序中测试
前端代码已经集成了语音识别功能，只需：
1. 打开小程序
2. 进入背单词页面
3. 点击AI助手的🎤按钮
4. 长按录音，松开自动识别

## 步骤5：前端集成

前端代码已经在 `components/ai-assistant/ai-assistant.js` 中实现了语音识别功能：

```javascript
// 语音识别
async recognizeVoice(filePath) {
  wx.showLoading({ title: '识别中...', mask: true });
  
  try {
    const result = await wx.cloud.callFunction({
      name: 'voiceToText',
      data: { filePath: filePath }
    });
    
    if (result.result && result.result.text) {
      this.setData({ inputText: result.result.text });
      wx.hideLoading();
      setTimeout(() => this.sendMessage(), 300);
    }
  } catch (error) {
    wx.hideLoading();
    wx.showToast({ title: '语音识别暂不可用', icon: 'none' });
  }
}
```

## 常见问题

### Q1: 云函数部署失败
**A:** 
- 检查是否安装了 `wx-server-sdk` 依赖
- 确保环境变量已正确配置
- 查看云函数日志了解具体错误

### Q2: 语音识别返回空结果
**A:**
- 检查音频文件格式是否为WAV
- 确保音频质量足够清晰
- 检查百度API配额是否已用尽
- 查看云函数日志中的错误信息

### Q3: 识别准确率低
**A:**
- 确保用户说话清晰
- 减少背景噪音
- 可以升级到百度的高精度识别模型（需付费）

### Q4: 如何切换到其他语音识别服务？
**A:**
修改 `voiceToText/index.js` 中的识别函数，集成其他服务商的API：
- 腾讯云语音识别
- 阿里云语音识别
- Google Cloud Speech-to-Text

## 成本估算

### 百度语音识别
- 免费版：每天500次调用
- 付费版：按调用次数计费，通常 ¥0.01-0.05 每次

### 微信云开发
- 云函数调用：免费额度 100万次/月
- 云存储：免费额度 5GB/月

## 后续优化

1. **缓存识别结果**：避免重复识别相同的音频
2. **支持多语言**：配置百度API支持多种语言
3. **离线识别**：集成本地语音识别库
4. **识别结果确认**：让用户确认识别结果后再发送

## 参考资源

- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [百度语音识别API文档](https://ai.baidu.com/ai-doc/SPEECH/Yk6fr6hzs)
- [微信小程序语音API](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.getRecorderManager.html)
