/**
 * AI助手路由
 */
const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

// 豆包AI配置
const DOUBAO_CONFIG = {
  apiKey: process.env.DOUBAO_API_KEY || '52b5d7d9-1c95-4188-8bc9-613460fb3168',
  apiUrl: process.env.DOUBAO_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: process.env.DOUBAO_MODEL || 'doubao-seed-1-6-lite-251015'
};

// AI对话接口
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, context } = req.body;
    const userId = req.user.userId;

    console.log('AI请求:', message);
    console.log('上下文:', context);

    // 调用豆包AI
    const response = await callDoubaoAI(message, context, userId);

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('AI请求失败:', error);
    res.status(500).json({ success: false, message: 'AI服务暂时不可用' });
  }
});

// AI自动补全单词内容（例句、翻译）
router.post('/complete-word', authenticateToken, async (req, res) => {
  try {
    const { word, phonetic, meaning } = req.body;

    console.log('🤖 ========== AI补全请求 ==========');
    console.log(`🤖 单词: ${word}`);
    console.log(`🤖 音标: ${phonetic || '无'}`);
    console.log(`🤖 释义: ${meaning || '无'}`);

    // 调用AI生成例句和翻译
    const result = await generateWordContent(word, phonetic, meaning);

    console.log(`🤖 AI生成结果:`);
    console.log(`  - 例句数量: ${result.examples?.length || 0}`);
    console.log(`  - 翻译数量: ${result.translations?.length || 0}`);
    if (result.examples && result.examples.length > 0) {
      result.examples.forEach((ex, i) => {
        console.log(`  - 例句${i + 1}: ${ex}`);
        console.log(`  - 翻译${i + 1}: ${result.translations[i] || '无'}`);
      });
    }

    // 保存到数据库（使用 INSERT ... ON DUPLICATE KEY UPDATE）
    if (result.examples && result.examples.length > 0) {
      const exampleStr = result.examples.join('|||');
      const transStr = result.translations.join('|||');

      console.log(`💾 准备保存到数据库:`);
      console.log(`  - word: ${word}`);
      console.log(`  - phonetic: ${phonetic || '空'}`);
      console.log(`  - example: ${exampleStr}`);
      console.log(`  - example_trans: ${transStr}`);
      console.log(`  - meaning: ${meaning || '空'}`);

      try {
        // 先检查单词是否已存在
        const [existing] = await pool.execute(
          'SELECT word, phonetic, example, example_trans FROM words WHERE word = ?',
          [word]
        );
        
        if (existing && existing.length > 0) {
          console.log(`💾 单词已存在，当前数据:`);
          console.log(`  - phonetic: ${existing[0].phonetic || '空'}`);
          console.log(`  - example: ${existing[0].example || '空'}`);
          console.log(`  - example_trans: ${existing[0].example_trans || '空'}`);
        } else {
          console.log(`💾 单词不存在，将插入新记录`);
        }
        
        const [dbResult] = await pool.execute(
          `INSERT INTO words (word, phonetic, example, example_trans, meaning, category) 
           VALUES (?, ?, ?, ?, ?, 'kaoyan') 
           ON DUPLICATE KEY UPDATE 
             example = VALUES(example),
             example_trans = VALUES(example_trans),
             updated_at = NOW()`,
          [word, phonetic || '', exampleStr, transStr, meaning || '']
        );

        console.log(`✅ 数据库操作完成:`);
        console.log(`  - affectedRows: ${dbResult.affectedRows}`);
        console.log(`  - insertId: ${dbResult.insertId}`);
        console.log(`  - changedRows: ${dbResult.changedRows}`);
        
        // 验证保存结果
        const [verify] = await pool.execute(
          'SELECT word, phonetic, example, example_trans FROM words WHERE word = ?',
          [word]
        );
        
        if (verify && verify.length > 0) {
          console.log(`✅ 验证保存成功，当前数据库数据:`);
          console.log(`  - phonetic: ${verify[0].phonetic || '空'}`);
          console.log(`  - example: ${verify[0].example || '空'}`);
          console.log(`  - example_trans: ${verify[0].example_trans || '空'}`);
          
          // 检查是否真的保存成功
          const savedExample = verify[0].example || '';
          const savedTrans = verify[0].example_trans || '';
          if (savedExample === exampleStr && savedTrans === transStr) {
            console.log(`✅✅ 数据完全匹配，保存成功！`);
          } else {
            console.log(`⚠️ 数据不匹配！`);
            console.log(`  期望 example: ${exampleStr}`);
            console.log(`  实际 example: ${savedExample}`);
            console.log(`  期望 trans: ${transStr}`);
            console.log(`  实际 trans: ${savedTrans}`);
          }
        } else {
          console.log(`❌ 验证失败：数据库中找不到该单词`);
        }
        
      } catch (dbError) {
        console.error('❌ 数据库操作失败:', dbError.message);
        console.error('❌ 错误详情:', dbError);
      }
    } else {
      console.log(`⚠️ AI未生成有效例句，跳过保存`);
    }

    console.log('🤖 ========== AI补全完成 ==========');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ AI补全失败:', error);
    res.status(500).json({ success: false, message: 'AI补全失败' });
  }
});

// 调用豆包AI
async function callDoubaoAI(userMessage, context, userId) {
  try {
    // 构建系统提示词
    const systemPrompt = buildSystemPrompt(context);
    
    // 构建对话历史
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // 如果有对话历史，添加最近的几轮
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentHistory = context.conversationHistory.slice(-4); // 最近2轮对话
      recentHistory.forEach(msg => {
        messages.splice(messages.length - 1, 0, {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    console.log('🤖 调用豆包AI:', DOUBAO_CONFIG.model);
    
    // 调用豆包API
    const response = await axios.post(
      DOUBAO_CONFIG.apiUrl,
      {
        model: DOUBAO_CONFIG.model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_CONFIG.apiKey}`
        },
        timeout: 30000
      }
    );

    const aiMessage = response.data.choices[0].message.content;
    console.log('✅ AI回复:', aiMessage);

    return {
      message: aiMessage,
      action: null
    };

  } catch (error) {
    console.error('❌ 豆包AI调用失败:', error.response?.data || error.message);
    
    // 如果AI调用失败，降级到规则引擎
    console.log('⚠️ 降级到规则引擎');
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

  // 添加当前单词信息
  if (context.currentWord) {
    const word = context.currentWord;
    prompt += `\n当前单词信息：
- 单词：${word.word}
- 音标：${word.phonetic || '未知'}
- 释义：${word.apiMeaning || word.translation || word.meaning || '未知'}
`;
    if (word.example) {
      prompt += `- 例句：${word.example}\n`;
    }
  }

  // 添加学习统计
  if (context.userStats) {
    const stats = context.userStats;
    prompt += `\n用户学习统计：
- 今日学习：${stats.todayLearned || 0} 个
- 累计学习：${stats.totalLearned || 0} 个
- 今日目标：${stats.todayGoal || 50} 个
`;
  }

  return prompt;
}

// 降级方案：规则引擎（AI调用失败时使用）
async function handleAIRequestFallback(message, context, userId) {
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

// 生成例句
async function generateExamples(word) {
  if (!word || !word.word) {
    return { message: '请告诉我你想要哪个单词的例句？', action: null };
  }

  const message = `正在为 "${word.word}" 生成例句...\n\n` +
    `💡 提示：你可以尝试：\n` +
    `1. 查看词典中的例句\n` +
    `2. 自己造句加深印象\n` +
    `3. 在阅读中寻找这个词的用法`;

  return { message, action: { type: 'generate_examples', word: word.word } };
}

// AI生成单词例句和翻译
async function generateWordContent(word, phonetic, meaning) {
  try {
    const prompt = `请为英语单词 "${word}" 生成2个实用的例句，要求：
1. 例句要简单易懂，适合考研水平
2. 例句要能体现单词的常用用法
3. 每个例句后面用 ||| 分隔符，然后写中文翻译
4. 不要在例句前加任何序号或前缀（如"例句1:"），直接写英文句子

单词信息：
- 单词：${word}
- 音标：${phonetic || '未知'}
- 释义：${meaning || '未知'}

请严格按以下格式输出（每行一个例句，不要有多余的文字或序号）：
The government consulted a specialist in renewable energy.|||政府咨询了一位可再生能源专家。
She made an appointment with a specialist.|||她预约了一位专科医生。`;

    console.log('🤖 调用豆包AI生成例句');

    const response = await axios.post(
      DOUBAO_CONFIG.apiUrl,
      {
        model: DOUBAO_CONFIG.model,
        messages: [
          { role: 'system', content: '你是一个专业的英语教学助手，擅长生成简洁实用的例句。请严格按照用户要求的格式输出，不要添加任何序号、前缀或额外说明。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_CONFIG.apiKey}`
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices[0].message.content.trim();
    console.log('✅ AI返回:', aiResponse);

    // 解析AI返回的内容
    const lines = aiResponse.split('\n').filter(line => line.trim());
    const examples = [];
    const translations = [];

    lines.forEach(line => {
      // 清理可能的序号前缀（如 "1." "例句1:" "例句1：" 等）
      let cleanLine = line.trim()
        .replace(/^[\d]+[\.\、\:\：]\s*/g, '')  // 移除 "1." "1、" "1:" "1："
        .replace(/^例句[\d]*[\.\、\:\：]?\s*/g, '');  // 移除 "例句1:" "例句1：" "例句:"
      
      const parts = cleanLine.split('|||');
      if (parts.length === 2) {
        examples.push(parts[0].trim());
        translations.push(parts[1].trim());
      }
    });

    // 如果解析失败，返回默认内容
    if (examples.length === 0) {
      return {
        examples: [`I need to learn this ${word}.`, `This ${word} is important.`],
        translations: [`我需要学习这个${word}。`, `这个${word}很重要。`]
      };
    }

    return { examples, translations };

  } catch (error) {
    console.error('❌ AI生成失败:', error.response?.data || error.message);
    
    // 降级：返回简单的默认例句
    return {
      examples: [`I need to learn this ${word}.`, `This ${word} is important.`],
      translations: [`我需要学习这个${word}。`, `这个${word}很重要。`]
    };
  }
}

module.exports = router;
