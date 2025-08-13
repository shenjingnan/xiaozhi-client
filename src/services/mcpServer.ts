import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { ProxyMCPServer } from "../ProxyMCPServer.js";
import { configManager } from "../configManager.js";
import { logger as globalLogger } from "../logger.js";
import { MCPServiceManager } from "./MCPServiceManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = globalLogger.withTag("mcp-server");
const MCP_SERVER_PROXY_FILENAME = "mcpServerProxy.js";
const MAX_SEARCH_LEVELS = 5; // 查找 mcpServerProxy.js 文件时的最大目录层级

interface SSEClient {
  id: string;
  sessionId: string;
  response: express.Response;
}

export class MCPServer extends EventEmitter {
  private app: express.Application;
  private server: Server | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private mcpProxy: ChildProcess | null = null;
  private proxyMCPServer: ProxyMCPServer | null = null;
  private mcpServiceManager: MCPServiceManager | null = null;
  private mcpProxyPath: string | null = null; // 缓存MCP代理路径
  private port: number;

  constructor(port = 3000) {
    super();
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 为MCP客户端设置CORS
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.header("Cache-Control", "no-cache");
      next();
    });
  }

  private setupRoutes(): void {
    // MCP协议的SSE端点
    this.app.get("/sse", (req, res) => {
      const clientId = Date.now().toString();
      const sessionId = randomUUID();

      // 设置SSE头部（匹配SDK实现）
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // 使用sessionId注册客户端
      this.clients.set(sessionId, { id: clientId, sessionId, response: res });
      logger.info(`MCP客户端已连接: ${clientId} (会话: ${sessionId})`);

      // 首先发送端点事件（SDK标准）
      res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

      // 处理客户端断开连接
      req.on("close", () => {
        this.clients.delete(sessionId);
        logger.info(`MCP客户端已断开连接: ${clientId} (会话: ${sessionId})`);
      });
    });

    // SSE传输的消息端点（MCP SDK标准）
    this.app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string;
        const message = req.body;

        logger.info(
          `通过SSE传输收到消息 (会话: ${sessionId}):`,
          JSON.stringify(message)
        );

        if (!sessionId || !this.clients.has(sessionId)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "无效或缺少sessionId",
            },
            id: message.id,
          });
          return;
        }

        if (!this.mcpProxy) {
          res.status(503).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "MCP代理未运行",
            },
            id: message.id,
          });
          return;
        }

        // 检查这是否是通知（没有id字段意味着这是通知）
        if (message.id === undefined) {
          // 这是通知，转发但不等待响应
          logger.info(`转发通知: ${message.method}`);
          this.mcpProxy!.stdin!.write(`${JSON.stringify(message)}\n`);

          // 立即发送202 Accepted以响应通知
          res.status(202).send();
        } else {
          // 这是请求，转发并等待响应
          const response = await this.forwardToProxy(message);

          // 通过SSE将响应发送到特定客户端
          const client = this.clients.get(sessionId);
          if (client) {
            this.sendToClient(client, response);
          }

          // 发送202 Accepted以确认收到（SDK标准）
          res.status(202).send();
        }
      } catch (error) {
        logger.error("SSE消息错误:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "内部错误",
          },
          id: req.body.id,
        });
      }
    });

    // 用于直接RPC通信的JSON-RPC端点（遗留）
    this.app.post("/rpc", async (req, res) => {
      try {
        const message = req.body;
        logger.debug("收到RPC消息:", message);

        if (!this.mcpProxy) {
          res.status(503).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "MCP代理未运行",
            },
            id: message.id,
          });
          return;
        }

        // 转发到mcpServerProxy
        const response = await this.forwardToProxy(message);
        res.json(response);
      } catch (error) {
        logger.error("RPC错误:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "内部错误",
          },
          id: req.body.id,
        });
      }
    });

    // 健康检查
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        mode: "mcp-server",
        proxy: this.mcpProxy ? "running" : "stopped",
        clients: this.clients.size,
      });
    });
  }

  private responseBuffer = "";
  private pendingRequests = new Map<
    number | string,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timeoutId: NodeJS.Timeout;
    }
  >();

  private async forwardToProxy(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.mcpProxy || !this.mcpProxy.stdin || !this.mcpProxy.stdout) {
        reject(new Error("MCP代理不可用"));
        return;
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        logger.warn(
          `消息超时 id: ${message.id}, 方法: ${message.method} - 如果响应已通过SSE发送，这是正常的`
        );
        // 不要以错误拒绝，而是用超时指示器解析
        resolve({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            _timeout: true,
            message: "响应可能已通过SSE发送",
          },
        });
      }, 30000);

      // 存储待处理请求
      this.pendingRequests.set(message.id, { resolve, reject, timeoutId });

      // 记录正在发送的消息
      logger.info(`转发消息到代理: ${JSON.stringify(message)}`);
      this.mcpProxy.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  private handleProxyResponse(data: Buffer): void {
    try {
      // 在缓冲区中累积数据
      this.responseBuffer += data.toString();

      // 处理完整行
      const lines = this.responseBuffer.split("\n");
      this.responseBuffer = lines.pop() || ""; // 将不完整的行保留在缓冲区中

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            logger.debug(`收到代理响应: ${line.substring(0, 200)}...`);

            // 检查这是否是对待处理请求的响应
            if (
              response.id !== undefined &&
              this.pendingRequests.has(response.id)
            ) {
              const pendingRequest = this.pendingRequests.get(response.id)!;
              clearTimeout(pendingRequest.timeoutId);
              this.pendingRequests.delete(response.id);
              pendingRequest.resolve(response);
            }
          } catch (e) {
            // 跳过无效的JSON行
            logger.debug(`来自代理的非JSON行: ${line}`);
          }
        }
      }
    } catch (error) {
      logger.error("处理代理响应时出错:", error);
    }
  }

  private sendToClient(client: SSEClient, message: any): void {
    try {
      // 使用事件：消息格式（SDK标准）
      const data = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
      client.response.write(data);
    } catch (error) {
      logger.error(`发送到客户端 ${client.id} 失败:`, error);
      this.clients.delete(client.sessionId);
    }
  }

  private broadcastToClients(message: any): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, message);
    }
  }

  public async start(): Promise<void> {
    try {
      // 并行启动mcpServerProxy和HTTP服务器
      // 在接受其他客户端连接之前，我们不需要等待MCP客户端连接到xiaozhi.me
      const results = await Promise.allSettled([
        this.startMCPProxy(),
        new Promise<void>((resolve) => {
          // 启动HTTP服务器
          this.server = this.app.listen(this.port, "0.0.0.0", () => {
            logger.info(`MCP服务器监听端口 ${this.port} (所有网络接口)`);
            logger.info(`SSE端点: http://0.0.0.0:${this.port}/sse`);
            logger.info(`消息端点: http://0.0.0.0:${this.port}/messages`);
            logger.info(`RPC端点: http://0.0.0.0:${this.port}/rpc`);
            logger.info(`本地访问: http://localhost:${this.port}`);
            resolve();
          });
        }),
      ]);

      // 检查 MCP 代理启动结果
      const [mcpProxyResult, httpServerResult] = results;
      if (mcpProxyResult.status === "rejected") {
        logger.error("MCP代理启动失败:", mcpProxyResult.reason);
      }

      if (httpServerResult.status === "rejected") {
        logger.error("HTTP服务器启动失败:", httpServerResult.reason);
        throw httpServerResult.reason;
      }

      // 启动MCP客户端连接到xiaozhi.me（不要阻塞服务器启动）
      this.startMCPClient().catch((error) => {
        logger.error("启动连接到xiaozhi.me的MCP客户端失败:", error);
      });

      this.emit("started");
    } catch (error) {
      logger.error("启动MCP服务器失败:", error);
      throw error;
    }
  }

  private findMCPProxyPath(): string {
    // 如果已经缓存了路径，直接返回
    if (this.mcpProxyPath) {
      return this.mcpProxyPath;
    }

    // 由于 tsup 打包的原因，import.meta.url 可能不准确
    // 我们需要找到 mcpServerProxy.js 的正确位置

    // 首先尝试使用环境变量指定的路径（主要用于测试环境）
    // MCP_SERVER_PROXY_PATH: 指定 mcpServerProxy.js 文件的完整路径
    // 在测试环境中，可以设置此环境变量来直接指定文件位置
    if (process.env.MCP_SERVER_PROXY_PATH) {
      // 验证路径是否安全，防止路径遍历攻击
      const normalizedPath = path.normalize(process.env.MCP_SERVER_PROXY_PATH);
      const resolvedPath = path.resolve(normalizedPath);

      // 定义允许的目录白名单（仅限项目目录和系统临时目录）
      const allowedBaseDirectories = [
        __dirname, // 当前模块目录
        path.join(__dirname, ".."), // 上级目录
        path.join(__dirname, "..", ".."), // 项目根目录
        path.join(__dirname, "..", "..", "dist"), // 项目dist目录
        os.tmpdir(), // 系统临时目录
      ];

      // 确保路径在白名单目录内且具有正确的文件名
      if (
        fs.existsSync(resolvedPath) &&
        path.basename(resolvedPath) === MCP_SERVER_PROXY_FILENAME &&
        allowedBaseDirectories.some((dir) => resolvedPath.startsWith(dir))
      ) {
        this.mcpProxyPath = resolvedPath;
        return this.mcpProxyPath;
      }

      logger.warn(`MCP_SERVER_PROXY_PATH 路径不安全: ${normalizedPath}`);
      throw new Error(
        `指定的 MCP 代理路径不存在或不安全: ${process.env.MCP_SERVER_PROXY_PATH}`
      );
    }

    // 方法1：尝试从当前脚本的目录开始查找
    const currentScript = fileURLToPath(import.meta.url);
    let searchDir = path.dirname(currentScript);

    // 向上查找直到找到 mcpServerProxy.js
    let mcpProxyPath: string | null = null;
    for (let i = 0; i < MAX_SEARCH_LEVELS; i++) {
      // 最多向上查找MAX_SEARCH_LEVELS级
      const testPath = path.join(searchDir, MCP_SERVER_PROXY_FILENAME);
      if (fs.existsSync(testPath)) {
        mcpProxyPath = testPath;
        break;
      }
      // 也检查 dist 目录
      const distPath = path.join(searchDir, "dist", MCP_SERVER_PROXY_FILENAME);
      if (fs.existsSync(distPath)) {
        mcpProxyPath = distPath;
        break;
      }
      searchDir = path.dirname(searchDir);
    }

    // 如果还没找到，尝试从项目根目录查找
    if (!mcpProxyPath) {
      const projectRoot = path.resolve(__dirname, "..", "..");
      const rootDistPath = path.join(
        projectRoot,
        "dist",
        MCP_SERVER_PROXY_FILENAME
      );
      if (fs.existsSync(rootDistPath)) {
        mcpProxyPath = rootDistPath;
      }
    }

    if (!mcpProxyPath) {
      throw new Error(`在项目结构中找不到 ${MCP_SERVER_PROXY_FILENAME}`);
    }

    // 缓存并返回路径
    this.mcpProxyPath = mcpProxyPath;
    return this.mcpProxyPath;
  }

  private async startMCPProxy(): Promise<void> {
    const mcpProxyPath = this.findMCPProxyPath();
    logger.info(`正在启动MCP代理: ${mcpProxyPath}`);

    this.mcpProxy = spawn("node", [mcpProxyPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        MCP_SERVER_MODE: "true",
        XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
      },
    });

    this.mcpProxy.on("error", (error) => {
      logger.error("MCP代理错误:", error);
    });

    this.mcpProxy.on("exit", (code, signal) => {
      logger.warn(`MCP代理退出，代码 ${code}，信号 ${signal}`);
      this.mcpProxy = null;
    });

    if (this.mcpProxy.stderr) {
      this.mcpProxy.stderr.on("data", (data) => {
        const message = data.toString().trim();
        // mcpServerProxy 使用 logger 输出日志到 stderr，这些不是错误
        // 只有真正的错误信息才应该被标记为 ERROR
        if (
          message.includes("[ERROR]") ||
          message.includes("Error:") ||
          message.includes("Failed")
        ) {
          logger.error("MCP代理stderr:", message);
        } else {
          // 将正常的日志信息作为 info 级别输出
          logger.info("MCP代理输出:", message);
        }
      });
    }

    // 为响应设置全局stdout处理器
    if (this.mcpProxy.stdout) {
      this.mcpProxy.stdout.on("data", (data: Buffer) => {
        this.handleProxyResponse(data);
      });
    }

    // 等待代理准备就绪
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("MCP代理启动超时"));
      }, 10000);

      const dataHandler = (data: Buffer) => {
        const message = data.toString();
        if (
          message.includes("MCP proxy ready") ||
          message.includes("started")
        ) {
          clearTimeout(timeout);
          this.mcpProxy?.stdout?.removeListener("data", dataHandler);
          resolve();
        }
      };

      this.mcpProxy?.stdout?.on("data", dataHandler);
    });

    logger.info("MCP代理启动成功");
  }

  private async startMCPClient(): Promise<void> {
    try {
      // 初始化 MCPServiceManager
      this.mcpServiceManager = new MCPServiceManager();

      // 获取小智接入点配置
      let mcpEndpoint: string | null = null;
      try {
        if (configManager.configExists()) {
          const endpoints = configManager.getMcpEndpoints();
          mcpEndpoint =
            endpoints.find((ep) => ep && !ep.includes("<请填写")) || null;
        }
      } catch (error) {
        logger.warn("从配置中读取小智接入点失败:", error);
      }

      // 只有在配置了有效端点时才启动连接
      if (mcpEndpoint) {
        this.proxyMCPServer = new ProxyMCPServer(mcpEndpoint);
        this.proxyMCPServer.setServiceManager(this.mcpServiceManager);

        await this.proxyMCPServer.connect();
        logger.info("小智接入点连接成功");
      } else {
        logger.info("未配置有效的小智接入点，跳过连接");
      }
    } catch (error) {
      logger.error("启动MCP客户端失败:", error);
    }
  }

  public async stop(): Promise<void> {
    logger.info("正在停止MCP服务器...");

    // 关闭所有SSE连接
    for (const client of this.clients.values()) {
      try {
        client.response.end();
      } catch (error) {
        // 忽略关闭时的错误
      }
    }
    this.clients.clear();

    // 停止HTTP服务器
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // 停止MCP代理
    if (this.mcpProxy) {
      this.mcpProxy.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        this.mcpProxy!.on("exit", () => resolve());
        setTimeout(() => {
          this.mcpProxy?.kill("SIGKILL");
          resolve();
        }, 5000);
      });
      this.mcpProxy = null;
    }

    // 停止小智接入点连接
    if (this.proxyMCPServer) {
      await this.proxyMCPServer.disconnect();
      this.proxyMCPServer = null;
    }

    // 停止 MCP 服务管理器
    if (this.mcpServiceManager) {
      await this.mcpServiceManager.stopAllServices();
      this.mcpServiceManager = null;
    }

    // 清除缓存的MCP代理路径
    this.mcpProxyPath = null;

    this.emit("stopped");
    logger.info("MCP服务器已停止");
  }
}
