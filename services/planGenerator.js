/**
 * 学习计划生成服务
 * 根据用户目标和水平生成个性化学习计划
 */

const { pool } = require('../config/database');

class PlanGenerator {
  /**
   * 生成学习计划
   * @param {Object} settings - 用户设置
   * @returns {Object} 学习计划
   */
  static generatePlan(settings) {
    const { 
      exam_date, 
      target_words = 5000, 
      vocabulary_level = 'intermediate',
      daily_goal = 50
    } = settings;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 如果没有设置考试日期，默认3个月后
    let examDate;
    if (exam_date) {
      examDate = new Date(exam_date);
    } else {
      examDate = new Date(today);
      examDate.setMonth(examDate.getMonth() + 3);
    }

    const daysRemaining = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return { 
        error: '考试日期已过，请重新设置',
        success: false 
      };
    }

    // 根据水平调整学习效率
    const levelMultiplier = {
      beginner: 0.7,    // 初学者学习效率较低
      intermediate: 1.0, // 中级正常
      advanced: 1.3      // 高级可以学更多
    };

    const multiplier = levelMultiplier[vocabulary_level] || 1.0;

    // 计算每日学习量
    let dailyNewWords = Math.ceil(target_words / daysRemaining);
    dailyNewWords = Math.round(dailyNewWords * multiplier);
    
    // 限制每日新词数量（20-100）
    dailyNewWords = Math.max(20, Math.min(100, dailyNewWords));

    // 复习量约为新词的50%
    const dailyReviewWords = Math.round(dailyNewWords * 0.5);

    // 预估每日学习时间（分钟）
    // 假设每个新词2分钟，复习词0.5分钟
    const estimatedDailyMinutes = dailyNewWords * 2 + dailyReviewWords * 0.5;

    // 生成阶段计划
    const phases = this.generatePhases(daysRemaining, target_words, vocabulary_level);

    return {
      success: true,
      plan: {
        startDate: today.toISOString().split('T')[0],
        endDate: examDate.toISOString().split('T')[0],
        totalDays: daysRemaining,
        targetWords: target_words,
        dailyNewWords,
        dailyReviewWords,
        estimatedDailyMinutes: Math.round(estimatedDailyMinutes),
        vocabularyLevel: vocabulary_level,
        phases
      },
      suggestions: this.generateSuggestions(vocabulary_level, daysRemaining, dailyNewWords)
    };
  }

  /**
   * 生成学习阶段
   */
  static generatePhases(totalDays, targetWords, level) {
    const phases = [];

    if (totalDays <= 30) {
      // 短期计划：单阶段冲刺
      phases.push({
        name: '冲刺阶段',
        days: totalDays,
        focus: '高频词汇 + 核心词汇',
        dailyGoal: Math.ceil(targetWords / totalDays)
      });
    } else if (totalDays <= 90) {
      // 中期计划：两阶段
      const phase1Days = Math.floor(totalDays * 0.6);
      const phase2Days = totalDays - phase1Days;

      phases.push({
        name: '基础积累',
        days: phase1Days,
        focus: '核心词汇 + 高频词汇',
        dailyGoal: Math.ceil(targetWords * 0.7 / phase1Days)
      });
      phases.push({
        name: '强化冲刺',
        days: phase2Days,
        focus: '难词攻克 + 全面复习',
        dailyGoal: Math.ceil(targetWords * 0.3 / phase2Days)
      });
    } else {
      // 长期计划：三阶段
      const phase1Days = Math.floor(totalDays * 0.4);
      const phase2Days = Math.floor(totalDays * 0.35);
      const phase3Days = totalDays - phase1Days - phase2Days;

      phases.push({
        name: '基础夯实',
        days: phase1Days,
        focus: '基础词汇 + 核心词汇',
        dailyGoal: Math.ceil(targetWords * 0.5 / phase1Days)
      });
      phases.push({
        name: '能力提升',
        days: phase2Days,
        focus: '中高级词汇 + 词组搭配',
        dailyGoal: Math.ceil(targetWords * 0.35 / phase2Days)
      });
      phases.push({
        name: '冲刺巩固',
        days: phase3Days,
        focus: '难词攻克 + 全面复习',
        dailyGoal: Math.ceil(targetWords * 0.15 / phase3Days)
      });
    }

    return phases;
  }

  /**
   * 生成学习建议
   */
  static generateSuggestions(level, days, dailyWords) {
    const suggestions = [];

    // 根据水平给建议
    if (level === 'beginner') {
      suggestions.push('建议先从基础词汇开始，打好基础');
      suggestions.push('每个单词多看几遍例句，理解用法');
    } else if (level === 'intermediate') {
      suggestions.push('注意词汇的多种含义和用法');
      suggestions.push('尝试用新学的单词造句');
    } else {
      suggestions.push('关注词汇的高级用法和搭配');
      suggestions.push('多阅读英文材料，在语境中巩固');
    }

    // 根据时间给建议
    if (days < 30) {
      suggestions.push('时间紧迫，建议集中精力攻克高频词');
      suggestions.push('每天保证固定学习时间，不要中断');
    } else if (days < 90) {
      suggestions.push('时间适中，可以稳步推进');
      suggestions.push('建议每周安排一次总复习');
    } else {
      suggestions.push('时间充裕，可以深入学习每个单词');
      suggestions.push('建议结合阅读和听力练习');
    }

    // 根据每日量给建议
    if (dailyWords > 80) {
      suggestions.push('每日任务量较大，注意劳逸结合');
    }

    return suggestions;
  }

  /**
   * 保存学习计划
   */
  static async savePlan(userId, plan) {
    try {
      // 先将旧计划设为非活跃
      await pool.execute(`
        UPDATE learning_plans SET is_active = 0 WHERE user_id = ?
      `, [userId]);

      // 插入新计划
      await pool.execute(`
        INSERT INTO learning_plans 
          (user_id, plan_name, start_date, end_date, target_words, 
           daily_new_words, daily_review_words, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        userId,
        '我的学习计划',
        plan.startDate,
        plan.endDate,
        plan.targetWords,
        plan.dailyNewWords,
        plan.dailyReviewWords
      ]);

      // 更新用户设置
      await pool.execute(`
        INSERT INTO user_settings (user_id, daily_goal, exam_date, target_words)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          daily_goal = VALUES(daily_goal),
          exam_date = VALUES(exam_date),
          target_words = VALUES(target_words)
      `, [userId, plan.dailyNewWords, plan.endDate, plan.targetWords]);

      return { success: true };
    } catch (error) {
      console.error('保存学习计划失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户当前计划
   */
  static async getCurrentPlan(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM learning_plans 
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC 
        LIMIT 1
      `, [userId]);

      if (rows.length > 0) {
        const plan = rows[0];
        
        // 计算进度
        const today = new Date();
        const startDate = new Date(plan.start_date);
        const endDate = new Date(plan.end_date);
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const passedDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));

        // 获取实际学习进度
        const [stats] = await pool.execute(`
          SELECT COUNT(DISTINCT word_id) as learned_count
          FROM word_mastery
          WHERE user_id = ?
        `, [userId]);

        const learnedCount = stats[0]?.learned_count || 0;
        const progressPercent = Math.min(100, Math.round((learnedCount / plan.target_words) * 100));

        return {
          ...plan,
          totalDays,
          passedDays,
          remainingDays,
          learnedCount,
          progressPercent,
          isOnTrack: learnedCount >= (passedDays * plan.daily_new_words * 0.8)
        };
      }
      return null;
    } catch (error) {
      console.error('获取学习计划失败:', error);
      return null;
    }
  }

  /**
   * 获取用户设置
   */
  static async getUserSettings(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM user_settings WHERE user_id = ?
      `, [userId]);

      if (rows.length > 0) {
        return rows[0];
      }

      // 返回默认设置
      return {
        vocabulary_level: 'intermediate',
        daily_goal: 50,
        exam_date: null,
        target_words: 5000,
        reminder_enabled: 1
      };
    } catch (error) {
      console.error('获取用户设置失败:', error);
      return null;
    }
  }

  /**
   * 更新用户设置
   */
  static async updateUserSettings(userId, settings) {
    try {
      const { vocabulary_level, daily_goal, exam_date, target_words, reminder_enabled, reminder_time } = settings;

      await pool.execute(`
        INSERT INTO user_settings 
          (user_id, vocabulary_level, daily_goal, exam_date, target_words, reminder_enabled, reminder_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          vocabulary_level = COALESCE(VALUES(vocabulary_level), vocabulary_level),
          daily_goal = COALESCE(VALUES(daily_goal), daily_goal),
          exam_date = COALESCE(VALUES(exam_date), exam_date),
          target_words = COALESCE(VALUES(target_words), target_words),
          reminder_enabled = COALESCE(VALUES(reminder_enabled), reminder_enabled),
          reminder_time = COALESCE(VALUES(reminder_time), reminder_time)
      `, [userId, vocabulary_level, daily_goal, exam_date, target_words, reminder_enabled, reminder_time]);

      return { success: true };
    } catch (error) {
      console.error('更新用户设置失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = PlanGenerator;
