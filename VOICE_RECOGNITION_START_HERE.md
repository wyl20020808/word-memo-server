# 🎤 语音识别功能 - 从这里开始

## 👋 欢迎！

你已经成功配置了语音识别功能的前端代码。现在需要部署后端的云函数来完成整个功能。

本文档将指导你完成部署过程。

---

## ⚡ 5分钟快速开始

### 第1步：获取百度API凭证（2分钟）

1. 访问 https://ai.baidu.com/
2. 登录 → 控制台 → 应用列表 → 创建应用
3. 应用类型选择"服务端"
4. 复制 **API Key** 和 **Secret Key**

### 第2步：创建云函数（2分钟）

1. 微信开发者工具 → 云开发 → 云函数
2. 右键"云函数" → 新建 Node.js 云函数
3. 函数名称：`voiceToText`
4. 复制 `server/cloud-functions/voiceToText/index.js` 的代码
5. 保存（Ctrl+S）

### 第3步：配置环境变量（1分钟）

1. 点击"函数配置"
2. 添加环境变量：
   - `BAIDU_API_KEY` = 你的 API Key
   - `BAIDU_SECRET_KEY` = 你的 Secret Key

### 第4步：部署（1分钟）

1. 点击"上传并部署：云端安装依赖"
2. 等待部署完成（30-60秒）
3. 看到成功提示

**✅ 完成！** 现在你可以在小程序中使用语音识别功能了。

---

## 📚 详细文档

根据你的需求选择相应的文档：

### 🚀 我想快速部署
👉 **VOICE_RECOGNITION_QUICK_REFERENCE.md**
- 5分钟快速步骤
- 包含关键命令
- 适合有经验的开发者

### 📖 我是第一次部署
👉 **VOICE_RECOGNITION_DEPLOYMENT_STEPS.md**
- 详细的分步骤指南
- 包含问题排查
- 适合新手

### 📸 我喜欢看图
👉 **VOICE_RECOGNITION_VISUAL_GUIDE.md**
- 带有步骤描述的可视化指南
- 包含调试技巧
- 适合视觉学习者

### 🆘 我遇到了问题
👉 **VOICE_RECOGNITION_TROUBLESHOOTING.md**
- 常见问题及解决方案
- 故障诊断流程
- 调试技巧

### ✅ 我想按步骤检查
👉 **VOICE_RECOGNITION_CHECKLIST.md**
- 打印版检查清单
- 逐步验证
- 适合按部就班的用户

### 📋 我想了解整体情况
👉 **VOICE_RECOGNITION_README.md**
- 功能概览
- 文档导航
- 相关资源

### 🔍 我想看文档索引
👉 **VOICE_RECOGNITION_INDEX.md**
- 完整的资源索引
- 快速问题解决
- 推荐阅读顺序

---

## 🎯 根据你的情况选择

### 情况1：我有经验，想快速部署
```
1. 阅读：VOICE_RECOGNITION_QUICK_REFERENCE.md（5分钟）
2. 按照步骤部署
3. 测试功能
```

### 情况2：我是新手，想详细了解
```
1. 阅读：VOICE_RECOGNITION_DEPLOYMENT_STEPS.md（15分钟）
2. 按照步骤部署
3. 如果遇到问题，查看 VOICE_RECOGNITION_TROUBLESHOOTING.md
```

### 情况3：我喜欢按清单操作
```
1. 打印：VOICE_RECOGNITION_CHECKLIST.md
2. 按照清单逐步操作
3. 逐项检查
```

### 情况4：我遇到了问题
```
1. 查看：VOICE_RECOGNITION_TROUBLESHOOTING.md
2. 查看云函数日志
3. 根据错误信息解决
```

---

## 🔑 关键信息

### 百度API获取
- 访问：https://ai.baidu.com/
- 登录 → 控制台 → 应用列表 → 创建应用
- 应用类型：**服务端**
- 获取：API Key 和 Secret Key

### 云函数创建
- 微信开发者工具 → 云开发 → 云函数
- 右键"云函数" → 新建 Node.js 云函数
- 函数名称：**voiceToText**

### 环境变量配置
- 函数配置 → 环境变量 → 添加
- `BAIDU_API_KEY` = 你的 API Key
- `BAIDU_SECRET_KEY` = 你的 Secret Key

### 部署
- 点击"上传并部署：云端安装依赖"
- 等待30-60秒
- 看到成功提示

### 测试
- 小程序 → 背单词 → AI助手 → 长按🎤
- 说话 → 松开 → 等待识别结果

---

## 📁 文件位置

### 云函数代码
```
server/cloud-functions/voiceToText/index.js
```

### 前端实现
```
components/ai-assistant/ai-assistant.js
```

### 所有文档
```
server/VOICE_RECOGNITION_*.md
```

---

## ✅ 成功标志

当你看到以下现象时，说明部署成功：

✅ 云函数部署显示成功
✅ 小程序中能看到🎤语音输入按钮
✅ 长按🎤能开始录音
✅ 录音完成后能识别出文字
✅ 识别结果出现在输入框中

---

## 🆘 快速问题解决

| 问题 | 解决方案 |
|------|--------|
| 部署失败 | 检查网络，删除重建 |
| 识别不工作 | 检查环境变量配置 |
| 识别为空 | 重新录音，检查配额 |
| 缺少凭证 | 重新配置环境变量 |
| 结果不准 | 改善录音环境 |

**详细解决方案：VOICE_RECOGNITION_TROUBLESHOOTING.md**

---

## 💡 提示

- 📖 **建议先读快速参考**，了解整体流程
- 🔍 **遇到问题先查日志**，日志通常能告诉你问题所在
- 🌐 **确保网络正常**，部署和识别都需要网络
- ⏱️ **耐心等待**，部署通常需要30-60秒
- 🎤 **录音要清晰**，识别质量取决于音频质量

---

## 📞 获取帮助

### 第1步：查看文档
- 根据你的需求选择相应的文档
- 按照文档中的步骤操作

### 第2步：查看日志
- 微信开发者工具 → 云开发 → 云函数
- 右键voiceToText → 查看日志
- 查看错误信息

### 第3步：查看故障排查指南
- 打开 VOICE_RECOGNITION_TROUBLESHOOTING.md
- 根据错误信息查找解决方案

### 第4步：检查百度配额
- 访问 https://ai.baidu.com/
- 进入控制台 → 查看应用配额

---

## 🚀 现在就开始

### 选择你的路径：

**🏃 快速部署（5分钟）**
→ 打开 `VOICE_RECOGNITION_QUICK_REFERENCE.md`

**📚 详细指南（15分钟）**
→ 打开 `VOICE_RECOGNITION_DEPLOYMENT_STEPS.md`

**📸 可视化指南（10分钟）**
→ 打开 `VOICE_RECOGNITION_VISUAL_GUIDE.md`

**✅ 检查清单**
→ 打开 `VOICE_RECOGNITION_CHECKLIST.md`

---

## 🎉 准备好了吗？

选择上面的一个文档，按照步骤操作，你就能成功部署语音识别功能！

**祝你部署顺利！** 🚀

---

## 📋 文档列表

| 文档 | 用途 | 时间 |
|------|------|------|
| VOICE_RECOGNITION_QUICK_REFERENCE.md | 快速参考 | 5分钟 |
| VOICE_RECOGNITION_DEPLOYMENT_STEPS.md | 详细指南 | 15分钟 |
| VOICE_RECOGNITION_VISUAL_GUIDE.md | 可视化指南 | 10分钟 |
| VOICE_RECOGNITION_CHECKLIST.md | 检查清单 | 按需 |
| VOICE_RECOGNITION_TROUBLESHOOTING.md | 故障排查 | 按需 |
| VOICE_RECOGNITION_README.md | 功能概览 | 5分钟 |
| VOICE_RECOGNITION_INDEX.md | 资源索引 | 5分钟 |
| VOICE_RECOGNITION_SETUP.md | 初始配置 | 10分钟 |
| VOICE_RECOGNITION_SUMMARY.md | 技术总结 | 10分钟 |

---

**现在就打开其中一个文档开始部署吧！** 📖

