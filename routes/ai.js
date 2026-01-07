/**
 * AI助手路由 - 使用统一的任务管理器
 */
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const { callAI, parseAIJSON } = require('../services/aiService');
const { createTask, TaskType, getTaskStatus } = require('../services/aiTaskManager');

const router = express.Router();

// ==================== AI对话接口 ====================

// 通用AI对话接口（异步轮询模式）
router.post('/conversation', authenticateToken, async (req, res) => {
  try {
    const { messages } = req.body;
    const userId = req.user.userId;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: '缺少对话消息' });
    }

    console.log('🤖 通用AI对话，用户:', userId, '消息数:', messages.length);

    // 创建异步任务
    const taskId = createTask(TaskType.CONVERSATION, userId, async () => {
      const systemPrompt = `你是一个智能助手，可以帮助用户：
1. 分析和复盘日常事务
2. 解答各种问题
3. 提供建议和思路
4. 整理和总结信息

回答要求：
- 简洁明了，重点突出
- 提供实用的建议
- 保持友好和鼓励的态度
- 如果用户问的是学习相关问题，给出具体可行的方法`;

      const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ];

      const aiResponse = await callAI(fullMessages, {
        temperature: 0.8,
        maxTokens: 1500
      });

      return { reply: aiResponse };
    });

    // 立即返回任务ID
    res.json({ 
      success: true, 
      data: { taskId, status: 'processing' }
    });

  } catch (error) {
    console.error('❌ AI对话失败:', error);
    res.status(500).json({ success: false, message: 'AI服务暂时不可用: ' + error.message });
  }
});

// 查询AI对话结果（兼容旧接口）
router.get('/conversation/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = getTaskStatus(taskId);

    if (task.status === 'not_found' || task.status === 'processing') {
      return res.json({ success: true, data: { status: 'processing' } });
    }

    if (task.status === 'completed') {
      res.json({ 
        success: true, 
        data: { 
          status: 'completed', 
          reply: task.result.reply 
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
    } else {
      res.json({ success: true, data: { status: task.status } });
    }

  } catch (error) {
    console.error('❌ 查询AI结果失败:', error);
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

// 旧的同步AI对话接口（保留兼容）
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, context } = req.body;
    const userId = req.user.userId;
    const response = await callAIChat(message, context, userId);
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('AI请求失败:', error);
    res.status(500).json({ success: false, message: 'AI服务暂时不可用' });
  }
});

// ==================== AI单词补全（异步轮询模式） ====================

router.post('/complete-word', authenticateToken, async (req, res) => {
  try {
    const { word, phonetic, meaning } = req.body;
    const userId = req.user.userId;
    console.log('🤖 AI补全请求:', word);

    // 创建异步任务
    const taskId = createTask(TaskType.WORD_COMPLETE, userId, async () => {
      const result = await generateWordContent(word, phonetic, meaning);

      // 保存到数据库
      if (result.examples && result.examples.length > 0) {
        const exampleStr = result.examples.join('|||');
        const transStr = result.translations.join('|||');

        await pool.execute(
          `INSERT INTO words (word, phonetic, example, example_trans, meaning, category) 
           VALUES (?, ?, ?, ?, ?, 'kaoyan') 
           ON DUPLICATE KEY UPDATE 
             example = VALUES(example),
             example_trans = VALUES(example_trans),
             updated_at = NOW()`,
          [word, phonetic || '', exampleStr, transStr, meaning || '']
        );
      }

      return result;
    });

    // 立即返回任务ID
    res.json({ success: true, data: { taskId, status: 'processing' } });
  } catch (error) {
    console.error('❌ AI补全失败:', error);
    res.status(500).json({ success: false, message: 'AI补全失败' });
  }
});

// ==================== 辅助函数 ====================

// 调用AI对话
async function callAIChat(userMessage, context, userId) {
  try {
    const systemPrompt = buildSystemPrompt(context);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentHistory = context.conversationHistory.slice(-4);
      recentHistory.forEach(msg => {
        messages.splice(messages.length - 1, 0, {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    const aiMessage = await callAI(messages, { temperature: 0.7, maxTokens: 1000 });
    return { message: aiMessage, action: null };
  } catch (error) {
    console.error('❌ AI调用失败:', error.message);
    return await handleAIRequestFallback(userMessage, context, userId);
  }
}

// 构建系统提示词
function buildSystemPrompt(context) {
  let prompt = `你是一个专业的英语学习助手，帮助用户背单词和提高英语水平。

你的职责：
1. 分析用户的学习进度，给出个性化建议
2. 解释单词的含义、用法、词根词缀
3. 提供科学的记忆技巧和方法
4. 生成例句帮助理解单词
5. 回答用户的英语学习问题

回答要求：
- 简洁明了，重点突出
- 使用emoji让回答更生动
- 提供可操作的建议
- 鼓励用户坚持学习
`;

  if (context.currentWord) {
    const word = context.currentWord;
    prompt += `\n当前单词信息：
- 单词：${word.word}
- 音标：${word.phonetic || '未知'}
- 释义：${word.apiMeaning || word.translation || word.meaning || '未知'}
`;
  }

  if (context.userStats) {
    const stats = context.userStats;
    prompt += `\n用户学习统计：
- 今日学习：${stats.todayLearned || 0} 个
- 累计学习：${stats.totalLearned || 0} 个
`;
  }

  return prompt;
}

// 降级方案
async function handleAIRequestFallback(message, context, userId) {
  const msgLower = message.toLowerCase();

  if (msgLower.includes('分析') || msgLower.includes('进度')) {
    return await analyzeUserProgress(userId, context);
  }
  if (msgLower.includes('解释') || msgLower.includes('什么意思')) {
    return await explainWord(context.currentWord);
  }
  if (msgLower.includes('记忆') || msgLower.includes('技巧')) {
    return await provideMemoryTips(context.currentWord);
  }

  return {
    message: '我理解你的问题了。你可以问我：\n\n• "分析我的学习进度"\n• "解释这个单词"\n• "给我一些记忆技巧"\n\n或者直接告诉我你想了解什么！',
    action: null
  };
}

// 分析用户学习进度
async function analyzeUserProgress(userId, context) {
  try {
    const [stats] = await pool.execute(
      `SELECT COUNT(DISTINCT word_id) as total_learned, AVG(rating) as avg_rating
       FROM user_word_records WHERE user_id = ?`,
      [userId]
    );

    const today = new Date().toISOString().split('T')[0];
    const [todayStats] = await pool.execute(
      'SELECT learned_count FROM user_stats WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    const totalLearned = stats[0]?.total_learned || 0;
    const avgRating = stats[0]?.avg_rating || 0;
    const todayLearned = todayStats[0]?.learned_count || 0;

    let analysis = `📊 学习分析报告\n\n`;
    analysis += `✅ 累计学习：${totalLearned} 个单词\n`;
    analysis += `📅 今日学习：${todayLearned} 个单词\n`;
    analysis += `⭐ 平均熟练度：${avgRating.toFixed(1)} 星\n\n`;

    if (todayLearned < 10) {
      analysis += `💡 建议：今天还可以多学几个单词哦！`;
    } else if (todayLearned >= 50) {
      analysis += `🎉 太棒了！今天的学习目标已完成！`;
    } else {
      analysis += `👍 不错的进度，继续加油！`;
    }

    return { message: analysis, action: null };
  } catch (e) {
    return { message: '暂时无法获取学习数据，请稍后再试。', action: null };
  }
}

// 解释单词
async function explainWord(word) {
  if (!word || !word.word) {
    return { message: '请先选择一个单词，我来帮你详细解释！', action: null };
  }

  let explanation = `📖 单词解析：${word.word}\n\n`;
  if (word.phonetic) explanation += `🔊 音标：${word.phonetic}\n\n`;
  if (word.apiMeaning || word.translation || word.meaning) {
    explanation += `📝 释义：${word.apiMeaning || word.translation || word.meaning}\n\n`;
  }

  explanation += `\n💡 记忆提示：\n• 多次复习加深印象\n• 尝试在句子中使用\n• 联想相关词汇`;
  return { message: explanation, action: null };
}

// 提供记忆技巧
async function provideMemoryTips(word) {
  const tips = [
    `💡 词根词缀法\n将单词拆分成词根、前缀、后缀，理解每部分的含义。`,
    `💡 联想记忆法\n将单词与熟悉的事物、场景联系起来。`,
    `💡 造句记忆法\n用新学的单词造句，在实际语境中使用。`,
    `💡 对比记忆法\n将相似或相反的单词放在一起对比记忆。`,
    `💡 重复记忆法\n遵循艾宾浩斯遗忘曲线，定期复习。`
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  let message = randomTip;
  
  if (word && word.word) {
    message += `\n\n📌 以 "${word.word}" 为例：\n试着用这个单词造3个句子！`;
  }

  return { message, action: null };
}

// AI生成单词例句
async function generateWordContent(word, phonetic, meaning) {
  try {
    const prompt = `请为英语单词 "${word}" 生成2个实用的例句，要求：
1. 例句要简单易懂，适合考研水平
2. 每个例句后面用 ||| 分隔符，然后写中文翻译
3. 不要加序号，直接写英文句子

单词：${word}，音标：${phonetic || '未知'}，释义：${meaning || '未知'}

格式示例：
The government consulted a specialist.|||政府咨询了一位专家。
She made an appointment with a specialist.|||她预约了一位专科医生。`;

    const messages = [
      { role: 'system', content: '你是一个专业的英语教学助手，擅长生成简洁实用的例句。' },
      { role: 'user', content: prompt }
    ];

    const aiResponse = await callAI(messages, { temperature: 0.7, maxTokens: 500 });

    const lines = aiResponse.split('\n').filter(line => line.trim());
    const examples = [];
    const translations = [];

    lines.forEach(line => {
      let cleanLine = line.trim()
        .replace(/^[\d]+[\.\、\:\：]\s*/g, '')
        .replace(/^例句[\d]*[\.\、\:\：]?\s*/g, '');
      
      const parts = cleanLine.split('|||');
      if (parts.length === 2) {
        examples.push(parts[0].trim());
        translations.push(parts[1].trim());
      }
    });

    if (examples.length === 0) {
      return {
        examples: [`I need to learn this ${word}.`, `This ${word} is important.`],
        translations: [`我需要学习这个${word}。`, `这个${word}很重要。`]
      };
    }

    return { examples, translations };
  } catch (error) {
    console.error('❌ AI生成失败:', error.message);
    return {
      examples: [`I need to learn this ${word}.`, `This ${word} is important.`],
      translations: [`我需要学习这个${word}。`, `这个${word}很重要。`]
    };
  }
}

// ==================== SM-2 复习系统 API ====================

const ReviewScheduler = require('../services/reviewScheduler');

router.get('/review/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const words = await ReviewScheduler.getTodayReviewWords(userId, limit);
    const count = await ReviewScheduler.getTodayReviewCount(userId);
    res.json({ success: true, data: { words, totalCount: count } });
  } catch (error) {
    console.error('获取复习单词失败:', error);
    res.status(500).json({ success: false, message: '获取复习单词失败' });
  }
});

router.get('/review/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await ReviewScheduler.getTodayReviewCount(userId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取复习数量失败' });
  }
});

router.post('/review/complete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId, quality, errorType } = req.body;
    if (!wordId || quality === undefined) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    const result = await ReviewScheduler.updateMastery(userId, wordId, quality, errorType);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新复习记录失败' });
  }
});

router.post('/review/init', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId, rating } = req.body;
    if (!wordId) {
      return res.status(400).json({ success: false, message: '缺少单词ID' });
    }
    const quality = ReviewScheduler.convertRatingToQuality(rating || 3);
    const result = await ReviewScheduler.initWordMastery(userId, wordId, quality);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '初始化掌握度失败' });
  }
});

router.get('/review/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const stats = await ReviewScheduler.getReviewStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取复习统计失败' });
  }
});

// ==================== AI水平诊断 API ====================

const LevelDiagnoser = require('../services/levelDiagnoser');

router.get('/diagnosis/start', authenticateToken, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const questions = await LevelDiagnoser.generateQuestions(count);
    if (questions.length === 0) {
      return res.status(500).json({ success: false, message: '生成题目失败' });
    }
    res.json({ success: true, data: { questions } });
  } catch (error) {
    res.status(500).json({ success: false, message: '生成诊断题目失败' });
  }
});

router.post('/diagnosis/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: '缺少答案数据' });
    }
    const result = LevelDiagnoser.calculateResult(answers);
    await LevelDiagnoser.saveResult(userId, result, answers);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '提交诊断答案失败' });
  }
});

router.get('/diagnosis/result', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await LevelDiagnoser.getLatestResult(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取诊断结果失败' });
  }
});

// ==================== 学习计划 API ====================

const PlanGenerator = require('../services/planGenerator');

router.post('/plan/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = req.body;
    const userSettings = await PlanGenerator.getUserSettings(userId);
    const mergedSettings = { ...userSettings, ...settings };
    const result = PlanGenerator.generatePlan(mergedSettings);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    await PlanGenerator.savePlan(userId, result.plan);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '生成学习计划失败' });
  }
});

router.get('/plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const plan = await PlanGenerator.getCurrentPlan(userId);
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取学习计划失败' });
  }
});

router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = await PlanGenerator.getUserSettings(userId);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户设置失败' });
  }
});

router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = req.body;
    const result = await PlanGenerator.updateUserSettings(userId, settings);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新用户设置失败' });
  }
});

// ==================== 薄弱词汇 API ====================

const WeakWordAnalyzer = require('../services/weakWordAnalyzer');

router.get('/weak-words', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const words = await WeakWordAnalyzer.getWeakWords(userId, limit);
    const stats = await WeakWordAnalyzer.getWeakWordStats(userId);
    res.json({ success: true, data: { words, stats } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取薄弱词汇失败' });
  }
});

router.get('/weak-words/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const stats = await WeakWordAnalyzer.getWeakWordStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取薄弱词汇统计失败' });
  }
});

router.get('/weak-words/practice', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = parseInt(req.query.count) || 10;
    const result = await WeakWordAnalyzer.generatePractice(userId, count);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '生成强化练习失败' });
  }
});

router.post('/weak-words/mark-error', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId, errorType } = req.body;
    const result = await WeakWordAnalyzer.markErrorType(userId, wordId, errorType);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '标记错误类型失败' });
  }
});

// ==================== 学习报告 API ====================

const ReportGenerator = require('../services/reportGenerator');

router.get('/report/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const overview = await ReportGenerator.getOverview(userId);
    res.json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取学习概览失败' });
  }
});

router.get('/report/trend', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.query.days) || 7;
    const trend = await ReportGenerator.getTrend(userId, days);
    res.json({ success: true, data: trend });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取学习趋势失败' });
  }
});

router.get('/report/distribution', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const distribution = await ReportGenerator.getMasteryDistribution(userId);
    res.json({ success: true, data: distribution });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取掌握分布失败' });
  }
});

router.get('/report/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const suggestions = await ReportGenerator.generateSuggestions(userId);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取学习建议失败' });
  }
});

router.get('/report', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const report = await ReportGenerator.getFullReport(userId);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取学习报告失败' });
  }
});

module.exports = router;
