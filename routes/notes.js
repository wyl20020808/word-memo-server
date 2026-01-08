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
                activity_summary, activity_categories, recent_highlights, notes_count
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
      console.log('📊 没有找到分析结果');
      return res.json({ success: true, data: null });
    }

    const analysis = results[0];
    console.log('📊 数据库原始数据:', {
      activity_summary: analysis.activity_summary,
      activity_categories_type: typeof analysis.activity_categories,
      activity_categories_length: analysis.activity_categories?.length,
      activity_categories_preview: analysis.activity_categories?.substring(0, 200),
      recent_highlights_type: typeof analysis.recent_highlights,
      recent_highlights_preview: analysis.recent_highlights?.substring(0, 200)
    });
    
    // 安全解析 JSON 字段
    const safeParseJSON = (str, defaultVal = []) => {
      if (!str) return defaultVal;
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : defaultVal;
      } catch (e) {
        console.error('JSON解析失败:', e.message, '原始数据:', str?.substring(0, 100));
        // 如果不是有效JSON，可能是纯文本，转为数组
        return typeof str === 'string' ? [str] : defaultVal;
      }
    };
    
    // 计算分析结果的新鲜度
    const lastAnalyzed = new Date(analysis.analyzed_at);
    const now = new Date();
    const hoursSinceAnalysis = (now - lastAnalyzed) / (1000 * 60 * 60);
    
    const categories = safeParseJSON(analysis.activity_categories);
    const highlights = safeParseJSON(analysis.recent_highlights);
    
    console.log('📊 解析后的数据:', {
      categories_count: categories.length,
      categories_sample: categories[0],
      highlights_count: highlights.length
    });
    
    // 返回数据，包含是否需要更新的标记（让前端决定是否提示用户手动更新）
    const responseData = {
      id: analysis.id,
      summary: analysis.summary,
      keyPoints: safeParseJSON(analysis.key_points),
      suggestions: safeParseJSON(analysis.suggestions),
      analyzedAt: analysis.analyzed_at,
      // 新格式字段
      overallSummary: analysis.activity_summary || analysis.summary || '',
      activitySummary: analysis.activity_summary || analysis.summary || '',
      activityCategories: categories,
      categories: categories, // 前端期望的字段名
      recentHighlights: highlights,
      highlights: highlights, // 前端期望的字段名
      weeklyTrend: null, // TODO: 从数据库读取
      totalRecords: analysis.notes_count || 0,
      dateRange: '近7天',
      needsUpdate: hoursSinceAnalysis >= 3 // 告诉前端是否需要更新
    };
    
    console.log('📊 返回给前端的数据:', {
      overallSummary: responseData.overallSummary,
      categories_count: responseData.categories.length,
      highlights_count: responseData.highlights.length
    });
    
    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ 获取分析结果失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// AI活动分析函数 - 详细分类版（带fallback）
async function performActivityAnalysis(notes) {
  const contentList = notes.map(note => {
    const date = new Date(note.created_at).toLocaleDateString('zh-CN');
    const time = new Date(note.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const category = note.category ? `[${note.category}]` : '';
    return `${date} ${time} ${category} ${note.original_content}`;
  }).join('\n');

  const systemPrompt = `你是一个专业的生活分析师。请仔细分析用户的记录，将活动分类整理。

**重要：必须返回完整且严格的JSON格式，确保所有括号都闭合！**

返回格式（必须完整）：
{
  "overallSummary": "整体总结（30字内）",
  "totalRecords": ${notes.length},
  "dateRange": "近7天",
  "categories": [
    {
      "id": "study",
      "name": "📚 学习成长",
      "color": "#667eea",
      "percentage": 40,
      "count": 4,
      "summary": "学习总结（20字内）",
      "activities": [
        {"title": "活动1", "detail": "详情", "time": "时间"}
      ],
      "insight": "建议（20字内）"
    },
    {
      "id": "entertainment",
      "name": "🎮 休闲娱乐",
      "color": "#4facfe",
      "percentage": 30,
      "count": 3,
      "summary": "娱乐总结",
      "activities": [],
      "insight": "建议"
    },
    {
      "id": "thinking",
      "name": "💭 思考感悟",
      "color": "#43e97b",
      "percentage": 20,
      "count": 2,
      "summary": "思考总结",
      "activities": [],
      "insight": "建议"
    },
    {
      "id": "daily",
      "name": "🏠 日常生活",
      "color": "#fa709a",
      "percentage": 10,
      "count": 1,
      "summary": "日常总结",
      "activities": [],
      "insight": "建议"
    }
  ],
  "highlights": [
    {"icon": "✨", "title": "亮点", "content": "内容"}
  ],
  "weeklyTrend": {
    "mostActiveDay": "日期",
    "mostActiveCategory": "类别",
    "suggestion": "建议"
  }
}

分类规则：
- 📚 学习成长：学习、背单词、看书、技能提升
- 🎮 休闲娱乐：游戏、看剧、运动、社交
- 💭 思考感悟：反思、计划、灵感、情绪
- 🏠 日常生活：吃饭、购物、家务、出行

要求：
1. percentage总和=100
2. 每个类别最多2个activities
3. 所有文字简短（避免超长导致截断）
4. **确保JSON完整，所有括号闭合**
5. **只返回JSON，不要其他内容**`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请分析以下${notes.length}条记录：\n\n${contentList}` }
  ];

  let result = null;
  let aiResponse = null;

  // 第一次尝试：使用豆包
  try {
    console.log('🎯 第一次尝试：使用豆包 API');
    aiResponse = await callAI(messages, { 
      temperature: 0.7, 
      maxTokens: 3500,
      preferredProvider: 'Doubao'
    });

    // 清理 AI 返回的内容
    let cleanedResponse = aiResponse.trim();
    cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleanedResponse = cleanedResponse.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    // 尝试解析
    result = parseAIJSON(cleanedResponse);
    
    // 验证数据完整性
    if (result && result.categories && Array.isArray(result.categories) && result.categories.length > 0) {
      console.log('✅ 豆包返回数据完整，解析成功');
    } else {
      console.warn('⚠️ 豆包返回数据不完整，准备使用备用AI');
      console.log('豆包返回内容前500字符:', cleanedResponse.substring(0, 500));
      result = null; // 标记为失败，触发fallback
    }
  } catch (error) {
    console.error('❌ 豆包调用失败:', error.message);
    result = null;
  }

  // 第二次尝试：如果豆包失败，使用DeepSeek
  if (!result) {
    try {
      console.log('🔄 第二次尝试：使用 DeepSeek API');
      aiResponse = await callAI(messages, { 
        temperature: 0.7, 
        maxTokens: 3500,
        preferredProvider: 'DeepSeek'
      });

      // 清理 AI 返回的内容
      let cleanedResponse = aiResponse.trim();
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      cleanedResponse = cleanedResponse.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      // 尝试解析
      result = parseAIJSON(cleanedResponse);
      
      // 验证数据完整性
      if (result && result.categories && Array.isArray(result.categories) && result.categories.length > 0) {
        console.log('✅ DeepSeek返回数据完整，解析成功');
      } else {
        console.warn('⚠️ DeepSeek返回数据也不完整');
        console.log('DeepSeek返回内容前500字符:', cleanedResponse.substring(0, 500));
        result = null;
      }
    } catch (error) {
      console.error('❌ DeepSeek调用也失败:', error.message);
      result = null;
    }
  }
  
  // 如果两个AI都失败，返回默认结构
  if (!result || !result.categories) {
    console.error('❌ 所有AI都返回了不完整的数据，使用默认结构');
    
    result = {
      overallSummary: '分析数据格式异常，请重新分析',
      totalRecords: notes.length,
      dateRange: '近7天',
      categories: [
        {
          id: 'study',
          name: '📚 学习成长',
          color: '#667eea',
          percentage: 0,
          count: 0,
          summary: '暂无数据',
          activities: [],
          insight: '请重新触发分析'
        }
      ],
      highlights: [],
      weeklyTrend: {
        mostActiveDay: '未知',
        mostActiveCategory: '未知',
        suggestion: '数据异常，请重新分析'
      }
    };
  }

  // 数据验证和修复
  if (!Array.isArray(result.categories)) {
    result.categories = [];
  }
  
  // 确保每个 category 都有必需的字段
  result.categories = result.categories.map(cat => ({
    id: cat.id || 'unknown',
    name: cat.name || '未知类别',
    color: cat.color || '#999999',
    percentage: typeof cat.percentage === 'number' ? cat.percentage : 0,
    count: typeof cat.count === 'number' ? cat.count : 0,
    summary: cat.summary || '',
    activities: Array.isArray(cat.activities) ? cat.activities : [],
    insight: cat.insight || ''
  }));
  
  // 确保 highlights 是数组
  if (!Array.isArray(result.highlights)) {
    result.highlights = [];
  }

  return {
    summary: result.overallSummary || '分析完成',
    keyPoints: result.highlights ? result.highlights.map(h => h.content || h.title || '') : [],
    suggestions: result.weeklyTrend ? [result.weeklyTrend.suggestion || ''] : [],
    activitySummary: result.overallSummary || '分析完成',
    activityCategories: result.categories || [],
    recentHighlights: result.highlights || [],
    weeklyTrend: result.weeklyTrend || null,
    totalRecords: result.totalRecords || notes.length,
    dateRange: result.dateRange || '近7天'
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

