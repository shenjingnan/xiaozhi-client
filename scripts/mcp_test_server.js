#!/usr/bin/env node

/**
 * MCP测试服务端 - 模拟小智接入点
 *
 * 这个服务端模拟小智接入点的行为，用于测试MCP计算器客户端：
 * 1. 启动WebSocket服务器
 * 2. 接受MCP客户端连接
 * 3. 实现MCP协议的基本通信流程
 * 4. 自动测试计算器工具的各种场景
 * 5. 显示完整的通信过程和结果
 *
 * 使用方法：
 * node mcp_test_server.js
 * 然后在另一个终端运行：
 * export MCP_ENDPOINT=ws://localhost:8080/mcp && node simple_mcp_calculator.js
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';

// 配置
let PORT = 8080;
const WS_PATH = '/mcp';

// 日志工具
function log(type, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${message}`);
    if (data) {
        console.log('📊 数据详情:', JSON.stringify(data, null, 2));
    }
}

// MCP测试服务端
class MCPTestServer {
    constructor() {
        this.server = null;
        this.wss = null;
        this.clients = new Map(); // 存储客户端连接信息
        this.messageId = 1;
        this.testScenarios = [
            { expression: '2+3', expected: 5 },
            { expression: '2+3*4', expected: 14 },
            { expression: '(2+3)*4', expected: 20 },
            { expression: '10/2-3', expected: 2 },
            { expression: '2.5*4', expected: 10 },
            // { expression: 'sqrt(16)', expected: 'error' }, // 测试错误情况
            // { expression: '1+2+3+4+5', expected: 15 }
        ];
        this.currentTestIndex = 0;
    }

    // 生成唯一消息ID
    generateId() {
        return `server_${this.messageId++}`;
    }

    // 启动服务器
    async start() {
        log('🚀 启动', 'MCP测试服务端正在启动...');

        // 创建HTTP服务器
        this.server = createServer();

        // 创建WebSocket服务器
        this.wss = new WebSocketServer({
            server: this.server,
            path: WS_PATH
        });

        // 设置WebSocket事件处理
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });

        // 启动HTTP服务器
        this.server.listen(PORT, () => {
            log('✅ 服务启动', `WebSocket服务器运行在 ws://localhost:${PORT}${WS_PATH}`);
            log('📋 使用说明', '在另一个终端运行以下命令连接客户端：');
            console.log(`   export MCP_ENDPOINT=ws://localhost:${PORT}${WS_PATH}`);
            console.log("   node simple_mcp_calculator.js");
            console.log('');
        });

        // 优雅关闭处理
        process.on('SIGINT', () => {
            log('🛑 关闭', '收到中断信号，正在关闭服务器...');
            this.stop();
        });
    }

    // 处理新的WebSocket连接
    handleConnection(ws, request) {
        const clientId = this.generateId();
        const clientInfo = {
            id: clientId,
            ws: ws,
            isInitialized: false,
            tools: []
        };

        this.clients.set(clientId, clientInfo);

        log('🔗 新连接', `客户端 ${clientId} 已连接`, {
            ip: request.socket.remoteAddress,
            userAgent: request.headers['user-agent']
        });

        // 设置WebSocket事件处理
        ws.on('message', (data) => {
            this.handleMessage(clientId, data.toString());
        });

        ws.on('close', (code, reason) => {
            log('🔌 连接关闭', `客户端 ${clientId} 断开连接`, {
                code,
                reason: reason.toString()
            });
            this.clients.delete(clientId);
        });

        ws.on('error', (error) => {
            log('❌ WebSocket错误', `客户端 ${clientId}`, error.message);
        });

        // 发送初始化请求
        setTimeout(() => {
            this.sendInitializeRequest(clientId);
        }, 1000);
    }

    // 处理接收到的消息
    handleMessage(clientId, messageStr) {
        try {
            const message = JSON.parse(messageStr);
            log('📥 收到消息', `来自客户端 ${clientId}`, message);

            const client = this.clients.get(clientId);
            if (!client) {
                log('⚠️ 警告', `未找到客户端 ${clientId}`);
                return;
            }

            // 根据消息类型处理
            if (message.method) {
                this.handleRequest(clientId, message);
            } else if (message.result !== undefined || message.error) {
                this.handleResponse(clientId, message);
            }
        } catch (error) {
            log('❌ 消息解析错误', `客户端 ${clientId}`, error.message);
        }
    }

    // 处理请求消息
    handleRequest(clientId, request) {
        const { id, method, params } = request;
        log('🔧 处理请求', `客户端 ${clientId}, 方法: ${method}`, { id, params });

        // 这里我们作为服务端，通常不会收到很多请求
        // 主要是响应客户端的能力查询等
        switch (method) {
            default:
                log('⚠️ 未处理的请求', `方法: ${method}`);
        }
    }

    // 处理响应消息
    handleResponse(clientId, response) {
        const client = this.clients.get(clientId);
        if (!client) return;

        log('📤 收到响应', `来自客户端 ${clientId}`, response);

        if (response.result?.protocolVersion) {
            // 初始化响应
            client.isInitialized = true;
            log('✅ 初始化完成', `客户端 ${clientId} 已初始化`);

            // 请求工具列表
            setTimeout(() => {
                this.requestToolsList(clientId);
            }, 500);

        } else if (response.result?.tools) {
            // 工具列表响应
            client.tools = response.result.tools;
            log('🛠️ 工具列表', `客户端 ${clientId} 提供的工具`, client.tools);

            // 开始测试计算器工具
            setTimeout(() => {
                this.startCalculatorTests(clientId);
            }, 500);

        } else if (response.result?.content) {
            // 工具调用结果
            this.handleToolCallResult(clientId, response);
        }
    }

    // 发送初始化请求
    sendInitializeRequest(clientId) {
        const message = {
            jsonrpc: '2.0',
            id: this.generateId(),
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                clientInfo: {
                    name: 'MCPTestServer',
                    version: '1.0.0'
                }
            }
        };

        this.sendMessage(clientId, message, '发送初始化请求');
    }

    // 请求工具列表
    requestToolsList(clientId) {
        const message = {
            jsonrpc: '2.0',
            id: this.generateId(),
            method: 'tools/list',
            params: {}
        };

        this.sendMessage(clientId, message, '请求工具列表');
    }

    // 开始计算器测试
    startCalculatorTests(clientId) {
        log('🧪 开始测试', `客户端 ${clientId} - 计算器工具测试`);
        this.currentTestIndex = 0;
        this.runNextTest(clientId);
    }

    // 运行下一个测试
    runNextTest(clientId) {
        if (this.currentTestIndex >= this.testScenarios.length) {
            log('🎉 测试完成', `客户端 ${clientId} - 所有测试场景已完成`);
            return;
        }

        const scenario = this.testScenarios[this.currentTestIndex];
        log('🧮 测试场景', `${this.currentTestIndex + 1}/${this.testScenarios.length}: ${scenario.expression}`);

        const message = {
            jsonrpc: '2.0',
            id: this.generateId(),
            method: 'tools/call',
            params: {
                name: 'calculator__calculator',
                arguments: {
                    javascript_expression: scenario.expression
                }
            }
        };

        this.sendMessage(clientId, message, `调用计算器: ${scenario.expression}`);
    }

    // 处理工具调用结果
    handleToolCallResult(clientId, response) {
        const scenario = this.testScenarios[this.currentTestIndex];

        if (response.error) {
            log('❌ 工具调用错误', `场景 ${this.currentTestIndex + 1}`, response.error);
            if (scenario.expected === 'error') {
                log('✅ 测试通过', '预期的错误情况');
            } else {
                log('❌ 测试失败', '意外的错误');
            }
        } else {
            const content = response.result.content;
            if (content?.[0]?.text) {
                const resultText = content[0].text;
                log('📊 计算结果', `场景 ${this.currentTestIndex + 1}`, resultText);

                // 简单的结果验证
                if (scenario.expected !== 'error') {
                    const expectedStr = `= ${scenario.expected}`;
                    if (resultText.includes(expectedStr)) {
                        log('✅ 测试通过', `结果正确: ${scenario.expression} = ${scenario.expected}`);
                    } else {
                        log('❌ 测试失败', `结果不匹配，期望: ${scenario.expected}`);
                    }
                } else {
                    log('❌ 测试失败', '期望错误但得到了结果');
                }
            }
        }

        // 继续下一个测试
        this.currentTestIndex++;
        setTimeout(() => {
            this.runNextTest(clientId);
        }, 1000);
    }

    // 发送消息的通用方法
    sendMessage(clientId, message, description) {
        const client = this.clients.get(clientId);
        if (!client) {
            log('⚠️ 警告', `客户端 ${clientId} 不存在，无法发送消息`);
            return;
        }

        if (client.ws.readyState !== client.ws.OPEN) {
            log('⚠️ 警告', `客户端 ${clientId} 连接未就绪，无法发送消息`);
            return;
        }

        const messageStr = JSON.stringify(message);
        log('📤 发送消息', `到客户端 ${clientId}: ${description}`, message);

        try {
            client.ws.send(messageStr);
        } catch (error) {
            log('❌ 发送失败', `客户端 ${clientId}`, error.message);
        }
    }

    // 停止服务器
    stop() {
        if (this.wss) {
            this.wss.close();
        }
        if (this.server) {
            this.server.close();
        }
        process.exit(0);
    }
}

// 主程序
function main() {
    console.log('🧪 MCP测试服务端');
    console.log('==================');
    console.log('这个服务端模拟小智接入点的行为：');
    console.log('1. 启动WebSocket服务器');
    console.log('2. 接受MCP客户端连接');
    console.log('3. 执行MCP协议通信流程');
    console.log('4. 自动测试计算器工具');
    console.log('5. 验证计算结果正确性');
    console.log('==================\n');

    const server = new MCPTestServer();
    server.start();
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
    if (process.argv[2]) {
        PORT = Number.parseInt(process.argv[2]);
    }
    main();
}
