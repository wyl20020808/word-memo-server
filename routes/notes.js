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

// 获取AI分析结果（最近一次）- 只读取，不触发分析
router.get('/analysis', async (req, res) => {
  try {
    const userId = req.user.userId;

    // 先尝试查询包含新字段的数据
    let results;
    try {
      [results] = await pool.execute(
        `SELECT id, summary, key_points, suggestions, analyzed_at, 
                activity_summary, activity_categories, recent_highlights
         FROM ai_notes_analysis 
         WHERE user_id = ? 
         ORDER BY analyzed_at DESC 
         LIMIT 1`,
        [userId]
      );
    } catch (queryError) {
      // 如果新字段不存在，回退到只查询基础字段
      if (queryError.message.includes('Unknown column')) {
        console.log('⚠️ 新字段不存在，使用基础查询');
        [results] = await pool.execute(
          `SELECT id, summary, key_points, suggestions, analyzed_at
           FROM ai_notes_analysis 
           WHERE user_id = ? 
           ORDER BY analyzed_at DESC 
           LIMIT 1`,
          [userId]
        );
      } else {
        throw queryError;
      }
    }

    if (results.length === 0) {
      // 没有分析结果，直接返回null，不触发分析
      return res.json({ success: true, data: null });
    }

    const analysis = results[0];
    
    // 安全解析 JSON 字段
    const safeParseJSON = (str, defaultVal = []) => {
      if (!str) return defaultVal;
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : defaultVal;
      } catch (e) {
        // 如果不是有效JSON，可能是纯文本，转为数组
        return typeof str === 'string' ? [str] : defaultVal;
      }
    };
    
    // 计算分析结果的新鲜度
    const lastAnalyzed = new Date(analysis.analyzed_at);
    const now = new Date();
    const hoursSinceAnalysis = (now - lastAnalyzed) / (1000 * 60 * 60);
    
    // 返回数据，包含是否需要更新的标记（让前端决定是否提示用户手动更新）
    res.json({
      success: true,
      data: {
        id: analysis.id,
        summary: analysis.summary,
        keyPoints: safeParseJSON(analysis.key_points),
        suggestions: safeParseJSON(analysis.suggestions),
        analyzedAt: analysis.analyzed_at,
        // 新格式字段
        overallSummary: analysis.activity_summary || analysis.summary || '',
        activitySummary: analysis.activity_summary || analysis.summary || '',
        activityCategories: safeParseJSON(analysis.activity_categories),
        categories: safeParseJSON(analysis.activity_categories), // 前端期望的字段名
        recentHighlights: safeParseJSON(analysis.recent_highlights),
        highlights: safeParseJSON(analysis.recent_highlights), // 前端期望的字段名
        weeklyTrend: null, // 旧数据没有这个字段
        totalRecords: analysis.notes_count || 0,
        dateRange: '近7天',
        needsUpdate: hoursSinceAnalysis >= 3 // 告诉前端是否需要更新
      }
    });

  } catch (error) {
    console.error('❌ 获取分析结果失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// AI活动分析函数 - 详细分类版
async function performActivityAnalysis(notes) {
  const contentList = notes.map(note => {
    const date = new Date(note.created_at).toLocaleDateString('zh-CN');
    const time = new Date(note.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const category = note.category ? `[${note.category}]` : '';
    return `${date} ${time} ${category} ${note.original_content}`;
  }).join('\n');

  const systemPrompt = `你是一个专业的生活分析师。请仔细分析用户的记录，将活动分类整理，并给出深度洞察。

请严格按以下JSON格式返回（不要添加任何其他内容）：
{
  "overallSummary": "整体总结（50字以内，概括用户这段时间的生活状态和重心）",
  "totalRecords": ${notes.length},
  "dateRange": "分析的时间范围描述",
  "categories": [
    {
      "id": "study",
      "name": "📚 学习成长",
      "color": "#667eea",
      "percentage": 30,
      "count": 3,
      "summary": "这个板块的总结（30字以内）",
      "activities": [
        {
          "title": "具体活动名称",
          "detail": "活动详情描述",
          "time": "时间信息"
        }
      ],
      "insight": "针对这个板块的洞察或建议（30字以内）"
    },
    {
      "id": "work",
      "name": "💼 工作事务",
      "color": "#f093fb",
      "percentage": 25,
      "count": 2,
      "summary": "工作相关总结",
      "activities": [],
      "insight": "工作方面的洞察"
    },
    {
      "id": "entertainment",
      "name": "🎮 休闲娱乐",
      "color": "#4facfe",
      "percentage": 20,
      "count": 2,
      "summary": "娱乐活动总结",
      "activities": [],
      "insight": "娱乐方面的建议"
    },
    {
      "id": "thinking",
      "name": "💭 思考感悟",
      "color": "#43e97b",
      "percentage": 15,
      "count": 1,
      "summary": "思考内容总结",
      "activities": [],
      "insight": "思考方面的点评"
    },
    {
      "id": "daily",
      "name": "🏠 日常生活",
      "color": "#fa709a",
      "percentage": 10,
      "count": 1,
      "summary": "日常活动总结",
      "activities": [],
      "insight": "生活方面的建议"
    }
  ],
  "highlights": [
    {
      "icon": "🌟",
      "title": "亮点标题",
      "content": "亮点内容描述（40字以内）"
    }
  ],
  "weeklyTrend": {
    "mostActiveDay": "最活跃的日期",
    "mostActiveCategory": "最活跃的类别",
    "suggestion": "基于趋势的建议（40字以内）"
  }
}

分类规则：
- 📚 学习成长：背单词、看书、学习课程、考研复习、技能提升等
- 💼 工作事务：工作任务、项目进展、会议、职业相关等
- 🎮 休闲娱乐：游戏、看剧、听音乐、社交活动、运动健身等
- 💭 思考感悟：反思、计划、灵感、情绪记录、人生思考等
- 🏠 日常生活：吃饭、购物、家务、出行、健康等

要求：
1. percentage 所有类别加起来必须等于100
2. 如果某类别没有相关记录，percentage设为0，activities为空数组
3. 每个类别最多列出3个具体活动
4. highlights 提取2-3个最值得关注的亮点
5. 所有文字要简洁有力，避免啰嗦
6. 只返回JSON，不要有任何其他文字`;

  const aiResponse = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请分析以下${notes.length}条记录：\n\n${contentList}` }
  ], { temperature: 0.7, maxTokens: 2500 });

  const result = parseAIJSON(aiResponse);
  if (!result) {
    throw new Error('AI返回格式错误');
  }

  return {
    summary: result.overallSummary || '',
    keyPoints: result.highlights ? result.highlights.map(h => h.content) : [],
    suggestions: result.weeklyTrend ? [result.weeklyTrend.suggestion] : [],
    activitySummary: result.overallSummary || '',
    activityCategories: result.categories || [],
    recentHighlights: result.highlights || [],
    weeklyTrend: result.weeklyTrend || null,
    totalRecords: result.totalRecords || notes.length,
    dateRange: result.dateRange || ''
  };
}

// 保存分析结果到数据库（带重试）
async function saveAnalysisResult(userId, analysisResult, notesCount) {
  await pool.executeWithRetry(
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

// 手动触发AI分析（异步轮询模式）
router.post('/analyze', async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('📝 开始获取用户记录，用户ID:', userId);

    // 获取最近7天的记录
    let notes;
    try {
      const [result] = await pool.execute(
        `SELECT original_content, category, created_at 
         FROM ai_notes 
         WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY created_at DESC`,
        [userId]
      );
      notes = result;
    } catch (dbError) {
      console.error('❌ 数据库查询失败:', dbError.message);
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!notes || notes.length === 0) {
      return res.status(400).json({ success: false, message: '没有可分析的记录' });
    }

    console.log('📝 手动触发AI分析（异步模式），用户:', userId, '记录数:', notes.length);

    // 创建异步任务 - 复制notes数据避免引用问题
    const notesCopy = notes.map(n => ({
      original_content: n.original_content,
      category: n.category,
      created_at: n.created_at
    }));

    const taskId = createTask(TaskType.NOTES_ANALYSIS, userId, async () => {
      const analysisResult = await performActivityAnalysis(notesCopy);
      await saveAnalysisResult(userId, analysisResult, notesCopy.length);
      
      return {
        summary: analysisResult.summary,
        keyPoints: analysisResult.keyPoints,
        suggestions: analysisResult.suggestions,
        activitySummary: analysisResult.activitySummary,
        activityCategories: analysisResult.activityCategories,
        recentHighlights: analysisResult.recentHighlights,
        notesCount: notesCopy.length,
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
