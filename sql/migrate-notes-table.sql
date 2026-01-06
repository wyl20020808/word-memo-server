-- 修改ai_notes表结构（简化，只存原始内容）
ALTER TABLE ai_notes 
  DROP COLUMN IF EXISTS categories,
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS key_points,
  DROP COLUMN IF EXISTS suggestions,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '' AFTER original_content;

-- 创建AI分析结果表（存储综合分析结果）
CREATE TABLE IF NOT EXISTS ai_notes_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  summary TEXT,
  key_points JSON,
  suggestions JSON,
  notes_count INT DEFAULT 0,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_analyzed (user_id, analyzed_at)
);
