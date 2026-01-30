/**
 * 向后兼容的 MCPService 类
 * 包装 @xiaozhi-client/mcp-core 的 MCPConnection，使用 EventBus 发射事件
 */

import { MCP_SERVICE_EVENTS } from "@/constants/index.js";
import { getEventBus } from "@/root/services/event-bus.service.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MCPConnection } from "@xiaozhi-client/mcp-core";
import type { InternalMCPServiceConfig } from "./types.js";

/**
 * MCP 服务类（向后兼容包装器）
 * 负责管理单个 MCP 服务的连接、工具管理和调用
 */
export class MCPService {
  private connection: MCPConnection;
  private eventBus = getEventBus();

  constructor(config: InternalMCPServiceConfig) {
    // 从配置中解构 name，其余作为连接配置
    const {
      name,
      ...connectionConfig
    }: { name: string } & Omit<InternalMCPServiceConfig, "name"> = config;

    // 创建回调适配器，将 mcp-core 的回调转换为 EventBus 事件
    const callbacks = {
      onConnected: (data: {
        serviceName: string;
        tools: Tool[];
        connectionTime: Date;
      }) => {
        this.eventBus.emitEvent(MCP_SERVICE_EVENTS.CONNECTED, data);
      },
      onDisconnected: (data: {
        serviceName: string;
        reason?: string;
        disconnectionTime: Date;
      }) => {
        this.eventBus.emitEvent(MCP_SERVICE_EVENTS.DISCONNECTED, data);
      },
      onConnectionFailed: (data: {
        serviceName: string;
        error: Error;
        attempt: number;
      }) => {
        this.eventBus.emitEvent(MCP_SERVICE_EVENTS.CONNECTION_FAILED, data);
      },
    };

    // 适配新 API：将 name 从 config 中分离
    this.connection = new MCPConnection(name, connectionConfig, callbacks);
  }

  /**
   * 连接到 MCP 服务
   */
  async connect(): Promise<void> {
    return this.connection.connect();
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    return this.connection.disconnect();
  }

  /**
   * 调用工具
   */
  async callTool(name: string, arguments_: Record<string, unknown>) {
    return this.connection.callTool(name, arguments_);
  }

  /**
   * 获取工具列表
   */
  getTools(): Tool[] {
    return this.connection.getTools();
  }

  /**
   * 获取服务配置
   */
  getConfig() {
    return this.connection.getConfig();
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return this.connection.getStatus();
  }

  /**
   * 检查是否已连接
   */
  isConnected() {
    return this.connection.isConnected();
  }
}
