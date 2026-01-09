/**
 * 学习成长数据聚合服务
 * 负责统计：
 * 1. 时长占比（背单词 vs 计算机知识）
 * 2. 学习频率 & 时段分布
 * 3. 学习完成度
 * 4. 近期学习趋势
 */
const { pool } = require('../config/database');

class LearningGrowthService {
  
  /**
   * 获取综合学习成长数据
   * @param {number} userId 
   */
  static async getGrowthStats(userId) {
    try {
      // 并行获取四类数据
      const [distribution, frequency, completion, trend] = await Promise.all([
        this.getDurationDistribution(userId),
        this.getFrequencyAndHeatmap(userId),
        this.getCompletionStatus(userId),
        this.getStudyTrend(userId)
      ]);

      return {
        distribution, // 饼图：时长占比
        frequency,    // 柱状图+热力图：频率与时段
        completion,   // 进度条/漏斗：完成度
        trend         // 折线图：趋势
      };
    } catch (error) {
      console.error('❌ 获取学习成长数据失败:', error);
      return null;
    }
  }

  /**
   * 1. 细分内容时长占比 (单位：分钟)
   * 背单词：learning_logs (time_spent求和，若无则按每词10秒估算)
   * 计算机：user_major_records (time_spent求和)
   */
  static async getDurationDistribution(userId) {
    try {
      // 1. 背单词时长 (近30天)
      const [wordStats] = await pool.execute(`
        SELECT 
          SUM(CASE WHEN time_spent > 0 THEN time_spent ELSE 10 END) as total_seconds
        FROM learning_logs 
        WHERE user_id = ? 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, [userId]);

      // 2. 计算机刷题时长 (近30天)
      const [majorStats] = await pool.execute(`
        SELECT 
          SUM(time_spent) as total_seconds
        FROM user_major_records
        WHERE user_id = ?
          AND answered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, [userId]);

      const wordTime = Math.round((wordStats[0]?.total_seconds || 0) / 60);
      const majorTime = Math.round((majorStats[0]?.total_seconds || 0) / 60);
      const total = wordTime + majorTime;

      return {
        chartType: 'ring',
        totalMinutes: total,
        items: [
          { name: '背单词', value: wordTime, color: '#55efc4' }, // 青绿色
          { name: '计算机知识', value: majorTime, color: '#a29bfe' } // 紫色
        ].filter(i => i.value > 0).map(i => ({
          ...i,
          percent: total > 0 ? Math.round(i.value / total * 100) : 0
        }))
      };
    } catch (e) {
      console.error('获取时长占比失败:', e);
      return { items: [] };
    }
  }

  /**
   * 2. 学习频率 & 时段分布
   * 频率：本周每日学习次数
   * 时段：全天24小时活跃度热力
   */
  static async getFrequencyAndHeatmap(userId) {
    try {
      // 聚合所有学习行为的时间戳 (近7天用于频率，近30天用于时段热力)
      const [logs] = await pool.execute(`
        SELECT created_at as active_time, 'word' as type FROM learning_logs 
        WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        UNION ALL
        SELECT answered_at as active_time, 'major' as type FROM user_major_records
        WHERE user_id = ? AND answered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, [userId, userId]);

      // 处理周频率 (近7天)
      const now = new Date();
      const weekFreq = Array(7).fill(0);
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const weekLabels = []; // e.g. ["周一", "周二"...]

      // 构建近7天的标签和初始数据
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        weekLabels.push(days[d.getDay()]);
      }

      // 处理时段热力 (0-23点)
      const hourHeatmap = Array(24).fill(0);

      logs.forEach(log => {
        const date = new Date(log.active_time);
        const hour = date.getHours();
        
        // 热力图数据 (近30天都算)
        hourHeatmap[hour]++;

        // 频率数据 (只算近7天)
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays < 7 && diffDays >= 0) {
          // weekLabels是[6天前, ..., 今天]，对应 index = 6 - diffDays
          weekFreq[6 - diffDays]++;
        }
      });

      // 找到最活跃时段
      let maxHour = 0;
      let maxCount = 0;
      hourHeatmap.forEach((count, h) => {
        if (count > maxCount) {
          maxCount = count;
          maxHour = h;
        }
      });

      return {
        chartType: 'bar_heatmap',
        frequency: {
          labels: weekLabels,
          values: weekFreq
        },
        heatmap: {
          values: hourHeatmap, // [0, 0, ..., 15, 20, ...]
          peakHour: `${maxHour}:00 - ${maxHour+1}:00`
        }
      };
    } catch (e) {
      console.error('获取频率分布失败:', e);
      return {};
    }
  }

  /**
   * 3. 学习完成度
   * 背单词：已掌握/目标词数
   * 计算机：正确率
   */
  static async getCompletionStatus(userId) {
    try {
      // 单词进度
      // 获取用户设置的目标
      const [settings] = await pool.execute('SELECT target_words FROM user_settings WHERE user_id = ?', [userId]);
      const targetWords = settings[0]?.target_words || 5000;
      
      // 获取已掌握单词数 (rating >= 4)
      const [wordMastery] = await pool.execute(`
        SELECT COUNT(*) as count FROM user_word_records 
        WHERE user_id = ? AND rating >= 4
      `, [userId]);
      const masteredWords = wordMastery[0]?.count || 0;

      // 计算机正确率
      const [majorStats] = await pool.execute(`
        SELECT COUNT(*) as total, SUM(is_correct) as correct
        FROM user_major_records WHERE user_id = ?
      `, [userId]);
      
      const totalQs = majorStats[0]?.total || 0;
      const correctQs = majorStats[0]?.correct || 0;
      const accuracy = totalQs > 0 ? Math.round(correctQs / totalQs * 100) : 0;

      return {
        chartType: 'progress',
        items: [
          { 
            label: '单词掌握', 
            current: masteredWords, 
            total: targetWords, 
            percent: Math.min(100, Math.round(masteredWords / targetWords * 100)),
            color: '#55efc4'
          },
          { 
            label: '刷题正确率', 
            current: correctQs, 
            total: totalQs, 
            percent: accuracy,
            color: '#a29bfe',
            isRate: true // 标记显示为百分比而非 x/y
          }
        ]
      };
    } catch (e) {
      console.error('获取完成度失败:', e);
      return { items: [] };
    }
  }

  /**
   * 4. 学习趋势 (近7天时长变化)
   */
  static async getStudyTrend(userId) {
    try {
      // 获取近7天每一天的学习时长
      const [logs] = await pool.execute(`
        SELECT 
          DATE(created_at) as date, 
          SUM(CASE WHEN time_spent > 0 THEN time_spent ELSE 10 END) as seconds
        FROM learning_logs 
        WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)
        UNION ALL
        SELECT 
          DATE(answered_at) as date, 
          SUM(time_spent) as seconds
        FROM user_major_records
        WHERE user_id = ? AND answered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(answered_at)
      `, [userId, userId]);

      // 合并同一天的数据
      const dayMap = {};
      const now = new Date();
      const labels = [];
      const values = [];

      // 初始化近7天
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const label = `${d.getMonth() + 1}.${d.getDate()}`; // M.D
        
        dayMap[dateStr] = 0;
        labels.push(label);
        // 保存日期key以便匹配，最终只返回labels和values
      }

      // 填充数据
      logs.forEach(row => {
        // row.date可能是Date对象或字符串
        let dStr = row.date;
        if (row.date instanceof Date) {
          dStr = row.date.toISOString().split('T')[0];
        } else if (typeof row.date === 'string') {
          dStr = row.date.split('T')[0];
        }
        
        if (dayMap.hasOwnProperty(dStr)) {
          dayMap[dStr] += row.seconds;
        }
      });

      // 转换为分钟并生成数组
      const dateKeys = Object.keys(dayMap).sort();
      dateKeys.forEach(k => {
        values.push(Math.round(dayMap[k] / 60));
      });

      return {
        chartType: 'line',
        labels: labels,
        values: values, // 分钟
        totalRecent: values.reduce((a, b) => a + b, 0)
      };
    } catch (e) {
      console.error('获取学习趋势失败:', e);
      return { labels: [], values: [] };
    }
  }
}

module.exports = LearningGrowthService;

