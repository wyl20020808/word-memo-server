/**
 * AI任务管理器 - 统一的异步任务轮询系统
 * 用于处理所有需要超过15秒的AI调用
 */

// 任务结果缓存（内存缓存，5分钟过期）
const taskCache = new Map();

// 任务类型枚举
const TaskType = {
  CONVERSATION: 'conversation',      // AI对话
  NOTES_ANALYSIS: 'notes_analysis',  // 笔记分析
  WORD_COMPLETE: 'word_complete',    // 单词补全
  SUMMARY_GENERATE: 'summary_generate', // 总结生成
  MAJOR_GENERATE: 'major_generate',  // 408题目生成
  MAJOR_ANALYSIS: 'major_analysis',  // 408题目解析
  ARTICLE_GENERATE: 'article_generate', // 文章生成
  SENTENCE_GENERATE: 'sentence_generate', // 句子生成
  CUSTOM: 'custom'                   // 自定义任务
};

/**
 * 生成唯一任务ID
 */
function generateTaskId(type, userId) {
  return `${type}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建异步任务
 * @param {string} type - 任务类型
 * @param {number} userId - 用户ID
 * @param {Function} asyncFn - 异步执行函数，返回结果
 * @returns {string} taskId
 */
function createTask(type, userId, asyncFn) {
  const taskId = generateTaskId(type, userId);
  
  // 初始化任务状态
  taskCache.set(taskId, {
    status: 'processing',
    type,
    userId,
    createdAt: Date.now()
  });
  
  // 异步执行任务
  executeTask(taskId, asyncFn);
  
  return taskId;
}

/**
 * 执行任务并存储结果
 */
async function executeTask(taskId, asyncFn) {
  try {
    console.log(`🚀 开始执行任务: ${taskId}`);
    const startTime = Date.now();
    
    // 执行异步函数
    const result = await asyncFn();
    
    const duration = Date.now() - startTime;
    console.log(`✅ 任务完成: ${taskId}, 耗时: ${duration}ms`);
    
    // 存储成功结果
    taskCache.set(taskId, {
      status: 'completed',
      result,
      completedAt: Date.now(),
      duration
    });
    
  } catch (error) {
    console.error(`❌ 任务失败: ${taskId}`, error.message);
    
    // 存储失败结果
    taskCache.set(taskId, {
      status: 'failed',
      error: error.message,
      completedAt: Date.now()
    });
  }
  
  // 5分钟后清理缓存
  setTimeout(() => {
    taskCache.delete(taskId);
    console.log(`🗑️ 清理任务缓存: ${taskId}`);
  }, 5 * 60 * 1000);
}

/**
 * 查询任务状态
 * @param {string} taskId - 任务ID
 * @returns {Object} 任务状态和结果
 */
function getTaskStatus(taskId) {
  const task = taskCache.get(taskId);
  
  if (!task) {
    return { status: 'not_found' };
  }
  
  return task;
}

/**
 * 取消任务（仅标记，不能真正中断执行中的任务）
 */
function cancelTask(taskId) {
  const task = taskCache.get(taskId);
  if (task && task.status === 'processing') {
    taskCache.set(taskId, {
      ...task,
      status: 'cancelled',
      completedAt: Date.now()
    });
    return true;
  }
  return false;
}

/**
 * 获取用户的所有任务
 */
function getUserTasks(userId) {
  const tasks = [];
  for (const [taskId, task] of taskCache.entries()) {
    if (task.userId === userId) {
      tasks.push({ taskId, ...task });
    }
  }
  return tasks;
}

/**
 * 清理过期任务
 */
function cleanupExpiredTasks() {
  const now = Date.now();
  const expireTime = 5 * 60 * 1000; // 5分钟
  
  for (const [taskId, task] of taskCache.entries()) {
    const taskTime = task.completedAt || task.createdAt;
    if (now - taskTime > expireTime) {
      taskCache.delete(taskId);
    }
  }
}

// 每分钟清理一次过期任务
setInterval(cleanupExpiredTasks, 60 * 1000);

module.exports = {
  TaskType,
  createTask,
  getTaskStatus,
  cancelTask,
  getUserTasks,
  generateTaskId
};
