-- 为ai_notes_analysis表添加活动分析字段
-- 如果字段已存在，会被忽略

ALTER TABLE ai_notes_analysis 
ADD COLUMN IF NOT EXISTS activity_summary TEXT COMMENT 'AI活动总结' AFTER suggestions,
ADD COLUMN IF NOT EXISTS activity_categories JSON COMMENT '活动分类' AFTER activity_summary,
ADD COLUMN IF NOT EXISTS recent_highlights JSON COMMENT '近期亮点' AFTER activity_categories;

-- 验证字段是否添加成功
DESCRIBE ai_notes_analysis;
