const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateAISummary, extractStudyData } = require('../services/summaryGenerator');
const { createTask, TaskType } = require('../services/aiTaskManager');

const router = express.Router();

// 初始化学习进度和总结相关表
async function initSummaryTables() {
  try {
    // 学习进度记录表（各科目）
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS study_progress (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        subject ENUM('english', 'math', 'politics', 'major') NOT NULL,
        date DATE NOT NULL,
        study_time INT DEFAULT 0,
        exercises_done INT DEFAULT 0,
        chapters_done VARCHAR(255),
        notes_count INT DEFAULT 0,
        error_count INT DEFAULT 0,
        custom_data JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_subject_date (user_id, subject, date)
      )
    `);

    // 每日总结表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        auto_summary TEXT,
        user_notes TEXT,
        ai_suggestions TEXT,
        mood ENUM('great', 'good', 'normal', 'tired', 'bad') DEFAULT 'normal',
        tomorrow_plan TEXT,
        total_study_time INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (user_id, date)
      )
    `);

    // 提醒设置表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reminder_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        reminder_enabled TINYINT DEFAULT 1,
        reminder_time TIME DEFAULT '20:00:00',
        email VARCHAR(255),
        subscribe_template_id VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ 学习进度和总结表初始化完成');
  } catch (error) {
    console.error('初始化总结表失败:', error);
  }
}

// 导出初始化函数供外部调用
router.initSummaryTables = initSummaryTables;

// ==================== 学习进度接口 ====================

// 获取今日各科目学习进度
router.get('/progress/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    // 获取各科目进度
    const [progress] = await pool.execute(`
      SELECT * FROM study_progress 
      WHERE user_id = ? AND date = ?
    `, [userId, today]);

    // 获取英语自动统计数据
    const [englishStats] = await pool.execute(`
      SELECT * FROM user_english_stats 
      WHERE user_id = ? AND date = ?
    `, [userId, today]);

    // 获取单词学习数据
    const [wordStats] = await pool.execute(`
      SELECT COUNT(*) as today_words FROM user_word_records 
      WHERE user_id = ? AND DATE(last_learned_at) = ?
    `, [userId, today]);

    const progressMap = {};
    progress.forEach(p => {
      progressMap[p.subject] = p;
    });

    // 合并英语自动数据
    const englishAuto = englishStats[0] || {};
    if (!progressMap.english) {
      progressMap.english = { subject: 'english', study_time: 0 };
    }
    progressMap.english.auto_data = {
      words_learned: wordStats[0]?.today_words || 0,
      reading_count: englishAuto.reading_count || 0,
      translation_count: englishAuto.translation_count || 0,
      quiz_count: englishAuto.quiz_count || 0
    };

    res.json({
      success: true,
      data: {
        english: progressMap.english || { subject: 'english', study_time: 0 },
        math: progressMap.math || { subject: 'math', study_time: 0 },
        politics: progressMap.politics || { subject: 'politics', study_time: 0 },
        major: progressMap.major || { subject: 'major', study_time: 0 }
      }
    });
  } catch (error) {
    console.error('获取进度失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 更新科目学习进度
router.post('/progress/update', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subject, studyTime, exercisesDone, chaptersDone, notesCount, errorCount, customData } = req.body;
    const today = new Date().toISOString().split('T')[0];

    await pool.execute(`
      INSERT INTO study_progress (user_id, subject, date, study_time, exercises_done, chapters_done, notes_count, error_count, custom_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        study_time = COALESCE(?, study_time),
        exercises_done = COALESCE(?, exercises_done),
        chapters_done = COALESCE(?, chapters_done),
        notes_count = COALESCE(?, notes_count),
        error_count = COALESCE(?, error_count),
        custom_data = COALESCE(?, custom_data)
    `, [
      userId, subject, today, studyTime || 0, exercisesDone || 0, chaptersDone || '', notesCount || 0, errorCount || 0, JSON.stringify(customData || {}),
      studyTime, exercisesDone, chaptersDone, notesCount, errorCount, JSON.stringify(customData || {})
    ]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新进度失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 获取累计学习进度统计
router.get('/progress/total', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [stats] = await pool.execute(`
      SELECT 
        subject,
        SUM(study_time) as total_time,
        SUM(exercises_done) as total_exercises,
        SUM(notes_count) as total_notes,
        COUNT(DISTINCT date) as study_days
      FROM study_progress
      WHERE user_id = ?
      GROUP BY subject
    `, [userId]);

    // 获取英语累计数据
    const [englishTotal] = await pool.execute(`
      SELECT 
        COALESCE(SUM(reading_count), 0) as total_reading,
        COALESCE(SUM(translation_count), 0) as total_translation,
        COALESCE(SUM(quiz_count), 0) as total_quiz
      FROM user_english_stats WHERE user_id = ?
    `, [userId]);

    const [wordTotal] = await pool.execute(`
      SELECT COUNT(*) as total_words FROM user_word_records WHERE user_id = ?
    `, [userId]);

    const result = {
      english: { total_time: 0, total_exercises: 0, study_days: 0 },
      math: { total_time: 0, total_exercises: 0, study_days: 0 },
      politics: { total_time: 0, total_exercises: 0, study_days: 0 },
      major: { total_time: 0, total_exercises: 0, study_days: 0 }
    };

    stats.forEach(s => {
      result[s.subject] = {
        total_time: s.total_time || 0,
        total_exercises: s.total_exercises || 0,
        total_notes: s.total_notes || 0,
        study_days: s.study_days || 0
      };
    });

    result.english.auto_data = {
      total_words: wordTotal[0]?.total_words || 0,
      total_reading: englishTotal[0]?.total_reading || 0,
      total_translation: englishTotal[0]?.total_translation || 0,
      total_quiz: englishTotal[0]?.total_quiz || 0
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取累计进度失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ==================== 每日总结接口 ====================

// 获取今日总结（含AI自动生成部分）
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // 获取已保存的总结
    const [summaries] = await pool.execute(`
      SELECT * FROM daily_summaries WHERE user_id = ? AND date = ?
    `, [userId, date]);

    // 获取今日学习数据用于自动总结
    const [progress] = await pool.execute(`
      SELECT * FROM study_progress WHERE user_id = ? AND date = ?
    `, [userId, date]);

    const [englishStats] = await pool.execute(`
      SELECT * FROM user_english_stats WHERE user_id = ? AND date = ?
    `, [userId, date]);

    const [wordStats] = await pool.execute(`
      SELECT COUNT(*) as count FROM user_word_records 
      WHERE user_id = ? AND DATE(learned_at) = ?
    `, [userId, date]);

    const autoData = {
      progress: progress,
      english: englishStats[0] || {},
      words: wordStats[0]?.count || 0
    };

    res.json({
      success: true,
      data: {
        summary: summaries[0] || null,
        autoData: autoData
      }
    });
  } catch (error) {
    console.error('获取总结失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 生成AI总结（异步轮询模式）
router.post('/daily/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userNotes, mood, tomorrowPlan } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // 创建异步任务
    const taskId = createTask(TaskType.SUMMARY_GENERATE, userId, async () => {
      // 先尝试从用户输入中提取学习数据
      let extractedData = null;
      if (userNotes && userNotes.length >= 10) {
        extractedData = await extractStudyData(userNotes);
        
        // 如果提取到数据，保存到数据库
        if (extractedData) {
          for (const subject of ['math', 'politics', 'major']) {
            const data = extractedData[subject];
            if (data && (data.time || data.exercises || data.notes)) {
              await pool.execute(`
                INSERT INTO study_progress (user_id, subject, date, study_time, exercises_done, chapters_done, notes_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                  study_time = study_time + ?,
                  exercises_done = exercises_done + ?,
                  chapters_done = COALESCE(?, chapters_done),
                  notes_count = notes_count + ?
              `, [
                userId, subject, today, 
                data.time || 0, data.exercises || 0, data.chapters || '', data.notes || 0,
                data.time || 0, data.exercises || 0, data.chapters || null, data.notes || 0
              ]);
            }
          }
        }
      }

      // 收集今日所有学习数据
      const [progress] = await pool.execute(`
        SELECT * FROM study_progress WHERE user_id = ? AND date = ?
      `, [userId, today]);

      const [englishStats] = await pool.execute(`
        SELECT * FROM user_english_stats WHERE user_id = ? AND date = ?
      `, [userId, today]);

      const [wordStats] = await pool.execute(`
        SELECT COUNT(*) as count FROM user_word_records 
        WHERE user_id = ? AND DATE(learned_at) = ?
      `, [userId, today]);

      const studyData = {
        progress,
        english: englishStats[0] || {},
        words: wordStats[0]?.count || 0,
        userNotes,
        mood,
        extractedData
      };

      // 调用AI生成总结
      const aiResult = await generateAISummary(studyData);

      // 计算总学习时长
      let totalTime = 0;
      progress.forEach(p => { totalTime += p.study_time || 0; });

      // 保存总结
      await pool.execute(`
        INSERT INTO daily_summaries (user_id, date, auto_summary, user_notes, ai_suggestions, mood, tomorrow_plan, total_study_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          auto_summary = ?, user_notes = ?, ai_suggestions = ?, mood = ?, tomorrow_plan = ?, total_study_time = ?
      `, [
        userId, today, aiResult.summary, userNotes, aiResult.suggestions, mood, tomorrowPlan, totalTime,
        aiResult.summary, userNotes, aiResult.suggestions, mood, tomorrowPlan, totalTime
      ]);

      return {
        autoSummary: aiResult.summary,
        suggestions: aiResult.suggestions,
        encouragement: aiResult.encouragement,
        totalStudyTime: totalTime,
        extractedData: aiResult.extractedData
      };
    });

    res.json({ success: true, data: { taskId, status: 'processing' } });
  } catch (error) {
    console.error('生成总结失败:', error);
    res.status(500).json({ success: false, message: '生成失败' });
  }
});

// 保存用户总结
router.post('/daily/save', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userNotes, mood, tomorrowPlan } = req.body;
    const today = new Date().toISOString().split('T')[0];

    await pool.execute(`
      INSERT INTO daily_summaries (user_id, date, user_notes, mood, tomorrow_plan)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE user_notes = ?, mood = ?, tomorrow_plan = ?
    `, [userId, today, userNotes, mood, tomorrowPlan, userNotes, mood, tomorrowPlan]);

    res.json({ success: true, message: '保存成功' });
  } catch (error) {
    console.error('保存总结失败:', error);
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 获取历史总结列表
router.get('/daily/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 30;

    const [summaries] = await pool.execute(`
      SELECT * FROM daily_summaries 
      WHERE user_id = ? 
      ORDER BY date DESC 
      LIMIT ?
    `, [userId, limit]);

    res.json({ success: true, data: summaries });
  } catch (error) {
    console.error('获取历史总结失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ==================== 提醒设置接口 ====================

// 获取提醒设置
router.get('/reminder', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [settings] = await pool.execute(`
      SELECT * FROM reminder_settings WHERE user_id = ?
    `, [userId]);

    res.json({
      success: true,
      data: settings[0] || { reminder_enabled: true, reminder_time: '20:00:00' }
    });
  } catch (error) {
    console.error('获取提醒设置失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 更新提醒设置
router.post('/reminder', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderEnabled, reminderTime, email } = req.body;

    await pool.execute(`
      INSERT INTO reminder_settings (user_id, reminder_enabled, reminder_time, email)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE reminder_enabled = ?, reminder_time = ?, email = ?
    `, [userId, reminderEnabled ? 1 : 0, reminderTime, email, reminderEnabled ? 1 : 0, reminderTime, email]);

    res.json({ success: true, message: '设置成功' });
  } catch (error) {
    console.error('更新提醒设置失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 订阅消息（微信小程序）
router.post('/reminder/subscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { templateId } = req.body;

    await pool.execute(`
      INSERT INTO reminder_settings (user_id, subscribe_template_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE subscribe_template_id = ?
    `, [userId, templateId, templateId]);

    res.json({ success: true, message: '订阅成功' });
  } catch (error) {
    console.error('订阅失败:', error);
    res.status(500).json({ success: false, message: '订阅失败' });
  }
});

module.exports = router;
