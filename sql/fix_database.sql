-- 修复数据库脚本
-- 如果数据库已存在，先删除再重建

DROP DATABASE IF EXISTS word_memo;
CREATE DATABASE word_memo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE word_memo;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(100) UNIQUE NOT NULL COMMENT '微信openid',
  nickname VARCHAR(100) DEFAULT '' COMMENT '昵称',
  avatar_url VARCHAR(500) DEFAULT '' COMMENT '头像URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 单词表（修复TEXT字段默认值问题）
CREATE TABLE IF NOT EXISTS words (
  id INT PRIMARY KEY AUTO_INCREMENT,
  word VARCHAR(100) NOT NULL COMMENT '单词',
  phonetic VARCHAR(200) DEFAULT '' COMMENT '音标',
  translation TEXT NOT NULL COMMENT '翻译',
  example TEXT COMMENT '例句',
  category VARCHAR(50) DEFAULT '四六级' COMMENT '分类',
  difficulty INT DEFAULT 1 COMMENT '难度等级 1-5',
  frequency INT DEFAULT 0 COMMENT '出现频率',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_word (word),
  INDEX idx_category (category)
);

-- 用户学习记录表
CREATE TABLE IF NOT EXISTS user_word_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  word_id INT NOT NULL,
  rating INT DEFAULT 0 COMMENT '熟悉度评分 1-5',
  learned_count INT DEFAULT 0 COMMENT '学习次数',
  last_learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后学习时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_word (user_id, word_id)
);

-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  word_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_collection (user_id, word_id)
);

-- 学习统计表
CREATE TABLE IF NOT EXISTS user_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  date DATE NOT NULL COMMENT '日期',
  learned_count INT DEFAULT 0 COMMENT '当日学习单词数',
  study_time INT DEFAULT 0 COMMENT '学习时长(分钟)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (user_id, date)
);

-- 插入示例单词数据
INSERT INTO words (word, phonetic, translation, example, category) VALUES
('abandon', '/əˈbændən/', 'v. 遗弃；放弃', 'He decided to abandon the project.', '四六级'),
('ability', '/əˈbɪləti/', 'n. 能力；才能', 'She has the ability to do the job.', '四六级'),
('abnormal', '/æbˈnɔːrml/', 'adj. 反常的', 'The weather is abnormal for this time of year.', '四六级'),
('aboard', '/əˈbɔːrd/', 'adv. 在船(车、飞行器)上', 'Welcome aboard!', '四六级'),
('absence', '/ˈæbsəns/', 'n. 缺席；缺乏', 'In the absence of proof, we cannot accuse him.', '四六级'),
('absolute', '/ˈæbsəluːt/', 'adj. 绝对的；完全的', 'I have absolute confidence in you.', '四六级'),
('absorb', '/əbˈzɔːrb/', 'v. 吸收；吸引', 'Plants absorb water from the soil.', '四六级'),
('abstract', '/ˈæbstrækt/', 'adj. 抽象的 n. 摘要', 'This is an abstract concept.', '四六级'),
('academic', '/ˌækəˈdemɪk/', 'adj. 学术的；理论的', 'He has a strong academic background.', '四六级'),
('accelerate', '/əkˈseləreɪt/', 'v. 加速；促进', 'The car began to accelerate.', '四六级'),
('accept', '/əkˈsept/', 'v. 接受；承认', 'I accept your apology.', '四六级'),
('access', '/ˈækses/', 'n. 通道；接近 v. 访问', 'Students have access to the library.', '四六级'),
('accident', '/ˈæksɪdənt/', 'n. 事故；意外', 'There was a car accident yesterday.', '四六级'),
('accompany', '/əˈkʌmpəni/', 'v. 陪伴；伴随', 'I will accompany you to the station.', '四六级'),
('accomplish', '/əˈkʌmplɪʃ/', 'v. 完成；实现', 'We accomplished our mission.', '四六级'),
('accord', '/əˈkɔːrd/', 'n. 协议；一致 v. 给予', 'The two sides reached an accord.', '四六级'),
('account', '/əˈkaʊnt/', 'n. 账户；解释 v. 解释', 'Please give an account of what happened.', '四六级'),
('accurate', '/ˈækjərət/', 'adj. 准确的；精确的', 'Your answer is accurate.', '四六级'),
('achieve', '/əˈtʃiːv/', 'v. 实现；达到', 'She achieved her goal.', '四六级'),
('acquire', '/əˈkwaɪər/', 'v. 获得；学到', 'He acquired new skills.', '四六级'),
('action', '/ˈækʃən/', 'n. 行动；动作', 'We need to take action now.', '四六级'),
('active', '/ˈæktɪv/', 'adj. 积极的；活跃的', 'She is very active in sports.', '四六级'),
('actual', '/ˈæktʃuəl/', 'adj. 实际的；真实的', 'The actual cost was higher.', '四六级'),
('adapt', '/əˈdæpt/', 'v. 适应；改编', 'Animals adapt to their environment.', '四六级'),
('addition', '/əˈdɪʃən/', 'n. 加法；增加', 'In addition to English, he speaks French.', '四六级'),
('adequate', '/ˈædɪkwət/', 'adj. 足够的；适当的', 'We have adequate supplies.', '四六级'),
('adjust', '/əˈdʒʌst/', 'v. 调整；适应', 'Please adjust the volume.', '四六级'),
('administration', '/ədˌmɪnɪˈstreɪʃən/', 'n. 管理；行政', 'The school administration made new rules.', '四六级'),
('admit', '/əˈdmɪt/', 'v. 承认；允许进入', 'He admitted his mistake.', '四六级'),
('adopt', '/əˈdɑːpt/', 'v. 采用；收养', 'They decided to adopt a child.', '四六级');

-- 显示创建结果
SELECT 'Database created successfully!' as message;
SELECT COUNT(*) as word_count FROM words;