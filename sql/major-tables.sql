-- 408专业课题库表
-- 执行前请先连接到 word_memo 数据库

-- 1. 创建题目表
CREATE TABLE IF NOT EXISTS major_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subject VARCHAR(10) NOT NULL COMMENT 'ds=数据结构,os=操作系统,cn=计算机网络,co=组成原理',
  chapter VARCHAR(100) COMMENT '章节',
  question TEXT NOT NULL COMMENT '题目内容',
  option_a VARCHAR(500) NOT NULL,
  option_b VARCHAR(500) NOT NULL,
  option_c VARCHAR(500) NOT NULL,
  option_d VARCHAR(500) NOT NULL,
  answer CHAR(1) NOT NULL COMMENT '正确答案A/B/C/D',
  explanation TEXT COMMENT '解析',
  difficulty VARCHAR(10) DEFAULT 'medium' COMMENT 'easy/medium/hard',
  source VARCHAR(100) COMMENT '来源',
  year INT COMMENT '年份',
  is_ai_generated TINYINT DEFAULT 0,
  use_count INT DEFAULT 0,
  correct_rate DECIMAL(5,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subject (subject),
  INDEX idx_difficulty (difficulty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 创建用户答题记录表
CREATE TABLE IF NOT EXISTS user_major_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  user_answer CHAR(1),
  is_correct TINYINT,
  time_spent INT COMMENT '答题用时(秒)',
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 创建用户统计表
CREATE TABLE IF NOT EXISTS user_major_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  subject VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  questions_done INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  UNIQUE KEY unique_user_subject_date (user_id, subject, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 插入预置408真题
INSERT INTO major_questions (subject, chapter, question, option_a, option_b, option_c, option_d, answer, explanation, difficulty, source, year, is_ai_generated) VALUES
('ds', '线性表', '在一个长度为n的顺序表中，在第i个位置插入一个新元素，需要移动的元素个数为：', 'n-i', 'n-i+1', 'n-i-1', 'i', 'B', '在第i个位置插入元素，需要将第i到第n个元素都向后移动一位，共n-i+1个元素。', 'easy', '408真题', 2020, 0),
('ds', '栈和队列', '若一个栈的入栈序列为1,2,3,...,n，其出栈序列为p1,p2,p3,...,pn，则下列哪个出栈序列是不可能的？', '3,2,1,4,5,...,n', '1,2,3,4,5,...,n', 'n,n-1,...,3,2,1', '3,4,2,1,5,...,n', 'D', '3出栈时，1和2必须在栈中，4出栈后，2不可能在1之前出栈。', 'medium', '408真题', 2019, 0),
('ds', '树与二叉树', '一棵完全二叉树有1000个结点，则该树的叶子结点数为：', '499', '500', '501', '502', 'B', '完全二叉树中，n0=n2+1，n=n0+n1+n2。1000个结点的完全二叉树n1=1，所以n0=500。', 'medium', '408真题', 2021, 0),
('ds', '图', '对于有n个顶点的无向图，若采用邻接矩阵存储，则该矩阵的大小为：', 'n', 'n²', '2n', 'n(n-1)/2', 'B', '邻接矩阵是n×n的二维数组，存储空间为n²。', 'easy', '408真题', 2018, 0),
('ds', '排序', '下列排序算法中，时间复杂度与初始数据状态无关的是：', '直接插入排序', '快速排序', '堆排序', '冒泡排序', 'C', '堆排序的时间复杂度始终为O(nlogn)，与初始数据状态无关。', 'medium', '408真题', 2020, 0),
('os', '进程管理', '下列关于进程和线程的叙述中，正确的是：', '进程是资源分配的基本单位，线程是调度的基本单位', '线程是资源分配的基本单位，进程是调度的基本单位', '进程和线程都是资源分配的基本单位', '进程和线程都是调度的基本单位', 'A', '进程是资源分配的基本单位，线程是CPU调度的基本单位。', 'easy', '408真题', 2019, 0),
('os', '内存管理', '在请求分页存储管理中，若采用FIFO页面置换算法，当分配给进程的物理块数增加时，缺页次数：', '一定减少', '一定增加', '可能增加也可能减少', '保持不变', 'C', '这是Belady异常现象，FIFO算法可能出现分配更多物理块反而缺页次数增加的情况。', 'hard', '408真题', 2020, 0),
('os', '文件管理', '在UNIX系统中，文件的物理结构采用的是：', '连续结构', '链接结构', '索引结构', '混合索引结构', 'D', 'UNIX采用混合索引结构，包括直接地址、一次间接、二次间接和三次间接索引。', 'medium', '408真题', 2018, 0),
('cn', '物理层', '在OSI参考模型中，提供端到端可靠传输服务的是：', '物理层', '数据链路层', '网络层', '传输层', 'D', '传输层提供端到端的可靠传输服务，如TCP协议。', 'easy', '408真题', 2019, 0),
('cn', '网络层', 'IP地址192.168.1.100/26的子网掩码是：', '255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224', 'C', '/26表示前26位为网络号，子网掩码为255.255.255.192（11111111.11111111.11111111.11000000）。', 'medium', '408真题', 2020, 0),
('cn', '传输层', 'TCP建立连接需要进行几次握手？', '1次', '2次', '3次', '4次', 'C', 'TCP建立连接需要三次握手：SYN、SYN+ACK、ACK。', 'easy', '408真题', 2018, 0),
('co', '数据表示', '若某计算机字长为8位，采用补码表示，则能表示的整数范围是：', '-127~127', '-128~127', '-128~128', '-127~128', 'B', '8位补码表示范围为-2^7到2^7-1，即-128到127。', 'easy', '408真题', 2019, 0),
('co', 'CPU', '下列关于RISC和CISC的叙述中，正确的是：', 'RISC的指令数量多于CISC', 'RISC的指令长度固定', 'CISC更适合流水线技术', 'RISC的寻址方式更复杂', 'B', 'RISC特点：指令数量少、长度固定、寻址方式简单、适合流水线。', 'medium', '408真题', 2020, 0),
('co', '存储系统', 'Cache的地址映射方式中，冲突概率最低的是：', '直接映射', '全相联映射', '组相联映射', '以上都一样', 'B', '全相联映射允许主存块映射到Cache任意位置，冲突概率最低，但硬件复杂。', 'medium', '408真题', 2021, 0);

-- 验证
SELECT '表创建完成' as status;
SELECT COUNT(*) as question_count FROM major_questions;
