/**
 * 薄弱词汇分析服务
 * 分析用户的薄弱词汇并提供强化练习
 */

const { pool } = require('../config/database');

class WeakWordAnalyzer {
  /**
   * 获取用户薄弱词汇
   * @param {number} userId - 用户ID
   * @param {number} limit - 限制数量
   * @returns {Array} 薄弱词汇列表
   */
  static async getWeakWords(userId, limit = 50) {
    try {
      // 薄弱词汇定义：错误次数多、难度因子低、最近答错的
      const [words] = await pool.execute(`
        SELECT 
          w.id, w.word, w.phonetic, w.translation, w.meaning, w.example,
          wm.easiness_factor, wm.repetition, wm.correct_count, wm.wrong_count,
          wm.error_type, wm.last_quality,
          ROUND(wm.wrong_count / GREATEST(wm.correct_count + wm.wrong_count, 1) * 100) as error_rate
        FROM word_mastery wm
        JOIN words w ON wm.word_id = w.id
        WHERE wm.user_id = ? 
          AND (wm.wrong_count > 0 OR wm.easiness_factor < 2.0 OR wm.last_quality < 3)
        ORDER BY 
          wm.wrong_count DESC,
          wm.easiness_factor ASC,
          wm.last_quality ASC
        LIMIT ?
      `, [userId, limit]);

      return words;
    } catch (error) {
      console.error('获取薄弱词汇失败:', error);
      return [];
    }
  }

  /**
   * 获取薄弱词汇统计
   * @param {number} userId - 用户ID
   */
  static async getWeakWordStats(userId) {
    try {
      // 总薄弱词数
      const [totalWeak] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? AND (wrong_count > 0 OR easiness_factor < 2.0)
      `, [userId]);

      // 按错误类型分类
      const [byErrorType] = await pool.execute(`
        SELECT 
          COALESCE(error_type, 'unknown') as error_type,
          COUNT(*) as count
        FROM word_mastery
        WHERE user_id = ? AND wrong_count > 0
        GROUP BY error_type
      `, [userId]);

      // 高错误率词汇（错误率>50%）
      const [highErrorRate] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? 
          AND (correct_count + wrong_count) >= 2
          AND wrong_count / (correct_count + wrong_count) > 0.5
      `, [userId]);

      // 最近一周新增薄弱词
      const [recentWeak] = await pool.execute(`
        SELECT COUNT(*) as count FROM word_mastery
        WHERE user_id = ? 
          AND wrong_count > 0
          AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `, [userId]);

      return {
        totalWeakWords: totalWeak[0]?.count || 0,
        highErrorRateWords: highErrorRate[0]?.count || 0,
        recentWeakWords: recentWeak[0]?.count || 0,
        byErrorType: byErrorType.reduce((acc, item) => {
          acc[item.error_type] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('获取薄弱词汇统计失败:', error);
      return {
        totalWeakWords: 0,
        highErrorRateWords: 0,
        recentWeakWords: 0,
        byErrorType: {}
      };
    }
  }

  /**
   * 生成强化练习题目
   * @param {number} userId - 用户ID
   * @param {number} count - 题目数量
   */
  static async generatePractice(userId, count = 10) {
    try {
      // 获取薄弱词汇
      const weakWords = await this.getWeakWords(userId, count * 2);
      
      if (weakWords.length === 0) {
        return { questions: [], message: '暂无薄弱词汇，继续保持！' };
      }

      // 获取干扰项
      const [allWords] = await pool.execute(`
        SELECT word, translation, meaning FROM words
        ORDER BY RAND()
        LIMIT 100
      `);

      const questions = [];
      const usedWords = new Set();

      for (let i = 0; i < Math.min(count, weakWords.length); i++) {
        const word = weakWords[i];
        if (usedWords.has(word.word)) continue;
        usedWords.add(word.word);

        // 选择3个干扰项
        const distractors = allWords
          .filter(w => w.word !== word.word && !usedWords.has(w.word + '_d'))
          .slice(0, 3);

        if (distractors.length < 3) continue;

        distractors.forEach(d => usedWords.add(d.word + '_d'));

        const options = [
          { word: word.word, meaning: word.translation || word.meaning },
          ...distractors.map(d => ({ word: d.word, meaning: d.translation || d.meaning }))
        ].sort(() => Math.random() - 0.5);

        questions.push({
          id: i + 1,
          word: word.word,
          phonetic: word.phonetic,
          correctAnswer: word.translation || word.meaning,
          options,
          errorRate: word.error_rate,
          wrongCount: word.wrong_count
        });
      }

      return { questions };
    } catch (error) {
      console.error('生成强化练习失败:', error);
      return { questions: [], error: error.message };
    }
  }

  /**
   * 标记错误类型
   * @param {number} userId - 用户ID
   * @param {number} wordId - 单词ID
   * @param {string} errorType - 错误类型 (spelling/meaning/usage)
   */
  static async markErrorType(userId, wordId, errorType) {
    try {
      await pool.execute(`
        UPDATE word_mastery 
        SET error_type = ?
        WHERE user_id = ? AND word_id = ?
      `, [errorType, userId, wordId]);

      return { success: true };
    } catch (error) {
      console.error('标记错误类型失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WeakWordAnalyzer;
