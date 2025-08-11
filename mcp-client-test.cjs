#!/usr/bin/env node

const WebSocket = require('ws');

const ENDPOINT_URL = 'wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg';

// 模拟的 MCP 工具
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

class MCPTester {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('🔍 连接到接入点:', this.url);
      
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket 连接已建立');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket 错误:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('🔚 连接已关闭');
      });
    });
  }

  handleMessage(message) {
    console.log('📨 收到:', JSON.stringify(message, null, 2));
    
    if (message.method) {
      // 处理服务器主动发送的请求
      this.handleServerRequest(message);
    } else if (message.id) {
      // 处理响应
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        pending.resolve(message);
        this.pendingRequests.delete(message.id);
      }
    }
  }

  handleServerRequest(request) {
    switch (request.method) {
      case 'initialize':
        // 服务器要求我们初始化，我们回应
        this.sendResponse(request.id, {
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
        });
        
        // 发送初始化完成通知
        this.sendNotification('initialized', {});
        break;
        
      case 'tools/list':
        // 服务器请求工具列表，我们返回模拟的工具
        this.sendResponse(request.id, {
          tools: MOCK_TOOLS
        });
        break;
        
      case 'ping':
        // 处理ping消息
        this.sendResponse(request.id, {});
        console.log('🏓 回应ping消息');
        break;
        
      default:
        console.log('⚠️  未知请求:', request.method);
    }
  }

  sendRequest(method, params) {
    return new Promise((resolve) => {
      const id = ++this.messageId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      this.pendingRequests.set(id, { resolve });
      this.ws.send(JSON.stringify(request));
      console.log('📤 发送:', JSON.stringify(request, null, 2));
    });
  }

  sendResponse(id, result) {
    const response = {
      jsonrpc: '2.0',
      id,
      result
    };
    this.ws.send(JSON.stringify(response));
    console.log('📤 发送响应:', JSON.stringify(response, null, 2));
  }

  sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };
    this.ws.send(JSON.stringify(notification));
    console.log('📤 发送通知:', JSON.stringify(notification, null, 2));
  }

  async listTools() {
    console.log('🔧 请求工具列表...');
    const response = await this.sendRequest('tools/list', {});
    return response.result;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runTest() {
  console.log('=== MCP 客户端连接测试 ===\n');
  
  const tester = new MCPTester(ENDPOINT_URL);
  
  try {
    await tester.connect();
    
    // 等待一段时间让服务器发送初始化请求
    console.log('⏳ 等待服务器初始化...');
    
    // 5秒后尝试获取工具列表
    setTimeout(async () => {
      try {
        const result = await tester.listTools();
        console.log('🎉 工具列表获取成功:', result.tools.map(t => t.name));
        
        // 验证工具
        const toolNames = result.tools.map(t => t.name);
        const hasCalculator = toolNames.includes('calculator_add');
        const hasWeather = toolNames.includes('weather_get');
        
        console.log('\n📊 验证结果:');
        console.log(`- calculator_add: ${hasCalculator ? '✅' : '❌'}`);
        console.log(`- weather_get: ${hasWeather ? '✅' : '❌'}`);
        
        if (hasCalculator && hasWeather) {
          console.log('\n🎊 测试成功！接入点正确识别了模拟的MCP工具');
        } else {
          console.log('\n⚠️  部分工具未找到');
        }
        
      } catch (error) {
        console.error('❌ 获取工具列表失败:', error);
      } finally {
        tester.close();
      }
    }, 3000);
    
  } catch (error) {
    console.error('❌ 连接失败:', error);
    tester.close();
  }
}

if (require.main === module) {
  runTest();
}

module.exports = MCPTester;