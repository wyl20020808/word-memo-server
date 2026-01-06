# 语音识别功能完整指南

## 📚 文档导航

本项目包含以下语音识别相关文档，根据你的需求选择：

### 🚀 快速开始（推荐新手）
- **文件**：`VOICE_RECOGNITION_QUICK_REFERENCE.md`
- **内容**：5分钟快速部署步骤
- **适合**：想快速上手的用户

### 📖 详细部署指南（推荐）
- **文件**：`VOICE_RECOGNITION_DEPLOYMENT_STEPS.md`
- **内容**：完整的分步骤部署指南，包含问题排查
- **适合**：需要详细说明的用户

### 📸 可视化指南（推荐有图）
- **文件**：`VOICE_RECOGNITION_VISUAL_GUIDE.md`
- **内容**：带有步骤描述的可视化指南
- **适合**：喜欢看图的用户

### 🔧 技术总结
- **文件**：`VOICE_RECOGNITION_SUMMARY.md`
- **内容**：技术架构和实现细节
- **适合**：想了解技术细节的开发者

### ⚙️ 初始设置指南
- **文件**：`VOICE_RECOGNITION_SETUP.md`
- **内容**：初始配置和环境设置
- **适合**：第一次配置的用户

---

## 🎯 部署流程概览

```
第1步：获取百度API凭证
    ↓
第2步：在微信开发者工具中创建云函数
    ↓
第3步：配置环境变量
    ↓
第4步：上传并部署
    ↓
第5步：测试语音识别功能
```

---

## 📋 核心文件

### 后端文件
- `server/cloud-functions/voiceToText/index.js` - 云函数主代码
- `server/cloud-functions/voiceToText/package.json` - 依赖配置
- `server/cloud-functions/voiceToText/config.json` - 云函数配置

### 前端文件
- `components/ai-assistant/ai-assistant.js` - AI助手组件（包含语音输入）
- `components/ai-assistant/ai-assistant.wxml` - AI助手模板
- `components/ai-assistant/ai-assistant.wxss` - AI助手样式

---

## 🔑 关键步骤

### 1️⃣ 获取百度API凭证（2分钟）

访问 https://ai.baidu.com/
- 登录 → 控制台 → 应用列表 → 创建应用
- 应用类型选择"服务端"
- 复制 API Key 和 Secret Key

### 2️⃣ 创建云函数（2分钟）

微信开发者工具
- 云开发 → 云函数 → 新建 Node.js 云函数
- 函数名称：`voiceToText`
- 复制 `server/cloud-functions/voiceToText/index.js` 的代码

### 3️⃣ 配置环境变量（1分钟）

函数配置 → 环境变量
- `BAIDU_API_KEY` = 你的 API Key
- `BAIDU_SECRET_KEY` = 你的 Secret Key

### 4️⃣ 部署（1分钟）

点击"上传并部署：云端安装依赖"
- 等待部署完成（30-60秒）
- 看到成功提示即可

### 5️⃣ 测试（2分钟）

小程序 → 背单词 → AI助手 → 长按🎤录音
- 说话 → 松开按钮 → 等待识别结果

---

## ✨ 功能特性

### 前端功能
- ✅ 长按录音，松开停止
- ✅ 实时显示录音时长
- ✅ 自动调用云函数识别
- ✅ 识别结果自动填入输入框
- ✅ 友好的错误提示

### 后端功能
- ✅ 使用百度语音识别API
- ✅ 自动获取和刷新token
- ✅ 支持多种音频格式
- ✅ 完整的错误处理
- ✅ 详细的日志记录

### 用户体验
- ✅ 无需手动输入，直接语音
- ✅ 识别速度快（通常1-3秒）
- ✅ 支持中文和英文
- ✅ 识别失败时有友好提示
- ✅ 可以重新录音重试

---

## 🐛 常见问题

### Q: 部署失败怎么办？
A: 检查网络连接，删除云函数重新创建，确保代码没有语法错误。

### Q: 识别不工作怎么办？
A: 检查环境变量是否正确配置，查看云函数日志了解具体错误。

### Q: 识别结果为空怎么办？
A: 确保录音时间足够长（至少1秒），检查百度账户是否有足够配额。

### Q: 如何查看云函数日志？
A: 微信开发者工具 → 云开发 → 云函数 → 右键voiceToText → 查看日志

### Q: 百度免费配额是多少？
A: 免费版每天500次调用，足够大多数用户使用。

---

## 📞 获取帮助

1. **查看相关文档**
   - 快速参考：`VOICE_RECOGNITION_QUICK_REFERENCE.md`
   - 详细指南：`VOICE_RECOGNITION_DEPLOYMENT_STEPS.md`
   - 可视化指南：`VOICE_RECOGNITION_VISUAL_GUIDE.md`

2. **查看云函数日志**
   - 微信开发者工具 → 云开发 → 云函数 → 查看日志

3. **检查环境变量**
   - 打开函数配置，验证 API Key 和 Secret Key

4. **检查百度配额**
   - 访问 https://ai.baidu.com/ → 控制台 → 查看配额

---

## 🎉 部署成功标志

当你看到以下现象时，说明部署成功：

✅ 云函数部署显示成功
✅ 小程序中能看到🎤语音输入按钮
✅ 长按🎤能开始录音
✅ 录音完成后能识别出文字
✅ 识别结果出现在输入框中

---

## 📝 下一步

部署完成后，你可以：

1. **测试功能**
   - 在小程序中使用语音输入
   - 测试不同的语言和口音

2. **优化体验**
   - 调整识别参数
   - 添加识别结果确认
   - 支持多语言

3. **监控使用**
   - 查看云函数日志
   - 监控百度API配额使用情况

4. **升级配额**
   - 如果免费配额不足，升级为付费版本

---

## 📚 相关资源

- [百度AI开放平台](https://ai.baidu.com/)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)

---

**祝你部署顺利！如有问题，请查看相关文档或检查云函数日志。** 🚀

