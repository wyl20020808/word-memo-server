// 内存数据库 - 用于Railway部署测试
class MemoryDB {
  constructor() {
    this.users = new Map();
    this.words = new Map();
    this.userWordRecords = new Map();
    this.userCollections = new Map();
    this.userStats = new Map();
    
    // 初始化示例数据
    this.initSampleData();
  }
  
  initSampleData() {
    // 添加示例单词
    const sampleWords = [
      { id: 1, word: 'abandon', phonetic: '/əˈbændən/', translation: 'v. 遗弃；放弃', example: 'He decided to abandon the project.', category: '四六级' },
      { id: 2, word: 'ability', phonetic: '/əˈbɪləti/', translation: 'n. 能力；才能', example: 'She has the ability to do the job.', category: '四六级' },
      { id: 3, word: 'abnormal', phonetic: '/æbˈnɔːrml/', translation: 'adj. 反常的', example: 'The weather is abnormal for this time of year.', category: '四六级' },
      { id: 4, word: 'aboard', phonetic: '/əˈbɔːrd/', translation: 'adv. 在船(车、飞行器)上', example: 'Welcome aboard!', category: '四六级' },
      { id: 5, word: 'absence', phonetic: '/ˈæbsəns/', translation: 'n. 缺席；缺乏', example: 'In the absence of proof, we cannot accuse him.', category: '四六级' },
      { id: 6, word: 'absolute', phonetic: '/ˈæbsəluːt/', translation: 'adj. 绝对的；完全的', example: 'I have absolute confidence in you.', category: '四六级' },
      { id: 7, word: 'absorb', phonetic: '/əbˈzɔːrb/', translation: 'v. 吸收；吸引', example: 'Plants absorb water from the soil.', category: '四六级' },
      { id: 8, word: 'abstract', phonetic: '/ˈæbstrækt/', translation: 'adj. 抽象的 n. 摘要', example: 'This is an abstract concept.', category: '四六级' },
      { id: 9, word: 'academic', phonetic: '/ˌækəˈdemɪk/', translation: 'adj. 学术的；理论的', example: 'He has a strong academic background.', category: '四六级' },
      { id: 10, word: 'accelerate', phonetic: '/əkˈseləreɪt/', translation: 'v. 加速；促进', example: 'The car began to accelerate.', category: '四六级' }
    ];
    
    sampleWords.forEach(word => {
      this.words.set(word.id, word);
    });
    
    console.log(`📚 已加载 ${sampleWords.length} 个示例单词`);
  }
  
  // 模拟SQL查询
  async execute(sql, params = []) {
    console.log('🔍 Memory DB Query:', sql, params);
    
    // 简单的SQL解析和执行
    if (sql.includes('SELECT') && sql.includes('users')) {
      return this.handleUserQuery(sql, params);
    } else if (sql.includes('SELECT') && sql.includes('words')) {
      return this.handleWordQuery(sql, params);
    } else if (sql.includes('INSERT') && sql.includes('users')) {
      return this.handleUserInsert(sql, params);
    } else if (sql.includes('INSERT') && sql.includes('user_word_records')) {
      return this.handleLearnRecord(sql, params);
    } else if (sql.includes('INSERT') && sql.includes('user_collections')) {
      return this.handleCollection(sql, params);
    }
    
    return [[]];
  }
  
  handleUserQuery(sql, params) {
    const [openid] = params;
    const users = Array.from(this.users.values()).filter(u => u.openid === openid);
    return [users];
  }
  
  handleWordQuery(sql, params) {
    const words = Array.from(this.words.values());
    return [words.map(word => ({
      ...word,
      user_rating: 0,
      learned_count: 0,
      is_collected: 0
    }))];
  }
  
  handleUserInsert(sql, params) {
    const [openid, nickname, avatar_url] = params;
    const userId = this.users.size + 1;
    const user = { id: userId, openid, nickname, avatar_url };
    this.users.set(userId, user);
    return [{ insertId: userId }];
  }
  
  handleLearnRecord(sql, params) {
    // 处理学习记录
    return [{ affectedRows: 1 }];
  }
  
  handleCollection(sql, params) {
    // 处理收藏
    return [{ affectedRows: 1 }];
  }
}

module.exports = MemoryDB;