/**
 * 管理员路由 - 词汇导入等管理功能
 */
const express = require('express');
const axios = require('axios');
const { pool } = require('../config/database');

const router = express.Router();

// 获取单词详情（从免费API）
async function getWordDetails(word) {
  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      { timeout: 10000 }
    );
    
    const data = response.data[0];
    let phonetic = data.phonetic || '';
    if (!phonetic && data.phonetics?.length > 0) {
      phonetic = data.phonetics.find(p => p.text)?.text || '';
    }
    
    let audioUrl = '';
    if (data.phonetics?.length > 0) {
      audioUrl = data.phonetics.find(p => p.audio)?.audio || '';
    }
    
    let meanings = [];
    let examples = [];
    
    if (data.meanings) {
      for (const meaning of data.meanings) {
        for (const def of meaning.definitions.slice(0, 2)) {
          meanings.push(`${meaning.partOfSpeech}. ${def.definition}`);
          if (def.example) examples.push(def.example);
        }
      }
    }
    
    return {
      phonetic, audio_url: audioUrl,
      meaning: meanings.slice(0, 3).join('\n'),
      example: examples.slice(0, 2).join('\n'),
      success: true
    };
  } catch (error) {
    return { phonetic: '', audio_url: '', meaning: '', example: '', success: false };
  }
}

// 批量导入单词API
router.post('/import-words', async (req, res) => {
  try {
    const { words, category = '考研' } = req.body;
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ success: false, message: '请提供单词列表' });
    }
    
    console.log(`📚 开始导入 ${words.length} 个单词...`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const results = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().trim();
      if (!word) continue;
      
      // 检查是否已存在
      const [existing] = await pool.execute('SELECT id FROM words WHERE word = ?', [word]);
      if (existing.length > 0) {
        skipCount++;
        results.push({ word, status: 'skipped' });
        continue;
      }
      
      // 获取单词详情
      const details = await getWordDetails(word);
      const meaning = details.meaning || '暂无释义';
      
      try {
        await pool.execute(
          `INSERT INTO words (word, phonetic, meaning, example, audio_url, category) VALUES (?, ?, ?, ?, ?, ?)`,
          [word, details.phonetic, meaning, details.example, details.audio_url, category]
        );
        successCount++;
        results.push({ word, status: 'success' });
      } catch (err) {
        failCount++;
        results.push({ word, status: 'failed', error: err.message });
      }
      
      // 避免请求过快
      await new Promise(r => setTimeout(r, 300));
    }
    
    res.json({
      success: true,
      data: {
        total: words.length,
        success: successCount,
        skipped: skipCount,
        failed: failCount,
        results: results.slice(0, 50) // 只返回前50条结果
      }
    });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取导入状态
router.get('/words-count', async (req, res) => {
  try {
    const [result] = await pool.execute('SELECT COUNT(*) as count FROM words');
    const [categories] = await pool.execute(
      'SELECT category, COUNT(*) as count FROM words GROUP BY category'
    );
    res.json({
      success: true,
      data: { total: result[0].count, categories }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
