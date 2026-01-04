/**
 * AI助手路由
 */
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

// AI对话接口
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, context } = req.body;
    const userId = req.user.userId;

    console.log('AI请求:', message);
    console.log('上下文:', context);

    // TODO: 这里接入真实的AI API（OpenAI、通义千问、文心一言等）
    // 现在先用规则引擎模拟
    const response = await handleAIRequest(message, context, userId);

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('AI请求失败:', error);
    res.status(500).json({ success: false, message: 'AI服务暂时不可用' });
  }
});

// AI请求处理（规则引擎 + 后续可接入真实AI）
async function handleAIRequest(message, context, userId) {
  const msgLower = message.toLowerCase();

  // 1. 学习分析请求
  if (msgLower.includes('分析') || msgLower.includes('进度') || msgLower.includes('统计')) {
    return await analyzeUserProgress(userId, context);
  }

  // 2. 单词解释请求
  if (msgLower.includes('解释') || msgLower.includes('什么意思') || (context.currentWord && msgLower.includes('单词'))) {
    return await explainWord(context.currentWord);
  }

  // 3. 记忆技巧请求
  if (msgLower.includes('记忆') || msgLower.includes('技巧') || msgLower.includes('方法')) {
    return await provideMemoryTips(context.currentWord);
  }

  // 4. 例句生成请求
  if (msgLower.includes('例句') || msgLower.includes('造句')) {
    return await generateExamples(context.currentWord);
  }

  // 5. 默认回复
  return {
    message: '我理解你的问题了。你可以问我：\n\n• "分析我的学习进度"\n• "解释这个单词"\n• "给我一些记忆技巧"\n• "生成一些例句"\n\n或者直接告诉我你想了解什么！',
    action: null
  };
}

// 分析用户学习进度
async function analyzeUserProgress(userId, context) {
  try {
    // 获取用户统计数据
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(DISTINCT word_id) as total_learned,
        AVG(rating) as avg_rating,
        SUM(learned_count) as total_reviews
      FROM user_word_records 
      WHERE user_id = ?`,
      [userId]
    );

    // 获取今日学习
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
  
  if (word.phonetic) {
    explanation += `🔊 音标：${word.phonetic}\n\n`;
  }

  if (word.apiMeaning || word.translation || word.meaning) {
    explanation += `📝 释义：${word.apiMeaning || word.translation || word.meaning}\n\n`;
  }

  if (word.example) {
    const examples = word.example.split('|||').filter(e => e.trim());
    if (examples.length > 0) {
      explanation += `💬 例句：\n`;
      examples.forEach((ex, idx) => {
        explanation += `${idx + 1}. ${ex}\n`;
      });
    }
  }

  explanation += `\n💡 记忆提示：\n`;
  explanation += `• 多次复习加深印象\n`;
  explanation += `• 尝试在句子中使用\n`;
  explanation += `• 联想相关词汇`;

  return { message: explanation, action: null };
}

// 提供记忆技巧
async function provideMemoryTips(word) {
  const tips = [
    `💡 词根词缀法\n将单词拆分成词根、前缀、后缀，理解每部分的含义，组合记忆更高效。`,
    `💡 联想记忆法\n将单词与熟悉的事物、场景联系起来，创造生动的画面帮助记忆。`,
    `💡 造句记忆法\n用新学的单词造句，在实际语境中使用，加深理解和记忆。`,
    `💡 对比记忆法\n将相似或相反的单词放在一起对比记忆，找出异同点。`,
    `💡 重复记忆法\n遵循艾宾浩斯遗忘曲线，在1天、3天、7天、15天后复习。`
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  
  let message = randomTip;
  
  if (word && word.word) {
    message += `\n\n📌 以 "${word.word}" 为例：\n`;
    message += `试着用这个单词造3个句子，分别描述不同的场景，这样能更好地记住它的用法！`;
  }

  return { message, action: null };
}

// 生成例句（简单版本，后续可接入AI生成）
async function generateExamples(word) {
  if (!word || !word.word) {
    return { message: '请告诉我你想要哪个单词的例句？', action: null };
  }

  // TODO: 接入AI生成真实例句
  const message = `正在为 "${word.word}" 生成例句...\n\n` +
    `💡 提示：你可以尝试：\n` +
    `1. 查看词典中的例句\n` +
    `2. 自己造句加深印象\n` +
    `3. 在阅读中寻找这个词的用法\n\n` +
    `（AI生成例句功能即将上线！）`;

  return { message, action: { type: 'generate_examples', word: word.word } };
}

module.exports = router;
