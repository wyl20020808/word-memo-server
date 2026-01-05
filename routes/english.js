const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 初始化英语相关表
async function initEnglishTables() {
  try {
    // 创建阅读文章表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reading_articles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
        word_count INT DEFAULT 0,
        read_time INT DEFAULT 5,
        preview TEXT,
        content_en TEXT NOT NULL,
        content_zh TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active TINYINT DEFAULT 1
      )
    `);

    // 创建翻译句子表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS translation_sentences (
        id INT PRIMARY KEY AUTO_INCREMENT,
        english TEXT NOT NULL,
        chinese TEXT NOT NULL,
        analysis TEXT,
        difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
        source VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active TINYINT DEFAULT 1
      )
    `);

    // 创建用户阅读记录表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_reading_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        article_id INT NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_article (user_id, article_id)
      )
    `);

    // 创建用户翻译记录表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_translation_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        sentence_id INT NOT NULL,
        user_translation TEXT,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建用户英语统计表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_english_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        reading_count INT DEFAULT 0,
        translation_count INT DEFAULT 0,
        quiz_count INT DEFAULT 0,
        UNIQUE KEY unique_user_date (user_id, date)
      )
    `);

    // 检查是否有文章数据，没有则插入示例数据
    const [articles] = await pool.execute('SELECT COUNT(*) as count FROM reading_articles');
    if (articles[0].count === 0) {
      await insertSampleData();
    }

    console.log('✅ 英语学习表初始化完成');
  } catch (error) {
    console.error('初始化英语表失败:', error);
  }
}

// 插入示例数据
async function insertSampleData() {
  // 插入示例文章
  const articles = [
    {
      title: 'The Power of Habit',
      difficulty: 'easy',
      word_count: 150,
      read_time: 3,
      preview: 'Habits are powerful forces in our lives...',
      content_en: 'Habits are powerful forces in our lives. They shape our actions, our health, and even our happiness. Understanding how habits work can help us change them.\n\nEvery habit consists of three parts: a cue, a routine, and a reward. The cue triggers the behavior, the routine is the behavior itself, and the reward is what we get from it.\n\nTo change a habit, we need to identify these three components and then work on replacing the routine while keeping the same cue and reward.',
      content_zh: '习惯是我们生活中强大的力量。它们塑造我们的行为、健康，甚至幸福。理解习惯如何运作可以帮助我们改变它们。\n\n每个习惯由三部分组成：触发因素、惯例和奖励。触发因素引发行为，惯例是行为本身，奖励是我们从中获得的东西。\n\n要改变一个习惯，我们需要识别这三个组成部分，然后在保持相同触发因素和奖励的同时，努力替换惯例。'
    },
    {
      title: 'Climate Change and Our Future',
      difficulty: 'medium',
      word_count: 200,
      read_time: 5,
      preview: 'Climate change is one of the most pressing issues...',
      content_en: 'Climate change is one of the most pressing issues of our time. Scientists around the world have reached a consensus that human activities are causing global temperatures to rise at an unprecedented rate.\n\nThe consequences of climate change are far-reaching. Rising sea levels threaten coastal communities, extreme weather events are becoming more frequent, and ecosystems are being disrupted.\n\nHowever, there is still hope. By transitioning to renewable energy sources, improving energy efficiency, and changing our consumption patterns, we can mitigate the worst effects of climate change.',
      content_zh: '气候变化是我们这个时代最紧迫的问题之一。世界各地的科学家已经达成共识，人类活动正在以前所未有的速度导致全球气温上升。\n\n气候变化的后果是深远的。海平面上升威胁着沿海社区，极端天气事件变得更加频繁，生态系统正在被破坏。\n\n然而，仍然有希望。通过转向可再生能源、提高能源效率和改变我们的消费模式，我们可以减轻气候变化的最坏影响。'
    },
    {
      title: 'The Digital Revolution',
      difficulty: 'hard',
      word_count: 250,
      read_time: 6,
      preview: 'The digital revolution has fundamentally transformed...',
      content_en: 'The digital revolution has fundamentally transformed how we live, work, and communicate. In just a few decades, technology has reshaped virtually every aspect of human society.\n\nArtificial intelligence and machine learning are now capable of performing tasks that were once thought to be exclusively human domains. From medical diagnosis to creative writing, AI systems are demonstrating remarkable capabilities.\n\nYet this technological progress raises important questions about privacy, employment, and the nature of human identity. As we navigate this new landscape, we must ensure that technology serves humanity rather than the other way around.',
      content_zh: '数字革命从根本上改变了我们的生活、工作和交流方式。在短短几十年内，技术几乎重塑了人类社会的方方面面。\n\n人工智能和机器学习现在能够执行曾经被认为是人类专属领域的任务。从医学诊断到创意写作，人工智能系统正在展示出非凡的能力。\n\n然而，这种技术进步引发了关于隐私、就业和人类身份本质的重要问题。在我们探索这个新领域时，我们必须确保技术服务于人类，而不是相反。'
    }
  ];

  for (const article of articles) {
    await pool.execute(
      'INSERT INTO reading_articles (title, difficulty, word_count, read_time, preview, content_en, content_zh) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [article.title, article.difficulty, article.word_count, article.read_time, article.preview, article.content_en, article.content_zh]
    );
  }

  // 插入示例翻译句子
  const sentences = [
    {
      english: 'The fact that technology has become so deeply embedded in our daily lives raises important questions about privacy, autonomy, and the nature of human connection.',
      chinese: '技术已经如此深入地嵌入我们的日常生活，这一事实引发了关于隐私、自主权和人际关系本质的重要问题。',
      analysis: '主干：The fact raises questions。that引导同位语从句解释fact的内容。about后接三个并列的名词短语作questions的后置定语。',
      difficulty: 'hard'
    },
    {
      english: 'What distinguishes successful people from others is not so much their intelligence or talent as their persistence and willingness to learn from failure.',
      chinese: '成功人士与他人的区别与其说是他们的智力或才能，不如说是他们的坚持和从失败中学习的意愿。',
      analysis: '主干：What distinguishes... is not so much A as B（与其说A不如说B）。What引导主语从句。',
      difficulty: 'hard'
    },
    {
      english: 'It is precisely because we live in an age of unprecedented change that we must develop the ability to adapt quickly and continuously reinvent ourselves.',
      chinese: '正是因为我们生活在一个前所未有的变革时代，我们才必须培养快速适应和不断重塑自我的能力。',
      analysis: '强调句型：It is... that...。强调的是because引导的原因状语从句。',
      difficulty: 'medium'
    },
    {
      english: 'The research suggests that the benefits of regular exercise extend far beyond physical health, encompassing improvements in mental well-being, cognitive function, and social relationships.',
      chinese: '研究表明，定期锻炼的好处远不止身体健康，还包括心理健康、认知功能和社会关系的改善。',
      analysis: '主干：The research suggests that...。that引导宾语从句。encompassing是现在分词作伴随状语。',
      difficulty: 'medium'
    },
    {
      english: 'Only when we recognize that our individual actions have collective consequences can we begin to address the environmental challenges that threaten our planet.',
      chinese: '只有当我们认识到我们的个人行为会产生集体后果时，我们才能开始应对威胁我们星球的环境挑战。',
      analysis: '倒装句：Only when...can we...。only+状语从句置于句首时，主句要部分倒装。',
      difficulty: 'hard'
    }
  ];

  for (const sentence of sentences) {
    await pool.execute(
      'INSERT INTO translation_sentences (english, chinese, analysis, difficulty, source) VALUES (?, ?, ?, ?, ?)',
      [sentence.english, sentence.chinese, sentence.analysis, sentence.difficulty, '考研真题']
    );
  }

  console.log('✅ 示例数据插入完成');
}

// 初始化表
initEnglishTables();

// ==================== 阅读文章接口 ====================

// 获取文章列表
router.get('/articles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [articles] = await pool.execute(`
      SELECT a.*, 
        CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as is_read
      FROM reading_articles a
      LEFT JOIN user_reading_records r ON a.id = r.article_id AND r.user_id = ?
      WHERE a.is_active = 1
      ORDER BY a.difficulty, a.id
    `, [userId]);

    res.json({ success: true, data: articles });
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 获取文章详情
router.get('/articles/:id', authenticateToken, async (req, res) => {
  try {
    const [articles] = await pool.execute(
      'SELECT * FROM reading_articles WHERE id = ? AND is_active = 1',
      [req.params.id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    res.json({ success: true, data: articles[0] });
  } catch (error) {
    console.error('获取文章详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 标记文章已读
router.post('/articles/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const articleId = req.params.id;
    const today = new Date().toISOString().split('T')[0];

    // 记录阅读
    await pool.execute(
      'INSERT IGNORE INTO user_reading_records (user_id, article_id) VALUES (?, ?)',
      [userId, articleId]
    );

    // 更新统计
    await pool.execute(`
      INSERT INTO user_english_stats (user_id, date, reading_count)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE reading_count = reading_count + 1
    `, [userId, today]);

    res.json({ success: true, message: '已标记为已读' });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// ==================== 翻译句子接口 ====================

// 获取翻译句子列表
router.get('/sentences', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const [sentences] = await pool.execute(
      'SELECT * FROM translation_sentences WHERE is_active = 1 ORDER BY RAND() LIMIT ?',
      [limit]
    );

    res.json({ success: true, data: sentences });
  } catch (error) {
    console.error('获取翻译句子失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 提交翻译
router.post('/sentences/:id/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sentenceId = req.params.id;
    const { userTranslation } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // 记录翻译
    await pool.execute(
      'INSERT INTO user_translation_records (user_id, sentence_id, user_translation) VALUES (?, ?, ?)',
      [userId, sentenceId, userTranslation]
    );

    // 更新统计
    await pool.execute(`
      INSERT INTO user_english_stats (user_id, date, translation_count)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE translation_count = translation_count + 1
    `, [userId, today]);

    res.json({ success: true, message: '提交成功' });
  } catch (error) {
    console.error('提交翻译失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

// ==================== 统计接口 ====================

// 获取英语学习统计
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    // 今日统计
    const [todayStats] = await pool.execute(
      'SELECT * FROM user_english_stats WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    // 累计统计
    const [totalStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(reading_count), 0) as total_reading,
        COALESCE(SUM(translation_count), 0) as total_translation,
        COALESCE(SUM(quiz_count), 0) as total_quiz,
        COUNT(DISTINCT date) as study_days
      FROM user_english_stats
      WHERE user_id = ?
    `, [userId]);

    // 获取单词学习数
    const [wordStats] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_word_records WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: {
        today: todayStats[0] || { reading_count: 0, translation_count: 0, quiz_count: 0 },
        total: {
          readingCount: totalStats[0]?.total_reading || 0,
          translationCount: totalStats[0]?.total_translation || 0,
          quizCount: totalStats[0]?.total_quiz || 0,
          wordsLearned: wordStats[0]?.count || 0,
          studyDays: totalStats[0]?.study_days || 0
        }
      }
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 更新抽背统计
router.post('/stats/quiz', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { count } = req.body;
    const today = new Date().toISOString().split('T')[0];

    await pool.execute(`
      INSERT INTO user_english_stats (user_id, date, quiz_count)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quiz_count = quiz_count + ?
    `, [userId, today, count, count]);

    res.json({ success: true });
  } catch (error) {
    console.error('更新统计失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

module.exports = router;
