/**
 * Words Router - Smart Lazy Loading v2
 * 1. Get words user hasn't learned yet
 * 2. Fetch from external API, dedupe with learned words
 * 3. Cache new words to DB for all users
 */
const express = require('express');
const axios = require('axios');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let cachedWordList = null;
let cacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000;

async function fetchKaoyanWordList() {
  if (cachedWordList && (Date.now() - cacheTime < CACHE_DURATION)) {
    console.log('Using cached word list, count:', cachedWordList.length);
    return cachedWordList;
  }
  
  try {
    console.log('Fetching kaoyan word list from GitHub...');
    const response = await axios.get(
      'https://raw.githubusercontent.com/kajweb/dict/main/json/kaoyan.json',
      { timeout: 15000 }
    );
    
    if (response.data && Array.isArray(response.data)) {
      // 打印第一个元素看看格式
      console.log('First item format:', JSON.stringify(response.data[0]));
      
      // 根据实际格式提取单词
      cachedWordList = response.data.map(item => {
        if (typeof item === 'string') return item;
        if (item.word) return item.word;
        if (item.name) return item.name;
        if (item.headWord) return item.headWord;
        return String(item);
      }).filter(w => w && w.length > 0);
      
      cacheTime = Date.now();
      console.log('Got ' + cachedWordList.length + ' words');
      console.log('First 10 words:', cachedWordList.slice(0, 10).join(', '));
      return cachedWordList;
    }
  } catch (error) {
    console.log('Failed to fetch word list:', error.message);
  }
  
  console.log('Using backup words');
  return BACKUP_WORDS;
}

async function fetchWordFromAPI(word) {
  try {
    const response = await axios.get(
      'https://api.dictionaryapi.dev/api/v2/entries/en/' + word,
      { timeout: 10000 }
    );
    
    const data = response.data[0];
    let phonetic = data.phonetic || '';
    if (!phonetic && data.phonetics && data.phonetics.length > 0) {
      const found = data.phonetics.find(p => p.text);
      phonetic = found ? found.text : '';
    }
    
    let audioUrl = '';
    if (data.phonetics && data.phonetics.length > 0) {
      const found = data.phonetics.find(p => p.audio);
      audioUrl = found ? found.audio : '';
    }
    
    let meanings = [];
    let examples = [];
    if (data.meanings) {
      for (const meaning of data.meanings) {
        for (const def of meaning.definitions.slice(0, 2)) {
          meanings.push(meaning.partOfSpeech + '. ' + def.definition);
          if (def.example) examples.push(def.example);
        }
      }
    }
    
    return {
      word: word,
      phonetic: phonetic,
      meaning: meanings.slice(0, 3).join('\n') || 'No definition',
      example: examples.slice(0, 2).join('\n') || '',
      audio_url: audioUrl
    };
  } catch (error) {
    console.log('API fetch failed for: ' + word);
    return null;
  }
}

async function getWordWithCache(word) {
  try {
    // 1. 先查数据库缓存
    const [cached] = await pool.execute('SELECT * FROM words WHERE word = ?', [word]);
    if (cached.length > 0) {
      console.log('From cache: ' + word);
      return { ...cached[0] }; // 返回副本，避免引用问题
    }
    
    // 2. 从API获取
    const wordData = await fetchWordFromAPI(word);
    if (!wordData) {
      console.log('API failed for: ' + word + ', returning placeholder');
      // 返回新对象，避免引用问题
      return { 
        word: word, 
        phonetic: '', 
        meaning: 'No definition available', 
        example: '', 
        audio_url: '' 
      };
    }
    
    // 3. 存入数据库
    try {
      await pool.execute(
        'INSERT INTO words (word, phonetic, meaning, example, audio_url, category) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE phonetic = VALUES(phonetic), meaning = VALUES(meaning), example = VALUES(example), audio_url = VALUES(audio_url)',
        [wordData.word, wordData.phonetic, wordData.meaning, wordData.example, wordData.audio_url, 'kaoyan']
      );
      
      // 重新查询获取完整记录
      const [inserted] = await pool.execute('SELECT * FROM words WHERE word = ?', [word]);
      if (inserted.length > 0) {
        console.log('Cached to DB: ' + word);
        return { ...inserted[0] }; // 返回副本
      }
    } catch (dbError) {
      console.log('DB cache failed for: ' + word, dbError.message);
    }
    
    // 返回API数据的副本
    return { ...wordData };
    
  } catch (error) {
    console.error('Get word failed for: ' + word, error.message);
    // 返回新对象
    return { 
      word: word, 
      phonetic: '', 
      meaning: 'Error loading definition', 
      example: '', 
      audio_url: '' 
    };
  }
}

const BACKUP_WORDS = [
  'abandon', 'ability', 'able', 'abnormal', 'abroad', 'absence', 'absolute', 
  'absorb', 'abstract', 'abuse', 'academic', 'accelerate', 'accept', 'access',
  'accident', 'accommodate', 'accompany', 'accomplish', 'account', 'accurate',
  'achieve', 'acknowledge', 'acquire', 'action', 'active', 'actual', 'adapt',
  'addition', 'address', 'adequate', 'adjust', 'administration', 'admire',
  'admit', 'adopt', 'adult', 'advance', 'advantage', 'advertise', 'advice',
  'affair', 'affect', 'afford', 'afraid', 'agency', 'agent', 'aggressive',
  'agree', 'agriculture', 'ahead', 'aid', 'aim', 'aircraft', 'alarm',
  'alcohol', 'alive', 'allow', 'almost', 'alone', 'along', 'already',
  'alter', 'alternative', 'although', 'altogether', 'always', 'amateur',
  'amaze', 'ambition', 'among', 'amount', 'analyse', 'analysis', 'ancestor',
  'ancient', 'anger', 'angle', 'angry', 'animal', 'announce', 'annual',
  'another', 'answer', 'anticipate', 'anxiety', 'anxious', 'apart',
  'apartment', 'apologize', 'apparent', 'appeal', 'appear', 'appearance',
  'application', 'apply', 'appoint', 'appreciate', 'approach', 'appropriate',
  'approve', 'area', 'argue', 'argument', 'arise', 'arm', 'army', 'around'
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const userId = req.user.userId;
    
    console.log('User ' + userId + ' requesting ' + limit + ' new words');
    
    const [learnedRecords] = await pool.execute(
      'SELECT w.word FROM user_word_records uwr JOIN words w ON uwr.word_id = w.id WHERE uwr.user_id = ?',
      [userId]
    );
    const learnedWords = new Set(learnedRecords.map(r => r.word.toLowerCase()));
    console.log('User learned: ' + learnedWords.size + ' words');
    
    const allWords = await fetchKaoyanWordList();
    console.log('Total words in list: ' + allWords.length);
    
    const newWords = allWords.filter(w => !learnedWords.has(w.toLowerCase()));
    console.log('New words available: ' + newWords.length);
    
    if (newWords.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: allWords.length,
        learned: learnedWords.size,
        hasMore: false,
        message: 'All words learned!'
      });
    }
    
    const wordsToReturn = newWords.slice(0, limit);
    console.log('Words to return:', wordsToReturn.slice(0, 5).join(', ') + '...');
    
    // 批量获取单词详情（限制并发数为5）
    const wordsWithDetails = [];
    const batchSize = 5;
    for (let i = 0; i < wordsToReturn.length; i += batchSize) {
      const batch = wordsToReturn.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(word => getWordWithCache(word))
      );
      wordsWithDetails.push(...batchResults);
    }
    
    // 添加用户数据
    const finalWords = wordsWithDetails.map(wordData => ({
      ...wordData,
      user_rating: 0,
      learned_count: 0,
      is_collected: 0
    }));
    
    console.log('Returning ' + finalWords.length + ' words');
    
    res.json({
      success: true,
      data: finalWords,
      total: allWords.length,
      learned: learnedWords.size,
      remaining: newWords.length,
      hasMore: newWords.length > limit
    });
    
  } catch (error) {
    console.error('Get words failed:', error);
    res.status(500).json({ success: false, message: 'Failed to get words' });
  }
});

router.get('/:word', authenticateToken, async (req, res) => {
  try {
    const wordData = await getWordWithCache(req.params.word);
    res.json({ success: true, data: wordData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.post('/learn', authenticateToken, async (req, res) => {
  try {
    const { wordId, word, rating } = req.body;
    const userId = req.user.userId;
    
    let actualWordId = wordId;
    if (word && !wordId) {
      await getWordWithCache(word);
      const [wordRecord] = await pool.execute('SELECT id FROM words WHERE word = ?', [word]);
      if (wordRecord.length > 0) {
        actualWordId = wordRecord[0].id;
      }
    }
    
    if (!actualWordId) {
      return res.status(400).json({ success: false, message: 'Word not found' });
    }
    
    await pool.execute(
      'INSERT INTO user_word_records (user_id, word_id, rating, learned_count, last_learned_at) VALUES (?, ?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE rating = VALUES(rating), learned_count = learned_count + 1, last_learned_at = NOW()',
      [userId, actualWordId, rating]
    );
    
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

router.post('/collect', authenticateToken, async (req, res) => {
  try {
    const { wordId, word, isCollect } = req.body;
    const userId = req.user.userId;
    
    let actualWordId = wordId;
    if (word && !wordId) {
      await getWordWithCache(word);
      const [wordRecord] = await pool.execute('SELECT id FROM words WHERE word = ?', [word]);
      if (wordRecord.length > 0) {
        actualWordId = wordRecord[0].id;
      }
    }
    
    if (!actualWordId) {
      return res.status(400).json({ success: false, message: 'Word not found' });
    }
    
    if (isCollect) {
      await pool.execute('INSERT IGNORE INTO user_collections (user_id, word_id) VALUES (?, ?)', [userId, actualWordId]);
    } else {
      await pool.execute('DELETE FROM user_collections WHERE user_id = ? AND word_id = ?', [userId, actualWordId]);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

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
