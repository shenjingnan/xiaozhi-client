#!/usr/bin/env node

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class SimpleMCPClient extends EventEmitter {
  constructor(endpointUrl) {
    super();
    this.endpointUrl = endpointUrl;
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('连接到接入点:', this.endpointUrl);
      
      this.ws = new WebSocket(this.endpointUrl);
      
      this.ws.on('open', () => {
        console.log('WebSocket连接已建立');
        this.initialize().then(resolve).catch(reject);
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      this.ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('WebSocket连接已关闭');
      });
    });
  }

  async initialize() {
    const initRequest = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'simple-mcp-client',
          version: '1.0.0'
        }
      }
    };

    console.log('发送初始化请求...');
    const response = await this.sendRequest(initRequest);
    console.log('初始化成功:', response.result);
    
    // 发送initialized通知
    this.sendNotification('initialized', {});
  }

  async listTools() {
    const request = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'tools/list',
      params: {}
    };

    console.log('请求工具列表...');
    const response = await this.sendRequest(request);
    return response.result;
  }

  sendRequest(request) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });
      this.ws.send(JSON.stringify(request));
      
      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('请求超时'));
        }
      }, 10000);
    });
  }

  sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };
    this.ws.send(JSON.stringify(notification));
  }

  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      resolve(message);
    } else {
      console.log('收到消息:', message);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

class MockMCPServer {
  constructor() {
    this.tools = [
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
  }

  getTools() {
    return this.tools;
  }

  async handleRequest(method, params) {
    switch (method) {
      case 'tools/list':
        return { tools: this.tools };
      case 'tools/call':
        return this.handleToolCall(params);
      default:
        throw new Error(`未知方法: ${method}`);
    }
  }

  handleToolCall(params) {
    const { name, arguments: args } = params;
    
    switch (name) {
      case 'calculator_add':
        return {
          content: [
            {
              type: 'text',
              text: `计算结果: ${args.a} + ${args.b} = ${args.a + args.b}`
            }
          ]
        };
      case 'weather_get':
        return {
          content: [
            {
              type: 'text',
              text: `${args.city}的天气: 晴天，25°C`
            }
          ]
        };
      default:
        throw new Error(`未知工具: ${name}`);
    }
  }
}

async function testMCPConnection() {
  const ENDPOINT_URL = 'wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg';
  
  console.log('=== 开始 MCP 连接测试 ===');
  
  const client = new SimpleMCPClient(ENDPOINT_URL);
  const mockServer = new MockMCPServer();
  
  try {
    // 建立连接
    await client.connect();
    console.log('✅ 连接建立成功');
    
    // 获取工具列表
    const toolsResult = await client.listTools();
    console.log('✅ 工具列表获取成功');
    console.log('发现的工具:', toolsResult.tools.map(t => t.name));
    
    // 验证工具数量
    const expectedTools = mockServer.getTools();
    if (toolsResult.tools.length >= expectedTools.length) {
      console.log('✅ 工具数量验证通过');
      console.log(`期望工具数量: ${expectedTools.length}`);
      console.log(`实际工具数量: ${toolsResult.tools.length}`);
    } else {
      console.log('⚠️  工具数量不匹配');
    }
    
    // 验证特定工具是否存在
    const toolNames = toolsResult.tools.map(t => t.name);
    const hasCalculatorAdd = toolNames.includes('calculator_add');
    const hasWeatherGet = toolNames.includes('weather_get');
    
    console.log('工具验证结果:');
    console.log(`- calculator_add: ${hasCalculatorAdd ? '✅' : '❌'}`);
    console.log(`- weather_get: ${hasWeatherGet ? '✅' : '❌'}`);
    
    if (hasCalculatorAdd && hasWeatherGet) {
      console.log('🎉 所有测试通过！接入点正确识别了我们的模拟工具');
    } else {
      console.log('⚠️  部分工具未找到，可能需要检查服务器配置');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    client.close();
    console.log('=== 测试完成 ===');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  testMCPConnection().catch(console.error);
}

module.exports = { SimpleMCPClient, MockMCPServer };