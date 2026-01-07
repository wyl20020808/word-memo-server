const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { callAI, parseAIJSON } = require('../services/aiService');
const { createTask, TaskType } = require('../services/aiTaskManager');

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

    // 创建文章申请表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS article_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        title VARCHAR(255),
        content TEXT NOT NULL,
        type ENUM('article', 'translation') DEFAULT 'article',
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        admin_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_status (status)
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
  // 插入更多示例文章
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
    },
    {
      title: 'The Art of Learning',
      difficulty: 'easy',
      word_count: 180,
      read_time: 4,
      preview: 'Learning is a lifelong journey that shapes who we are...',
      content_en: 'Learning is a lifelong journey that shapes who we are. The most successful people are those who never stop learning, constantly seeking new knowledge and skills.\n\nEffective learning requires more than just reading or listening. It involves active engagement with the material, asking questions, and making connections to what you already know.\n\nResearch shows that spaced repetition and active recall are among the most powerful learning techniques. By reviewing material at increasing intervals and testing yourself regularly, you can dramatically improve retention.',
      content_zh: '学习是塑造我们的终身旅程。最成功的人是那些从不停止学习、不断寻求新知识和技能的人。\n\n有效的学习不仅仅是阅读或听讲。它涉及与材料的积极互动、提出问题，以及与你已知的知识建立联系。\n\n研究表明，间隔重复和主动回忆是最强大的学习技巧之一。通过以递增的间隔复习材料并定期测试自己，你可以显著提高记忆力。'
    },
    {
      title: 'Globalization and Culture',
      difficulty: 'medium',
      word_count: 220,
      read_time: 5,
      preview: 'Globalization has brought the world closer together...',
      content_en: 'Globalization has brought the world closer together than ever before. People, goods, and ideas now flow across borders with unprecedented ease, creating both opportunities and challenges.\n\nOn one hand, globalization has lifted millions out of poverty and given people access to products and information from around the world. On the other hand, it has raised concerns about cultural homogenization and the loss of local traditions.\n\nThe key is to find a balance that allows us to benefit from global connections while preserving the diversity that makes our world rich and interesting.',
      content_zh: '全球化使世界比以往任何时候都更加紧密。人员、商品和思想现在以前所未有的便利跨越国界流动，创造了机遇和挑战。\n\n一方面，全球化使数百万人摆脱了贫困，让人们能够获得来自世界各地的产品和信息。另一方面，它引发了对文化同质化和地方传统丧失的担忧。\n\n关键是找到一种平衡，使我们能够从全球联系中受益，同时保持使我们的世界丰富多彩的多样性。'
    },
    {
      title: 'The Science of Sleep',
      difficulty: 'medium',
      word_count: 200,
      read_time: 5,
      preview: 'Sleep is essential for our physical and mental health...',
      content_en: 'Sleep is essential for our physical and mental health. During sleep, our bodies repair tissues, consolidate memories, and regulate hormones that control growth and appetite.\n\nMost adults need seven to nine hours of sleep per night, yet many people consistently get less. Chronic sleep deprivation has been linked to obesity, heart disease, diabetes, and depression.\n\nTo improve sleep quality, experts recommend maintaining a consistent sleep schedule, creating a dark and quiet sleeping environment, and avoiding screens before bedtime.',
      content_zh: '睡眠对我们的身心健康至关重要。在睡眠期间，我们的身体修复组织、巩固记忆，并调节控制生长和食欲的激素。\n\n大多数成年人每晚需要七到九小时的睡眠，但许多人持续睡眠不足。长期睡眠不足与肥胖、心脏病、糖尿病和抑郁症有关。\n\n为了提高睡眠质量，专家建议保持一致的睡眠时间表，创造黑暗安静的睡眠环境，并避免在睡前使用屏幕。'
    },
    {
      title: 'Critical Thinking in the Information Age',
      difficulty: 'hard',
      word_count: 280,
      read_time: 7,
      preview: 'In an era of information overload, critical thinking has become...',
      content_en: 'In an era of information overload, critical thinking has become more important than ever. We are constantly bombarded with news, opinions, and claims from countless sources, making it increasingly difficult to separate fact from fiction.\n\nCritical thinking involves questioning assumptions, evaluating evidence, and considering alternative perspectives before forming conclusions. It requires intellectual humility—the willingness to admit that we might be wrong and to change our minds when presented with compelling evidence.\n\nDeveloping critical thinking skills takes practice. Start by questioning the sources of information you encounter, looking for potential biases, and seeking out diverse viewpoints on important issues.',
      content_zh: '在信息过载的时代，批判性思维变得比以往任何时候都更加重要。我们不断受到来自无数来源的新闻、观点和声明的轰炸，使得区分事实与虚构变得越来越困难。\n\n批判性思维涉及在形成结论之前质疑假设、评估证据和考虑替代观点。它需要智识上的谦逊——愿意承认我们可能是错的，并在面对令人信服的证据时改变我们的想法。\n\n培养批判性思维技能需要练习。首先质疑你遇到的信息来源，寻找潜在的偏见，并在重要问题上寻求多样化的观点。'
    },
    {
      title: 'The Future of Work',
      difficulty: 'hard',
      word_count: 260,
      read_time: 6,
      preview: 'The workplace is undergoing a profound transformation...',
      content_en: 'The workplace is undergoing a profound transformation driven by technological advances, changing demographics, and evolving social values. Remote work, once a rare perk, has become mainstream, fundamentally altering how and where we work.\n\nAutomation and artificial intelligence are reshaping job markets, eliminating some roles while creating others. The skills that will be most valuable in the future are those that machines cannot easily replicate: creativity, emotional intelligence, and complex problem-solving.\n\nTo thrive in this new landscape, workers must embrace lifelong learning and be prepared to adapt to changing circumstances. The most successful careers will likely involve multiple transitions and continuous skill development.',
      content_zh: '在技术进步、人口结构变化和社会价值观演变的推动下，工作场所正在经历深刻的转变。远程工作曾经是一种罕见的福利，现在已成为主流，从根本上改变了我们工作的方式和地点。\n\n自动化和人工智能正在重塑就业市场，消除一些角色的同时创造其他角色。未来最有价值的技能是机器无法轻易复制的：创造力、情商和复杂问题解决能力。\n\n要在这个新环境中蓬勃发展，工作者必须拥抱终身学习，并准备好适应不断变化的环境。最成功的职业生涯可能涉及多次转型和持续的技能发展。'
    },
    {
      title: 'Healthy Eating Made Simple',
      difficulty: 'easy',
      word_count: 160,
      read_time: 3,
      preview: 'Good nutrition does not have to be complicated...',
      content_en: 'Good nutrition does not have to be complicated. The basic principles of healthy eating are simple: eat plenty of fruits and vegetables, choose whole grains over refined ones, and limit processed foods and added sugars.\n\nPortion control is also important. Even healthy foods can contribute to weight gain if eaten in excess. Using smaller plates and paying attention to hunger cues can help manage portion sizes.\n\nRemember that no single food is magic or poison. A balanced diet that includes a variety of foods is the key to good health.',
      content_zh: '良好的营养不必复杂。健康饮食的基本原则很简单：多吃水果和蔬菜，选择全谷物而不是精制谷物，限制加工食品和添加糖。\n\n份量控制也很重要。即使是健康食品，如果吃得过多也会导致体重增加。使用较小的盘子并注意饥饿信号可以帮助控制份量。\n\n记住，没有任何一种食物是神奇的或有毒的。包含各种食物的均衡饮食是健康的关键。'
    },
    {
      title: 'The Psychology of Motivation',
      difficulty: 'medium',
      word_count: 210,
      read_time: 5,
      preview: 'Understanding what motivates us can help us achieve our goals...',
      content_en: 'Understanding what motivates us can help us achieve our goals more effectively. Psychologists distinguish between intrinsic motivation, which comes from within, and extrinsic motivation, which comes from external rewards or pressures.\n\nResearch suggests that intrinsic motivation leads to better performance and greater satisfaction. When we do something because we find it interesting or meaningful, we are more likely to persist in the face of challenges.\n\nTo boost motivation, set clear and achievable goals, break large tasks into smaller steps, and celebrate progress along the way. Surrounding yourself with supportive people can also make a significant difference.',
      content_zh: '理解是什么激励我们可以帮助我们更有效地实现目标。心理学家区分内在动机（来自内心）和外在动机（来自外部奖励或压力）。\n\n研究表明，内在动机会带来更好的表现和更大的满足感。当我们因为觉得某事有趣或有意义而去做时，我们更有可能在面对挑战时坚持下去。\n\n为了提高动力，设定清晰可实现的目标，将大任务分解为小步骤，并在过程中庆祝进步。让自己周围都是支持你的人也会产生重大影响。'
    }
  ];

  for (const article of articles) {
    await pool.execute(
      'INSERT INTO reading_articles (title, difficulty, word_count, read_time, preview, content_en, content_zh) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [article.title, article.difficulty, article.word_count, article.read_time, article.preview, article.content_en, article.content_zh]
    );
  }

  // 插入示例翻译句子（更多）
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
    },
    {
      english: 'Had it not been for the timely intervention of the government, the economic crisis would have resulted in far more severe consequences.',
      chinese: '如果不是政府的及时干预，经济危机将会导致更加严重的后果。',
      analysis: '虚拟条件句的倒装：Had it not been for = If it had not been for。表示与过去事实相反的假设。',
      difficulty: 'hard'
    },
    {
      english: 'The more we understand about the brain, the more we realize how much remains to be discovered about the nature of consciousness.',
      chinese: '我们对大脑了解得越多，就越意识到关于意识本质还有多少有待发现。',
      analysis: 'The more...the more...句型，表示"越...越..."。两个比较级形成关联。',
      difficulty: 'medium'
    },
    {
      english: 'Whether the proposed policy will achieve its intended goals depends largely on how effectively it is implemented at the local level.',
      chinese: '拟议的政策能否实现其预期目标，在很大程度上取决于它在地方层面的实施效果。',
      analysis: '主干：Whether...depends on how...。Whether引导主语从句，how引导宾语从句。',
      difficulty: 'medium'
    },
    {
      english: 'Not until the Industrial Revolution did people begin to understand the profound impact that human activities could have on the natural environment.',
      chinese: '直到工业革命，人们才开始理解人类活动对自然环境可能产生的深远影响。',
      analysis: 'Not until置于句首引起部分倒装。that引导定语从句修饰impact。',
      difficulty: 'hard'
    },
    {
      english: 'So rapidly has artificial intelligence advanced in recent years that many jobs once thought to be immune to automation are now at risk.',
      chinese: '近年来人工智能发展如此迅速，以至于许多曾被认为不受自动化影响的工作现在也面临风险。',
      analysis: 'So...that...结构，so+副词置于句首引起倒装。once thought to be是过去分词短语作后置定语。',
      difficulty: 'hard'
    },
    {
      english: 'It is essential that every student develop critical thinking skills, which are indispensable for success in the modern workplace.',
      chinese: '每个学生都必须培养批判性思维能力，这对于在现代职场取得成功是不可或缺的。',
      analysis: 'It is essential that...虚拟语气，从句谓语用动词原形。which引导非限制性定语从句。',
      difficulty: 'medium'
    },
    {
      english: 'The extent to which social media influences public opinion has become a subject of intense debate among scholars and policymakers alike.',
      chinese: '社交媒体在多大程度上影响公众舆论，已成为学者和政策制定者激烈争论的话题。',
      analysis: '主干：The extent has become a subject。to which引导定语从句修饰extent。',
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

// 导出初始化函数供外部调用
router.initEnglishTables = initEnglishTables;

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

// ==================== 文章申请接口 ====================

// 提交文章申请
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, content, type } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, message: '内容不能为空' });
    }
    
    await pool.execute(`
      INSERT INTO article_requests (user_id, title, content, type)
      VALUES (?, ?, ?, ?)
    `, [userId, title || '', content, type || 'article']);
    
    res.json({ success: true, message: '申请已提交，等待审核' });
  } catch (error) {
    console.error('提交申请失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

// 获取用户的申请列表
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [requests] = await pool.execute(`
      SELECT * FROM article_requests
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
    
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('获取申请列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ==================== AI生成英语内容（异步轮询模式） ====================

// AI生成新的阅读文章
router.post('/generate-articles', authenticateToken, async (req, res) => {
  try {
    const { count = 3, difficulty = 'medium' } = req.body;
    const userId = req.user.userId;
    const limitCount = Math.min(Math.max(count, 1), 10);

    console.log(`🤖 开始生成${limitCount}篇${difficulty}难度的英语文章...`);

    // 创建异步任务
    const taskId = createTask(TaskType.ARTICLE_GENERATE, userId, async () => {
      const messages = [
        {
          role: 'system',
          content: `你是英语教学专家。生成${limitCount}篇${difficulty}难度的英语阅读文章。
返回JSON数组：[{"title":"标题","difficulty":"${difficulty}","word_count":数字,"read_time":分钟,"preview":"预览","content_en":"英文内容200-400字","content_zh":"中文翻译"}]`
        },
        { role: 'user', content: `生成${limitCount}篇${difficulty}难度的英语阅读文章` }
      ];

      const content = await callAI(messages, { temperature: 0.8, maxTokens: 3000 });
      const articles = parseAIJSON(content);
      
      if (!articles || !Array.isArray(articles) || articles.length === 0) {
        throw new Error('AI生成失败');
      }

      // 保存到数据库
      const savedArticles = [];
      for (const article of articles) {
        const [result] = await pool.execute(
          `INSERT INTO reading_articles (title, difficulty, word_count, read_time, preview, content_en, content_zh) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [article.title || '无标题', article.difficulty || difficulty, article.word_count || 250, article.read_time || 5, article.preview || '', article.content_en || '', article.content_zh || '']
        );
        savedArticles.push({ id: result.insertId, ...article });
      }

      return savedArticles;
    });

    res.json({ success: true, data: { taskId, status: 'processing' } });
  } catch (error) {
    console.error('AI生成文章失败:', error);
    res.status(500).json({ success: false, message: '生成失败' });
  }
});

// AI生成新的翻译句子
router.post('/generate-sentences', authenticateToken, async (req, res) => {
  try {
    const { count = 5, difficulty = 'medium' } = req.body;
    const userId = req.user.userId;
    const limitCount = Math.min(Math.max(count, 1), 15);

    console.log(`🤖 开始生成${limitCount}个${difficulty}难度的英语长难句...`);

    // 创建异步任务
    const taskId = createTask(TaskType.SENTENCE_GENERATE, userId, async () => {
      const messages = [
        {
          role: 'system',
          content: `你是考研英语专家。生成${limitCount}个${difficulty}难度的英语长难句翻译练习。
返回JSON数组：[{"english":"英文句子","chinese":"中文翻译","analysis":"语法分析","difficulty":"${difficulty}"}]`
        },
        { role: 'user', content: `生成${limitCount}个${difficulty}难度的英语长难句` }
      ];

      const content = await callAI(messages, { temperature: 0.8, maxTokens: 2500 });
      const sentences = parseAIJSON(content);
      
      if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
        throw new Error('AI生成失败');
      }

      // 保存到数据库
      const savedSentences = [];
      for (const sentence of sentences) {
        const [result] = await pool.execute(
          `INSERT INTO translation_sentences (english, chinese, analysis, difficulty, source) VALUES (?, ?, ?, ?, 'AI生成')`,
          [sentence.english || '', sentence.chinese || '', sentence.analysis || '', sentence.difficulty || difficulty]
        );
        savedSentences.push({ id: result.insertId, ...sentence });
      }

      return savedSentences;
    });

    res.json({ success: true, data: { taskId, status: 'processing' } });
  } catch (error) {
    console.error('AI生成句子失败:', error);
    res.status(500).json({ success: false, message: '生成失败' });
  }
});

module.exports = router;
