// 测试通用AI服务
const { callAI, parseAIJSON, getAvailableProviders } = require('./services/aiService');

async function testAIService() {
  console.log('🧪 开始测试通用AI服务...');
  
  // 1. 测试获取可用服务商
  console.log('\n1. 可用的AI服务商:');
  const providers = getAvailableProviders();
  console.log(providers);
  
  if (providers.length === 0) {
    console.log('❌ 没有可用的AI服务商，请检查环境变量配置');
    return;
  }
  
  // 2. 测试简单对话
  console.log('\n2. 测试简单对话:');
  try {
    const messages = [
      { role: 'system', content: '你是一个友好的助手。' },
      { role: 'user', content: '你好，请简单介绍一下自己。' }
    ];
    
    const response = await callAI(messages, { maxTokens: 100 });
    console.log('✅ 对话测试成功:');
    console.log(response);
  } catch (error) {
    console.log('❌ 对话测试失败:', error.message);
  }
  
  // 3. 测试JSON解析
  console.log('\n3. 测试JSON解析:');
  const jsonText = '{"name": "测试", "value": 123}';
  const parsed = parseAIJSON(jsonText);
  console.log('✅ JSON解析结果:', parsed);
  
  // 4. 测试AI生成JSON
  console.log('\n4. 测试AI生成JSON:');
  try {
    const messages = [
      { 
        role: 'system', 
        content: '请返回一个简单的JSON对象，包含name和age字段。只返回JSON，不要其他文字。' 
      },
      { role: 'user', content: '生成一个人员信息的JSON' }
    ];
    
    const response = await callAI(messages, { maxTokens: 100, temperature: 0.3 });
    console.log('AI返回:', response);
    
    const jsonData = parseAIJSON(response);
    if (jsonData) {
      console.log('✅ JSON生成和解析成功:', jsonData);
    } else {
      console.log('⚠️ JSON解析失败，但AI调用成功');
    }
  } catch (error) {
    console.log('❌ JSON生成测试失败:', error.message);
  }
  
  console.log('\n🎉 AI服务测试完成！');
}

// 运行测试
testAIService().catch(console.error);