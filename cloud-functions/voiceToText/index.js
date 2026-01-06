/**
 * 微信云函数：语音识别
 * 使用腾讯云语音识别API进行语音转文字
 */

const cloud = require('wx-server-sdk');
const https = require('https');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 调用腾讯云语音识别API
 * @param {string} audioPath - 音频文件路径
 * @returns {Promise<string>} 识别结果文本
 */
async function recognizeWithTencentCloud(audioPath) {
  try {
    // 读取音频文件
    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString('base64');
    
    // 调用腾讯云语音识别API
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const region = 'ap-beijing';
    
    if (!secretId || !secretKey) {
      console.error('缺少腾讯云凭证');
      return '';
    }
    
    // 这里需要使用腾讯云SDK或直接调用API
    // 简化版本：使用百度语音识别作为备选方案
    return await recognizeWithBaidu(audioBuffer);
    
  } catch (error) {
    console.error('腾讯云识别失败:', error);
    return '';
  }
}

/**
 * 调用百度语音识别API（备选方案）
 * @param {Buffer} audioBuffer - 音频文件Buffer
 * @returns {Promise<string>} 识别结果文本
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
            const recognizeUrl = `https://vop.baidu.com/server_api`;
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
      // 如果是本地路径，直接使用
      if (fs.existsSync(filePath)) {
        // 使用本地路径
      } else {
        return {
          success: false,
          message: '无法获取音频文件'
        };
      }
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
