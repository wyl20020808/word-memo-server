const express = require('express');
const { pool } = require('../config/database');
const { callAI, parseAIJSON } = require('../services/aiService');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 所有路由需要登录
router.use(authMiddleware);

// 添加记录（不做AI分析，直接保存）
router.post('/add', async (req, res) => {
  try {
    const userId = req.userId;
    const { content, category } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '内容不能为空' });
    }

    const [result] = await pool.execute(
      `INSERT INTO ai_notes (user_id, original_content, category) VALUES (?, ?, ?)`,
      [userId, content.trim(), category || '']
    );

    res.json({
      success: true,
      data: {
        id: result.insertId,
        content: content.trim(),
        category: category || '',
        created_at: new Date()
      }
    });

  } catch (error) {
    console.error('❌ 添加记录失败:', error);
    res.status(500).json({ success: false, message: '添加失败' });
  }
});

// 更新记录
router.put('/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const noteId = req.params.id;
    const { content, category } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '内容不能为空' });
    }

    await pool.execute(
      `UPDATE ai_notes SET original_content = ?, category = ? WHERE id = ? AND user_id = ?`,
      [content.trim(), category || '', noteId, userId]
    );

    res.json({ success: true, message: '更新成功' });

  } catch (error) {
    console.error('❌ 更新记录失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 获取记录列表
router.get('/list', async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;

    const [notes] = await pool.execute(
      `SELECT id, original_content, category, created_at 
       FROM ai_notes 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    const formattedNotes = notes.map(note => ({
      id: note.id,
      content: note.original_content,
      category: note.category || '',
      created_at: note.created_at
    }));

    res.json({ success: true, data: formattedNotes });

  } catch (error) {
    console.error('❌ 获取记录列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 删除记录
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
    console.error('❌ 删除记录失败:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 获取AI分析结果（最近一次）
router.get('/analysis', async (req, res) => {
  try {
    const userId = req.userId;

    const [results] = await pool.execute(
      `SELECT id, summary, key_points, suggestions, analyzed_at 
       FROM ai_notes_analysis 
       WHERE user_id = ? 
       ORDER BY analyzed_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (results.length === 0) {
      return res.json({ success: true, data: null });
    }

    const analysis = results[0];
    res.json({
      success: true,
      data: {
        id: analysis.id,
        summary: analysis.summary,
        keyPoints: JSON.parse(analysis.key_points || '[]'),
        suggestions: JSON.parse(analysis.suggestions || '[]'),
        analyzedAt: analysis.analyzed_at
      }
    });

  } catch (error) {
    console.error('❌ 获取分析结果失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 手动触发AI分析（分析近期所有记录）
router.post('/analyze', async (req, res) => {
  try {
    const userId = req.userId;

    // 获取最近7天的记录
    const [notes] = await pool.execute(
      `SELECT original_content, category, created_at 
       FROM ai_notes 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY created_at DESC`,
      [userId]
    );

    if (notes.length === 0) {
      return res.status(400).json({ success: false, message: '没有可分析的记录' });
    }

    console.log('📝 开始AI分析，用户:', userId, '记录数:', notes.length);

    // 构建内容
    const contentList = notes.map((note, i) => {
      const date = new Date(note.created_at).toLocaleDateString('zh-CN');
      return `[${date}] ${note.category ? `(${note.category}) ` : ''}${note.original_content}`;
    }).join('\n\n');

    // AI分析
    const systemPrompt = `你是一个智能复盘分析助手。用户会提供近期的多条记录，你需要综合分析这些内容，给出：

1. 整体总结：概括用户近期的主要活动和状态
2. 关键发现：从记录中提取的重要信息和规律
3. 改进建议：针对性的建议

请以JSON格式返回：
{
  "summary": "整体总结，200字以内",
  "keyPoints": ["发现1", "发现2", "发现3"],
  "suggestions": ["建议1", "建议2", "建议3"]
}

注意：
- 总结要有洞察力，不是简单罗列
- 发现要有价值，能帮助用户认识自己
- 建议要具体可行
- 只返回JSON`;

    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请分析以下${notes.length}条近期记录：\n\n${contentList}` }
    ], { temperature: 0.7, maxTokens: 1500 });

    const result = parseAIJSON(aiResponse);
    if (!result) {
      throw new Error('AI返回格式错误');
    }

    // 保存分析结果
    await pool.execute(
      `INSERT INTO ai_notes_analysis (user_id, summary, key_points, suggestions, notes_count) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        result.summary || '',
        JSON.stringify(result.keyPoints || []),
        JSON.stringify(result.suggestions || []),
        notes.length
      ]
    );

    res.json({
      success: true,
      data: {
        summary: result.summary,
        keyPoints: result.keyPoints || [],
        suggestions: result.suggestions || [],
        notesCount: notes.length,
        analyzedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ AI分析失败:', error);
    res.status(500).json({ success: false, message: '分析失败: ' + error.message });
  }
});

module.exports = router;
