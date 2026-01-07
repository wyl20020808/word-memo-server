-- 创建复盘记录相关表
-- 执行: 在数据库管理工具中运行此SQL

-- 复盘记录表
CREATE TABLE IF NOT EXISTS ai_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  original_content TEXT NOT NULL,
  category VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI分析结果表
CREATE TABLE IF NOT EXISTS ai_notes_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  summary TEXT,
  key_points JSON,
  suggestions JSON,
  notes_count INT DEFAULT 0,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_analyzed (user_id, analyzed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
