/**
 * 语音识别服务
 * 使用百度语音识别API进行语音转文字
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class VoiceService {
  constructor() {
    this.baiduApiKey = process.env.BAIDU_API_KEY;
    this.baiduSecretKey = process.env.BAIDU_SECRET_KEY;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  /**
   * 获取百度API访问令牌
   */
  async getAccessToken() {
    try {
      // 如果token还未过期，直接返回
      if (this.accessToken && Date.now() < this.tokenExpireTime) {
        return this.accessToken;
      }

      if (!this.baiduApiKey || !this.baiduSecretKey) {
        console.error('❌ 缺少百度API凭证');
        throw new Error('缺少百度API凭证，请配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY');
      }

      console.log('🔄 正在获取百度API token...');

      return new Promise((resolve, reject) => {
        const tokenUrl = `https://openapi.baidu.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.baiduApiKey}&client_secret=${this.baiduSecretKey}`;

        https.get(tokenUrl, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const tokenData = JSON.parse(data);
              
              if (tokenData.error) {
                console.error('❌ 获取token失败:', tokenData.error_description);
                reject(new Error(`获取token失败: ${tokenData.error_description}`));
                return;
              }

              if (!tokenData.access_token) {
                console.error('❌ token响应无效:', tokenData);
                reject(new Error('token响应无效'));
                return;
              }

              // 保存token和过期时间（提前5分钟过期）
              this.accessToken = tokenData.access_token;
              this.tokenExpireTime = Date.now() + (tokenData.expires_in - 300) * 1000;

              console.log('✅ 获取token成功，有效期:', tokenData.expires_in, '秒');
              resolve(this.accessToken);
            } catch (e) {
              console.error('❌ 解析token响应失败:', e.message);
              reject(e);
            }
          });
        }).on('error', (e) => {
          console.error('❌ 获取token请求失败:', e.message);
          reject(e);
        });
      });
    } catch (error) {
      console.error('❌ 获取token异常:', error.message);
      throw error;
    }
  }

  /**
   * 调用百度语音识别API
   * @param {Buffer} audioBuffer - 音频文件Buffer
   * @returns {Promise<string>} 识别结果文本
   */
  async recognizeAudio(audioBuffer) {
    try {
      console.log('🎤 开始语音识别...');
      console.log('📊 音频大小:', audioBuffer.length, '字节');

      // 获取访问令牌
      const accessToken = await this.getAccessToken();

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

      console.log('📤 发送识别请求...');

      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'vop.baidu.com',
          path: '/server_api',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 30000 // 30秒超时
        };

        const req = https.request(options, (res) => {
          let result = '';
          
          res.on('data', chunk => result += chunk);
          
          res.on('end', () => {
            try {
              console.log('📥 收到识别响应');
              const resultData = JSON.parse(result);

              console.log('📊 识别结果:', resultData);

              // 检查是否有错误
              if (resultData.err_no !== 0) {
                console.error('❌ 百度API错误:', resultData.err_msg);
                resolve(''); // 返回空字符串而不是抛出错误
                return;
              }

              // 提取识别结果
              if (resultData.result && resultData.result.length > 0) {
                const text = resultData.result[0];
                console.log('✅ 识别成功:', text);
                resolve(text);
              } else {
                console.log('⚠️ 无识别结果');
                resolve('');
              }
            } catch (e) {
              console.error('❌ 解析识别响应失败:', e.message);
              resolve(''); // 返回空字符串而不是抛出错误
            }
          });
        });

        req.on('error', (e) => {
          console.error('❌ 识别请求失败:', e.message);
          resolve(''); // 返回空字符串而不是抛出错误
        });

        req.on('timeout', () => {
          console.error('❌ 识别请求超时');
          req.destroy();
          resolve(''); // 返回空字符串而不是抛出错误
        });

        req.write(postData);
        req.end();
      });

    } catch (error) {
      console.error('❌ 语音识别异常:', error.message);
      return ''; // 返回空字符串而不是抛出错误
    }
  }

  /**
   * 从文件识别语音
   * @param {string} filePath - 音频文件路径
   * @returns {Promise<string>} 识别结果文本
   */
  async recognizeFromFile(filePath) {
    try {
      console.log('📂 读取音频文件:', filePath);
      
      const audioBuffer = fs.readFileSync(filePath);
      console.log('✅ 文件读取成功，大小:', audioBuffer.length, '字节');
      
      return await this.recognizeAudio(audioBuffer);
    } catch (error) {
      console.error('❌ 读取文件失败:', error.message);
      return '';
    }
  }

  /**
   * 从Base64字符串识别语音
   * @param {string} base64Audio - Base64编码的音频数据
   * @returns {Promise<string>} 识别结果文本
   */
  async recognizeFromBase64(base64Audio) {
    try {
      console.log('🔄 解码Base64音频...');
      
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      console.log('✅ 解码成功，大小:', audioBuffer.length, '字节');
      
      return await this.recognizeAudio(audioBuffer);
    } catch (error) {
      console.error('❌ 解码Base64失败:', error.message);
      return '';
    }
  }

  /**
   * 验证百度API凭证
   */
  async validateCredentials() {
    try {
      console.log('🔍 验证百度API凭证...');
      
      if (!this.baiduApiKey || !this.baiduSecretKey) {
        console.error('❌ 缺少百度API凭证');
        return {
          valid: false,
          message: '缺少百度API凭证'
        };
      }

      // 尝试获取token来验证凭证
      const token = await this.getAccessToken();
      
      if (token) {
        console.log('✅ 百度API凭证有效');
        return {
          valid: true,
          message: '百度API凭证有效'
        };
      } else {
        console.error('❌ 无法获取token');
        return {
          valid: false,
          message: '无法获取token'
        };
      }
    } catch (error) {
      console.error('❌ 验证凭证失败:', error.message);
      return {
        valid: false,
        message: error.message
      };
    }
  }
}

// 创建单例实例
const voiceService = new VoiceService();

module.exports = voiceService;
