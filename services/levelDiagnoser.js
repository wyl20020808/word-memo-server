/**
 * AI水平诊断服务
 * 通过诊断测试评估用户词汇水平
 */

const { pool } = require('../config/database');

class LevelDiagnoser {
  /**
   * 生成诊断题目
   * @param {number} count - 题目数量
   * @returns {Array} 诊断题目列表
   */
  static async generateQuestions(count = 20) {
    try {
      // 从不同难度级别抽取题目
      // 简单30% + 中等40% + 困难30%
      const easyCount = Math.floor(count * 0.3);
      const mediumCount = Math.floor(count * 0.4);
      const hardCount = count - easyCount - mediumCount;

      // 获取不同难度的单词
      const [easyWords] = await pool.execute(`
        SELECT id, word, phonetic, translation, meaning 
        FROM words 
        WHERE difficulty <= 1 OR difficulty IS NULL
        ORDER BY RAND() 
        LIMIT ?
      `, [easyCount * 4]); // 每题需要4个选项

      const [mediumWords] = await pool.execute(`
        SELECT id, word, phonetic, translation, meaning 
        FROM words 
        WHERE difficulty = 2 OR (difficulty IS NULL AND LENGTH(word) > 6)
        ORDER BY RAND() 
        LIMIT ?
      `, [mediumCount * 4]);

      const [hardWords] = await pool.execute(`
        SELECT id, word, phonetic, translation, meaning 
        FROM words 
        WHERE difficulty >= 3 OR (difficulty IS NULL AND LENGTH(word) > 8)
        ORDER BY RAND() 
        LIMIT ?
      `, [hardCount * 4]);

      // 如果某个难度单词不够，从全部单词中补充
      let allWords = [...easyWords, ...mediumWords, ...hardWords];
      
      if (allWords.length < count * 4) {
        const [moreWords] = await pool.execute(`
          SELECT id, word, phonetic, translation, meaning 
          FROM words 
          ORDER BY RAND() 
          LIMIT ?
        `, [count * 4]);
        allWords = moreWords;
      }

      // 生成选择题
      const questions = [];
      const usedWords = new Set();

      for (let i = 0; i < count && allWords.length >= 4; i++) {
        // 选择一个正确答案
        let correctIndex = -1;
        for (let j = 0; j < allWords.length; j++) {
          if (!usedWords.has(allWords[j].word)) {
            correctIndex = j;
            break;
          }
        }

        if (correctIndex === -1) break;

        const correctWord = allWords[correctIndex];
        usedWords.add(correctWord.word);

        // 选择3个干扰项
        const options = [correctWord];
        for (let j = 0; j < allWords.length && options.length < 4; j++) {
          if (j !== correctIndex && !usedWords.has(allWords[j].word + '_option')) {
            options.push(allWords[j]);
            usedWords.add(allWords[j].word + '_option');
          }
        }

        if (options.length < 4) continue;

        // 打乱选项顺序
        const shuffledOptions = options.sort(() => Math.random() - 0.5);

        // 确定难度
        let difficulty = 'easy';
        if (i >= easyCount && i < easyCount + mediumCount) {
          difficulty = 'medium';
        } else if (i >= easyCount + mediumCount) {
          difficulty = 'hard';
        }

        questions.push({
          id: i + 1,
          word: correctWord.word,
          phonetic: correctWord.phonetic,
          correctAnswer: correctWord.translation || correctWord.meaning,
          options: shuffledOptions.map(w => ({
            word: w.word,
            meaning: w.translation || w.meaning
          })),
          difficulty
        });
      }

      return questions.sort(() => Math.random() - 0.5);
    } catch (error) {
      console.error('生成诊断题目失败:', error);
      return [];
    }
  }

  /**
   * 计算诊断结果
   * @param {Array} answers - 用户答案 [{questionId, selectedWord, isCorrect, difficulty}]
   * @returns {Object} 诊断结果
   */
  static calculateResult(answers) {
    const total = answers.length;
    const correct = answers.filter(a => a.isCorrect).length;
    const accuracy = total > 0 ? correct / total : 0;

    // 按难度统计
    const byDifficulty = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 }
    };

    answers.forEach(a => {
      const diff = a.difficulty || 'medium';
      if (byDifficulty[diff]) {
        byDifficulty[diff].total++;
        if (a.isCorrect) byDifficulty[diff].correct++;
      }
    });

    // 计算各难度正确率
    const easyAccuracy = byDifficulty.easy.total > 0 
      ? byDifficulty.easy.correct / byDifficulty.easy.total : 0;
    const mediumAccuracy = byDifficulty.medium.total > 0 
      ? byDifficulty.medium.correct / byDifficulty.medium.total : 0;
    const hardAccuracy = byDifficulty.hard.total > 0 
      ? byDifficulty.hard.correct / byDifficulty.hard.total : 0;

    // 综合评估词汇水平
    let level, estimatedVocabulary, description;

    if (accuracy >= 0.85 && hardAccuracy >= 0.6) {
      level = 'advanced';
      estimatedVocabulary = 6000 + Math.floor(hardAccuracy * 2000);
      description = '词汇量优秀，可以挑战高难度词汇';
    } else if (accuracy >= 0.6 && mediumAccuracy >= 0.5) {
      level = 'intermediate';
      estimatedVocabulary = 3000 + Math.floor(accuracy * 3000);
      description = '词汇基础扎实，继续积累中高级词汇';
    } else {
      level = 'beginner';
      estimatedVocabulary = Math.floor(accuracy * 3000);
      description = '建议从基础词汇开始，打好基础';
    }

    // 分析薄弱领域
    const weakAreas = [];
    if (easyAccuracy < 0.7) weakAreas.push('基础词汇');
    if (mediumAccuracy < 0.5) weakAreas.push('中级词汇');
    if (hardAccuracy < 0.3) weakAreas.push('高级词汇');

    return {
      totalQuestions: total,
      correctCount: correct,
      accuracy: Math.round(accuracy * 100),
      level,
      estimatedVocabulary,
      description,
      weakAreas,
      byDifficulty: {
        easy: { ...byDifficulty.easy, accuracy: Math.round(easyAccuracy * 100) },
        medium: { ...byDifficulty.medium, accuracy: Math.round(mediumAccuracy * 100) },
        hard: { ...byDifficulty.hard, accuracy: Math.round(hardAccuracy * 100) }
      }
    };
  }

  /**
   * 保存诊断结果
   * @param {number} userId - 用户ID
   * @param {Object} result - 诊断结果
   * @param {Array} answers - 详细答题记录
   */
  static async saveResult(userId, result, answers) {
    try {
      await pool.execute(`
        INSERT INTO diagnosis_results 
          (user_id, total_questions, correct_count, accuracy, vocabulary_level, 
           estimated_vocabulary, weak_areas, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        result.totalQuestions,
        result.correctCount,
        result.accuracy,
        result.level,
        result.estimatedVocabulary,
        JSON.stringify(result.weakAreas),
        JSON.stringify({ answers, byDifficulty: result.byDifficulty })
      ]);

      // 更新用户设置中的词汇水平
      await pool.execute(`
        INSERT INTO user_settings (user_id, vocabulary_level)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE vocabulary_level = VALUES(vocabulary_level)
      `, [userId, result.level]);

      return { success: true };
    } catch (error) {
      console.error('保存诊断结果失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户最近的诊断结果
   * @param {number} userId - 用户ID
   */
  static async getLatestResult(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM diagnosis_results 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [userId]);

      if (rows.length > 0) {
        const result = rows[0];
        result.weak_areas = JSON.parse(result.weak_areas || '[]');
        result.details = JSON.parse(result.details || '{}');
        return result;
      }
      return null;
    } catch (error) {
      console.error('获取诊断结果失败:', error);
      return null;
    }
  }
}

module.exports = LevelDiagnoser;
