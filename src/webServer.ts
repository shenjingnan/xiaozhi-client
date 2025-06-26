import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { parse } from "node:url";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { ConfigManager } from "./configManager.js";
import type { AppConfig } from "./configManager.js";
import { Logger } from "./logger.js";

interface ClientInfo {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

export class WebServer {
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private configManager: ConfigManager;
  private logger: Logger;
  private port: number;
  private clientInfo: ClientInfo = {
    status: "disconnected",
    mcpEndpoint: "",
    activeMCPServers: [],
  };

  constructor(port = 9999) {
    this.port = port;
    this.configManager = new ConfigManager();
    this.logger = new Logger("WebServer");

    this.httpServer = createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({ server: this.httpServer });
    this.setupWebSocket();
  }

  private async handleHttpRequest(req: any, res: any) {
    const { pathname } = parse(req.url || "", true);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // 提供静态文件
      if (req.method === "GET" && !pathname?.startsWith("/api/")) {
        await this.serveStaticFile(pathname || "/", res);
        return;
      }

      if (pathname === "/api/config" && req.method === "GET") {
        const config = await this.configManager.readConfig();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(config));
      } else if (pathname === "/api/config" && req.method === "PUT") {
        let body = "";
        req.on("data", (chunk: any) => {
          body += chunk.toString();
        });
        req.on("end", async () => {
          try {
            const newConfig: AppConfig = JSON.parse(body);
            await this.configManager.updateConfig(newConfig);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));

            this.broadcastConfigUpdate(newConfig);
          } catch (error) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      } else if (pathname === "/api/status" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(this.clientInfo));
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    } catch (error) {
      this.logger.error("HTTP request error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }

  private async serveStaticFile(pathname: string, res: any) {
    try {
      // 获取当前文件所在目录
      const __dirname = dirname(fileURLToPath(import.meta.url));

      // 确定web目录路径
      const possibleWebPaths = [
        join(__dirname, "..", "web", "dist"), // 构建后的目录
        join(__dirname, "..", "web"), // 开发目录
        join(process.cwd(), "web", "dist"), // 当前工作目录
        join(process.cwd(), "web"),
      ];

      const webPath = possibleWebPaths.find((p) => existsSync(p));

      if (!webPath) {
        // 如果找不到 web 目录，返回简单的 HTML 页面
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>小智配置管理</title>
            <meta charset="utf-8">
            <style>
              body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              .error { color: #e53e3e; background: #fed7d7; padding: 20px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <h1>小智配置管理</h1>
            <div class="error">
              <p>错误：找不到前端资源文件。</p>
              <p>请先构建前端项目：</p>
              <pre>cd web && pnpm install && pnpm build</pre>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // 处理路径
      let filePath = pathname;
      if (filePath === "/") {
        filePath = "/index.html";
      }

      // 安全性检查：防止路径遍历
      if (filePath.includes("..")) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const fullPath = join(webPath, filePath);

      // 检查文件是否存在
      if (!existsSync(fullPath)) {
        // 对于 SPA，返回 index.html
        const indexPath = join(webPath, "index.html");
        if (existsSync(indexPath)) {
          const content = await readFile(indexPath);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
        return;
      }

      // 读取文件
      const content = await readFile(fullPath);

      // 设置正确的 Content-Type
      const ext = fullPath.split(".").pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        ico: "image/x-icon",
      };

      const contentType = contentTypes[ext || ""] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch (error) {
      this.logger.error("Serve static file error:", error);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }

  private setupWebSocket() {
    this.wss.on("connection", (ws) => {
      this.logger.info("WebSocket client connected");

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.error("WebSocket message error:", error);
          ws.send(JSON.stringify({ type: "error", error: error.message }));
        }
      });

      ws.on("close", () => {
        this.logger.info("WebSocket client disconnected");
      });

      this.sendInitialData(ws);
    });
  }

  private async handleWebSocketMessage(ws: any, data: any) {
    switch (data.type) {
      case "getConfig": {
        const config = await this.configManager.readConfig();
        ws.send(JSON.stringify({ type: "config", data: config }));
        break;
      }

      case "updateConfig":
        await this.configManager.updateConfig(data.config);
        this.broadcastConfigUpdate(data.config);
        break;

      case "getStatus":
        ws.send(JSON.stringify({ type: "status", data: this.clientInfo }));
        break;

      case "clientStatus":
        this.updateClientInfo(data.data);
        this.broadcastStatusUpdate();
        break;
    }
  }

  private async sendInitialData(ws: any) {
    const config = await this.configManager.readConfig();
    ws.send(JSON.stringify({ type: "config", data: config }));
    ws.send(JSON.stringify({ type: "status", data: this.clientInfo }));
  }

  private broadcastConfigUpdate(config: AppConfig) {
    const message = JSON.stringify({ type: "configUpdate", data: config });
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  private broadcastStatusUpdate() {
    const message = JSON.stringify({
      type: "statusUpdate",
      data: this.clientInfo,
    });
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  private updateClientInfo(info: Partial<ClientInfo>) {
    this.clientInfo = { ...this.clientInfo, ...info };
    if (info.lastHeartbeat) {
      this.clientInfo.lastHeartbeat = Date.now();
    }
  }

  public updateStatus(info: Partial<ClientInfo>) {
    this.updateClientInfo(info);
    this.broadcastStatusUpdate();
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer
        .listen(this.port, () => {
          this.logger.info(
            `Web server listening on http://localhost:${this.port}`
          );
          resolve();
        })
        .on("error", reject);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => {
          this.logger.info("Web server stopped");
          resolve();
        });
      });
    });
  }
}
