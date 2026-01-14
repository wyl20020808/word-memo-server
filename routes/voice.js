/**
 * 语音识别路由
 */

const express = require('express');
const multer = require('multer');
const voiceService = require('../services/voiceService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 存储分块上传的临时数据（内存存储，生产环境可改用Redis）
const chunkStorage = new Map();

// 定期清理过期的分块数据（5分钟过期）
setInterval(() => {
  const now = Date.now();
  for (const [uploadId, data] of chunkStorage.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      chunkStorage.delete(uploadId);
      console.log('🗑️ 清理过期分块:', uploadId);
    }
  }
}, 60 * 1000); // 每分钟检查一次

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

/**
 * 语音识别接口（文件上传方式）
 * POST /api/voice/recognize-file
 */
router.post('/recognize-file', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    console.log('🎤 收到语音文件上传请求');
    console.log('👤 用户ID:', req.user.userId);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '缺少音频文件'
      });
    }

    console.log('📊 文件大小:', req.file.size, '字节');
    console.log('📊 文件类型:', req.file.mimetype);

    // 将文件buffer转为base64
    const base64Audio = req.file.buffer.toString('base64');

    // 调用语音识别服务
    const text = await voiceService.recognizeFromBase64(base64Audio);

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
 * 语音识别接口（Base64方式）
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
 * 分块上传接口
 * POST /api/voice/upload-chunk
 * 
 * 用于大文件分块上传，支持长时间录音
 */
router.post('/upload-chunk', authenticateToken, async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, chunkData } = req.body;

    if (!uploadId || chunkIndex === undefined || !totalChunks || !chunkData) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    console.log(`📦 收到分块 ${chunkIndex + 1}/${totalChunks}, uploadId: ${uploadId}`);

    // 初始化或获取存储
    if (!chunkStorage.has(uploadId)) {
      chunkStorage.set(uploadId, {
        chunks: new Array(totalChunks).fill(null),
        totalChunks,
        receivedCount: 0,
        createdAt: Date.now(),
        userId: req.user.userId
      });
    }

    const storage = chunkStorage.get(uploadId);
    
    // 验证用户
    if (storage.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: '无权访问此上传'
      });
    }

    // 存储分块
    if (storage.chunks[chunkIndex] === null) {
      storage.chunks[chunkIndex] = chunkData;
      storage.receivedCount++;
    }

    console.log(`✅ 分块 ${chunkIndex + 1} 已存储, 已收到 ${storage.receivedCount}/${totalChunks}`);

    res.json({
      success: true,
      data: {
        uploadId,
        chunkIndex,
        receivedCount: storage.receivedCount,
        totalChunks
      }
    });

  } catch (error) {
    console.error('❌ 分块上传失败:', error.message);
    res.status(500).json({
      success: false,
      message: '分块上传失败: ' + error.message
    });
  }
});

/**
 * 合并分块并识别
 * POST /api/voice/recognize-chunked
 * 
 * 合并所有分块后进行语音识别
 */
router.post('/recognize-chunked', authenticateToken, async (req, res) => {
  try {
    const { uploadId, totalChunks } = req.body;

    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: '缺少uploadId'
      });
    }

    console.log(`🔄 开始合并分块, uploadId: ${uploadId}`);

    const storage = chunkStorage.get(uploadId);
    
    if (!storage) {
      return res.status(404).json({
        success: false,
        message: '未找到上传数据，可能已过期'
      });
    }

    // 验证用户
    if (storage.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: '无权访问此上传'
      });
    }

    // 检查是否所有分块都已收到
    if (storage.receivedCount < storage.totalChunks) {
      return res.status(400).json({
        success: false,
        message: `分块不完整: ${storage.receivedCount}/${storage.totalChunks}`
      });
    }

    // 合并所有分块
    const fullBase64 = storage.chunks.join('');
    console.log(`📊 合并后数据大小: ${Math.round(fullBase64.length / 1024)} KB`);

    // 清理存储
    chunkStorage.delete(uploadId);

    // 调用语音识别
    const text = await voiceService.recognizeFromBase64(fullBase64);

    if (text) {
      console.log('✅ 分块识别成功:', text.substring(0, 50) + '...');
      res.json({
        success: true,
        data: {
          text: text,
          message: '识别成功'
        }
      });
    } else {
      console.log('⚠️ 分块识别无结果');
      res.json({
        success: true,
        data: {
          text: '',
          message: '无法识别，请重试'
        }
      });
    }

  } catch (error) {
    console.error('❌ 分块识别失败:', error.message);
    res.status(500).json({
      success: false,
      message: '识别失败: ' + error.message
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
