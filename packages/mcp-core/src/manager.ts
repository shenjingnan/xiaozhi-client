/**
 * MCP 服务管理器
 * 提供简洁的 API 来管理多个 MCP 服务
 */

import { EventEmitter } from "node:events";
import { MCPConnection } from "./connection.js";
import type { MCPServiceConfig, ToolCallResult } from "./types.js";
import { MCPTransportType } from "./types.js";

/**
 * 用户友好的传输类型
 * 用于简化和标准化用户输入
 */
type UserFriendlyTransportType =
  | "stdio"
  | "sse"
  | "http"
  | MCPTransportType;

/**
 * MCP 服务管理器
 * 提供简洁的 API 来管理多个 MCP 服务
 *
 * @example
 * ```typescript
 * const manager = new MCPManager();
 *
 * // 添加服务
 * manager.addServer('datetime', {
 *   type: 'stdio',
 *   command: 'node',
 *   args: ['datetime.js']
 * });
 *
 * // 连接所有服务
 * await manager.connect();
 *
 * // 调用工具
 * const result = await manager.callTool('datetime', 'get_current_time', {
 *   format: 'YYYY-MM-DD HH:mm:ss'
 * });
 *
 * // 断开连接
 * await manager.disconnect();
 * ```
 */
export class MCPManager extends EventEmitter {
  private connections: Map<string, MCPConnection> = new Map();
  private configs: Map<string, MCPServiceConfig> = new Map();

  constructor() {
    super();
  }

  /**
   * 添加 MCP 服务器配置
   * @param name 服务器名称
   * @param config 服务器配置
   *
   * @example
   * ```typescript
   * // 添加 stdio 服务
   * manager.addServer('calculator', {
   *   type: 'stdio',
   *   command: 'node',
   *   args: ['calculator.js']
   * });
   *
   * // 添加 HTTP 服务
   * manager.addServer('web-search', {
   *   type: 'http',
   *   url: 'https://api.example.com/mcp',
   *   headers: {
   *     Authorization: 'Bearer your-api-key'
   *   }
   * });
   * ```
   */
  addServer(
    name: string,
    config: Omit<MCPServiceConfig, "name"> & {
      type?: UserFriendlyTransportType;
    }
  ): void {
    if (this.configs.has(name)) {
      throw new Error(`服务 ${name} 已存在`);
    }

    // 标准化 type 字段 - 将用户友好的类型映射到实际的枚举值
    const normalizedConfig: MCPServiceConfig = { ...config };

    if (config.type) {
      // 首先检查用户友好的字符串类型
      const typeStr = String(config.type);
      if (typeStr === "http") {
        normalizedConfig.type = MCPTransportType.STREAMABLE_HTTP;
      } else if (typeStr === "sse") {
        normalizedConfig.type = MCPTransportType.SSE;
      } else {
        // 已经是枚举值或正确格式
        normalizedConfig.type = config.type as MCPTransportType;
      }
    }

    // 存储 config（不包含 name，name 已作为 Map 的 key）
    this.configs.set(name, normalizedConfig);
  }

  /**
   * 移除服务器配置
   * @param name 服务器名称
   */
  removeServer(name: string): boolean {
    return this.configs.delete(name);
  }

  /**
   * 连接所有已添加的 MCP 服务
   * 所有服务并行连接，单个服务失败不会影响其他服务
   *
   * @example
   * ```typescript
   * await manager.connect();
   * ```
   */
  async connect(): Promise<void> {
    this.emit("connect");

    const promises = Array.from(this.configs.entries()).map(
      async ([name, config]) => {
        try {
          const connection = new MCPConnection(name, config, {
            onConnected: (data) => {
              this.emit("connected", {
                serverName: data.serviceName,
                tools: data.tools,
              });
            },
            onDisconnected: (data) => {
              this.emit("disconnected", {
                serverName: data.serviceName,
                reason: data.reason,
              });
            },
            onConnectionFailed: (data) => {
              this.emit("error", {
                serverName: data.serviceName,
                error: data.error,
              });
            },
          });

          await connection.connect();
          this.connections.set(name, connection);
        } catch (error) {
          this.emit("error", { serverName: name, error });
          throw error;
        }
      }
    );

    await Promise.allSettled(promises);
  }

  /**
   * 断开所有 MCP 服务连接
   *
   * @example
   * ```typescript
   * await manager.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    const promises = Array.from(this.connections.values()).map((conn) =>
      conn.disconnect()
    );

    await Promise.allSettled(promises);
    this.connections.clear();

    this.emit("disconnect");
  }

  /**
   * 调用指定服务的工具
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param args 工具参数
   *
   * @example
   * ```typescript
   * const result = await manager.callTool('datetime', 'get_current_time', {
   *   format: 'YYYY-MM-DD HH:mm:ss'
   * });
   * ```
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`服务 ${serverName} 不存在`);
    }

    if (!connection.isConnected()) {
      throw new Error(`服务 ${serverName} 未连接`);
    }

    return connection.callTool(toolName, args);
  }

  /**
   * 列出所有可用的工具
   * @returns 工具列表，格式为 [{ name, serverName, description, inputSchema }]
   *
   * @example
   * ```typescript
   * const tools = manager.listTools();
   * console.log('可用工具:', tools.map(t => `${t.serverName}/${t.name}`));
   * ```
   */
  listTools(): Array<{
    name: string;
    serverName: string;
    description: string;
    inputSchema: unknown;
  }> {
    const allTools: Array<{
      name: string;
      serverName: string;
      description: string;
      inputSchema: unknown;
    }> = [];

    for (const [serverName, connection] of this.connections) {
      if (connection.isConnected()) {
        const tools = connection.getTools();
        for (const tool of tools) {
          allTools.push({
            name: tool.name,
            serverName,
            description: tool.description || "",
            inputSchema: tool.inputSchema,
          });
        }
      }
    }

    return allTools;
  }

  /**
   * 获取服务状态
   * @param serverName 服务名称
   * @returns 服务状态，如果服务不存在则返回 null
   *
   * @example
   * ```typescript
   * const status = manager.getServerStatus('datetime');
   * if (status) {
   *   console.log(`已连接: ${status.connected}, 工具数: ${status.toolCount}`);
   * }
   * ```
   */
  getServerStatus(serverName: string): {
    connected: boolean;
    toolCount: number;
  } | null {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return null;
    }

    const status = connection.getStatus();
    return {
      connected: status.connected,
      toolCount: status.toolCount,
    };
  }

  /**
   * 获取所有服务的状态
   * @returns 所有服务的状态映射
   *
   * @example
   * ```typescript
   * const statuses = manager.getAllServerStatus();
   * console.log(statuses);
   * // {
   * //   datetime: { connected: true, toolCount: 3 },
   * //   calculator: { connected: true, toolCount: 1 }
   * // }
   * ```
   */
  getAllServerStatus(): Record<
    string,
    { connected: boolean; toolCount: number }
  > {
    const statuses: Record<string, { connected: boolean; toolCount: number }> = {};

    for (const [serverName, connection] of this.connections) {
      const status = connection.getStatus();
      statuses[serverName] = {
        connected: status.connected,
        toolCount: status.toolCount,
      };
    }

    return statuses;
  }

  /**
   * 检查服务是否已连接
   * @param serverName 服务名称
   *
   * @example
   * ```typescript
   * if (manager.isConnected('datetime')) {
   *   console.log('datetime 服务已连接');
   * }
   * ```
   */
  isConnected(serverName: string): boolean {
    const connection = this.connections.get(serverName);
    return connection ? connection.isConnected() : false;
  }

  /**
   * 获取已配置的服务列表
   * @returns 服务名称数组
   *
   * @example
   * ```typescript
   * const servers = manager.getServerNames();
   * console.log('已配置的服务:', servers);
   * ```
   */
  getServerNames(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * 获取已连接的服务列表
   * @returns 已连接的服务名称数组
   *
   * @example
   * ```typescript
   * const connectedServers = manager.getConnectedServerNames();
   * console.log('已连接的服务:', connectedServers);
   * ```
   */
  getConnectedServerNames(): string[] {
    const connected: string[] = [];
    for (const [serverName, connection] of this.connections) {
      if (connection.isConnected()) {
        connected.push(serverName);
      }
    }
    return connected;
  }
}

// 为了向后兼容，保留旧的 MCPServiceManager 类名作为别名
export { MCPManager as MCPServiceManager };
