const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取单词列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category = '四六级', limit = 50, offset = 0 } = req.query;
    const userId = req.user.userId;
    
    // 获取单词列表，包含用户的学习记录
    const [words] = await pool.execute(`
      SELECT 
        w.*,
        COALESCE(uwr.rating, 0) as user_rating,
        COALESCE(uwr.learned_count, 0) as learned_count,
        CASE WHEN uc.id IS NOT NULL THEN 1 ELSE 0 END as is_collected
      FROM words w
      LEFT JOIN user_word_records uwr ON w.id = uwr.word_id AND uwr.user_id = ?
      LEFT JOIN user_collections uc ON w.id = uc.word_id AND uc.user_id = ?
      WHERE w.category = ?
      ORDER BY w.id
      LIMIT ? OFFSET ?
    `, [userId, userId, category, parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: words
    });
    
  } catch (error) {
    console.error('获取单词列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取单词列表失败'
    });
  }
});

// 记录学习进度
router.post('/learn', authenticateToken, async (req, res) => {
  try {
    const { wordId, rating } = req.body;
    const userId = req.user.userId;
    
    // 插入或更新学习记录
    await pool.execute(`
      INSERT INTO user_word_records (user_id, word_id, rating, learned_count, last_learned_at)
      VALUES (?, ?, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE
        rating = VALUES(rating),
        learned_count = learned_count + 1,
        last_learned_at = NOW()
    `, [userId, wordId, rating]);
    
    // 更新今日统计
    const today = new Date().toISOString().split('T')[0];
    await pool.execute(`
      INSERT INTO user_stats (user_id, date, learned_count)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE
        learned_count = learned_count + 1
    `, [userId, today]);
    
    res.json({
      success: true,
      message: '学习记录保存成功'
    });
    
  } catch (error) {
    console.error('保存学习记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存学习记录失败'
    });
  }
});

// 收藏/取消收藏单词
router.post('/collect', authenticateToken, async (req, res) => {
  try {
    const { wordId, isCollect } = req.body;
    const userId = req.user.userId;
    
    if (isCollect) {
      // 添加收藏
      await pool.execute(
        'INSERT IGNORE INTO user_collections (user_id, word_id) VALUES (?, ?)',
        [userId, wordId]
      );
    } else {
      // 取消收藏
      await pool.execute(
        'DELETE FROM user_collections WHERE user_id = ? AND word_id = ?',
        [userId, wordId]
      );
    }
    
    res.json({
      success: true,
      message: isCollect ? '收藏成功' : '取消收藏成功'
    });
    
  } catch (error) {
    console.error('收藏操作失败:', error);
    res.status(500).json({
      success: false,
      message: '收藏操作失败'
    });
  }
});

// 获取收藏的单词
router.get('/collections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [words] = await pool.execute(`
      SELECT 
        w.*,
        COALESCE(uwr.rating, 0) as user_rating,
        COALESCE(uwr.learned_count, 0) as learned_count,
        1 as is_collected,
        uc.created_at as collected_at
      FROM user_collections uc
      JOIN words w ON uc.word_id = w.id
      LEFT JOIN user_word_records uwr ON w.id = uwr.word_id AND uwr.user_id = ?
      WHERE uc.user_id = ?
      ORDER BY uc.created_at DESC
    `, [userId, userId]);
    
    res.json({
      success: true,
      data: words
    });
    
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收藏列表失败'
    });
  }
});

module.exports = router;