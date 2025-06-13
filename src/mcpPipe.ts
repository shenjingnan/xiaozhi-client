#!/usr/bin/env node

/**
 * MCP Pipe - JavaScript Implementation
 * Connects to MCP server and pipes input/output to WebSocket endpoint
 * d
 * Version: 0.2.0
 *
 * Usage:
 * export MCP_ENDPOINT=<mcp_endpoint>
 * node mcp_pipe.js <mcp_script>
 */

import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { config } from 'dotenv';
import process from 'process';
import { configManager } from './configManager.js';

// Load environment variables
config();

// Logger utility
class Logger {
    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    info(message: string): void {
        const timestamp = new Date().toISOString();
        console.error(`${timestamp} - ${this.name} - INFO - ${message}`);
    }

    error(message: string): void {
        const timestamp = new Date().toISOString();
        console.error(`${timestamp} - ${this.name} - ERROR - ${message}`);
    }

    warning(message: string): void {
        const timestamp = new Date().toISOString();
        console.error(`${timestamp} - ${this.name} - WARNING - ${message}`);
    }

    debug(message: string): void {
        const timestamp = new Date().toISOString();
        console.error(`${timestamp} - ${this.name} - DEBUG - ${message}`);
    }
}

const logger = new Logger('MCP_PIPE');

// Reconnection settings
const INITIAL_BACKOFF = 1000; // Initial wait time in milliseconds
const MAX_BACKOFF = 30000; // Maximum wait time in milliseconds (reduced)
let reconnectAttempt = 0;
let backoff = INITIAL_BACKOFF;

class MCPPipe {
    private mcpScript: string;
    private endpointUrl: string;
    private process: ChildProcess | null;
    private websocket: WebSocket | null;
    private shouldReconnect: boolean;
    private isConnected: boolean;
    private shutdownResolve?: () => void;

    constructor(mcpScript: string, endpointUrl: string) {
        this.mcpScript = mcpScript;
        this.endpointUrl = endpointUrl;
        this.process = null;
        this.websocket = null;
        this.shouldReconnect = true;
        this.isConnected = false;
    }

    async start() {
        // Start MCP script process
        this.startMCPProcess();

        // Start WebSocket connection
        await this.connectToServer();

        // Keep the process running
        return new Promise<void>((resolve) => {
            // This promise will only resolve when shutdown is called
            this.shutdownResolve = resolve;
        });
    }

    async connectToServer() {
        if (this.isConnected) {
            return;
        }

        logger.info('Connecting to WebSocket server...');

        this.websocket = new WebSocket(this.endpointUrl);

        this.websocket.on('open', () => {
            logger.info('Successfully connected to WebSocket server');
            this.isConnected = true;

            // Reset reconnection counter
            reconnectAttempt = 0;
            backoff = INITIAL_BACKOFF;
        });

        this.websocket.on('message', (data: WebSocket.Data) => {
            const message = data.toString();
            logger.debug(`<< ${message.substring(0, 120)}...`);

            // Write to process stdin
            if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
                this.process.stdin.write(message + '\n');
            }
        });

        this.websocket.on('close', (code: number, reason: Buffer) => {
            logger.error(`WebSocket connection closed: ${code} ${reason}`);
            this.isConnected = false;
            this.websocket = null;

            // Only reconnect if we should and it's not a permanent error
            if (this.shouldReconnect && code !== 4004) {
                this.scheduleReconnect();
            }
        });

        this.websocket.on('error', (error: Error) => {
            logger.error(`WebSocket error: ${error.message}`);
            this.isConnected = false;
        });
    }

    scheduleReconnect() {
        if (!this.shouldReconnect) return;

        reconnectAttempt++;
        const waitTime = Math.min(backoff * Math.pow(2, reconnectAttempt - 1), MAX_BACKOFF);

        logger.info(`Scheduling reconnection attempt ${reconnectAttempt} in ${(waitTime / 1000).toFixed(2)} seconds...`);

        setTimeout(() => {
            if (this.shouldReconnect) {
                this.connectToServer();
            }
        }, waitTime);
    }

    startMCPProcess() {
        if (this.process) {
            logger.info(`${this.mcpScript} process already running`);
            return;
        }

        logger.info(`Starting ${this.mcpScript} process`);

        this.process = spawn('node', [this.mcpScript], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Handle process stdout - send to WebSocket
        this.process.stdout?.on('data', (data: Buffer) => {
            const message = data.toString();
            logger.debug(`>> ${message.substring(0, 120)}...`);

            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(message);
            }
        });

        // Handle process stderr - print to terminal
        this.process.stderr?.on('data', (data: Buffer) => {
            process.stderr.write(data);
        });

        // Handle process exit
        this.process.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
            logger.info(`${this.mcpScript} process exited with code ${code}, signal ${signal}`);
            this.process = null;
            this.shouldReconnect = false;
            if (this.websocket) {
                this.websocket.close();
            }
        });

        // Handle process error
        this.process.on('error', (error: Error) => {
            logger.error(`Process error: ${error.message}`);
            this.process = null;
            this.shouldReconnect = false;
            if (this.websocket) {
                this.websocket.close();
            }
        });
    }

    cleanup() {
        if (this.process) {
            logger.info(`Terminating ${this.mcpScript} process`);
            try {
                this.process.kill('SIGTERM');

                // Force kill after timeout
                setTimeout(() => {
                    if (this.process && !this.process.killed) {
                        this.process.kill('SIGKILL');
                    }
                }, 5000);
            } catch (error) {
                logger.error(`Error terminating process: ${error instanceof Error ? error.message : String(error)}`);
            }
            this.process = null;
        }

        if (this.websocket) {
            this.websocket = null;
        }

        this.isConnected = false;
    }

    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    shutdown() {
        logger.info('Shutting down MCP Pipe...');
        this.shouldReconnect = false;
        this.cleanup();
        if (this.websocket) {
            this.websocket.close();
        }
        if (this.shutdownResolve) {
            this.shutdownResolve();
        }
        process.exit(0);
    }
}

// Signal handlers
function setupSignalHandlers(mcpPipe: MCPPipe): void {
    process.on('SIGINT', () => {
        logger.info('Received interrupt signal, shutting down...');
        mcpPipe.shutdown();
    });

    process.on('SIGTERM', () => {
        logger.info('Received terminate signal, shutting down...');
        mcpPipe.shutdown();
    });
}

// Main execution
async function main() {
    // Check command line arguments
    if (process.argv.length < 3) {
        logger.error('Usage: node mcp_pipe.js <mcp_script>');
        process.exit(1);
    }

    const mcpScript = process.argv[2];

    // Get endpoint URL from config file or environment variable (fallback)
    let endpointUrl: string;

    try {
        // 调试信息 - 使用 process.stderr.write 确保能看到
        process.stderr.write(`[DEBUG] XIAOZHI_CONFIG_DIR: ${process.env.XIAOZHI_CONFIG_DIR}\n`);
        process.stderr.write(`[DEBUG] process.cwd(): ${process.cwd()}\n`);
        process.stderr.write(`[DEBUG] configManager.getConfigPath(): ${configManager.getConfigPath()}\n`);
        process.stderr.write(`[DEBUG] configManager.configExists(): ${configManager.configExists()}\n`);

        // 首先尝试从配置文件读取
        if (configManager.configExists()) {
            endpointUrl = configManager.getMcpEndpoint();
            logger.info('使用配置文件中的 MCP 端点');
        } else {
            // 如果配置文件不存在，尝试从环境变量读取（向后兼容）
            endpointUrl = process.env.MCP_ENDPOINT || '';
            if (!endpointUrl) {
                logger.error('配置文件不存在且未设置 MCP_ENDPOINT 环境变量');
                logger.error('请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量');
                process.exit(1);
            }
            logger.info('使用环境变量中的 MCP 端点（建议使用配置文件）');
        }
    } catch (error) {
        logger.error(`读取配置失败: ${error instanceof Error ? error.message : String(error)}`);

        // 尝试从环境变量读取作为备用方案
        endpointUrl = process.env.MCP_ENDPOINT || '';
        if (!endpointUrl) {
            logger.error('请运行 "xiaozhi init" 初始化配置，或设置 MCP_ENDPOINT 环境变量');
            process.exit(1);
        }
        logger.info('使用环境变量中的 MCP 端点作为备用方案');
    }

    // 验证端点 URL
    if (!endpointUrl || endpointUrl.includes('<请填写')) {
        logger.error('MCP 端点未配置或配置无效');
        logger.error('请运行 "xiaozhi config mcpEndpoint <your-endpoint-url>" 设置端点');
        process.exit(1);
    }

    // Create MCP Pipe instance
    const mcpPipe = new MCPPipe(mcpScript, endpointUrl);

    // Setup signal handlers
    setupSignalHandlers(mcpPipe);

    // Start the MCP pipe
    try {
        await mcpPipe.start();
    } catch (error) {
        logger.error(`Program execution error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    });
}
