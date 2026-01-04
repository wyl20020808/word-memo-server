-- AI智能学习功能数据表
-- 执行: mysql -u root -p word_memo < ai-tables.sql

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  vocabulary_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
  daily_goal INT DEFAULT 50,
  exam_date DATE,
  target_words INT DEFAULT 5000,
  reminder_time TIME DEFAULT '20:00:00',
  reminder_enabled TINYINT DEFAULT 1,
  preferred_mode ENUM('card', 'quiz', 'spell') DEFAULT 'card',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 单词掌握度表（SM-2算法核心）
CREATE TABLE IF NOT EXISTS word_mastery (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  word_id INT NOT NULL,
  easiness_factor DECIMAL(4,2) DEFAULT 2.50,  -- 难度因子 (1.3-2.5)
  repetition INT DEFAULT 0,                    -- 重复次数
  interval_days INT DEFAULT 1,                 -- 当前间隔天数
  next_review_date DATE,                       -- 下次复习日期
  last_quality INT DEFAULT 0,                  -- 上次评分 (0-5)
  correct_count INT DEFAULT 0,                 -- 正确次数
  wrong_count INT DEFAULT 0,                   -- 错误次数
  error_type VARCHAR(50),                      -- 错误类型 (spelling/meaning/usage)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_word (user_id, word_id),
  INDEX idx_next_review (user_id, next_review_date),
  INDEX idx_easiness (user_id, easiness_factor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 学习日志表
CREATE TABLE IF NOT EXISTS learning_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  word_id INT NOT NULL,
  action ENUM('learn', 'review', 'quiz', 'spell') NOT NULL,
  quality INT DEFAULT 0,                       -- 评分 (0-5)
  time_spent INT DEFAULT 0,                    -- 花费时间(秒)
  is_correct TINYINT DEFAULT 0,
  error_type VARCHAR(50),                      -- 错误类型
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, created_at),
  INDEX idx_word (word_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 诊断结果表
CREATE TABLE IF NOT EXISTS diagnosis_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  total_questions INT DEFAULT 20,
  correct_count INT DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  vocabulary_level ENUM('beginner', 'intermediate', 'advanced'),
  estimated_vocabulary INT DEFAULT 0,          -- 估计词汇量
  weak_areas JSON,                             -- 薄弱领域
  details JSON,                                -- 详细答题记录
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 学习计划表
CREATE TABLE IF NOT EXISTS learning_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  plan_name VARCHAR(100) DEFAULT '默认计划',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_words INT DEFAULT 5000,
  daily_new_words INT DEFAULT 50,
  daily_review_words INT DEFAULT 25,
  is_active TINYINT DEFAULT 1,
  progress_percent DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 为words表添加difficulty字段（如果不存在）
ALTER TABLE words ADD COLUMN IF NOT EXISTS difficulty INT DEFAULT 1;
