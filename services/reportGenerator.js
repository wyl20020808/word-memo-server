/**
 * 学习报告生成服务
 * 生成用户学习数据分析报告
 */

const { pool } = require('../config/database');

class ReportGenerator {
  /**
   * 获取学习概览
   * @param {number} userId - 用户ID
   */
  static async getOverview(userId) {
    try {
      // 总学习数据
      const [total] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT word_id) as total_words,
          SUM(correct_count) as total_correct,
          SUM(wrong_count) as total_wrong
        FROM word_mastery
        WHERE user_id = ?
      `, [userId]);

      // 已掌握单词数（repetition >= 3 且 easiness_factor >= 2.0）
      const [mastered] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? AND repetition >= 3 AND easiness_factor >= 2.0
      `, [userId]);

      // 学习中单词数
      const [learning] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? AND repetition < 3
      `, [userId]);

      // 今日学习
      const today = new Date().toISOString().split('T')[0];
      const [todayStats] = await pool.execute(`
        SELECT COUNT(*) as count FROM learning_logs
        WHERE user_id = ? AND DATE(created_at) = ?
      `, [userId, today]);

      // 连续学习天数
      const streakDays = await this.calculateStreak(userId);

      // 计算正确率
      const totalCorrect = total[0]?.total_correct || 0;
      const totalWrong = total[0]?.total_wrong || 0;
      const totalAttempts = totalCorrect + totalWrong;
      const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

      return {
        totalWords: total[0]?.total_words || 0,
        masteredWords: mastered[0]?.count || 0,
        learningWords: learning[0]?.count || 0,
        todayLearned: todayStats[0]?.count || 0,
        streakDays,
        accuracy,
        totalCorrect,
        totalWrong
      };
    } catch (error) {
      console.error('获取学习概览失败:', error);
      return {
        totalWords: 0,
        masteredWords: 0,
        learningWords: 0,
        todayLearned: 0,
        streakDays: 0,
        accuracy: 0
      };
    }
  }

  /**
   * 计算连续学习天数
   */
  static async calculateStreak(userId) {
    try {
      const [days] = await pool.execute(`
        SELECT DISTINCT DATE(created_at) as learn_date
        FROM learning_logs
        WHERE user_id = ?
        ORDER BY learn_date DESC
        LIMIT 30
      `, [userId]);

      if (days.length === 0) return 0;

      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < days.length; i++) {
        const learnDate = new Date(days[i].learn_date);
        learnDate.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        
        if (learnDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else if (i === 0 && learnDate.getTime() === expectedDate.getTime() - 86400000) {
          // 今天还没学，但昨天学了
          continue;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.error('计算连续天数失败:', error);
      return 0;
    }
  }

  /**
   * 获取学习趋势（最近7天/30天）
   * @param {number} userId - 用户ID
   * @param {number} days - 天数
   */
  static async getTrend(userId, days = 7) {
    try {
      const [trend] = await pool.execute(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
          SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as wrong
        FROM learning_logs
        WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [userId, days]);

      // 填充缺失的日期
      const result = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = trend.find(t => t.date === dateStr);
        result.push({
          date: dateStr,
          count: dayData?.count || 0,
          correct: dayData?.correct || 0,
          wrong: dayData?.wrong || 0,
          accuracy: dayData ? Math.round((dayData.correct / dayData.count) * 100) : 0
        });
      }

      return result;
    } catch (error) {
      console.error('获取学习趋势失败:', error);
      return [];
    }
  }

  /**
   * 获取词汇掌握分布
   * @param {number} userId - 用户ID
   */
  static async getMasteryDistribution(userId) {
    try {
      const [distribution] = await pool.execute(`
        SELECT 
          CASE 
            WHEN easiness_factor >= 2.5 THEN 'excellent'
            WHEN easiness_factor >= 2.0 THEN 'good'
            WHEN easiness_factor >= 1.5 THEN 'fair'
            ELSE 'weak'
          END as level,
          COUNT(*) as count
        FROM word_mastery
        WHERE user_id = ?
        GROUP BY level
      `, [userId]);

      const result = {
        excellent: 0,
        good: 0,
        fair: 0,
        weak: 0
      };

      distribution.forEach(d => {
        result[d.level] = d.count;
      });

      return result;
    } catch (error) {
      console.error('获取掌握分布失败:', error);
      return { excellent: 0, good: 0, fair: 0, weak: 0 };
    }
  }

  /**
   * 生成AI学习建议
   * @param {number} userId - 用户ID
   */
  static async generateSuggestions(userId) {
    try {
      const overview = await this.getOverview(userId);
      const trend = await this.getTrend(userId, 7);
      const distribution = await this.getMasteryDistribution(userId);

      const suggestions = [];

      // 根据正确率给建议
      if (overview.accuracy < 60) {
        suggestions.push({
          type: 'warning',
          icon: '⚠️',
          title: '正确率偏低',
          content: '建议放慢学习速度，每个单词多看几遍，确保理解后再进入下一个'
        });
      } else if (overview.accuracy >= 90) {
        suggestions.push({
          type: 'success',
          icon: '🎉',
          title: '正确率优秀',
          content: '可以适当增加每日学习量，挑战更多新词汇'
        });
      }

      // 根据连续天数给建议
      if (overview.streakDays === 0) {
        suggestions.push({
          type: 'info',
          icon: '📅',
          title: '开始新的学习',
          content: '今天是新的开始，坚持每天学习，养成好习惯'
        });
      } else if (overview.streakDays >= 7) {
        suggestions.push({
          type: 'success',
          icon: '🔥',
          title: `连续学习${overview.streakDays}天`,
          content: '太棒了！保持这个势头，你的词汇量会快速增长'
        });
      }

      // 根据薄弱词汇给建议
      if (distribution.weak > 10) {
        suggestions.push({
          type: 'warning',
          icon: '📝',
          title: '薄弱词汇较多',
          content: `有${distribution.weak}个薄弱词汇需要强化，建议去薄弱词汇页面专项练习`
        });
      }

      // 根据学习趋势给建议
      const recentDays = trend.slice(-3);
      const avgCount = recentDays.reduce((sum, d) => sum + d.count, 0) / 3;
      if (avgCount < 10) {
        suggestions.push({
          type: 'info',
          icon: '💪',
          title: '学习量可以增加',
          content: '最近几天学习量较少，建议每天至少学习20个单词'
        });
      }

      // 默认建议
      if (suggestions.length === 0) {
        suggestions.push({
          type: 'success',
          icon: '👍',
          title: '学习状态良好',
          content: '继续保持当前的学习节奏，稳步提升词汇量'
        });
      }

      return suggestions;
    } catch (error) {
      console.error('生成学习建议失败:', error);
      return [{
        type: 'info',
        icon: '💡',
        title: '开始学习',
        content: '每天坚持学习，积少成多'
      }];
    }
  }

  /**
   * 获取完整学习报告
   * @param {number} userId - 用户ID
   */
  static async getFullReport(userId) {
    try {
      const [overview, trend7, trend30, distribution, suggestions] = await Promise.all([
        this.getOverview(userId),
        this.getTrend(userId, 7),
        this.getTrend(userId, 30),
        this.getMasteryDistribution(userId),
        this.generateSuggestions(userId)
      ]);

      return {
        overview,
        trend: {
          week: trend7,
          month: trend30
        },
        distribution,
        suggestions
      };
    } catch (error) {
      console.error('获取完整报告失败:', error);
      return null;
    }
  }
}

module.exports = ReportGenerator;
