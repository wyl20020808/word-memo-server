const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-1-5-lite-32k-250115';

// 408四门课程
const SUBJECTS = {
  ds: { name: '数据结构', code: 'ds' },
  os: { name: '操作系统', code: 'os' },
  cn: { name: '计算机网络', code: 'cn' },
  co: { name: '计算机组成原理', code: 'co' }
};

// 初始化408题库表
async function init408Tables() {
  try {
    console.log('🔄 开始初始化408专业课表...');
    
    // 题目表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS major_questions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        subject VARCHAR(10) NOT NULL,
        chapter VARCHAR(100),
        question TEXT NOT NULL,
        option_a VARCHAR(500) NOT NULL,
        option_b VARCHAR(500) NOT NULL,
        option_c VARCHAR(500) NOT NULL,
        option_d VARCHAR(500) NOT NULL,
        answer CHAR(1) NOT NULL,
        explanation TEXT,
        ai_analysis TEXT,
        difficulty VARCHAR(10) DEFAULT 'medium',
        source VARCHAR(100),
        year INT,
        is_ai_generated TINYINT DEFAULT 0,
        use_count INT DEFAULT 0,
        correct_rate DECIMAL(5,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subject (subject),
        INDEX idx_difficulty (difficulty)
      )
    `);
    console.log('✅ major_questions 表创建成功');

    // 用户答题记录表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_major_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        question_id INT NOT NULL,
        user_answer CHAR(1),
        is_correct TINYINT,
        time_spent INT,
        answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_question (question_id)
      )
    `);
    console.log('✅ user_major_records 表创建成功');

    // 用户408统计表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_major_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        subject VARCHAR(10) NOT NULL,
        date DATE NOT NULL,
        questions_done INT DEFAULT 0,
        correct_count INT DEFAULT 0,
        UNIQUE KEY unique_user_subject_date (user_id, subject, date)
      )
    `);
    console.log('✅ user_major_stats 表创建成功');

    // 安全添加ai_analysis字段（如果不存在）
    try {
      await pool.execute(`
        ALTER TABLE major_questions 
        ADD COLUMN ai_analysis TEXT AFTER explanation
      `);
      console.log('✅ ai_analysis 字段添加成功');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('✅ ai_analysis 字段已存在');
      } else {
        console.log('⚠️ ai_analysis 字段添加失败:', error.message);
      }
    }

    // 检查是否有题目，没有则插入预置题目
    const [count] = await pool.execute('SELECT COUNT(*) as cnt FROM major_questions');
    console.log('📊 当前题目数量:', count[0].cnt);
    if (count[0].cnt === 0) {
      await insertPresetQuestions();
    }

    console.log('✅ 408专业课题库表初始化完成');
  } catch (error) {
    console.error('❌ 初始化408表失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 导出初始化函数供外部调用
router.init408Tables = init408Tables;

// 插入预置的408真题
async function insertPresetQuestions() {
  const questions = [
    // 数据结构
    {
      subject: 'ds',
      chapter: '线性表',
      question: '在一个长度为n的顺序表中，在第i个位置插入一个新元素，需要移动的元素个数为：',
      option_a: 'n-i',
      option_b: 'n-i+1',
      option_c: 'n-i-1',
      option_d: 'i',
      answer: 'B',
      explanation: '在第i个位置插入元素，需要将第i到第n个元素都向后移动一位，共n-i+1个元素。',
      difficulty: 'easy',
      source: '408真题',
      year: 2020
    },
    {
      subject: 'ds',
      chapter: '栈和队列',
      question: '若一个栈的入栈序列为1,2,3,...,n，其出栈序列为p1,p2,p3,...,pn，则下列哪个出栈序列是不可能的？',
      option_a: '3,2,1,4,5,...,n',
      option_b: '1,2,3,4,5,...,n',
      option_c: 'n,n-1,...,3,2,1',
      option_d: '3,4,2,1,5,...,n',
      answer: 'D',
      explanation: '3出栈时，1和2必须在栈中，4出栈后，2不可能在1之前出栈。',
      difficulty: 'medium',
      source: '408真题',
      year: 2019
    },
    {
      subject: 'ds',
      chapter: '树与二叉树',
      question: '一棵完全二叉树有1000个结点，则该树的叶子结点数为：',
      option_a: '499',
      option_b: '500',
      option_c: '501',
      option_d: '502',
      answer: 'B',
      explanation: '完全二叉树中，n0=n2+1，n=n0+n1+n2。1000个结点的完全二叉树n1=1，所以n0=500。',
      difficulty: 'medium',
      source: '408真题',
      year: 2021
    },
    {
      subject: 'ds',
      chapter: '图',
      question: '对于有n个顶点的无向图，若采用邻接矩阵存储，则该矩阵的大小为：',
      option_a: 'n',
      option_b: 'n²',
      option_c: '2n',
      option_d: 'n(n-1)/2',
      answer: 'B',
      explanation: '邻接矩阵是n×n的二维数组，存储空间为n²。',
      difficulty: 'easy',
      source: '408真题',
      year: 2018
    },
    {
      subject: 'ds',
      chapter: '排序',
      question: '下列排序算法中，时间复杂度与初始数据状态无关的是：',
      option_a: '直接插入排序',
      option_b: '快速排序',
      option_c: '堆排序',
      option_d: '冒泡排序',
      answer: 'C',
      explanation: '堆排序的时间复杂度始终为O(nlogn)，与初始数据状态无关。',
      difficulty: 'medium',
      source: '408真题',
      year: 2020
    },
    // 操作系统
    {
      subject: 'os',
      chapter: '进程管理',
      question: '下列关于进程和线程的叙述中，正确的是：',
      option_a: '进程是资源分配的基本单位，线程是调度的基本单位',
      option_b: '线程是资源分配的基本单位，进程是调度的基本单位',
      option_c: '进程和线程都是资源分配的基本单位',
      option_d: '进程和线程都是调度的基本单位',
      answer: 'A',
      explanation: '进程是资源分配的基本单位，线程是CPU调度的基本单位。',
      difficulty: 'easy',
      source: '408真题',
      year: 2019
    },
    {
      subject: 'os',
      chapter: '内存管理',
      question: '在请求分页存储管理中，若采用FIFO页面置换算法，当分配给进程的物理块数增加时，缺页次数：',
      option_a: '一定减少',
      option_b: '一定增加',
      option_c: '可能增加也可能减少',
      option_d: '保持不变',
      answer: 'C',
      explanation: '这是Belady异常现象，FIFO算法可能出现分配更多物理块反而缺页次数增加的情况。',
      difficulty: 'hard',
      source: '408真题',
      year: 2020
    },
    {
      subject: 'os',
      chapter: '文件管理',
      question: '在UNIX系统中，文件的物理结构采用的是：',
      option_a: '连续结构',
      option_b: '链接结构',
      option_c: '索引结构',
      option_d: '混合索引结构',
      answer: 'D',
      explanation: 'UNIX采用混合索引结构，包括直接地址、一次间接、二次间接和三次间接索引。',
      difficulty: 'medium',
      source: '408真题',
      year: 2018
    },
    // 计算机网络
    {
      subject: 'cn',
      chapter: '物理层',
      question: '在OSI参考模型中，提供端到端可靠传输服务的是：',
      option_a: '物理层',
      option_b: '数据链路层',
      option_c: '网络层',
      option_d: '传输层',
      answer: 'D',
      explanation: '传输层提供端到端的可靠传输服务，如TCP协议。',
      difficulty: 'easy',
      source: '408真题',
      year: 2019
    },
    {
      subject: 'cn',
      chapter: '网络层',
      question: 'IP地址192.168.1.100/26的子网掩码是：',
      option_a: '255.255.255.0',
      option_b: '255.255.255.128',
      option_c: '255.255.255.192',
      option_d: '255.255.255.224',
      answer: 'C',
      explanation: '/26表示前26位为网络号，子网掩码为255.255.255.192（11111111.11111111.11111111.11000000）。',
      difficulty: 'medium',
      source: '408真题',
      year: 2020
    },
    {
      subject: 'cn',
      chapter: '传输层',
      question: 'TCP建立连接需要进行几次握手？',
      option_a: '1次',
      option_b: '2次',
      option_c: '3次',
      option_d: '4次',
      answer: 'C',
      explanation: 'TCP建立连接需要三次握手：SYN、SYN+ACK、ACK。',
      difficulty: 'easy',
      source: '408真题',
      year: 2018
    },
    // 计算机组成原理
    {
      subject: 'co',
      chapter: '数据表示',
      question: '若某计算机字长为8位，采用补码表示，则能表示的整数范围是：',
      option_a: '-127~127',
      option_b: '-128~127',
      option_c: '-128~128',
      option_d: '-127~128',
      answer: 'B',
      explanation: '8位补码表示范围为-2^7到2^7-1，即-128到127。',
      difficulty: 'easy',
      source: '408真题',
      year: 2019
    },
    {
      subject: 'co',
      chapter: 'CPU',
      question: '下列关于RISC和CISC的叙述中，正确的是：',
      option_a: 'RISC的指令数量多于CISC',
      option_b: 'RISC的指令长度固定',
      option_c: 'CISC更适合流水线技术',
      option_d: 'RISC的寻址方式更复杂',
      answer: 'B',
      explanation: 'RISC特点：指令数量少、长度固定、寻址方式简单、适合流水线。',
      difficulty: 'medium',
      source: '408真题',
      year: 2020
    },
    {
      subject: 'co',
      chapter: '存储系统',
      question: 'Cache的地址映射方式中，冲突概率最低的是：',
      option_a: '直接映射',
      option_b: '全相联映射',
      option_c: '组相联映射',
      option_d: '以上都一样',
      answer: 'B',
      explanation: '全相联映射允许主存块映射到Cache任意位置，冲突概率最低，但硬件复杂。',
      difficulty: 'medium',
      source: '408真题',
      year: 2021
    }
  ];

  for (const q of questions) {
    await pool.execute(`
      INSERT INTO major_questions (subject, chapter, question, option_a, option_b, option_c, option_d, answer, explanation, difficulty, source, year, is_ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [q.subject, q.chapter, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.answer, q.explanation, q.difficulty, q.source, q.year]);
  }

  console.log('✅ 预置408真题插入完成');
}

init408Tables();

// ==================== 题目接口 ====================

// 获取题目列表（随机抽取）
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const { subject, count = 10, difficulty } = req.query;
    const limitCount = Math.min(Math.max(parseInt(count) || 10, 1), 50); // 限制1-50
    
    let questions = [];
    
    // 先从数据库获取现有题目
    let sql = 'SELECT * FROM major_questions WHERE 1=1';
    const params = [];
    
    if (subject) {
      sql += ' AND subject = ?';
      params.push(subject);
    }
    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }
    
    sql += ` ORDER BY RAND() LIMIT ${limitCount}`;
    
    const [existingQuestions] = await pool.execute(sql, params);
    questions = existingQuestions;
    
    // 如果题目数量不足，AI生成补充
    if (questions.length < limitCount) {
      const remaining = limitCount - questions.length;
      
      if (!DOUBAO_API_KEY) {
        // 没有AI服务，返回现有题目
        const safeQuestions = questions.map(q => ({
          id: q.id,
          subject: q.subject,
          chapter: q.chapter,
          question: q.question,
          options: {
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d
          },
          difficulty: q.difficulty
        }));
        
        return res.json({ 
          success: true, 
          data: safeQuestions,
          message: `题库不足，仅返回${questions.length}道题目`
        });
      }
      
      // AI生成补充题目
      const subjectName = subject ? SUBJECTS[subject]?.name || '408专业课' : '408专业课';
      
      try {
        const response = await axios.post(
          'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
          {
            model: DOUBAO_MODEL,
            messages: [
              {
                role: 'system',
                content: `你是一个考研408专业课出题专家。请生成${remaining}道${subjectName}的选择题。

严格按照以下JSON格式返回，只返回JSON数组：
[
  {
    "question": "题目内容",
    "option_a": "选项A内容",
    "option_b": "选项B内容", 
    "option_c": "选项C内容",
    "option_d": "选项D内容",
    "answer": "正确答案(A/B/C/D)",
    "explanation": "解析",
    "difficulty": "easy/medium/hard",
    "chapter": "所属章节"
  }
]

要求：
1. 题目符合考研408难度
2. 选项有迷惑性
3. 解析详细清晰`
              },
              {
                role: 'user',
                content: `请生成${remaining}道${subjectName}的选择题`
              }
            ],
            temperature: 0.8,
            max_tokens: 2000
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DOUBAO_API_KEY}`
            },
            timeout: 60000
          }
        );

        const content = response.data.choices[0]?.message?.content || '';
        
        // 解析JSON
        let generatedQuestions = [];
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            generatedQuestions = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('解析AI生成题目失败:', e);
        }
        
        // 保存AI生成的题目到数据库
        for (const q of generatedQuestions) {
          try {
            const [result] = await pool.execute(`
              INSERT INTO major_questions (subject, chapter, question, option_a, option_b, option_c, option_d, answer, explanation, difficulty, source, is_ai_generated)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AI生成', 1)
            `, [
              subject || 'ds', 
              q.chapter || '', 
              q.question, 
              q.option_a, 
              q.option_b, 
              q.option_c, 
              q.option_d, 
              q.answer, 
              q.explanation, 
              q.difficulty || 'medium'
            ]);
            
            // 添加到返回列表
            questions.push({
              id: result.insertId,
              subject: subject || 'ds',
              chapter: q.chapter || '',
              question: q.question,
              option_a: q.option_a,
              option_b: q.option_b,
              option_c: q.option_c,
              option_d: q.option_d,
              difficulty: q.difficulty || 'medium'
            });
          } catch (dbError) {
            console.error('保存AI题目失败:', dbError);
          }
        }
      } catch (aiError) {
        console.error('AI生成题目失败:', aiError);
      }
    }
    
    // 不返回答案和解析
    const safeQuestions = questions.map(q => ({
      id: q.id,
      subject: q.subject,
      chapter: q.chapter,
      question: q.question,
      options: {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d
      },
      difficulty: q.difficulty
    }));
    
    res.json({ success: true, data: safeQuestions });
  } catch (error) {
    console.error('获取题目失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 提交答案
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questionId, answer, timeSpent } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    // 获取正确答案
    const [questions] = await pool.execute(
      'SELECT * FROM major_questions WHERE id = ?',
      [questionId]
    );
    
    if (questions.length === 0) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }
    
    const question = questions[0];
    const isCorrect = answer.toUpperCase() === question.answer;
    
    // 记录答题
    await pool.execute(`
      INSERT INTO user_major_records (user_id, question_id, user_answer, is_correct, time_spent)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, questionId, answer, isCorrect ? 1 : 0, timeSpent || 0]);
    
    // 更新题目统计
    await pool.execute(`
      UPDATE major_questions 
      SET use_count = use_count + 1,
          correct_rate = (SELECT AVG(is_correct) * 100 FROM user_major_records WHERE question_id = ?)
      WHERE id = ?
    `, [questionId, questionId]);
    
    // 更新用户统计
    await pool.execute(`
      INSERT INTO user_major_stats (user_id, subject, date, questions_done, correct_count)
      VALUES (?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE 
        questions_done = questions_done + 1,
        correct_count = correct_count + ?
    `, [userId, question.subject, today, isCorrect ? 1 : 0, isCorrect ? 1 : 0]);
    
    res.json({
      success: true,
      data: {
        isCorrect,
        correctAnswer: question.answer,
        explanation: question.explanation
      }
    });
  } catch (error) {
    console.error('提交答案失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

// AI生成题目
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { subject, chapter, count = 3 } = req.body;
    
    if (!DOUBAO_API_KEY) {
      return res.status(400).json({ success: false, message: 'AI服务未配置' });
    }
    
    const subjectName = SUBJECTS[subject]?.name || '计算机专业课';
    
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: DOUBAO_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个考研408专业课出题专家。请生成${count}道${subjectName}${chapter ? '（' + chapter + '）' : ''}的选择题。

严格按照以下JSON格式返回，只返回JSON数组，不要有其他文字：
[
  {
    "question": "题目内容",
    "option_a": "选项A内容",
    "option_b": "选项B内容", 
    "option_c": "选项C内容",
    "option_d": "选项D内容",
    "answer": "正确答案(A/B/C/D)",
    "explanation": "解析",
    "difficulty": "easy/medium/hard",
    "chapter": "所属章节"
  }
]

要求：
1. 题目要符合考研408难度
2. 选项要有迷惑性
3. 解析要详细清晰
4. 难度分布合理`
          },
          {
            role: 'user',
            content: `请生成${count}道${subjectName}${chapter ? chapter : ''}的选择题`
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_API_KEY}`
        },
        timeout: 60000
      }
    );

    const content = response.data.choices[0]?.message?.content || '';
    
    // 解析JSON
    let generatedQuestions = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedQuestions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('解析AI生成题目失败:', e);
      return res.status(500).json({ success: false, message: '生成失败' });
    }
    
    // 保存到数据库
    const savedIds = [];
    for (const q of generatedQuestions) {
      const [result] = await pool.execute(`
        INSERT INTO major_questions (subject, chapter, question, option_a, option_b, option_c, option_d, answer, explanation, difficulty, source, is_ai_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AI生成', 1)
      `, [subject, q.chapter || chapter, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.answer, q.explanation, q.difficulty || 'medium']);
      savedIds.push(result.insertId);
    }
    
    // 返回生成的题目（不含答案）
    const safeQuestions = generatedQuestions.map((q, i) => ({
      id: savedIds[i],
      subject,
      chapter: q.chapter || chapter,
      question: q.question,
      options: {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d
      },
      difficulty: q.difficulty || 'medium'
    }));
    
    res.json({ success: true, data: safeQuestions });
  } catch (error) {
    console.error('AI生成题目失败:', error);
    res.status(500).json({ success: false, message: '生成失败' });
  }
});

// 获取用户408统计
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];
    
    // 今日统计
    const [todayStats] = await pool.execute(`
      SELECT subject, SUM(questions_done) as done, SUM(correct_count) as correct
      FROM user_major_stats
      WHERE user_id = ? AND date = ?
      GROUP BY subject
    `, [userId, today]);
    
    // 累计统计
    const [totalStats] = await pool.execute(`
      SELECT subject, SUM(questions_done) as done, SUM(correct_count) as correct
      FROM user_major_stats
      WHERE user_id = ?
      GROUP BY subject
    `, [userId]);
    
    // 题库统计
    const [questionStats] = await pool.execute(`
      SELECT subject, COUNT(*) as count FROM major_questions GROUP BY subject
    `);
    
    res.json({
      success: true,
      data: {
        today: todayStats,
        total: totalStats,
        questionBank: questionStats
      }
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 获取错题本
router.get('/wrong', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subject, limit = 20 } = req.query;
    const limitCount = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // 限制1-100
    
    let sql = `
      SELECT DISTINCT q.*, r.user_answer, r.answered_at
      FROM major_questions q
      JOIN user_major_records r ON q.id = r.question_id
      WHERE r.user_id = ? AND r.is_correct = 0
    `;
    const params = [userId];
    
    if (subject) {
      sql += ' AND q.subject = ?';
      params.push(subject);
    }
    
    sql += ` ORDER BY r.answered_at DESC LIMIT ${limitCount}`;
    
    const [questions] = await pool.execute(sql, params);
    
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('获取错题失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// AI解析题目
router.post('/analysis', authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.body;
    
    if (!DOUBAO_API_KEY) {
      return res.status(400).json({ success: false, message: 'AI服务未配置' });
    }
    
    // 获取题目信息
    const [questions] = await pool.execute(
      'SELECT * FROM major_questions WHERE id = ?',
      [questionId]
    );
    
    if (questions.length === 0) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }
    
    const question = questions[0];
    
    // 如果已有AI解析，直接返回
    if (question.ai_analysis) {
      return res.json({ 
        success: true, 
        data: { analysis: question.ai_analysis, cached: true }
      });
    }
    
    // 调用AI生成解析
    const subjectName = SUBJECTS[question.subject]?.name || '专业课';
    
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: DOUBAO_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个考研408专业课辅导老师。请简洁地解析题目，包括：
1. 核心知识点
2. 解题思路
3. 易错提醒

要求：简洁明了，300字以内。`
          },
          {
            role: 'user',
            content: `解析这道${subjectName}题目：

${question.question}
A. ${question.option_a}
B. ${question.option_b}
C. ${question.option_c}
D. ${question.option_d}

正确答案：${question.answer}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_API_KEY}`
        },
        timeout: 60000
      }
    );

    const analysis = response.data.choices[0]?.message?.content || '';
    
    // 保存AI解析到数据库
    await pool.execute(
      'UPDATE major_questions SET ai_analysis = ? WHERE id = ?',
      [analysis, questionId]
    );
    
    res.json({ 
      success: true, 
      data: { analysis, cached: false }
    });
  } catch (error) {
    console.error('AI解析失败:', error);
    res.status(500).json({ success: false, message: '解析失败' });
  }
});

module.exports = router;
