#!/usr/bin/env node

// 简化的 MCP 测试脚本
const WebSocket = require('ws');

const ENDPOINT_URL = 'wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg';

console.log('🔍 开始 MCP 连接测试...');

const ws = new WebSocket(ENDPOINT_URL);

ws.on('open', () => {
  console.log('✅ WebSocket 连接已建立');
  
  // 发送初始化请求
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'xiaozhi-test-client',
        version: '1.0.0'
      }
    }
  };
  
  ws.send(JSON.stringify(initRequest));
  console.log('📤 发送初始化请求');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📨 收到消息:', JSON.stringify(message, null, 2));
  
  if (message.id === 1) {
    // 初始化响应
    console.log('✅ 初始化成功');
    
    // 发送 tools/list 请求
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    ws.send(JSON.stringify(toolsRequest));
    console.log('📤 请求工具列表');
  } else if (message.id === 2) {
    // 工具列表响应
    const tools = message.result?.tools || [];
    console.log('🔧 发现的工具:', tools.map(t => t.name));
    
    if (tools.length >= 2) {
      console.log('🎉 成功检测到至少2个工具！');
    } else {
      console.log('⚠️  工具数量不足');
    }
    
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket 错误:', error);
});

ws.on('close', () => {
  console.log('🔚 连接已关闭');
});