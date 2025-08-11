import WebSocket from "ws";
import { Logger } from "./logger.js";

const MOCK_TOOLS = [
  {
    name: "calculator_add",
    description: "简单的加法计算器",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "第一个数字" },
        b: { type: "number", description: "第二个数字" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "weather_get",
    description: "获取天气信息",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名称" },
      },
      required: ["city"],
    },
  },
];

interface MCPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
}

interface ProxyMCPServerStatus {
  connected: boolean;
  initialized: boolean;
  url: string;
  availableTools: number;
}

export class ProxyMCPServer {
  private endpointUrl: string;
  private ws: WebSocket | null = null;
  private logger: Logger;
  private isConnected = false;
  private serverInitialized = false;
  private messageId = 0;
  private availableTools = MOCK_TOOLS; // 直接使用所有工具，不延迟添加

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl;
    this.logger = new Logger();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(`正在连接 MCP 接入点: ${this.endpointUrl}`);

      this.ws = new WebSocket(this.endpointUrl);

      this.ws.on("open", () => {
        this.isConnected = true;
        this.logger.info("MCP WebSocket 连接已建立");
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message: MCPMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.logger.error("MCP 消息解析错误:", error);
        }
      });

      this.ws.on("close", (code, reason) => {
        this.isConnected = false;
        this.serverInitialized = false;
        this.logger.info(`MCP 连接已关闭 (代码: ${code}, 原因: ${reason})`);
      });

      this.ws.on("error", (error) => {
        this.logger.error("MCP WebSocket 错误:", error.message);
        reject(error);
      });
    });
  }

  private handleMessage(message: MCPMessage): void {
    this.logger.debug("收到 MCP 消息:", JSON.stringify(message, null, 2));

    if (message.method) {
      this.handleServerRequest(message);
    }
  }

  private handleServerRequest(request: MCPMessage): void {
    switch (request.method) {
      case "initialize":
        this.sendResponse(request.id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true },
            logging: {},
          },
          serverInfo: {
            name: "xiaozhi-mcp-server",
            version: "1.0.0",
          },
        });
        this.serverInitialized = true;
        this.logger.info("MCP 服务器初始化完成");
        break;

      case "tools/list":
        this.sendResponse(request.id, { tools: this.availableTools });
        this.logger.info(`MCP 工具列表已发送 (${this.availableTools.length}个工具)`);
        break;

      case "ping":
        this.sendResponse(request.id, {});
        this.logger.debug("回应 MCP ping 消息");
        break;

      default:
        this.logger.warn(`未知的 MCP 请求: ${request.method}`);
    }
  }

  private sendResponse(id: number | string | undefined, result: any): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      const response: MCPMessage = {
        jsonrpc: "2.0",
        id,
        result,
      };
      this.ws.send(JSON.stringify(response));
    }
  }

  private sendMessage(message: MCPMessage): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public getStatus(): ProxyMCPServerStatus {
    return {
      connected: this.isConnected,
      initialized: this.serverInitialized,
      url: this.endpointUrl,
      availableTools: this.availableTools.length,
    };
  }

  public disconnect(): void {
    this.logger.info("主动断开 MCP 连接");

    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }

    this.isConnected = false;
    this.serverInitialized = false;
  }
}
