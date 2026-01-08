const axios = require('axios');

// AI服务配置
const AI_CONFIGS = [
  {
    name: 'Doubao',
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    key: process.env.DOUBAO_API_KEY,
    model: process.env.DOUBAO_MODEL || 'doubao-1-5-lite-32k-250115',
    timeout: 600000  // 10分钟
  },
  {
    name: 'DeepSeek',
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    key: process.env.DEEPSEEK_API_KEY || '52b5d7d9-1c95-4188-8bc9-613460fb3168',
    model: 'deepseek-v3-2-251201',
    timeout: 600000  // 10分钟
  }
];

/**
 * 通用AI调用服务
 * @param {Array} messages - 消息数组 [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
 * @param {Object} options - 可选参数
 * @param {number} options.temperature - 温度参数，默认0.8
 * @param {number} options.maxTokens - 最大token数，默认1500
 * @param {string} options.preferredProvider - 优先使用的AI服务商，默认按顺序尝试
 * @returns {Promise<string>} AI返回的内容
 */
async function callAI(messages, options = {}) {
  const {
    temperature = 0.8,
    maxTokens = 1500,
    preferredProvider = null
  } = options;

  // 获取可用的AI配置
  const availableConfigs = AI_CONFIGS.filter(config => config.key);
  
  if (availableConfigs.length === 0) {
    throw new Error('没有可用的AI服务配置');
  }

  // 如果指定了优先服务商，将其放在第一位
  if (preferredProvider) {
    const preferredIndex = availableConfigs.findIndex(config => 
      config.name.toLowerCase() === preferredProvider.toLowerCase()
    );
    if (preferredIndex > 0) {
      const preferred = availableConfigs.splice(preferredIndex, 1)[0];
      availableConfigs.unshift(preferred);
    }
  }

  let lastError = null;

  // 依次尝试每个AI服务
  for (let i = 0; i < availableConfigs.length; i++) {
    const config = availableConfigs[i];
    
    try {
      console.log(`🤖 尝试使用 ${config.name} API...`);
      
      const response = await axios.post(config.url, {
        model: config.model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        timeout: config.timeout
      });

      const content = response.data.choices[0]?.message?.content || '';
      
      if (content) {
        console.log(`✅ ${config.name} API 调用成功，返回内容长度: ${content.length}`);
        return content;
      } else {
        throw new Error('AI返回内容为空');
      }
      
    } catch (error) {
      console.error(`❌ ${config.name} API 失败:`, error.message);
      lastError = error;
      
      // 如果不是最后一个服务，继续尝试下一个
      if (i < availableConfigs.length - 1) {
        console.log(`⏭️ 尝试下一个AI服务...`);
        continue;
      }
    }
  }
  
  // 所有服务都失败了
  throw new Error(`所有AI服务都失败了。最后错误: ${lastError?.message}`);
}

/**
 * 解析AI返回的JSON内容 - 增强版
 * @param {string} content - AI返回的原始内容
 * @returns {Object|Array|null} 解析后的JSON对象，失败返回null
 */
function parseAIJSON(content) {
  try {
    // 尝试直接解析
    return JSON.parse(content);
  } catch (e) {
    console.log('直接解析失败，尝试清洗数据...');
    
    // 清洗步骤1: 移除 markdown 代码块标记
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    // 清洗步骤2: 移除可能的前后说明文字，只保留 JSON 部分
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    // 清洗步骤3: 修复常见的 JSON 错误
    // 修复尾部逗号
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    // 修复单引号
    cleaned = cleaned.replace(/'/g, '"');
    // 移除注释
    cleaned = cleaned.replace(/\/\/.*/g, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error('清洗后仍然解析失败:', e2.message);
      console.log('清洗后内容前500字符:', cleaned.substring(0, 500));
      return null;
    }
  }
}

/**
 * 获取可用的AI服务列表
 * @returns {Array} 可用的AI服务名称列表
 */
function getAvailableProviders() {
  return AI_CONFIGS.filter(config => config.key).map(config => config.name);
}

module.exports = {
  callAI,
  parseAIJSON,
  getAvailableProviders
};