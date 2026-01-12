const { pool } = require('../config/database');

class GlobalStatsService {

  /**
   * 获取全局行为总览数据
   * @param {number} userId 
   */
  static async getOverviewStats(userId) {
    try {
      const [proportions, timePattern, trends, correlation] = await Promise.all([
        this.getCategoryProportions(userId),
        this.getTimePattern(userId),
        this.getMonthlyTrends(userId),
        this.getBehaviorCorrelation(userId)
      ]);

      return {
        proportions, // 维度1：占比
        timePattern, // 维度2：时段模式 (桑基图数据)
        trends,      // 维度3：30天趋势
        correlation  // 维度4：关联度
      };
    } catch (error) {
      console.error('❌ 获取全局统计失败:', error);
      return null;
    }
  }

  /**
   * 1. 总行为占比 (基于记录数)
   */
  static async getCategoryProportions(userId) {
    const [rows] = await pool.execute(`
      SELECT category, COUNT(*) as count 
      FROM ai_notes 
      WHERE user_id = ? 
      GROUP BY category
    `, [userId]);

    // 映射标准分类名
    const map = {
      'study': '学习成长',
      'entertainment': '休闲娱乐',
      'thinking': '思考感悟',
      'daily': '日常生活'
    };

    let total = 0;
    const items = rows.map(r => {
      total += r.count;
      return {
        id: r.category || 'other',
        name: map[r.category] || '其他',
        value: r.count
      };
    });

    return {
      total,
      items: items.map(i => ({
        ...i,
        percent: total > 0 ? Math.round(i.value / total * 100) : 0
      }))
    };
  }

  /**
   * 2. 日/周行为模式 (时段 -> 分类)
   * 简化版桑基图数据：统计 Morning/Afternoon/Evening 各时段的主导活动
   */
  static async getTimePattern(userId) {
    const [rows] = await pool.execute(`
      SELECT 
        CASE 
          WHEN HOUR(created_at) BETWEEN 5 AND 11 THEN 'morning'
          WHEN HOUR(created_at) BETWEEN 12 AND 17 THEN 'afternoon'
          WHEN HOUR(created_at) BETWEEN 18 AND 23 THEN 'evening'
          ELSE 'lateNight'
        END as time_slot,
        category,
        COUNT(*) as count
      FROM ai_notes
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY time_slot, category
    `, [userId]);

    // 格式化为前端易用的结构
    // result: { morning: { study: 5, entertainment: 2 }, ... }
    const result = { morning: {}, afternoon: {}, evening: {}, lateNight: {} };
    
    rows.forEach(r => {
      if (result[r.time_slot]) {
        result[r.time_slot][r.category || 'other'] = r.count;
      }
    });

    return result;
  }

  /**
   * 3. 近30天趋势 (多折线图)
   */
  static async getMonthlyTrends(userId) {
    const [rows] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        category,
        COUNT(*) as count
      FROM ai_notes
      WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(created_at), category
      ORDER BY date ASC
    `, [userId]);

    // 整理数据
    const dates = [];
    const now = new Date();
    // 生成近30天日期
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const series = {
      study: Array(30).fill(0),
      entertainment: Array(30).fill(0),
      thinking: Array(30).fill(0)
    };

    rows.forEach(r => {
      const dateStr = typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0];
      const dateIdx = dates.indexOf(dateStr);
      if (dateIdx !== -1 && series[r.category]) {
        series[r.category][dateIdx] = r.count;
      }
    });

    return {
      dates: dates.map(d => d.slice(5).replace('-', '/')), // MM/DD
      series
    };
  }

  /**
   * 4. 行为关联度 (关联热力图)
   * 统计 A -> B 的次数
   */
  static async getBehaviorCorrelation(userId) {
    // 尝试使用窗口函数 LEAD (MySQL 8.0+)
    // 如果不支持，可能需要回退逻辑，但先假设支持
    try {
      const [rows] = await pool.execute(`
        WITH OrderedNotes AS (
          SELECT 
            category, 
            created_at,
            LEAD(category) OVER (ORDER BY created_at) as next_category,
            LEAD(created_at) OVER (ORDER BY created_at) as next_time
          FROM ai_notes
          WHERE user_id = ?
        )
        SELECT 
          category as source,
          next_category as target,
          COUNT(*) as weight
        FROM OrderedNotes
        WHERE next_category IS NOT NULL 
          AND TIMESTAMPDIFF(HOUR, created_at, next_time) < 4 -- 4小时内算关联
        GROUP BY category, next_category
      `, [userId]);

      // 转换为矩阵
      // source -> { target: weight }
      const matrix = {};
      const categories = ['study', 'entertainment', 'thinking', 'daily'];
      
      categories.forEach(c => matrix[c] = {});

      rows.forEach(r => {
        if (!r.source || !r.target) return;
        if (!matrix[r.source]) matrix[r.source] = {};
        matrix[r.source][r.target] = r.weight;
      });

      return matrix;
    } catch (e) {
      console.warn('关联分析SQL执行失败(可能MySQL版本过低):', e.message);
      return {};
    }
  }
}

module.exports = GlobalStatsService;


