/**
 * AI任务统一路由 - 处理所有AI异步任务的轮询
 */
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getTaskStatus, getUserTasks, cancelTask } = require('../services/aiTaskManager');

const router = express.Router();

// 所有路由需要登录
router.use(authenticateToken);

/**
 * 查询任务状态
 * GET /api/ai-task/:taskId
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = getTaskStatus(taskId);
    
    if (task.status === 'not_found') {
      // 任务不存在，可能还在处理中或已过期
      return res.json({
        success: true,
        data: { status: 'processing' }
      });
    }
    
    // 根据状态返回不同的数据
    if (task.status === 'completed') {
      res.json({
        success: true,
        data: {
          status: 'completed',
          result: task.result,
          duration: task.duration
        }
      });
    } else if (task.status === 'failed') {
      res.json({
        success: true,
        data: {
          status: 'failed',
          error: task.error
        }
      });
    } else if (task.status === 'cancelled') {
      res.json({
        success: true,
        data: {
          status: 'cancelled'
        }
      });
    } else {
      res.json({
        success: true,
        data: { status: 'processing' }
      });
    }
    
  } catch (error) {
    console.error('❌ 查询任务状态失败:', error);
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

/**
 * 获取用户所有任务
 * GET /api/ai-task/user/list
 */
router.get('/user/list', async (req, res) => {
  try {
    const userId = req.user.userId;
    const tasks = getUserTasks(userId);
    
    res.json({
      success: true,
      data: tasks
    });
    
  } catch (error) {
    console.error('❌ 获取用户任务失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

/**
 * 取消任务
 * POST /api/ai-task/:taskId/cancel
 */
router.post('/:taskId/cancel', async (req, res) => {
  try {
    const { taskId } = req.params;
    const success = cancelTask(taskId);
    
    res.json({
      success: true,
      data: { cancelled: success }
    });
    
  } catch (error) {
    console.error('❌ 取消任务失败:', error);
    res.status(500).json({ success: false, message: '取消失败' });
  }
});

module.exports = router;
