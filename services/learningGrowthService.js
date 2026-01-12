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
   * 聚合所有学习记录：
   * - 背单词 (learning_logs)
   * - 计算机 (user_major_records)
   * - 数学/政治/专业课 (user_study_stats)
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

      // 3. 考研其他科目时长 (数学、政治、专业课 - 从user_study_stats表获取)
      // 注意：这里假设 user_study_stats 按日记录，需要聚合
      const [pgStats] = await pool.execute(`
        SELECT 
          subject,
          SUM(study_time) as total_minutes
        FROM user_study_stats
        WHERE user_id = ?
          AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND subject IN ('math', 'politics', 'major')
        GROUP BY subject
      `, [userId]);

      const wordTime = Math.round((wordStats[0]?.total_seconds || 0) / 60);
      const majorTime = Math.round((majorStats[0]?.total_seconds || 0) / 60); // 计算机刷题
      
      let mathTime = 0;
      let politicsTime = 0;
      let pgMajorTime = 0;

      pgStats.forEach(row => {
        if (row.subject === 'math') mathTime = Number(row.total_minutes);
        if (row.subject === 'politics') politicsTime = Number(row.total_minutes);
        if (row.subject === 'major') pgMajorTime = Number(row.total_minutes);
      });

      // 合并计算机刷题时长到专业课，或单独列出
      // 这里为了清晰，将"计算机知识"(主要来自刷题) 和 "考研专业课"(来自手动记录) 分开或合并
      // 策略：合并显示为"专业课"，或者分开。这里选择分开展示更详细
      
      const items = [
        { name: '背单词', value: wordTime, color: '#55efc4' },
        { name: '计算机刷题', value: majorTime, color: '#a29bfe' },
        { name: '数学', value: mathTime, color: '#74b9ff' },
        { name: '政治', value: politicsTime, color: '#ff7675' },
        { name: '专业课(学习)', value: pgMajorTime, color: '#fd79a8' }
      ];

      const total = items.reduce((sum, item) => sum + item.value, 0);

      return {
        chartType: 'ring',
        totalMinutes: total,
        items: items.filter(i => i.value > 0).map(i => ({
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
      // 1. 背单词
      // 2. 计算机刷题
      // 3. 考研学习记录 (user_study_stats是按天记录的，没有具体时分秒，只能取当天0点或默认时间? 
      //    或者如果有 updated_at 可以用。这里为了热力图准确，暂不计入按天统计的记录到"时段热力"中，
      //    只计入到"频率"中(每天算一次活跃))
      
      const [logs] = await pool.execute(`
        SELECT created_at as active_time, 'word' as type FROM learning_logs 
        WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        UNION ALL
        SELECT answered_at as active_time, 'major' as type FROM user_major_records
        WHERE user_id = ? AND answered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, [userId, userId]);

      // 获取考研打卡记录 (用于补充频率)
      const [studyStats] = await pool.execute(`
        SELECT date, subject FROM user_study_stats
        WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `, [userId]);

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

      // 处理精确时间记录 (logs) -> 贡献热力 + 频率
      logs.forEach(log => {
        const date = new Date(log.active_time);
        const hour = date.getHours();
        
        // 热力图数据 (近30天都算)
        hourHeatmap[hour]++;

        // 频率数据 (只算近7天)
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays < 7 && diffDays >= 0) {
          weekFreq[6 - diffDays]++;
        }
      });

      // 处理按天记录 (studyStats) -> 只贡献频率
      // 注意：这里简单将每天的一条记录算作一次活跃，如果同一天有多条(多科目)，会增加频率
      studyStats.forEach(stat => {
        // stat.date 可能是字符串或Date
        const date = new Date(stat.date);
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        // 考研记录不贡献到"时段热力"，因为没有具体时间
        
        // 频率数据 (只算近7天)
        if (diffDays < 7 && diffDays >= 0) {
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
      // 1. 背单词
      // 2. 计算机刷题
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

      // 3. 考研学习 (user_study_stats, 单位 minutes -> seconds)
      const [pgLogs] = await pool.execute(`
        SELECT 
          date,
          SUM(study_time) * 60 as seconds
        FROM user_study_stats
        WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY date
      `, [userId]);

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

      // 填充精确记录数据
      logs.forEach(row => {
        let dStr = row.date;
        if (row.date instanceof Date) {
          dStr = row.date.toISOString().split('T')[0];
        } else if (typeof row.date === 'string') {
          dStr = row.date.split('T')[0];
        }
        
        if (dayMap.hasOwnProperty(dStr)) {
          dayMap[dStr] += Number(row.seconds);
        }
      });

      // 填充考研记录数据
      pgLogs.forEach(row => {
        let dStr = row.date;
        if (row.date instanceof Date) {
          dStr = row.date.toISOString().split('T')[0];
        } else if (typeof row.date === 'string') {
          dStr = row.date.split('T')[0];
        }

        if (dayMap.hasOwnProperty(dStr)) {
          dayMap[dStr] += Number(row.seconds);
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

