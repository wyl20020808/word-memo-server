+/**
 * 自动导入考研词汇（服务启动时调用）
 */
const axios = require('axios');
const { pool } = require('../config/database');

// 考研核心词汇（精简版，约500个高频词）
const CORE_WORDS = [
  'abandon', 'ability', 'able', 'abnormal', 'aboard', 'abolish', 'abroad',
  'absence', 'absent', 'absolute', 'absorb', 'abstract', 'absurd', 'abuse',
  'academic', 'academy', 'accelerate', 'accent', 'accept', 'access', 'accident',
  'accommodate', 'accompany', 'accomplish', 'accord', 'account', 'accumulate',
  'accurate', 'accuse', 'achieve', 'achievement', 'acknowledge', 'acquire',
  'across', 'act', 'action', 'active', 'activity', 'actual', 'adapt', 'add',
  'addition', 'additional', 'address', 'adequate', 'adjust', 'administration',
  'admire', 'admit', 'adopt', 'adult', 'advance', 'advantage', 'adventure',
  'advertise', 'advice', 'advise', 'affair', 'affect', 'afford', 'afraid',
  'after', 'afternoon', 'again', 'against', 'age', 'agency', 'agent', 'ago',
  'agree', 'agreement', 'ahead', 'aid', 'aim', 'air', 'aircraft', 'airline',
  'airport', 'alarm', 'album', 'alcohol', 'alive', 'all', 'allow', 'almost',
  'alone', 'along', 'already', 'also', 'alter', 'alternative', 'although',
  'always', 'amaze', 'ambition', 'among', 'amount', 'analyse', 'analysis',
  'ancient', 'anger', 'angle', 'angry', 'animal', 'announce', 'annual', 'another',
  'answer', 'anticipate', 'anxiety', 'anxious', 'any', 'anybody', 'anyone',
  'anything', 'anyway', 'anywhere', 'apart', 'apartment', 'apologize', 'apparent',
  'appeal', 'appear', 'appearance', 'apple', 'application', 'apply', 'appoint',
  'appreciate', 'approach', 'appropriate', 'approve', 'area', 'argue', 'argument',
  'arise', 'arm', 'army', 'around', 'arrange', 'arrest', 'arrival', 'arrive',
  'art', 'article', 'artist', 'as', 'ashamed', 'aside', 'ask', 'aspect', 'assess',
  'asset', 'assign', 'assist', 'associate', 'assume', 'assumption', 'assure',
  'atmosphere', 'attach', 'attack', 'attempt', 'attend', 'attention', 'attitude',
  'attract', 'attractive', 'audience', 'author', 'authority', 'automatic', 'available',
  'average', 'avoid', 'award', 'aware', 'away', 'awful',
  // B
  'baby', 'back', 'background', 'bad', 'badly', 'bag', 'balance', 'ball', 'ban',
  'band', 'bank', 'bar', 'barrier', 'base', 'basic', 'basis', 'basket', 'bath',
  'battle', 'be', 'beach', 'bear', 'beat', 'beautiful', 'beauty', 'because',
  'become', 'bed', 'bedroom', 'before', 'begin', 'beginning', 'behalf', 'behave',
  'behavior', 'behind', 'belief', 'believe', 'belong', 'below', 'benefit', 'beside',
  'best', 'better', 'between', 'beyond', 'big', 'bill', 'billion', 'bind', 'bird',
  'birth', 'bit', 'bite', 'black', 'blame', 'blank', 'blind', 'block', 'blood',
  'blow', 'blue', 'board', 'boat', 'body', 'boil', 'bomb', 'bond', 'bone', 'book',
  'boom', 'boot', 'border', 'bore', 'born', 'borrow', 'boss', 'both', 'bother',
  'bottle', 'bottom', 'bound', 'bowl', 'box', 'boy', 'brain', 'branch', 'brand',
  'brave', 'bread', 'break', 'breakfast', 'breath', 'breathe', 'breed', 'bridge',
  'brief', 'bright', 'brilliant', 'bring', 'broad', 'broadcast', 'brother', 'brown',
  'brush', 'budget', 'build', 'building', 'bunch', 'burden', 'burn', 'burst', 'bury',
  'bus', 'business', 'busy', 'but', 'buy', 'buyer',
  // C
  'cabinet', 'cable', 'cake', 'calculate', 'call', 'calm', 'camera', 'camp',
  'campaign', 'campus', 'can', 'cancel', 'cancer', 'candidate', 'cap', 'capable',
  'capacity', 'capital', 'captain', 'capture', 'car', 'card', 'care', 'career',
  'careful', 'carry', 'case', 'cash', 'cast', 'cat', 'catch', 'category', 'cause',
  'celebrate', 'cell', 'center', 'central', 'century', 'ceremony', 'certain',
  'certainly', 'chain', 'chair', 'chairman', 'challenge', 'champion', 'chance',
  'change', 'channel', 'chapter', 'character', 'characteristic', 'charge', 'charity',
  'chart', 'chase', 'cheap', 'check', 'cheese', 'chemical', 'chest', 'chicken',
  'chief', 'child', 'childhood', 'children', 'choice', 'choose', 'church', 'cigarette',
  'circle', 'circumstance', 'citizen', 'city', 'civil', 'claim', 'class', 'classic',
  'classroom', 'clean', 'clear', 'clearly', 'client', 'climate', 'climb', 'clock',
  'close', 'closely', 'clothes', 'cloud', 'club', 'clue', 'coach', 'coal', 'coast',
  'coat', 'code', 'coffee', 'coin', 'cold', 'collapse', 'colleague', 'collect',
  'collection', 'college', 'color', 'column', 'combination', 'combine', 'come',
  'comfort', 'comfortable', 'command', 'comment', 'commercial', 'commission',
  'commit', 'commitment', 'committee', 'common', 'communicate', 'communication',
  'community', 'company', 'compare', 'comparison', 'compete', 'competition',
  'competitive', 'complain', 'complaint', 'complete', 'completely', 'complex',
  'complicated', 'component', 'computer', 'concentrate', 'concentration', 'concept',
  'concern', 'concerned', 'conclude', 'conclusion', 'condition', 'conduct',
  'conference', 'confidence', 'confident', 'confirm', 'conflict', 'confront',
  'confuse', 'confusion', 'congress', 'connect', 'connection', 'conscious',
  'consequence', 'conservative', 'consider', 'considerable', 'consideration',
  'consist', 'consistent', 'constant', 'constitute', 'construction', 'consult',
  'consumer', 'consumption', 'contact', 'contain', 'contemporary', 'content',
  'contest', 'context', 'continue', 'contract', 'contrast', 'contribute',
  'contribution', 'control', 'controversial', 'convenience', 'convenient',
  'convention', 'conventional', 'conversation', 'convert', 'convince', 'cook',
  'cool', 'cooperate', 'cooperation', 'cope', 'copy', 'core', 'corner', 'corporate',
  'correct', 'cost', 'cottage', 'cotton', 'could', 'council', 'count', 'counter',
  'country', 'countryside', 'county', 'couple', 'courage', 'course', 'court',
  'cousin', 'cover', 'crack', 'craft', 'crash', 'crazy', 'cream', 'create',
  'creation', 'creative', 'creature', 'credit', 'crew', 'crime', 'criminal',
  'crisis', 'criterion', 'critic', 'critical', 'criticism', 'criticize', 'crop',
  'cross', 'crowd', 'crucial', 'cruel', 'cry', 'cultural', 'culture', 'cup',
  'cure', 'curious', 'currency', 'current', 'currently', 'curriculum', 'customer',
  'cut', 'cycle',
];

// 获取单词详情
async function getWordDetails(word) {
  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      { timeout: 8000 }
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
      example: examples.slice(0, 2).join('\n')
    };
  } catch (error) {
    return { phonetic: '', audio_url: '', meaning: '暂无释义', example: '' };
  }
}

// 自动导入函数
async function autoImport() {
  try {
    // 检查words表是否存在
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS words (
        id INT AUTO_INCREMENT PRIMARY KEY,
        word VARCHAR(100) NOT NULL UNIQUE,
        phonetic VARCHAR(100),
        meaning TEXT,
        example TEXT,
        audio_url VARCHAR(500),
        difficulty INT DEFAULT 1,
        category VARCHAR(50) DEFAULT '考研',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 检查是否已有数据
    const [countResult] = await pool.execute('SELECT COUNT(*) as count FROM words');
    const existingCount = countResult[0].count;
    
    if (existingCount >= 100) {
      console.log(`📚 数据库已有 ${existingCount} 个单词，跳过自动导入`);
      return;
    }
    
    console.log(`📚 开始自动导入考研词汇（当前: ${existingCount} 个）...`);
    
    let imported = 0;
    const batchSize = 50; // 每次导入50个
    const maxImport = 200; // 最多导入200个（避免启动太慢）
    
    for (let i = 0; i < CORE_WORDS.length && imported < maxImport; i++) {
      const word = CORE_WORDS[i];
      
      // 检查是否已存在
      const [existing] = await pool.execute('SELECT id FROM words WHERE word = ?', [word]);
      if (existing.length > 0) continue;
      
      const details = await getWordDetails(word);
      
      try {
        await pool.execute(
          `INSERT INTO words (word, phonetic, meaning, example, audio_url, category) VALUES (?, ?, ?, ?, ?, '考研')`,
          [word, details.phonetic, details.meaning, details.example, details.audio_url]
        );
        imported++;
        
        if (imported % 10 === 0) {
          console.log(`  📝 已导入 ${imported} 个单词...`);
        }
      } catch (err) {
        // 忽略重复错误
      }
      
      // 避免请求过快
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`✅ 自动导入完成，新增 ${imported} 个单词`);
    
  } catch (error) {
    console.error('⚠️ 自动导入失败:', error.message);
  }
}

module.exports = { autoImport };
