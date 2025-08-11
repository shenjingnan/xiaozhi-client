import WebSocket from "ws";
import { Logger } from "./logger.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// MCP 消息接口
interface MCPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
}

// 服务器状态接口
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

  // 工具管理
  private tools: Map<string, Tool> = new Map();

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl;
    this.logger = new Logger();
  }

  /**
   * 添加单个工具
   * @param name 工具名称
   * @param tool 工具定义
   * @param options 工具选项（可选）
   * @returns 返回 this 支持链式调用
   */
  addTool(name: string, tool: Tool): this {
    this.validateTool(name, tool);
    this.tools.set(name, tool);
    this.logger.debug(`工具 '${name}' 已添加`);
    // TODO: 未来可以使用 options 参数来设置工具的启用状态、元数据等
    return this;
  }

  /**
   * 批量添加工具
   * @param tools 工具对象，键为工具名称，值为工具定义
   * @returns 返回 this 支持链式调用
   */
  addTools(tools: Record<string, Tool>): this {
    for (const [name, tool] of Object.entries(tools)) {
      this.addTool(name, tool);
    }
    return this;
  }

  /**
   * 移除单个工具
   * @param name 工具名称
   * @returns 返回 this 支持链式调用
   */
  removeTool(name: string): this {
    if (this.tools.delete(name)) {
      this.logger.debug(`工具 '${name}' 已移除`);
    } else {
      this.logger.warn(`尝试移除不存在的工具: '${name}'`);
    }
    return this;
  }

  /**
   * 获取当前所有工具列表
   * @returns 工具数组
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 检查工具是否存在
   * @param name 工具名称
   * @returns 是否存在
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 验证工具的有效性
   * @param name 工具名称
   * @param tool 工具定义
   */
  private validateTool(name: string, tool: Tool): void {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error("工具名称必须是非空字符串");
    }

    if (this.tools.has(name)) {
      throw new Error(`工具 '${name}' 已存在`);
    }

    if (!tool || typeof tool !== 'object') {
      throw new Error("工具必须是有效的对象");
    }

    // 验证工具的必需字段
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error("工具必须包含有效的 'name' 字段");
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error("工具必须包含有效的 'description' 字段");
    }

    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      throw new Error("工具必须包含有效的 'inputSchema' 字段");
    }

    // 验证 inputSchema 的基本结构
    if (!tool.inputSchema.type || !tool.inputSchema.properties) {
      throw new Error("工具的 inputSchema 必须包含 'type' 和 'properties' 字段");
    }
  }

  /**
   * 连接 MCP 接入点
   * @returns 连接成功后的 Promise
   */
  public async connect(): Promise<void> {
    // 连接前验证
    if (this.tools.size === 0) {
      throw new Error("未配置任何工具。请在连接前至少添加一个工具。");
    }

    this.logger.info(`准备连接 MCP 接入点，当前配置了 ${this.tools.size} 个工具: ${Array.from(this.tools.keys()).join(', ')}`);

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

      case "tools/list": {
        const toolsList = this.getTools();
        this.sendResponse(request.id, { tools: toolsList });
        this.logger.info(`MCP 工具列表已发送 (${toolsList.length}个工具)`);
        break;
      }

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

  /**
   * 获取 MCP 服务器状态
   * @returns 服务器状态
   */
  public getStatus(): ProxyMCPServerStatus {
    return {
      connected: this.isConnected,
      initialized: this.serverInitialized,
      url: this.endpointUrl,
      availableTools: this.tools.size,
    };
  }

  /**
   * 主动断开 MCP 连接
   */
  public disconnect(): void {
    this.logger.info("主动断开 MCP 连接");

    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }

    this.isConnected = false;
    this.serverInitialized = false;
  }

  /**
   * 重连小智接入点
   */
  public async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }
}
