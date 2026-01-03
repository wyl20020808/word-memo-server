/**
 * Words Router - 直接读取本地词汇文件
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 读取本地词汇文件
let WORD_LIST = [];
try {
  const wordsFile = path.join(__dirname, '../data/all-words.json');
  const content = fs.readFileSync(wordsFile, 'utf8');
  WORD_LIST = JSON.parse(content);
  console.log('Loaded ' + WORD_LIST.length + ' words from local file');
} catch (error) {
  console.error('Failed to load words file:', error.message);
}

// 根据单词名查找本地数据
function findWordInList(wordStr) {
  return WORD_LIST.find(w => w.word.toLowerCase() === wordStr.toLowerCase());
}

// 获取单词详情（优先本地文件，然后数据库）
async function getWordData(wordStr) {
  // 1. 先从本地文件查找
  const localWord = findWordInList(wordStr);
  if (localWord) {
    return {
      word: localWord.word,
      phonetic: localWord.phonetic || '',
      meaning: localWord.meaning || '',
      example: localWord.example || '',
      audio_url: ''
    };
  }
  
  // 2. 从数据库查找
  try {
    const [cached] = await pool.execute('SELECT * FROM words WHERE word = ?', [wordStr]);
    if (cached.length > 0) {
      return { ...cached[0] };
    }
  } catch (e) {
    console.log('DB query failed:', e.message);
  }
  
  // 3. 返回基本信息
  return {
    word: wordStr,
    phonetic: '',
    meaning: '暂无释义',
    example: '',
    audio_url: ''
  };
}

// 保存单词到数据库
async function saveWordToDB(wordData) {
  try {
    await pool.execute(
      'INSERT INTO words (word, phonetic, meaning, example, audio_url, category) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE phonetic = VALUES(phonetic), meaning = VALUES(meaning), example = VALUES(example)',
      [wordData.word, wordData.phonetic, wordData.meaning, wordData.example, wordData.audio_url || '', 'kaoyan']
    );
    const [result] = await pool.execute('SELECT id FROM words WHERE word = ?', [wordData.word]);
    return result.length > 0 ? result[0].id : null;
  } catch (e) {
    console.log('Save word failed:', e.message);
    return null;
  }
}

// 获取用户未学习的单词
router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const userId = req.user.userId;
    
    console.log('User ' + userId + ' requesting ' + limit + ' words');
    console.log('Total words in list: ' + WORD_LIST.length);
    
    // 获取用户已学习的单词
    const [learnedRecords] = await pool.execute(
      'SELECT w.word FROM user_word_records uwr JOIN words w ON uwr.word_id = w.id WHERE uwr.user_id = ?',
      [userId]
    );
    const learnedWords = new Set(learnedRecords.map(r => r.word.toLowerCase()));
    console.log('User learned: ' + learnedWords.size + ' words');
    
    // 过滤出未学习的单词
    const newWords = WORD_LIST.filter(w => !learnedWords.has(w.word.toLowerCase()));
    console.log('New words available: ' + newWords.length);
    
    if (newWords.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: WORD_LIST.length,
        learned: learnedWords.size,
        hasMore: false,
        message: '恭喜！你已学完所有单词！'
      });
    }
    
    // 取指定数量的新单词
    const wordsToReturn = newWords.slice(0, limit);
    console.log('Returning words:', wordsToReturn.slice(0, 5).map(w => w.word).join(', '));
    
    // 构建返回数据
    const result = wordsToReturn.map(w => ({
      word: w.word,
      phonetic: w.phonetic || '',
      meaning: w.meaning || '',
      translation: w.meaning || '',  // 前端使用translation字段
      example: w.example || '',
      audio_url: '',
      user_rating: 0,
      learned_count: 0,
      is_collected: 0
    }));
    
    res.json({
      success: true,
      data: result,
      total: WORD_LIST.length,
      learned: learnedWords.size,
      remaining: newWords.length,
      hasMore: newWords.length > limit
    });
    
  } catch (error) {
    console.error('Get words failed:', error);
    res.status(500).json({ success: false, message: 'Failed to get words' });
  }
});

// 记录学习进度
router.post('/learn', authenticateToken, async (req, res) => {
  try {
    const { word, rating } = req.body;
    const userId = req.user.userId;
    
    if (!word) {
      return res.status(400).json({ success: false, message: 'Word is required' });
    }
    
    // 获取单词数据
    const wordData = await getWordData(word);
    
    // 确保单词在数据库中
    let wordId = await saveWordToDB(wordData);
    if (!wordId) {
      const [existing] = await pool.execute('SELECT id FROM words WHERE word = ?', [word]);
      wordId = existing.length > 0 ? existing[0].id : null;
    }
    
    if (!wordId) {
      return res.status(400).json({ success: false, message: 'Failed to save word' });
    }
    
    // 记录学习
    await pool.execute(
      'INSERT INTO user_word_records (user_id, word_id, rating, learned_count, last_learned_at) VALUES (?, ?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE rating = VALUES(rating), learned_count = learned_count + 1, last_learned_at = NOW()',
      [userId, wordId, rating || 0]
    );
    
    // 更新今日统计
    const today = new Date().toISOString().split('T')[0];
    await pool.execute(
      'INSERT INTO user_stats (user_id, date, learned_count) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE learned_count = learned_count + 1',
      [userId, today]
    );
    
    res.json({ success: true, message: 'Saved' });
  } catch (error) {
    console.error('Learn failed:', error);
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// 收藏单词
router.post('/collect', authenticateToken, async (req, res) => {
  try {
    const { word, isCollect } = req.body;
    const userId = req.user.userId;
    
    if (!word) {
      return res.status(400).json({ success: false, message: 'Word is required' });
    }
    
    // 确保单词在数据库中
    const wordData = await getWordData(word);
    await saveWordToDB(wordData);
    
    const [wordRecord] = await pool.execute('SELECT id FROM words WHERE word = ?', [word]);
    if (wordRecord.length === 0) {
      return res.status(400).json({ success: false, message: 'Word not found' });
    }
    
    const wordId = wordRecord[0].id;
    
    if (isCollect) {
      await pool.execute('INSERT IGNORE INTO user_collections (user_id, word_id) VALUES (?, ?)', [userId, wordId]);
    } else {
      await pool.execute('DELETE FROM user_collections WHERE user_id = ? AND word_id = ?', [userId, wordId]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Collect failed:', error);
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// 获取收藏列表
router.get('/user/collections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [words] = await pool.execute(
      'SELECT w.*, COALESCE(uwr.rating, 0) as user_rating, COALESCE(uwr.learned_count, 0) as learned_count, 1 as is_collected FROM user_collections uc JOIN words w ON uc.word_id = w.id LEFT JOIN user_word_records uwr ON w.id = uwr.word_id AND uwr.user_id = ? WHERE uc.user_id = ? ORDER BY uc.created_at DESC',
      [userId, userId]
    );
    res.json({ success: true, data: words });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
