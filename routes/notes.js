const express = require('express');
const { pool } = require('../config/database');
const { callAI, parseAIJSON } = require('../services/aiService');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 所有路由需要登录
router.use(authMiddleware);

// AI分析笔记内容
router.post('/analyze', async (req, res) => {
  try {
    const userId = req.userId;
    const { content, category } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '内容不能为空' });
    }

    console.log('📝 开始分析笔记，用户:', userId);
    console.log('📝 内容长度:', content.length);
    console.log('📝 指定分类:', category || '自动识别');

    // 构建AI提示词
    const systemPrompt = `你是一个智能笔记分析助手。用户会输入各种内容（可能是游戏复盘、学习总结、工作记录、生活感悟等），你需要：

1. 自动识别内容的类别（可以有多个类别）
2. 提取关键要点
3. 生成简洁的摘要
4. 给出有价值的建议

请以JSON格式返回，格式如下：
{
  "categories": ["类别1", "类别2"],
  "summary": "一段简洁的摘要，概括用户记录的主要内容",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "suggestions": ["建议1", "建议2"]
}

类别可选项：
- 🎮 游戏复盘
- 📚 学习总结
- 💼 工作记录
- 💪 健身运动
- 💰 理财投资
- 🎯 目标计划
- 💭 生活感悟
- 🔧 技术笔记

注意：
- 摘要要简洁有力，不超过100字
- 关键要点3-5个，每个不超过30字
- 建议要具体可行，2-3条
- 如果内容涉及游戏（如云顶之弈、王者荣耀等），要给出针对性的游戏建议
- 如果内容涉及学习，要给出学习方法建议
- 只返回JSON，不要其他内容`;

    const userPrompt = category 
      ? `用户指定分类为"${category}"，请分析以下内容：\n\n${content}`
      : `请分析以下内容：\n\n${content}`;

    // 调用AI
    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.7,
      maxTokens: 1000
    });

    // 解析AI返回的JSON
    const analysisResult = parseAIJSON(aiResponse);

    if (!analysisResult) {
      throw new Error('AI返回格式错误');
    }

    console.log('✅ AI分析完成:', analysisResult);

    // 保存到数据库
    const [result] = await pool.execute(
      `INSERT INTO ai_notes (user_id, original_content, categories, summary, key_points, suggestions) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        content,
        JSON.stringify(analysisResult.categories || []),
        analysisResult.summary || '',
        JSON.stringify(analysisResult.keyPoints || []),
        JSON.stringify(analysisResult.suggestions || [])
      ]
    );

    console.log('✅ 笔记已保存，ID:', result.insertId);

    res.json({
      success: true,
      data: {
        id: result.insertId,
        originalContent: content,
        categories: analysisResult.categories || [],
        summary: analysisResult.summary || '',
        keyPoints: analysisResult.keyPoints || [],
        suggestions: analysisResult.suggestions || []
      }
    });

  } catch (error) {
    console.error('❌ 分析笔记失败:', error);
    res.status(500).json({ success: false, message: '分析失败: ' + error.message });
  }
});

// 获取笔记列表
router.get('/list', async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;

    const [notes] = await pool.execute(
      `SELECT id, original_content, categories, summary, key_points, suggestions, created_at 
       FROM ai_notes 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    // 格式化数据
    const formattedNotes = notes.map(note => ({
      id: note.id,
      originalContent: note.original_content,
      categories: JSON.parse(note.categories || '[]'),
      summary: note.summary,
      keyPoints: JSON.parse(note.key_points || '[]'),
      suggestions: JSON.parse(note.suggestions || '[]'),
      created_at: note.created_at
    }));

    res.json({ success: true, data: formattedNotes });

  } catch (error) {
    console.error('❌ 获取笔记列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 删除笔记
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const noteId = req.params.id;

    await pool.execute(
      'DELETE FROM ai_notes WHERE id = ? AND user_id = ?',
      [noteId, userId]
    );

    res.json({ success: true, message: '删除成功' });

  } catch (error) {
    console.error('❌ 删除笔记失败:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 获取笔记统计
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId;

    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as totalNotes,
        COUNT(DISTINCT DATE(created_at)) as activeDays
       FROM ai_notes 
       WHERE user_id = ?`,
      [userId]
    );

    // 获取分类统计
    const [categoryStats] = await pool.execute(
      `SELECT categories FROM ai_notes WHERE user_id = ?`,
      [userId]
    );

    const categoryCount = {};
    categoryStats.forEach(row => {
      const cats = JSON.parse(row.categories || '[]');
      cats.forEach(cat => {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
    });

    res.json({
      success: true,
      data: {
        totalNotes: stats[0].totalNotes,
        activeDays: stats[0].activeDays,
        categoryCount
      }
    });

  } catch (error) {
    console.error('❌ 获取统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

module.exports = router;
