-- 更新 users 表，添加微信登录相关字段
-- 执行前请先备份数据

-- 添加 session_key 字段（存储微信session_key）
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_key VARCHAR(255) DEFAULT '';

-- 添加 last_login_at 字段（最后登录时间）
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME DEFAULT NULL;

-- 添加 created_at 字段（如果不存在）
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 确保 openid 字段足够长
ALTER TABLE users MODIFY COLUMN openid VARCHAR(128) NOT NULL;

-- 确保 nickname 和 avatar_url 字段存在
ALTER TABLE users MODIFY COLUMN nickname VARCHAR(100) DEFAULT '微信用户';
ALTER TABLE users MODIFY COLUMN avatar_url VARCHAR(500) DEFAULT '';

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_users_openid ON users(openid);
