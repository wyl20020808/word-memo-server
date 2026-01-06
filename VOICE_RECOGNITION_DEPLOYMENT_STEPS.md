# 语音识别云函数部署完整步骤

## 📋 前置准备

确保你已经：
- ✅ 安装了微信开发者工具
- ✅ 小程序已开通云开发功能
- ✅ 有百度账号（没有的话需要注册）

---

## 🔑 第1步：获取百度API凭证（5分钟）

### 1.1 访问百度AI开放平台

1. 打开浏览器，访问：**https://ai.baidu.com/**
2. 点击右上角 **"登录"** 按钮
3. 使用百度账号登录（没有账号的话先注册）

### 1.2 创建应用

1. 登录后，点击右上角 **"控制台"**
2. 在左侧菜单找到 **"应用列表"**，点击进入
3. 点击蓝色的 **"创建应用"** 按钮
4. 在表单中填写：
   - **应用名称**：输入 `微信小程序语音识别` 或任意名称
   - **应用类型**：选择 **"服务端"**
   - **应用描述**：可选，随意填写
5. 点击 **"立即创建"** 按钮

### 1.3 获取API凭证

1. 应用创建成功后，会显示应用详情页面
2. 在页面中找到：
   - **API Key**：一串字母和数字，例如 `abc123def456`
   - **Secret Key**：另一串字母和数字，例如 `xyz789uvw012`

3. **重要**：复制这两个值，保存到记事本或密码管理器

**✅ 第1步完成！** 你现在有了 API Key 和 Secret Key

---

## ☁️ 第2步：在微信开发者工具中创建云函数（10分钟）

### 2.1 打开微信开发者工具

1. 启动微信开发者工具
2. 打开你的小程序项目
3. 在顶部菜单栏找到 **"云开发"** 选项卡，点击进入

### 2.2 进入云函数管理

1. 在左侧菜单中找到 **"云函数"** 选项
2. 你会看到已有的云函数列表（如果有的话）

### 2.3 创建新的云函数

**方法A：右键菜单（推荐）**

1. 在左侧 **"云函数"** 上右键点击
2. 选择 **"新建 Node.js 云函数"**
3. 在弹出的对话框中输入函数名称：`voiceToText`
4. 点击 **"确定"**

**方法B：菜单栏**

1. 点击顶部菜单 **"云开发"** → **"新建云函数"**
2. 输入函数名称：`voiceToText`
3. 点击 **"确定"**

### 2.4 编写云函数代码

1. 新建的云函数会自动打开编辑器
2. **删除所有默认代码**
3. 复制以下代码到编辑器中：

```javascript
/**
 * 微信云函数：语音识别
 * 使用百度语音识别API进行语音转文字
 */

const cloud = require('wx-server-sdk');
const https = require('https');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 调用百度语音识别API
 */
async function recognizeWithBaidu(audioBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const baiduApiKey = process.env.BAIDU_API_KEY;
      const baiduSecretKey = process.env.BAIDU_SECRET_KEY;
      
      if (!baiduApiKey || !baiduSecretKey) {
        console.error('缺少百度语音凭证');
        resolve('');
        return;
      }
      
      // 获取百度API token
      const tokenUrl = `https://openapi.baidu.com/oauth/2.0/token?grant_type=client_credentials&client_id=${baiduApiKey}&client_secret=${baiduSecretKey}`;
      
      https.get(tokenUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const tokenData = JSON.parse(data);
            const accessToken = tokenData.access_token;
            
            if (!accessToken) {
              resolve('');
              return;
            }
            
            // 调用语音识别API
            const postData = JSON.stringify({
              speech: audioBuffer.toString('base64'),
              format: 'wav',
              rate: 16000,
              channel: 1,
              cuid: 'wechat-mini-program',
              token: accessToken
            });
            
            const options = {
              hostname: 'vop.baidu.com',
              path: '/server_api',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
              }
            };
            
            const req = https.request(options, (res) => {
              let result = '';
              res.on('data', chunk => result += chunk);
              res.on('end', () => {
                try {
                  const resultData = JSON.parse(result);
                  if (resultData.result && resultData.result.length > 0) {
                    resolve(resultData.result[0]);
                  } else {
                    resolve('');
                  }
                } catch (e) {
                  resolve('');
                }
              });
            });
            
            req.on('error', (e) => {
              console.error('百度API请求失败:', e);
              resolve('');
            });
            
            req.write(postData);
            req.end();
            
          } catch (e) {
            console.error('获取百度token失败:', e);
            resolve('');
          }
        });
      }).on('error', (e) => {
        console.error('获取百度token请求失败:', e);
        resolve('');
      });
      
    } catch (error) {
      console.error('百度语音识别失败:', error);
      reject(error);
    }
  });
}

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  try {
    console.log('收到语音识别请求:', event);
    
    const { filePath } = event;
    
    if (!filePath) {
      return {
        success: false,
        message: '缺少音频文件路径'
      };
    }
    
    // 从云存储下载文件
    const tempDir = '/tmp';
    const localPath = path.join(tempDir, 'audio.wav');
    
    try {
      // 下载文件到本地
      await cloud.downloadFile({
        fileID: filePath,
        savePath: localPath
      });
    } catch (e) {
      console.error('下载文件失败:', e);
      return {
        success: false,
        message: '无法获取音频文件'
      };
    }
    
    // 执行语音识别
    const text = await recognizeWithBaidu(fs.readFileSync(localPath));
    
    // 清理临时文件
    try {
      fs.unlinkSync(localPath);
    } catch (e) {
      console.log('清理临时文件失败:', e);
    }
    
    return {
      success: true,
      text: text || '',
      message: text ? '识别成功' : '识别失败或无法识别'
    };
    
  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      success: false,
      message: '语音识别失败: ' + error.message
    };
  }
};
```

4. 代码复制完成后，按 **Ctrl+S**（Mac按 **Cmd+S**）保存

### 2.5 配置环境变量

1. 在编辑器上方找到 **"函数配置"** 按钮，点击打开
2. 在弹出的配置面板中找到 **"环境变量"** 部分
3. 点击 **"添加"** 按钮，添加第一个环境变量：
   - **变量名**：`BAIDU_API_KEY`
   - **变量值**：粘贴你从百度获取的 **API Key**
   - 点击 **"确定"**

4. 再次点击 **"添加"** 按钮，添加第二个环境变量：
   - **变量名**：`BAIDU_SECRET_KEY`
   - **变量值**：粘贴你从百度获取的 **Secret Key**
   - 点击 **"确定"**

5. 配置完成后，关闭配置面板

**⚠️ 重要提示**：
- 确保没有多余的空格或特殊字符
- API Key 和 Secret Key 要完全复制，不要遗漏任何字符

### 2.6 上传并部署

1. 在编辑器上方找到 **"上传并部署"** 按钮
2. 点击 **"上传并部署：云端安装依赖"**
3. 等待部署完成（通常需要 30-60 秒）
4. 部署成功后，会看到提示信息

**✅ 第2步完成！** 云函数已部署到微信云开发

---

## 🧪 第3步：测试语音识别功能（5分钟）

### 3.1 在小程序中测试

1. 打开小程序
2. 进入 **"背单词"** 页面
3. 点击右下角的 **AI助手按钮**（🤖）
4. 在AI助手窗口中，找到输入框旁的 **🎤 按钮**
5. **长按** 🎤 按钮开始录音
6. 说一些话（例如"你好"或"apple"）
7. **松开** 按钮停止录音
8. 等待识别结果

### 3.2 查看识别结果

- 如果识别成功，你会看到识别出的文字出现在输入框中
- 如果识别失败，会显示"识别失败，请重试"的提示

---

## 🔧 常见问题排查

### ❌ 问题1：部署失败，显示"依赖安装失败"

**解决方案**：
1. 检查网络连接是否正常
2. 删除云函数，重新创建
3. 确保代码没有语法错误
4. 查看部署日志了解具体错误

### ❌ 问题2：识别不工作，显示"语音识别暂不可用"

**解决方案**：
1. 检查环境变量是否正确配置
   - 打开函数配置，验证 API Key 和 Secret Key
   - 确保没有多余的空格或特殊字符
2. 检查百度账户是否有足够的免费配额
3. 查看云函数日志：
   - 在云函数列表中右键点击 `voiceToText` 函数
   - 选择 **"查看日志"**
   - 查看错误信息

### ❌ 问题3：识别结果为空或不准确

**解决方案**：
1. 确保录音时间足够长（至少1秒）
2. 检查音频质量：
   - 在安静的环境中录音
   - 避免背景噪音
   - 说话清晰
3. 尝试重新录音

### ❌ 问题4：显示"缺少百度语音凭证"

**解决方案**：
1. 打开函数配置
2. 检查环境变量是否已添加
3. 验证 API Key 和 Secret Key 是否正确
4. 重新保存配置
5. 重新部署云函数

---

## ✅ 验证清单

部署完成后，检查以下项目：

- [ ] 已获取百度 API Key 和 Secret Key
- [ ] 已在微信开发者工具中创建 `voiceToText` 云函数
- [ ] 已复制云函数代码
- [ ] 已配置环境变量（BAIDU_API_KEY 和 BAIDU_SECRET_KEY）
- [ ] 已上传并部署云函数
- [ ] 部署显示成功
- [ ] 在小程序中测试语音输入功能

---

## 📞 获取帮助

如果遇到问题：

1. 查看本文档的"常见问题排查"部分
2. 查看云函数日志了解具体错误
3. 访问百度AI开放平台的帮助文档
4. 查看微信云开发的官方文档

祝你配置顺利！🎉

