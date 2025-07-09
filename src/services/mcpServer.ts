import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { configManager } from "../configManager.js";
import { logger as globalLogger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = globalLogger.withTag("mcp-server");

interface SSEClient {
  id: string;
  response: express.Response;
}

export class MCPServer extends EventEmitter {
  private app: express.Application;
  private server: Server | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private mcpProxy: ChildProcess | null = null;
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

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Register client
      this.clients.set(clientId, { id: clientId, response: res });
      logger.info(`MCP client connected: ${clientId}`);

      // Send initial connection event
      res.write(`event: open\ndata: {"protocol":"mcp","version":"1.0"}\n\n`);

      // Handle client disconnect
      req.on("close", () => {
        this.clients.delete(clientId);
        logger.info(`MCP client disconnected: ${clientId}`);
      });
    });

    // JSON-RPC endpoint for MCP protocol
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

  private async forwardToProxy(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.mcpProxy || !this.mcpProxy.stdin || !this.mcpProxy.stdout) {
        reject(new Error("MCP proxy not available"));
        return;
      }

      const messageHandler = (data: Buffer) => {
        try {
          const lines = data
            .toString()
            .split("\n")
            .filter((line) => line.trim());
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              if (response.id === message.id) {
                this.mcpProxy?.stdout?.removeListener("data", messageHandler);
                resolve(response);
                return;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      this.mcpProxy.stdout.on("data", messageHandler);
      this.mcpProxy.stdin.write(`${JSON.stringify(message)}\n`);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.mcpProxy?.stdout?.removeListener("data", messageHandler);
        reject(new Error("Request timeout"));
      }, 30000);
    });
  }

  private broadcastToClients(message: any): void {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    for (const client of this.clients.values()) {
      try {
        client.response.write(data);
      } catch (error) {
        logger.error(`Failed to send to client ${client.id}:`, error);
        this.clients.delete(client.id);
      }
    }
  }

  public async start(): Promise<void> {
    try {
      // Start mcpServerProxy
      await this.startMCPProxy();

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        logger.info(`MCP Server listening on port ${this.port}`);
        logger.info(`SSE endpoint: http://localhost:${this.port}/sse`);
        logger.info(`RPC endpoint: http://localhost:${this.port}/rpc`);
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
        logger.error("MCP proxy stderr:", data.toString());
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

    this.emit("stopped");
    logger.info("MCP server stopped");
  }
}
