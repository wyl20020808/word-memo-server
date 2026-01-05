// AI总结生成服务 - 支持从自然语言提取学习数据
const { callAI, parseAIJSON } = require('./aiService');

// 从用户输入中提取学习数据
async function extractStudyData(userInput) {
  if (!userInput || userInput.trim().length < 10) {
    return null;
  }

  try {
    const messages = [
      {
        role: 'system',
        content: `你是一个学习数据提取助手。从用户描述的今日学习内容中提取具体的学习数据。

请严格按照以下JSON格式返回，只返回JSON，不要有其他文字：
{
  "math": { "time": 数字(分钟), "exercises": 数字(题目数), "chapters": "章节名称" },
  "politics": { "time": 数字(分钟), "exercises": 数字(题目数), "notes": 数字(笔记数) },
  "major": { "time": 数字(分钟), "exercises": 数字(题目数), "notes": 数字(笔记数) },
  "other": "其他学习内容描述"
}

提取规则：
- 如果用户提到"做了X道题"、"刷了X题"，提取为exercises
- 如果用户提到"学了X小时/分钟"、"看了X小时"，提取为time（统一转为分钟）
- 如果用户提到"第X章"、"XX章节"，提取为chapters
- 如果用户提到"做了笔记"、"整理了X条笔记"，提取为notes
- 没有提到的字段设为0或空字符串
- 1小时=60分钟，半小时=30分钟`
      },
      {
        role: 'user',
        content: userInput
      }
    ];

    const content = await callAI(messages, { temperature: 0.3, maxTokens: 500 });
    const data = parseAIJSON(content);
    
    if (data) {
      console.log('✅ 成功提取学习数据:', data);
      return data;
    } else {
      console.log('⚠️ AI返回格式不正确，使用默认解析');
      return null;
    }
  } catch (error) {
    console.error('AI提取数据失败:', error.message);
    return null;
  }
}

// 生成AI学习总结
async function generateAISummary(studyData) {
  const { progress, english, words, userNotes, mood, extractedData } = studyData;

  // 构建学习数据描述
  let dataDescription = '今日学习数据：\n';
  
  // 英语数据（自动获取）
  dataDescription += `【英语】背单词${words}个`;
  if (english.reading_count) dataDescription += `，阅读${english.reading_count}篇`;
  if (english.translation_count) dataDescription += `，翻译${english.translation_count}句`;
  if (english.quiz_count) dataDescription += `，抽背${english.quiz_count}个`;
  dataDescription += '\n';

  // 其他科目数据（用户手动记录 + AI提取）
  const subjectNames = { math: '数学', politics: '政治', major: '专业课' };
  
  // 合并手动记录和AI提取的数据
  const mergedProgress = {};
  progress.forEach(p => {
    mergedProgress[p.subject] = p;
  });
  
  if (extractedData) {
    ['math', 'politics', 'major'].forEach(subject => {
      const extracted = extractedData[subject];
      if (extracted) {
        if (!mergedProgress[subject]) {
          mergedProgress[subject] = { subject };
        }
        if (extracted.time) mergedProgress[subject].study_time = (mergedProgress[subject].study_time || 0) + extracted.time;
        if (extracted.exercises) mergedProgress[subject].exercises_done = (mergedProgress[subject].exercises_done || 0) + extracted.exercises;
        if (extracted.chapters) mergedProgress[subject].chapters_done = extracted.chapters;
        if (extracted.notes) mergedProgress[subject].notes_count = (mergedProgress[subject].notes_count || 0) + extracted.notes;
      }
    });
  }

  Object.keys(mergedProgress).forEach(subject => {
    if (subject !== 'english') {
      const p = mergedProgress[subject];
      const name = subjectNames[subject] || subject;
      let desc = `【${name}】`;
      const parts = [];
      if (p.study_time) parts.push(`学习${p.study_time}分钟`);
      if (p.exercises_done) parts.push(`做题${p.exercises_done}道`);
      if (p.chapters_done) parts.push(`完成：${p.chapters_done}`);
      if (p.notes_count) parts.push(`笔记${p.notes_count}条`);
      if (p.error_count) parts.push(`错题${p.error_count}道`);
      if (parts.length > 0) {
        dataDescription += desc + parts.join('，') + '\n';
      }
    }
  });

  // 用户心得
  if (userNotes) {
    dataDescription += `\n用户描述：${userNotes}\n`;
  }

  // 心情
  const moodMap = { great: '非常好', good: '不错', normal: '一般', tired: '疲惫', bad: '不好' };
  if (mood) {
    dataDescription += `今日状态：${moodMap[mood] || mood}\n`;
  }

  // 如果没有AI API，使用本地生成
  try {
    const messages = [
      {
        role: 'system',
        content: `你是一个考研学习助手，帮助学生总结每日学习情况并给出建议。
请根据学生的学习数据，生成：
1. 简洁的今日学习总结（80字以内，突出亮点）
2. 针对性的学习建议（2-3条，每条15字以内）
3. 一句鼓励的话（20字以内）

回复格式：
总结：xxx
建议：
1. xxx
2. xxx
鼓励：xxx`
      },
      {
        role: 'user',
        content: dataDescription
      }
    ];

    const content = await callAI(messages, { temperature: 0.7, maxTokens: 500 });
    
    // 解析AI回复
    const summaryMatch = content.match(/总结[：:]\s*(.+?)(?=建议|$)/s);
    const suggestionsMatch = content.match(/建议[：:]?\s*([\s\S]+?)(?=鼓励|$)/);
    const encouragementMatch = content.match(/鼓励[：:]\s*(.+)/);

    return {
      summary: summaryMatch ? summaryMatch[1].trim() : generateLocalSummary(studyData).summary,
      suggestions: suggestionsMatch ? suggestionsMatch[1].trim() : generateLocalSummary(studyData).suggestions,
      encouragement: encouragementMatch ? encouragementMatch[1].trim() : '继续加油！',
      extractedData: mergedProgress
    };
  } catch (error) {
    console.error('AI总结生成失败:', error.message);
    return {
      ...generateLocalSummary(studyData),
      extractedData: mergedProgress
    };
  }
}

// 本地生成总结（备用方案）
function generateLocalSummary(studyData) {
  const { progress, english, words, mood } = studyData;

  let summary = '今日学习';
  const items = [];

  if (words > 0) items.push(`背单词${words}个`);
  if (english.reading_count) items.push(`阅读${english.reading_count}篇`);
  if (english.translation_count) items.push(`翻译${english.translation_count}句`);

  let totalTime = 0;
  let totalExercises = 0;
  progress.forEach(p => {
    totalTime += p.study_time || 0;
    totalExercises += p.exercises_done || 0;
  });

  if (totalTime > 0) items.push(`总学习${totalTime}分钟`);
  if (totalExercises > 0) items.push(`做题${totalExercises}道`);

  if (items.length > 0) {
    summary += '：' + items.join('，') + '。';
  } else {
    summary += '数据较少，建议增加学习记录。';
  }

  // 根据数据生成建议
  const suggestions = [];
  
  if (words < 30) {
    suggestions.push('建议每日背诵30-50个单词');
  }
  if (!english.reading_count) {
    suggestions.push('坚持每日阅读1篇英语文章');
  }
  if (totalTime < 120) {
    suggestions.push('建议增加学习时长');
  }
  if (mood === 'tired' || mood === 'bad') {
    suggestions.push('注意休息，保持良好状态');
  }

  if (suggestions.length === 0) {
    suggestions.push('继续保持，稳步前进！');
  }

  return {
    summary,
    suggestions: suggestions.join('\n'),
    encouragement: '每一步都算数，加油！'
  };
}

module.exports = { generateAISummary, extractStudyData };
