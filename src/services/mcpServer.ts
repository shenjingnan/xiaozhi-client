import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { configManager } from "../configManager.js";
import { logger as globalLogger } from "../logger.js";
import { MultiEndpointMCPPipe } from "../multiEndpointMCPPipe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = globalLogger.withTag("mcp-server");

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
  private mcpClient: MultiEndpointMCPPipe | null = null;
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

    // CORS for MCP clients
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.header("Cache-Control", "no-cache");
      next();
    });
  }

  private setupRoutes(): void {
    // SSE endpoint for MCP protocol
    this.app.get("/sse", (req, res) => {
      const clientId = Date.now().toString();
      const sessionId = randomUUID();

      // Set SSE headers (matching SDK implementation)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Register client with sessionId
      this.clients.set(sessionId, { id: clientId, sessionId, response: res });
      logger.info(`MCP client connected: ${clientId} (session: ${sessionId})`);

      // Send endpoint event first (SDK standard)
      res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

      // Handle client disconnect
      req.on("close", () => {
        this.clients.delete(sessionId);
        logger.info(
          `MCP client disconnected: ${clientId} (session: ${sessionId})`
        );
      });
    });

    // Messages endpoint for SSE transport (MCP SDK standard)
    this.app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string;
        const message = req.body;

        logger.info(
          `Received message via SSE transport (session: ${sessionId}):`,
          JSON.stringify(message)
        );

        if (!sessionId || !this.clients.has(sessionId)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "Invalid or missing sessionId",
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
              message: "MCP proxy not running",
            },
            id: message.id,
          });
          return;
        }

        // Check if this is a notification (no id field means it's a notification)
        if (message.id === undefined) {
          // This is a notification, forward it but don't wait for response
          logger.info(`Forwarding notification: ${message.method}`);
          this.mcpProxy!.stdin!.write(`${JSON.stringify(message)}\n`);

          // Send 202 Accepted immediately for notifications
          res.status(202).send();
        } else {
          // This is a request, forward and wait for response
          const response = await this.forwardToProxy(message);

          // Send response to specific client via SSE
          const client = this.clients.get(sessionId);
          if (client) {
            this.sendToClient(client, response);
          }

          // Send 202 Accepted to acknowledge receipt (SDK standard)
          res.status(202).send();
        }
      } catch (error) {
        logger.error("SSE message error:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
          id: req.body.id,
        });
      }
    });

    // JSON-RPC endpoint for direct RPC communication (legacy)
    this.app.post("/rpc", async (req, res) => {
      try {
        const message = req.body;
        logger.debug("Received RPC message:", message);

        if (!this.mcpProxy) {
          res.status(503).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "MCP proxy not running",
            },
            id: message.id,
          });
          return;
        }

        // Forward to mcpServerProxy
        const response = await this.forwardToProxy(message);
        res.json(response);
      } catch (error) {
        logger.error("RPC error:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
          id: req.body.id,
        });
      }
    });

    // Health check
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
        reject(new Error("MCP proxy not available"));
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        logger.warn(
          `Request timeout for message id: ${message.id}, method: ${message.method} - This may be normal if the response was already sent via SSE`
        );
        // Don't reject with error, just resolve with a timeout indicator
        resolve({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            _timeout: true,
            message: "Response may have been sent via SSE",
          },
        });
      }, 30000);

      // Store the pending request
      this.pendingRequests.set(message.id, { resolve, reject, timeoutId });

      // Log the message being sent
      logger.info(`Forwarding message to proxy: ${JSON.stringify(message)}`);
      this.mcpProxy.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  private handleProxyResponse(data: Buffer): void {
    try {
      // Accumulate data in buffer
      this.responseBuffer += data.toString();

      // Process complete lines
      const lines = this.responseBuffer.split("\n");
      this.responseBuffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            logger.debug(
              `Received response from proxy: ${line.substring(0, 200)}...`
            );

            // Check if this is a response to a pending request
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
            // Skip invalid JSON lines
            logger.debug(`Non-JSON line from proxy: ${line}`);
          }
        }
      }
    } catch (error) {
      logger.error("Error handling proxy response:", error);
    }
  }

  private sendToClient(client: SSEClient, message: any): void {
    try {
      // Use event: message format (SDK standard)
      const data = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
      client.response.write(data);
    } catch (error) {
      logger.error(`Failed to send to client ${client.id}:`, error);
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
      // Start mcpServerProxy and HTTP server in parallel
      // We don't need to wait for the MCP client to connect to xiaozhi.me
      // before starting the server to accept connections from other clients
      await Promise.all([
        this.startMCPProxy(),
        new Promise<void>((resolve) => {
          // Start HTTP server
          this.server = this.app.listen(this.port, () => {
            logger.info(`MCP Server listening on port ${this.port}`);
            logger.info(`SSE endpoint: http://localhost:${this.port}/sse`);
            logger.info(
              `Messages endpoint: http://localhost:${this.port}/messages`
            );
            logger.info(`RPC endpoint: http://localhost:${this.port}/rpc`);
            resolve();
          });
        }),
      ]);

      // Start MCP client to connect to xiaozhi.me (don't block server startup)
      this.startMCPClient().catch((error) => {
        logger.error("Failed to start MCP client for xiaozhi.me:", error);
      });

      this.emit("started");
    } catch (error) {
      logger.error("Failed to start MCP server:", error);
      throw error;
    }
  }

  private async startMCPProxy(): Promise<void> {
    // 由于 tsup 打包的原因，import.meta.url 可能不准确
    // 我们需要找到 mcpServerProxy.js 的正确位置

    // 方法1：尝试从当前脚本的目录开始查找
    const currentScript = fileURLToPath(import.meta.url);
    let searchDir = path.dirname(currentScript);

    // 向上查找直到找到 mcpServerProxy.js
    let mcpProxyPath: string | null = null;
    for (let i = 0; i < 5; i++) {
      // 最多向上查找5级
      const testPath = path.join(searchDir, "mcpServerProxy.js");
      const fs = await import("node:fs");
      if (fs.existsSync(testPath)) {
        mcpProxyPath = testPath;
        break;
      }
      // 也检查 dist 目录
      const distPath = path.join(searchDir, "dist", "mcpServerProxy.js");
      if (fs.existsSync(distPath)) {
        mcpProxyPath = distPath;
        break;
      }
      searchDir = path.dirname(searchDir);
    }

    if (!mcpProxyPath) {
      throw new Error(
        "Could not find mcpServerProxy.js in the project structure"
      );
    }

    logger.info(`Starting MCP proxy from: ${mcpProxyPath}`);

    this.mcpProxy = spawn("node", [mcpProxyPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        MCP_SERVER_MODE: "true",
        XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
      },
    });

    this.mcpProxy.on("error", (error) => {
      logger.error("MCP proxy error:", error);
    });

    this.mcpProxy.on("exit", (code, signal) => {
      logger.warn(`MCP proxy exited with code ${code}, signal ${signal}`);
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
          logger.error("MCP proxy stderr:", message);
        } else {
          // 将正常的日志信息作为 info 级别输出
          logger.info("MCP proxy output:", message);
        }
      });
    }

    // Set up global stdout handler for responses
    if (this.mcpProxy.stdout) {
      this.mcpProxy.stdout.on("data", (data: Buffer) => {
        this.handleProxyResponse(data);
      });
    }

    // Wait for proxy to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("MCP proxy startup timeout"));
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

    logger.info("MCP proxy started successfully");
  }

  private async startMCPClient(): Promise<void> {
    // 获取配置中的端点
    let endpoints: string[] = [];
    try {
      if (configManager.configExists()) {
        endpoints = configManager.getMcpEndpoints();
      }
    } catch (error) {
      logger.warn("Failed to read MCP endpoints from config:", error);
    }

    // 只有在配置中有端点时才启动客户端
    if (endpoints.length > 0) {
      // 获取 mcpServerProxy.js 的正确路径
      const currentScript = fileURLToPath(import.meta.url);
      let searchDir = path.dirname(currentScript);

      // 向上查找直到找到 mcpServerProxy.js
      let mcpProxyPath: string | null = null;
      for (let i = 0; i < 5; i++) {
        // 最多向上查找5级
        const testPath = path.join(searchDir, "mcpServerProxy.js");
        const fs = await import("node:fs");
        if (fs.existsSync(testPath)) {
          mcpProxyPath = testPath;
          break;
        }
        // 也检查 dist 目录
        const distPath = path.join(searchDir, "dist", "mcpServerProxy.js");
        if (fs.existsSync(distPath)) {
          mcpProxyPath = distPath;
          break;
        }
        searchDir = path.dirname(searchDir);
      }

      if (!mcpProxyPath) {
        logger.error(
          "Could not find mcpServerProxy.js in the project structure"
        );
        return;
      }

      this.mcpClient = new MultiEndpointMCPPipe(mcpProxyPath, endpoints);
      await this.mcpClient.start();
      logger.info("MCP client started, connecting to xiaozhi.me");
    } else {
      logger.info("No MCP endpoints configured, skipping client connection");
    }
  }

  public async stop(): Promise<void> {
    logger.info("Stopping MCP server...");

    // Close all SSE connections
    for (const client of this.clients.values()) {
      try {
        client.response.end();
      } catch (error) {
        // Ignore errors when closing
      }
    }
    this.clients.clear();

    // Stop HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // Stop MCP proxy
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

    // Stop MCP client
    if (this.mcpClient) {
      this.mcpClient.shutdown();
      this.mcpClient = null;
    }

    this.emit("stopped");
    logger.info("MCP server stopped");
  }
}
