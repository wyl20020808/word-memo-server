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

// 从免费词典API获取单词详情（英文例句）
async function fetchWordFromAPI(word) {
  try {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              if (json && json[0]) {
                const entry = json[0];
                // 获取音标
                let phonetic = '';
                if (entry.phonetic) {
                  phonetic = entry.phonetic;
                } else if (entry.phonetics && entry.phonetics.length > 0) {
                  const p = entry.phonetics.find(p => p.text) || entry.phonetics[0];
                  phonetic = p.text || '';
                }
                // 获取两个例句
                const examples = [];
                if (entry.meanings && entry.meanings.length > 0) {
                  for (const meaning of entry.meanings) {
                    if (meaning.definitions && meaning.definitions.length > 0) {
                      for (const def of meaning.definitions) {
                        if (def.example && examples.length < 2) {
                          examples.push(def.example);
                        }
                        if (examples.length >= 2) break;
                      }
                    }
                    if (examples.length >= 2) break;
                  }
                }
                resolve({ phonetic, example: examples.join('|||') }); // 用|||分隔两个例句
              } else {
                resolve({ phonetic: '', example: '' });
              }
            } else {
              resolve({ phonetic: '', example: '' });
            }
          } catch (e) {
            resolve({ phonetic: '', example: '' });
          }
        });
      }).on('error', () => resolve({ phonetic: '', example: '' }));
    });
  } catch (e) {
    return { phonetic: '', example: '' };
  }
}

// 从有道API获取中文释义
async function fetchChineseMeaning(word) {
  try {
    const https = require('https');
    return new Promise((resolve) => {
      const url = `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word)}`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              if (json.data && json.data.entries && json.data.entries.length > 0) {
                const entry = json.data.entries[0];
                resolve(entry.explain || '');
              } else {
                resolve('');
              }
            } else {
              resolve('');
            }
          } catch (e) {
            resolve('');
          }
        });
      }).on('error', () => resolve(''));
    });
  } catch (e) {
    return '';
  }
}

// 翻译例句（使用有道翻译API）
async function translateSentence(sentence) {
  if (!sentence) return '';
  try {
    const https = require('https');
    return new Promise((resolve) => {
      const url = `https://dict.youdao.com/webtranslate?i=${encodeURIComponent(sentence)}&doctype=json&keyfrom=fanyi.web`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              if (json.translateResult && json.translateResult[0] && json.translateResult[0][0]) {
                resolve(json.translateResult[0][0].tgt || '');
              } else {
                resolve('');
              }
            } else {
              resolve('');
            }
          } catch (e) {
            resolve('');
          }
        });
      }).on('error', () => resolve(''));
    });
  } catch (e) {
    return '';
  }
}

// 综合获取单词详情
async function fetchWordDetail(word) {
  const [engData, chMeaning] = await Promise.all([
    fetchWordFromAPI(word),
    fetchChineseMeaning(word)
  ]);
  
  // 翻译例句
  let exampleTrans = '';
  if (engData.example) {
    const examples = engData.example.split('|||');
    const transPromises = examples.map(ex => translateSentence(ex));
    const translations = await Promise.all(transPromises);
    exampleTrans = translations.join('|||');
  }
  
  return {
    phonetic: engData.phonetic,
    example: engData.example,
    exampleTrans: exampleTrans,
    meaning: chMeaning
  };
}

// 获取单词详情API（供前端调用获取音标和例句）- 单个
router.get('/detail/:word', async (req, res) => {
  try {
    const word = req.params.word;
    
    // 1. 先查数据库缓存（需要同时有音标和例句才算有效缓存）
    try {
      const [cached] = await pool.execute(
        'SELECT phonetic, example, example_trans, meaning FROM words WHERE word = ? AND phonetic != "" AND example != ""',
        [word]
      );
      if (cached.length > 0 && cached[0].example_trans) {
        // 有完整缓存，直接返回
        return res.json({
          success: true,
          data: { 
            word, 
            phonetic: cached[0].phonetic || '', 
            example: cached[0].example || '',
            exampleTrans: cached[0].example_trans || '',
            meaning: cached[0].meaning || ''
          }
        });
      }
    } catch (e) {
      console.log('Query cache failed:', e.message);
    }
    
    // 2. 从API获取（音标、例句、中文释义、例句翻译）
    const apiData = await fetchWordDetail(word);
    
    // 3. 缓存到数据库（包含例句翻译）
    if (apiData.phonetic || apiData.example) {
      try {
        await pool.execute(
          `INSERT INTO words (word, phonetic, example, example_trans, meaning, category) 
           VALUES (?, ?, ?, ?, ?, "kaoyan") 
           ON DUPLICATE KEY UPDATE 
             phonetic = COALESCE(NULLIF(VALUES(phonetic), ''), phonetic),
             example = COALESCE(NULLIF(VALUES(example), ''), example),
             example_trans = COALESCE(NULLIF(VALUES(example_trans), ''), example_trans),
             meaning = COALESCE(NULLIF(VALUES(meaning), ''), meaning)`,
          [word, apiData.phonetic, apiData.example, apiData.exampleTrans, apiData.meaning]
        );
      } catch (e) {
        console.log('Cache word detail failed:', e.message);
      }
    }
    
    res.json({ success: true, data: { word, ...apiData } });
  } catch (error) {
    console.error('Get word detail error:', error);
    res.json({ success: true, data: { word: req.params.word, phonetic: '', example: '', exampleTrans: '', meaning: '' } });
  }
});

// 批量获取单词详情API - 一次获取多个单词的音标、例句和中文释义
router.post('/details', async (req, res) => {
  try {
    const { words } = req.body;
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // 限制一次最多10个
    const wordList = words.slice(0, 10);
    const results = [];
    const needFetch = [];
    
    // 1. 先批量查数据库缓存（需要同时有音标、例句和例句翻译才算完整缓存）
    try {
      const placeholders = wordList.map(() => '?').join(',');
      const [cached] = await pool.execute(
        `SELECT word, phonetic, example, example_trans, meaning FROM words WHERE word IN (${placeholders})`,
        wordList
      );
      
      const cachedMap = {};
      cached.forEach(row => {
        // 只有同时有音标、例句和例句翻译才算完整缓存
        if (row.phonetic && row.example && row.example_trans) {
          cachedMap[row.word.toLowerCase()] = {
            word: row.word,
            phonetic: row.phonetic || '',
            example: row.example || '',
            exampleTrans: row.example_trans || '',
            meaning: row.meaning || ''
          };
        }
      });
      
      // 分类：有完整缓存的和需要获取的
      wordList.forEach(w => {
        const key = w.toLowerCase();
        if (cachedMap[key]) {
          results.push(cachedMap[key]);
        } else {
          needFetch.push(w);
        }
      });
    } catch (e) {
      console.log('Batch query cache failed:', e.message);
      // 数据库查询失败，全部需要从API获取
      needFetch.push(...wordList);
    }
    
    // 2. 并发从API获取缺失的（使用综合获取函数）
    if (needFetch.length > 0) {
      const fetchPromises = needFetch.map(async (word) => {
        const apiData = await fetchWordDetail(word);
        
        // 缓存到数据库（包含例句翻译）
        if (apiData.phonetic || apiData.example) {
          try {
            await pool.execute(
              `INSERT INTO words (word, phonetic, example, example_trans, meaning, category) 
               VALUES (?, ?, ?, ?, ?, "kaoyan") 
               ON DUPLICATE KEY UPDATE 
                 phonetic = COALESCE(NULLIF(VALUES(phonetic), ''), phonetic),
                 example = COALESCE(NULLIF(VALUES(example), ''), example),
                 example_trans = COALESCE(NULLIF(VALUES(example_trans), ''), example_trans),
                 meaning = COALESCE(NULLIF(VALUES(meaning), ''), meaning)`,
              [word, apiData.phonetic, apiData.example, apiData.exampleTrans, apiData.meaning]
            );
          } catch (e) {
            console.log('Cache word failed:', e.message);
          }
        }
        
        return { word, ...apiData };
      });
      
      const fetched = await Promise.all(fetchPromises);
      results.push(...fetched);
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Batch get details failed:', error);
    res.json({ success: true, data: [] });
  }
});

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
