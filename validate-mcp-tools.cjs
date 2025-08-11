#!/usr/bin/env node

const WebSocket = require('ws');

const ENDPOINT_URL = 'wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg';

// 模拟的 MCP 工具定义
const MOCK_TOOLS = [
  {
    name: 'calculator_add',
    description: '简单的加法计算器',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: '第一个数字' },
        b: { type: 'number', description: '第二个数字' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'weather_get',
    description: '获取天气信息',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名称' }
      },
      required: ['city']
    }
  }
];

console.log('🎯 MCP 工具验证测试');
console.log('固定接入点:', ENDPOINT_URL);
console.log('模拟工具:', MOCK_TOOLS.map(t => t.name).join(', '));
console.log('');

const ws = new WebSocket(ENDPOINT_URL);
let isTestComplete = false;

ws.on('open', () => {
  console.log('✅ WebSocket连接已建立');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.method === 'initialize') {
    // 服务器要求初始化
    console.log('📋 处理服务器初始化请求...');
    
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true
          }
        },
        serverInfo: {
          name: 'xiaozhi-mcp-test-server',
          version: '1.0.0'
        }
      }
    };
    
    ws.send(JSON.stringify(response));
    
    // 发送初始化完成通知
    const initialized = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    };
    ws.send(JSON.stringify(initialized));
    
  } else if (message.method === 'tools/list') {
    // 服务器请求工具列表
    console.log('🔧 提供模拟工具列表...');
    
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: MOCK_TOOLS
      }
    };
    
    ws.send(JSON.stringify(response));
    
  } else if (message.method === 'ping') {
    // 处理ping消息
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {}
    };
    ws.send(JSON.stringify(response));
    console.log('🏓 回应ping消息');
    
  } else if (message.jsonrpc === '2.0' && message.method === 'notifications/initialized') {
    // 初始化完成，现在可以验证工具
    console.log('✅ 初始化完成，验证工具...');
    
    // 现在测试我们自己的 tools/list 请求
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 999,
      method: 'tools/list',
      params: {}
    };
    
    ws.send(JSON.stringify(toolsRequest));
    
  } else if (message.id === 999) {
    // 收到工具列表响应
    const tools = message.result?.tools || [];
    console.log(`📊 发现 ${tools.length} 个工具`);
    
    // 验证我们模拟的工具
    const toolNames = tools.map(t => t.name);
    const expectedTools = ['calculator_add', 'weather_get'];
    
    console.log('');
    console.log('🔍 验证结果:');
    
    let allPassed = true;
    expectedTools.forEach(toolName => {
      const found = toolNames.includes(toolName);
      console.log(`- ${toolName}: ${found ? '✅ 找到' : '❌ 未找到'}`);
      if (!found) allPassed = false;
    });
    
    console.log('');
    if (allPassed) {
      console.log('🎉 测试成功！接入点正确识别了所有模拟的MCP工具');
    } else {
      console.log('⚠️  部分工具未找到');
    }
    
    console.log('\n📋 完整工具列表:');
    tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });
    
    isTestComplete = true;
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('❌ 连接错误:', error);
  process.exit(1);
});

ws.on('close', () => {
  if (!isTestComplete) {
    console.log('🔚 连接意外关闭');
  } else {
    console.log('🔚 测试完成，连接关闭');
  }
});

// 设置超时
setTimeout(() => {
  if (!isTestComplete) {
    console.log('⏰ 测试超时');
    ws.close();
  }
}, 10000);