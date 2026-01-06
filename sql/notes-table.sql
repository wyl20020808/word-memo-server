-- AI复盘笔记表
CREATE TABLE IF NOT EXISTS ai_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  original_content TEXT NOT NULL COMMENT '用户原始输入内容',
  categories JSON COMMENT '分类标签数组',
  summary TEXT COMMENT 'AI生成的摘要',
  key_points JSON COMMENT '关键要点数组',
  suggestions JSON COMMENT 'AI建议数组',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
