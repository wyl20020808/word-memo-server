/**
 * Words Router - 从MySQL数据库读取单词
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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
      // 使用有道翻译的免费接口
      const url = `https://fanyi.youdao.com/translate?&doctype=json&type=EN2ZH_CN&i=${encodeURIComponent(sentence)}`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              // 有道翻译返回格式: { translateResult: [[{tgt: "翻译结果"}]] }
              if (json.translateResult && json.translateResult[0] && json.translateResult[0][0]) {
                const result = json.translateResult[0][0].tgt || '';
                console.log('翻译结果:', sentence.substring(0, 30), '->', result.substring(0, 30));
                resolve(result);
              } else {
                console.log('翻译无结果:', sentence.substring(0, 30));
                resolve('');
              }
            } else {
              console.log('翻译请求失败:', res.statusCode);
              resolve('');
            }
          } catch (e) {
            console.log('翻译解析错误:', e.message);
            resolve('');
          }
        });
      }).on('error', (e) => {
        console.log('翻译网络错误:', e.message);
        resolve('');
      });
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
    console.log('开始翻译例句，单词:', word);
    const examples = engData.example.split('|||').filter(e => e.trim());
    console.log('例句数量:', examples.length);
    
    const transPromises = examples.map(async (ex, idx) => {
      console.log(`翻译例句 ${idx + 1}:`, ex.substring(0, 50));
      const trans = await translateSentence(ex);
      console.log(`翻译结果 ${idx + 1}:`, trans.substring(0, 50));
      return trans;
    });
    
    const translations = await Promise.all(transPromises);
    exampleTrans = translations.join('|||');
    console.log('最终翻译结果:', exampleTrans.substring(0, 100));
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
    
    console.log('📚 批量获取单词详情请求:', words.join(', '));
    
    // 限制一次最多10个
    const wordList = words.slice(0, 10);
    const results = [];
    const needFetch = [];
    
    // 1. 先批量查数据库缓存
    try {
      const placeholders = wordList.map(() => '?').join(',');
      const [cached] = await pool.execute(
        `SELECT word, phonetic, example, example_trans, meaning FROM words WHERE word IN (${placeholders})`,
        wordList
      );
      
      console.log(`💾 数据库查询结果: 找到 ${cached.length} 条记录`);
      
      const cachedMap = {};
      cached.forEach(row => {
        const hasValidExample = row.example && row.example.trim() && row.example !== '|||';
        const hasValidTrans = row.example_trans && row.example_trans.trim() && row.example_trans !== '|||';
        
        console.log(`  📝 ${row.word}:`);
        console.log(`     - phonetic: ${row.phonetic || '空'}`);
        console.log(`     - example: ${row.example || '空'}`);
        console.log(`     - example_trans: ${row.example_trans || '空'}`);
        console.log(`     - hasValidExample: ${hasValidExample}`);
        console.log(`     - hasValidTrans: ${hasValidTrans}`);
        
        // 只要有音标或例句就算有缓存（不要求必须全部有）
        if (row.phonetic || hasValidExample) {
          cachedMap[row.word.toLowerCase()] = {
            word: row.word,
            phonetic: row.phonetic || '',
            example: row.example || '',
            exampleTrans: row.example_trans || '',
            meaning: row.meaning || ''
          };
          
          // 判断是否完整
          if (row.phonetic && hasValidExample && hasValidTrans) {
            console.log(`  ✅ ${row.word} 从数据库读取（完整数据）`);
          } else {
            console.log(`  ⚠️ ${row.word} 从数据库读取（部分数据，可能需要补全）`);
          }
        } else {
          console.log(`  ❌ ${row.word} 数据库无有效数据`);
        }
      });
      
      // 分类：有缓存的和需要获取的
      wordList.forEach(w => {
        const key = w.toLowerCase();
        if (cachedMap[key]) {
          results.push(cachedMap[key]);
        } else {
          needFetch.push(w);
        }
      });
      
      console.log(`📊 统计: ${results.length} 个从缓存, ${needFetch.length} 个需要API获取`);
      if (results.length > 0) {
        console.log(`📊 缓存单词: ${results.map(r => r.word).join(', ')}`);
      }
      if (needFetch.length > 0) {
        console.log(`📊 需要API: ${needFetch.join(', ')}`);
      }
      
    } catch (e) {
      console.log('❌ 数据库查询失败:', e.message);
      // 数据库查询失败，全部需要从API获取
      needFetch.push(...wordList);
    }
    
    // 2. 并发从API获取缺失的（使用综合获取函数）
    if (needFetch.length > 0) {
      console.log(`🌐 需要从API获取: ${needFetch.join(', ')}`);
      
      const fetchPromises = needFetch.map(async (word) => {
        const apiData = await fetchWordDetail(word);
        
        console.log(`  📖 ${word} API返回: phonetic=${!!apiData.phonetic}, example=${!!apiData.example}, trans=${!!apiData.exampleTrans}`);
        
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
            console.log(`  💾 ${word} 已缓存到数据库`);
          } catch (e) {
            console.log(`  ❌ ${word} 缓存失败:`, e.message);
          }
        }
        
        return { word, ...apiData };
      });
      
      const fetched = await Promise.all(fetchPromises);
      results.push(...fetched);
    }
    
    console.log(`✅ 批量获取完成，返回 ${results.length} 个单词`);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Batch get details failed:', error);
    res.json({ success: true, data: [] });
  }
});

// 获取单词详情（优先本地文件，然后数据库）
// 获取单词详情（从数据库查找）
async function getWordData(wordStr) {
  // 从数据库查找
  try {
    const [cached] = await pool.execute('SELECT * FROM words WHERE word = ?', [wordStr]);
    if (cached.length > 0) {
      return { ...cached[0] };
    }
  } catch (e) {
    console.log('DB query failed:', e.message);
  }
  
  // 返回基本信息
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
    
    // 获取数据库中单词总数
    const [totalRows] = await pool.execute('SELECT COUNT(*) as count FROM words');
    const totalWords = totalRows[0].count;
    console.log('Total words in database: ' + totalWords);
    
    // 获取用户已学习的单词ID
    const [learnedRecords] = await pool.execute(
      'SELECT word_id FROM user_word_records WHERE user_id = ?',
      [userId]
    );
    const learnedWordIds = new Set(learnedRecords.map(r => r.word_id));
    console.log('User learned: ' + learnedWordIds.size + ' words');
    
    // 从数据库获取未学习的单词
    let query = 'SELECT id, word, phonetic, meaning, translation, example, example_trans FROM words';
    let params = [];
    
    if (learnedWordIds.size > 0) {
      const placeholders = Array.from(learnedWordIds).map(() => '?').join(',');
      query += ` WHERE id NOT IN (${placeholders})`;
      params = Array.from(learnedWordIds);
    }
    
    query += ` LIMIT ${limit}`;
    
    const [words] = await pool.execute(query, params);
    console.log('New words available: ' + words.length);
    
    if (words.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: totalWords,
        learned: learnedWordIds.size,
        hasMore: false,
        message: '恭喜！你已学完所有单词！'
      });
    }
    
    console.log('Returning words:', words.slice(0, 5).map(w => w.word).join(', '));
    
    // 构建返回数据
    const result = words.map(w => ({
      id: w.id,
      word: w.word,
      phonetic: w.phonetic || '',
      meaning: w.meaning || '',
      translation: w.meaning || w.translation || '',
      example: w.example || '',
      exampleTrans: w.example_trans || '',
      audio_url: '',
      user_rating: 0,
      learned_count: 0,
      is_collected: 0
    }));
    
    res.json({
      success: true,
      data: result,
      total: totalWords,
      learned: learnedWordIds.size,
      remaining: totalWords - learnedWordIds.size,
      hasMore: words.length >= limit
    });
    
  } catch (error) {
    console.error('Get words failed:', error);
    res.status(500).json({ success: false, message: 'Failed to get words: ' + error.message });
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
