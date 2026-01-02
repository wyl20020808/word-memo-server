const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取用户统计信息
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];
    
    // 获取今日学习统计
    const [todayStats] = await pool.execute(
      'SELECT learned_count FROM user_stats WHERE user_id = ? AND date = ?',
      [userId, today]
    );
    
    // 获取总学习统计
    const [totalStats] = await pool.execute(
      'SELECT SUM(learned_count) as total_learned FROM user_stats WHERE user_id = ?',
      [userId]
    );
    
    // 获取收藏数量
    const [collectionCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_collections WHERE user_id = ?',
      [userId]
    );
    
    // 获取最近7天学习统计
    const [weekStats] = await pool.execute(`
      SELECT date, learned_count 
      FROM user_stats 
      WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ORDER BY date DESC
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        todayLearned: todayStats[0]?.learned_count || 0,
        totalLearned: totalStats[0]?.total_learned || 0,
        collectionCount: collectionCount[0]?.count || 0,
        weekStats: weekStats
      }
    });
    
  } catch (error) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户统计失败'
    });
  }
});

// 获取学习历史
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;
    
    const [history] = await pool.execute(`
      SELECT 
        w.word,
        w.translation,
        uwr.rating,
        uwr.learned_count,
        uwr.last_learned_at
      FROM user_word_records uwr
      JOIN words w ON uwr.word_id = w.id
      WHERE uwr.user_id = ?
      ORDER BY uwr.last_learned_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('获取学习历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取学习历史失败'
    });
  }
});

module.exports = router;