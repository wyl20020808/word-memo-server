/**
 * 语音识别路由
 */

const express = require('express');
const voiceService = require('../services/voiceService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * 语音识别接口
 * POST /api/voice/recognize
 * 
 * 请求体：
 * {
 *   "audioData": "base64编码的音频数据"
 * }
 * 
 * 响应：
 * {
 *   "success": true,
 *   "text": "识别出的文字",
 *   "message": "识别成功"
 * }
 */
router.post('/recognize', authenticateToken, async (req, res) => {
  try {
    const { audioData } = req.body;

    if (!audioData) {
      return res.status(400).json({
        success: false,
        message: '缺少音频数据'
      });
    }

    console.log('🎤 收到语音识别请求');
    console.log('👤 用户ID:', req.user.userId);
    console.log('📊 音频数据大小:', audioData.length, '字符');

    // 调用语音识别服务
    const text = await voiceService.recognizeFromBase64(audioData);

    if (text) {
      console.log('✅ 识别成功:', text);
      res.json({
        success: true,
        data: {
          text: text,
          message: '识别成功'
        }
      });
    } else {
      console.log('⚠️ 识别失败或无结果');
      res.json({
        success: true,
        data: {
          text: '',
          message: '无法识别，请重试'
        }
      });
    }

  } catch (error) {
    console.error('❌ 语音识别异常:', error.message);
    res.status(500).json({
      success: false,
      message: '语音识别失败: ' + error.message
    });
  }
});

/**
 * 验证百度API凭证
 * GET /api/voice/validate
 * 
 * 响应：
 * {
 *   "success": true,
 *   "valid": true,
 *   "message": "百度API凭证有效"
 * }
 */
router.get('/validate', async (req, res) => {
  try {
    console.log('🔍 验证百度API凭证');

    const result = await voiceService.validateCredentials();

    res.json({
      success: true,
      data: {
        valid: result.valid,
        message: result.message
      }
    });

  } catch (error) {
    console.error('❌ 验证凭证异常:', error.message);
    res.status(500).json({
      success: false,
      message: '验证失败: ' + error.message
    });
  }
});

/**
 * 获取语音识别状态
 * GET /api/voice/status
 * 
 * 响应：
 * {
 *   "success": true,
 *   "status": "ready",
 *   "message": "语音识别服务就绪"
 * }
 */
router.get('/status', async (req, res) => {
  try {
    console.log('📊 获取语音识别状态');

    const result = await voiceService.validateCredentials();

    if (result.valid) {
      res.json({
        success: true,
        data: {
          status: 'ready',
          message: '语音识别服务就绪'
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          status: 'error',
          message: '语音识别服务不可用: ' + result.message
        }
      });
    }

  } catch (error) {
    console.error('❌ 获取状态异常:', error.message);
    res.status(500).json({
      success: false,
      status: 'error',
      message: '获取状态失败: ' + error.message
    });
  }
});

module.exports = router;
