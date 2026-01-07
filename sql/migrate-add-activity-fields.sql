-- 为 ai_notes_analysis 表添加活动分析字段
ALTER TABLE ai_notes_analysis 
ADD COLUMN IF NOT EXISTS activity_summary TEXT COMMENT 'AI活动总结',
ADD COLUMN IF NOT EXISTS activity_categories JSON COMMENT '活动分类',
ADD COLUMN IF NOT EXISTS recent_highlights JSON COMMENT '近期亮点';
