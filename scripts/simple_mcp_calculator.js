#!/usr/bin/env node

/**
 * 简化的MCP计算器 - 直接WebSocket连接示例
 *
 * 这个文件展示了MCP通信的核心机制：
 * 1. 直接连接到小智服务端的WebSocket
 * 2. 处理MCP协议的基本消息格式
 * 3. 实现计算器工具的调用和响应
 * 4. 可视化所有通信数据的结构
 *
 * 使用方法：
 * export MCP_ENDPOINT=ws://your-endpoint
 * node simple_mcp_calculator.js
 */

import WebSocket from 'ws';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 配置
const MCP_ENDPOINT = process.env.MCP_ENDPOINT;
const RECONNECT_DELAY = 3000; // 3秒重连延迟

// 日志工具
function log(type, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${message}`);
    if (data) {
        console.log('📊 数据详情:', JSON.stringify(data, null, 2));
    }
}

// 计算器工具实现
function calculateExpression(expression) {
    try {
        // 简单的安全检查
        if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
            throw new Error('表达式包含不允许的字符');
        }

        // 使用Function构造函数进行安全计算
        const result = new Function(`"use strict"; return (${expression})`)();

        if (typeof result !== 'number' || !Number.isFinite(result)) {
            throw new Error('计算结果不是有效数字');
        }

        return result;
    } catch (error) {
        throw new Error(`计算错误: ${error.message}`);
    }
}

// MCP消息处理器
class SimpleMCPCalculator {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.messageId = 1;
    }

    // 生成唯一消息ID
    generateId() {
        return `calc_${this.messageId++}`;
    }

    // 连接到WebSocket
    async connect() {
        if (!MCP_ENDPOINT) {
            log('❌ 错误', '请设置 MCP_ENDPOINT 环境变量');
            process.exit(1);
        }

        log('🔄 连接', `正在连接到 ${MCP_ENDPOINT}`);

        try {
            this.ws = new WebSocket(MCP_ENDPOINT);
            this.setupEventHandlers();
        } catch (error) {
            log('❌ 连接失败', error.message);
            this.scheduleReconnect();
        }
    }

    // 设置WebSocket事件处理
    setupEventHandlers() {
        this.ws.on('open', () => {
            this.isConnected = true;
            log('✅ 连接成功', '已连接到小智服务端');
            this.sendInitialize();
        });

        this.ws.on('message', (data) => {
            this.handleMessage(data.toString());
        });

        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            log('🔌 连接关闭', `代码: ${code}, 原因: ${reason}`);
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            log('❌ WebSocket错误', error.message);
        });
    }

    // 处理接收到的消息
    handleMessage(messageStr) {
        try {
            const message = JSON.parse(messageStr);
            log('📥 收到消息', '来自小智服务端', message);

            // 根据消息类型处理
            if (message.method) {
                this.handleRequest(message);
            } else if (message.result !== undefined || message.error) {
                this.handleResponse(message);
            }
        } catch (error) {
            log('❌ 消息解析错误', error.message);
        }
    }

    // 处理请求消息
    handleRequest(request) {
        const { id, method, params } = request;

        log('🔧 处理请求', `方法: ${method}`, { id, params });

        switch (method) {
            case 'initialize':
                this.sendInitializeResponse(id);
                break;

            case 'tools/list':
                this.sendToolsList(id);
                break;

            case 'tools/call':
                this.handleToolCall(id, params);
                break;

            default:
                this.sendError(id, `未知方法: ${method}`);
        }
    }

    // 处理响应消息
    handleResponse(response) {
        log('📤 收到响应', '来自小智服务端', response);
    }

    // 发送初始化消息
    sendInitialize() {
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
                    name: 'SimpleMCPCalculator',
                    version: '1.0.0'
                }
            }
        };

        this.sendMessage(message, '初始化请求');
    }

    // 发送初始化响应
    sendInitializeResponse(id) {
        const response = {
            jsonrpc: '2.0',
            id: id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: 'SimpleMCPCalculator',
                    version: '1.0.0'
                }
            }
        };

        this.sendMessage(response, '初始化响应');
    }

    // 发送工具列表
    sendToolsList(id) {
        const response = {
            jsonrpc: '2.0',
            id: id,
            result: {
                tools: [
                    {
                        name: 'calculator',
                        description: '数学计算器 - 计算数学表达式',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                expression: {
                                    type: 'string',
                                    description: '要计算的数学表达式，如: 2+3*4'
                                }
                            },
                            required: ['expression']
                        }
                    }
                ]
            }
        };

        this.sendMessage(response, '工具列表响应');
    }

    // 处理工具调用
    handleToolCall(id, params) {
        const { name, arguments: args } = params;

        log('🛠️ 工具调用', `工具名: ${name}`, args);

        if (name === 'calculator') {
            try {
                const expression = args.expression;
                if (!expression) {
                    throw new Error('缺少表达式参数');
                }

                log('🧮 开始计算', `表达式: ${expression}`);
                const result = calculateExpression(expression);
                log('✅ 计算完成', `结果: ${result}`);

                const response = {
                    jsonrpc: '2.0',
                    id: id,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: `计算结果: ${expression} = ${result}`
                            }
                        ],
                        isError: false
                    }
                };

                this.sendMessage(response, '计算结果响应');

            } catch (error) {
                log('❌ 计算错误', error.message);
                this.sendError(id, `计算失败: ${error.message}`);
            }
        } else {
            this.sendError(id, `未知工具: ${name}`);
        }
    }

    // 发送错误响应
    sendError(id, message) {
        const response = {
            jsonrpc: '2.0',
            id: id,
            error: {
                code: -1,
                message: message
            }
        };

        this.sendMessage(response, '错误响应');
    }

    // 发送消息的通用方法
    sendMessage(message, description) {
        if (!this.isConnected) {
            log('⚠️ 警告', '连接未建立，无法发送消息');
            return;
        }

        const messageStr = JSON.stringify(message);
        log('📤 发送消息', description, message);

        try {
            this.ws.send(messageStr);
        } catch (error) {
            log('❌ 发送失败', error.message);
        }
    }

    // 安排重连
    scheduleReconnect() {
        log('⏰ 重连', `${RECONNECT_DELAY/1000}秒后重新连接`);
        setTimeout(() => {
            this.connect();
        }, RECONNECT_DELAY);
    }

    // 启动
    start() {
        log('🚀 启动', 'SimpleMCP计算器正在启动...');
        this.connect();

        // 优雅关闭处理
        process.on('SIGINT', () => {
            log('🛑 关闭', '收到中断信号，正在关闭...');
            if (this.ws) {
                this.ws.close();
            }
            process.exit(0);
        });
    }
}

// 主程序
function main() {
    console.log('🧮 SimpleMCP计算器');
    console.log('==================');
    console.log('这个程序展示了MCP通信的核心机制：');
    console.log('1. WebSocket连接建立');
    console.log('2. MCP协议消息格式');
    console.log('3. 工具调用和响应');
    console.log('4. 数据结构可视化');
    console.log('==================\n');

    if (!MCP_ENDPOINT) {
        console.log('❌ 错误: 请设置 MCP_ENDPOINT 环境变量');
        console.log('示例: export MCP_ENDPOINT=ws://localhost:8080/mcp');
        process.exit(1);
    }

    const calculator = new SimpleMCPCalculator();
    calculator.start();
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
