/**
 * SM-2 间隔重复算法 - 复习调度服务
 * 基于SuperMemo 2算法实现智能复习调度
 */

const { pool } = require('../config/database');

class ReviewScheduler {
  /**
   * SM-2算法核心：计算下次复习日期
   * @param {Object} mastery - 当前掌握度数据
   * @param {number} quality - 用户评分 (0-5)
   * @returns {Object} 更新后的掌握度数据
   */
  static calculateNextReview(mastery, quality) {
    let { easiness_factor, repetition, interval_days } = mastery;
    
    // 确保初始值
    easiness_factor = easiness_factor || 2.5;
    repetition = repetition || 0;
    interval_days = interval_days || 1;
    
    if (quality < 3) {
      // 评分低于3，重新开始学习
      repetition = 0;
      interval_days = 1;
    } else {
      // 更新难度因子 (EF)
      // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
      const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
      easiness_factor = Math.max(1.3, easiness_factor + delta);
      
      // 计算新间隔
      if (repetition === 0) {
        interval_days = 1;
      } else if (repetition === 1) {
        interval_days = 6;
      } else {
        interval_days = Math.round(interval_days * easiness_factor);
      }
      
      // 限制最大间隔为180天
      interval_days = Math.min(interval_days, 180);
      
      repetition++;
    }
    
    // 计算下次复习日期
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval_days);
    
    return {
      easiness_factor: Math.round(easiness_factor * 100) / 100,
      repetition,
      interval_days,
      next_review_date: nextDate.toISOString().split('T')[0],
      last_quality: quality
    };
  }

  /**
   * 将用户评分(1-5星)转换为SM-2评分(0-5)
   * @param {number} rating - 用户评分 (1-5)
   * @param {boolean} isCorrect - 是否答对（选择题模式）
   * @returns {number} SM-2评分 (0-5)
   */
  static convertRatingToQuality(rating, isCorrect = true) {
    if (!isCorrect) {
      return 0; // 答错
    }
    
    // 1星->1, 2星->2, 3星->3, 4星->4, 5星->5
    return Math.max(0, Math.min(5, rating));
  }

  /**
   * 获取今日需要复习的单词
   * @param {number} userId - 用户ID
   * @param {number} limit - 限制数量
   * @returns {Array} 需要复习的单词列表
   */
  static async getTodayReviewWords(userId, limit = 50) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const [words] = await pool.execute(`
        SELECT 
          w.id, w.word, w.phonetic, w.translation, w.meaning, 
          w.example, w.example_trans, w.category,
          wm.easiness_factor, wm.repetition, wm.interval_days,
          wm.correct_count, wm.wrong_count, wm.last_quality,
          wm.next_review_date
        FROM word_mastery wm
        JOIN words w ON wm.word_id = w.id
        WHERE wm.user_id = ? AND wm.next_review_date <= ?
        ORDER BY wm.next_review_date ASC, wm.easiness_factor ASC
        LIMIT ?
      `, [userId, today, limit]);
      
      return words;
    } catch (error) {
      console.error('获取复习单词失败:', error);
      return [];
    }
  }

  /**
   * 获取今日待复习单词数量
   * @param {number} userId - 用户ID
   * @returns {number} 待复习数量
   */
  static async getTodayReviewCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const [rows] = await pool.execute(`
        SELECT COUNT(*) as count
        FROM word_mastery
        WHERE user_id = ? AND next_review_date <= ?
      `, [userId, today]);
      
      return rows[0]?.count || 0;
    } catch (error) {
      console.error('获取复习数量失败:', error);
      return 0;
    }
  }

  /**
   * 更新单词掌握度
   * @param {number} userId - 用户ID
   * @param {number} wordId - 单词ID
   * @param {number} quality - SM-2评分 (0-5)
   * @param {string} errorType - 错误类型 (可选)
   * @returns {Object} 更新结果
   */
  static async updateMastery(userId, wordId, quality, errorType = null) {
    try {
      // 获取当前掌握度
      const [existing] = await pool.execute(`
        SELECT * FROM word_mastery WHERE user_id = ? AND word_id = ?
      `, [userId, wordId]);
      
      let mastery;
      if (existing.length > 0) {
        mastery = existing[0];
      } else {
        // 新单词，初始化
        mastery = {
          easiness_factor: 2.5,
          repetition: 0,
          interval_days: 1
        };
      }
      
      // 计算新的复习参数
      const newMastery = this.calculateNextReview(mastery, quality);
      
      // 更新正确/错误计数
      const isCorrect = quality >= 3;
      const correctDelta = isCorrect ? 1 : 0;
      const wrongDelta = isCorrect ? 0 : 1;
      
      // 插入或更新
      await pool.execute(`
        INSERT INTO word_mastery 
          (user_id, word_id, easiness_factor, repetition, interval_days, 
           next_review_date, last_quality, correct_count, wrong_count, error_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          easiness_factor = VALUES(easiness_factor),
          repetition = VALUES(repetition),
          interval_days = VALUES(interval_days),
          next_review_date = VALUES(next_review_date),
          last_quality = VALUES(last_quality),
          correct_count = correct_count + ?,
          wrong_count = wrong_count + ?,
          error_type = COALESCE(VALUES(error_type), error_type),
          updated_at = NOW()
      `, [
        userId, wordId, 
        newMastery.easiness_factor, newMastery.repetition, newMastery.interval_days,
        newMastery.next_review_date, newMastery.last_quality,
        correctDelta, wrongDelta, errorType,
        correctDelta, wrongDelta
      ]);
      
      // 记录学习日志
      await pool.execute(`
        INSERT INTO learning_logs (user_id, word_id, action, quality, is_correct, error_type)
        VALUES (?, ?, 'review', ?, ?, ?)
      `, [userId, wordId, quality, isCorrect ? 1 : 0, errorType]);
      
      return {
        success: true,
        mastery: newMastery,
        isCorrect
      };
    } catch (error) {
      console.error('更新掌握度失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户复习统计
   * @param {number} userId - 用户ID
   * @returns {Object} 统计数据
   */
  static async getReviewStats(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 今日待复习
      const [todayReview] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? AND next_review_date <= ?
      `, [userId, today]);
      
      // 今日已复习
      const [todayCompleted] = await pool.execute(`
        SELECT COUNT(*) as count FROM learning_logs
        WHERE user_id = ? AND action = 'review' AND DATE(created_at) = ?
      `, [userId, today]);
      
      // 总掌握单词数（repetition >= 3 且 easiness_factor >= 2.0）
      const [mastered] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? AND repetition >= 3 AND easiness_factor >= 2.0
      `, [userId]);
      
      // 学习中的单词数
      const [learning] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? AND repetition < 3
      `, [userId]);
      
      // 平均难度因子
      const [avgEF] = await pool.execute(`
        SELECT AVG(easiness_factor) as avg_ef FROM word_mastery
        WHERE user_id = ?
      `, [userId]);
      
      return {
        todayPending: todayReview[0]?.count || 0,
        todayCompleted: todayCompleted[0]?.count || 0,
        totalMastered: mastered[0]?.count || 0,
        totalLearning: learning[0]?.count || 0,
        averageEasiness: Math.round((avgEF[0]?.avg_ef || 2.5) * 100) / 100
      };
    } catch (error) {
      console.error('获取复习统计失败:', error);
      return {
        todayPending: 0,
        todayCompleted: 0,
        totalMastered: 0,
        totalLearning: 0,
        averageEasiness: 2.5
      };
    }
  }

  /**
   * 初始化新学单词的掌握度记录
   * @param {number} userId - 用户ID
   * @param {number} wordId - 单词ID
   * @param {number} initialQuality - 初始评分
   */
  static async initWordMastery(userId, wordId, initialQuality = 3) {
    const mastery = this.calculateNextReview({
      easiness_factor: 2.5,
      repetition: 0,
      interval_days: 1
    }, initialQuality);
    
    try {
      await pool.execute(`
        INSERT IGNORE INTO word_mastery 
          (user_id, word_id, easiness_factor, repetition, interval_days, 
           next_review_date, last_quality, correct_count, wrong_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId, wordId,
        mastery.easiness_factor, mastery.repetition, mastery.interval_days,
        mastery.next_review_date, mastery.last_quality,
        initialQuality >= 3 ? 1 : 0,
        initialQuality < 3 ? 1 : 0
      ]);
      
      return { success: true, mastery };
    } catch (error) {
      console.error('初始化掌握度失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ReviewScheduler;
