-- 迁移脚本：添加 example_trans 和 meaning 字段
-- 运行此脚本为现有的 words 表添加新字段

USE word_memo;

-- 添加 example_trans 字段（例句翻译）
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_trans TEXT COMMENT '例句翻译（多个用|||分隔）' AFTER example;

-- 添加 meaning 字段（详细释义）
ALTER TABLE words ADD COLUMN IF NOT EXISTS meaning TEXT COMMENT '详细释义（从API获取）' AFTER translation;

-- 添加 updated_at 字段
ALTER TABLE words ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 如果上面的 IF NOT EXISTS 不支持，使用以下兼容写法：
-- ALTER TABLE words ADD COLUMN example_trans TEXT COMMENT '例句翻译（多个用|||分隔）';
-- ALTER TABLE words ADD COLUMN meaning TEXT COMMENT '详细释义（从API获取）';
