// AI总结生成服务
const axios = require('axios');

const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-1-5-lite-32k-250115';

// 生成AI学习总结
async function generateAISummary(studyData) {
  const { progress, english, words, userNotes, mood } = studyData;

  // 构建学习数据描述
  let dataDescription = '今日学习数据：\n';
  
  // 英语数据（自动获取）
  dataDescription += `【英语】背单词${words}个`;
  if (english.reading_count) dataDescription += `，阅读${english.reading_count}篇`;
  if (english.translation_count) dataDescription += `，翻译${english.translation_count}句`;
  if (english.quiz_count) dataDescription += `，抽背${english.quiz_count}个`;
  dataDescription += '\n';

  // 其他科目数据（用户手动记录）
  const subjectNames = { math: '数学', politics: '政治', major: '专业课' };
  progress.forEach(p => {
    if (p.subject !== 'english') {
      const name = subjectNames[p.subject] || p.subject;
      let desc = `【${name}】`;
      if (p.study_time) desc += `学习${p.study_time}分钟`;
      if (p.exercises_done) desc += `，做题${p.exercises_done}道`;
      if (p.chapters_done) desc += `，完成章节：${p.chapters_done}`;
      if (p.notes_count) desc += `，笔记${p.notes_count}条`;
      if (p.error_count) desc += `，错题${p.error_count}道`;
      dataDescription += desc + '\n';
    }
  });

  // 用户心得
  if (userNotes) {
    dataDescription += `\n用户心得：${userNotes}\n`;
  }

  // 心情
  const moodMap = { great: '非常好', good: '不错', normal: '一般', tired: '疲惫', bad: '不好' };
  if (mood) {
    dataDescription += `今日状态：${moodMap[mood] || mood}\n`;
  }

  // 如果没有豆包API，使用本地生成
  if (!DOUBAO_API_KEY) {
    return generateLocalSummary(studyData);
  }

  try {
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: DOUBAO_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个考研学习助手，帮助学生总结每日学习情况并给出建议。
请根据学生的学习数据，生成：
1. 简洁的今日学习总结（100字以内）
2. 针对性的学习建议（2-3条，每条20字以内）

回复格式：
总结：xxx
建议：
1. xxx
2. xxx`
          },
          {
            role: 'user',
            content: dataDescription
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_API_KEY}`
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0]?.message?.content || '';
    
    // 解析AI回复
    const summaryMatch = content.match(/总结[：:]\s*(.+?)(?=建议|$)/s);
    const suggestionsMatch = content.match(/建议[：:]?\s*([\s\S]+)/);

    return {
      summary: summaryMatch ? summaryMatch[1].trim() : generateLocalSummary(studyData).summary,
      suggestions: suggestionsMatch ? suggestionsMatch[1].trim() : generateLocalSummary(studyData).suggestions
    };
  } catch (error) {
    console.error('AI总结生成失败:', error.message);
    return generateLocalSummary(studyData);
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
    suggestions.push('建议增加学习时长，保持专注');
  }
  if (mood === 'tired' || mood === 'bad') {
    suggestions.push('注意休息，保持良好状态');
  }

  if (suggestions.length === 0) {
    suggestions.push('继续保持，稳步前进！');
  }

  return {
    summary,
    suggestions: suggestions.join('\n')
  };
}

module.exports = { generateAISummary };
