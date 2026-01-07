const express = require('express');
const { pool } = require('../config/database');
const { callAI, parseAIJSON } = require('../services/aiService');
const { authenticateToken } = require('../middleware/auth');
const { createTask, TaskType } = require('../services/aiTaskManager');

const router = express.Router();

// 所有路由需要登录
router.use(authenticateToken);

// 添加记录（不做AI分析，直接保存）
router.post('/add', async (req, res) => {
  try {
    const userId = req.user.userId;
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
    const userId = req.user.userId;
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
    const userId = req.user.userId;
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
    const userId = req.user.userId;
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
    const userId = req.user.userId;

    const [results] = await pool.execute(
      `SELECT id, summary, key_points, suggestions, analyzed_at, 
              activity_summary, activity_categories, recent_highlights
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
    
    // 检查是否需要更新（超过3小时）
    const lastAnalyzed = new Date(analysis.analyzed_at);
    const now = new Date();
    const hoursSinceAnalysis = (now - lastAnalyzed) / (1000 * 60 * 60);
    
    // 如果超过3小时，异步触发更新（不阻塞当前请求）
    if (hoursSinceAnalysis >= 3) {
      console.log('⏰ 分析结果已过期，触发后台更新');
      triggerBackgroundAnalysis(userId).catch(err => {
        console.error('后台分析失败:', err);
      });
    }

    res.json({
      success: true,
      data: {
        id: analysis.id,
        summary: analysis.summary,
        keyPoints: JSON.parse(analysis.key_points || '[]'),
        suggestions: JSON.parse(analysis.suggestions || '[]'),
        analyzedAt: analysis.analyzed_at,
        activitySummary: analysis.activity_summary,
        activityCategories: JSON.parse(analysis.activity_categories || '[]'),
        recentHighlights: JSON.parse(analysis.recent_highlights || '[]')
      }
    });

  } catch (error) {
    console.error('❌ 获取分析结果失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// AI活动分析函数
async function performActivityAnalysis(notes) {
  const contentList = notes.map(note => {
    const date = new Date(note.created_at).toLocaleDateString('zh-CN');
    const category = note.category ? '(' + note.category + ') ' : '';
    return '[' + date + '] ' + category + note.original_content;
  }).join('\n\n');

  const systemPrompt = '你是一个智能生活分析助手。用户会提供近期的记录，你需要分析用户最近在做什么。\n\n' +
    '请按以下JSON格式返回（严格遵守格式）：\n' +
    '{\n' +
    '  "summary": "一句话总结用户最近的主要活动和状态（30字以内）",\n' +
    '  "keyPoints": ["发现1", "发现2", "发现3"],\n' +
    '  "suggestions": ["建议1", "建议2", "建议3"],\n' +
    '  "activitySummary": "用一句话总结用户最近在做什么（30字以内）",\n' +
    '  "activityCategories": [\n' +
    '    {\n' +
    '      "name": "类别名称",\n' +
    '      "icon": "图标emoji",\n' +
    '      "desc": "活动描述（20字以内）",\n' +
    '      "count": 记录数量\n' +
    '    }\n' +
    '  ],\n' +
    '  "recentHighlights": [\n' +
    '    {\n' +
    '      "title": "亮点标题（10字以内）",\n' +
    '      "desc": "详细描述（30字以内）"\n' +
    '    }\n' +
    '  ]\n' +
    '}\n\n' +
    '要求：\n' +
    '- activityCategories 3-5个类别\n' +
    '- recentHighlights 3个亮点\n' +
    '- 所有文字简洁有力\n' +
    '- 只返回JSON，不要其他内容';

  const aiResponse = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请分析以下' + notes.length + '条记录：\n\n' + contentList }
  ], { temperature: 0.7, maxTokens: 1500 });

  const result = parseAIJSON(aiResponse);
  if (!result) {
    throw new Error('AI返回格式错误');
  }

  return {
    summary: result.summary || '',
    keyPoints: result.keyPoints || [],
    suggestions: result.suggestions || [],
    activitySummary: result.activitySummary || result.summary || '',
    activityCategories: result.activityCategories || [],
    recentHighlights: result.recentHighlights || []
  };
}

// 保存分析结果到数据库
async function saveAnalysisResult(userId, analysisResult, notesCount) {
  await pool.execute(
    `INSERT INTO ai_notes_analysis 
     (user_id, summary, key_points, suggestions, activity_summary, activity_categories, recent_highlights, notes_count) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      analysisResult.summary,
      JSON.stringify(analysisResult.keyPoints),
      JSON.stringify(analysisResult.suggestions),
      analysisResult.activitySummary,
      JSON.stringify(analysisResult.activityCategories),
      JSON.stringify(analysisResult.recentHighlights),
      notesCount
    ]
  );
}

// 后台异步分析（不阻塞请求）
async function triggerBackgroundAnalysis(userId) {
  try {
    const [notes] = await pool.execute(
      `SELECT original_content, category, created_at 
       FROM ai_notes 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    if (notes.length === 0) return;

    console.log('🔄 后台分析开始，用户:', userId);

    const analysisResult = await performActivityAnalysis(notes);
    await saveAnalysisResult(userId, analysisResult, notes.length);

    console.log('✅ 后台分析完成');
  } catch (error) {
    console.error('❌ 后台分析失败:', error);
  }
}

// 手动触发AI分析（异步轮询模式）
router.post('/analyze', async (req, res) => {
  try {
    const userId = req.user.userId;

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

    console.log('📝 手动触发AI分析（异步模式），用户:', userId, '记录数:', notes.length);

    // 创建异步任务
    const taskId = createTask(TaskType.NOTES_ANALYSIS, userId, async () => {
      const analysisResult = await performActivityAnalysis(notes);
      await saveAnalysisResult(userId, analysisResult, notes.length);
      
      return {
        summary: analysisResult.summary,
        keyPoints: analysisResult.keyPoints,
        suggestions: analysisResult.suggestions,
        activitySummary: analysisResult.activitySummary,
        activityCategories: analysisResult.activityCategories,
        recentHighlights: analysisResult.recentHighlights,
        notesCount: notes.length,
        analyzedAt: new Date()
      };
    });

    // 立即返回任务ID
    res.json({
      success: true,
      data: { taskId, status: 'processing' }
    });

  } catch (error) {
    console.error('❌ AI分析失败:', error);
    res.status(500).json({ success: false, message: '分析失败: ' + error.message });
  }
});

module.exports = router;
