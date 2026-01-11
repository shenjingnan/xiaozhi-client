/**
 * 小智接入点管理器
 *
 * 管理多个小智接入点的连接，每个小智接入点独立运行
 * 这是简化版本，移除了配置持久化和事件总线依赖
 */

import { EventEmitter } from "node:events";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { EndpointConnection } from "./connection.js";
import type {
  ConfigChangeEvent,
  ConnectionOptions,
  ConnectionStatus,
  IMCPServiceManager,
  ReconnectResult,
  SimpleConnectionStatus,
} from "./types.js";
import { ensureToolJSONSchema } from "./types.js";
import { isValidEndpointUrl, sliceEndpoint } from "./utils.js";

// 默认配置
const DEFAULT_OPTIONS: Required<ConnectionOptions> = {
  connectionTimeout: 10000,
  reconnectDelay: 2000,
};

/**
 * 小智接入点管理器
 *
 * 负责管理多个小智接入点的连接，每个小智接入点独立运行
 * 纯内存管理，无持久化副作用
 */
export class EndpointManager extends EventEmitter {
  // 连接实例管理
  private connections: Map<string, EndpointConnection> = new Map();
  private connectionStates: Map<string, ConnectionStatus> = new Map();

  // 核心依赖
  private mcpServiceManager: IMCPServiceManager | null = null;

  // 状态管理
  private isInitialized = false;
  private isConnecting = false;

  // 配置选项
  private options: Required<ConnectionOptions>;

  /**
   * 构造函数
   *
   * @param options - 连接选项
   */
  constructor(options?: ConnectionOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    console.debug("[EndpointManager] 实例已创建");
    console.debug("[EndpointManager] 配置选项:", this.options);
  }

  /**
   * 初始化连接管理器
   *
   * @param endpoints - 小智接入点列表
   * @param tools - 工具列表
   */
  async initialize(endpoints: string[], tools: Tool[]): Promise<void> {
    if (this.isInitialized) return;

    console.debug(
      `开始初始化 EndpointManager，小智接入点数量: ${endpoints.length}`
    );

    try {
      // 验证输入参数
      this.validateInitializeParams(endpoints, tools);

      // 清理现有连接（如果有）
      await this.cleanup();

      // 为每个小智接入点创建连接实例
      for (const endpoint of endpoints) {
        await this.createConnection(endpoint, tools);
      }

      this.isInitialized = true;

      console.debug(
        `EndpointManager 初始化完成，管理 ${this.connections.size} 个连接`
      );
    } catch (error) {
      console.error("EndpointManager 初始化失败:", error);
      await this.cleanup(); // 清理部分创建的连接
      throw error;
    }
  }

  /**
   * 连接所有小智接入点
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("EndpointManager 未初始化，请先调用 initialize()");
    }

    if (this.isConnecting) return;

    this.isConnecting = true;
    console.debug(`开始连接所有小智接入点，总数: ${this.connections.size}`);

    try {
      const connectionPromises: Promise<void>[] = [];

      // 并发连接所有小智接入点
      for (const [endpoint, endpointConnection] of this.connections) {
        connectionPromises.push(
          this.connectSingleEndpoint(endpoint, endpointConnection)
        );
      }

      // 等待所有连接完成（允许部分失败）
      const results = await Promise.allSettled(connectionPromises);

      // 统计连接结果
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;

      // 如果所有连接都失败，抛出错误
      if (successCount === 0) {
        throw new Error("所有小智接入点连接失败");
      }
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 断开所有连接
   */
  async disconnect(): Promise<void> {
    console.debug("开始断开所有连接");

    // 断开所有连接
    const disconnectPromises: Promise<void>[] = [];
    for (const [endpoint, endpointConnection] of this.connections) {
      disconnectPromises.push(
        this.disconnectSingleEndpoint(endpoint, endpointConnection)
      );
    }

    await Promise.allSettled(disconnectPromises);
    console.debug("所有小智接入点已断开连接");
  }

  /**
   * 添加连接（不写配置文件）
   *
   * @param endpoint - 小智接入点地址
   */
  async addConnection(endpoint: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("EndpointManager 未初始化");
    }

    // 检查连接管理器中的重复性
    if (this.connections.has(endpoint)) {
      console.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 已存在于连接管理器中，跳过添加`
      );
      return;
    }

    console.debug(`动态添加小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 获取当前工具列表
      const tools = this.getCurrentTools();

      // 创建新连接
      await this.createConnection(endpoint, tools);

      // 自动连接新添加的接入点
      const endpointConnection = this.connections.get(endpoint);
      if (!endpointConnection) {
        throw new Error(`无法获取接入点连接: ${endpoint}`);
      }
      await this.connectSingleEndpoint(endpoint, endpointConnection);

      console.info(`添加接入点成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      // 清理失败的连接
      this.connections.delete(endpoint);
      this.connectionStates.delete(endpoint);

      console.error(`添加小智接入点失败: ${sliceEndpoint(endpoint)}`, error);
      throw error;
    }
  }

  /**
   * 移除连接（不写配置文件）
   *
   * @param endpoint - 小智接入点地址
   */
  async removeConnection(endpoint: string): Promise<void> {
    if (!this.connections.has(endpoint)) {
      console.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 不存在于连接管理器中，跳过移除`
      );
      return;
    }

    console.debug(`动态移除小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      const endpointConnection = this.connections.get(endpoint);
      if (!endpointConnection) {
        throw new Error(`无法获取接入点连接: ${endpoint}`);
      }

      // 断开连接
      await this.disconnectSingleEndpoint(endpoint, endpointConnection);

      // 清理资源
      this.connections.delete(endpoint);
      this.connectionStates.delete(endpoint);

      console.info(`移除小智接入点成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      console.error(`移除小智接入点失败: ${sliceEndpoint(endpoint)}`, error);
      throw error;
    }
  }

  /**
   * 获取所有小智接入点
   */
  getEndpoints(): string[] {
    // 同时返回connections和connectionStates中的小智接入点
    const connectionEndpoints = Array.from(this.connections.keys());
    const stateEndpoints = Array.from(this.connectionStates.keys());
    return Array.from(new Set([...connectionEndpoints, ...stateEndpoints]));
  }

  /**
   * 断开指定小智接入点连接
   *
   * @param endpoint - 要断开的小智接入点
   */
  async disconnectEndpoint(endpoint: string): Promise<void> {
    const endpointConnection = this.connections.get(endpoint);
    if (!endpointConnection) {
      console.debug(`接入点不存在，跳过断开: ${sliceEndpoint(endpoint)}`);
      return;
    }

    console.info(`断开连接接入点: ${sliceEndpoint(endpoint)}`);

    try {
      await this.disconnectSingleEndpoint(endpoint, endpointConnection);
    } catch (error) {
      console.error(`断开连接接入点失败: ${sliceEndpoint(endpoint)}`, error);
      throw error;
    }
  }

  /**
   * 清除所有小智接入点
   */
  async clearEndpoints(): Promise<void> {
    console.debug("清除所有接入点");

    // 断开所有连接
    const disconnectPromises = Array.from(this.connections.keys()).map(
      (endpoint) => this.removeConnection(endpoint)
    );
    await Promise.allSettled(disconnectPromises);

    console.info("所有接入点已清除");
  }

  /**
   * 获取所有连接状态
   */
  getConnectionStatus(): ConnectionStatus[] {
    return Array.from(this.connectionStates.values());
  }

  /**
   * 检查是否有任何连接处于连接状态
   */
  isAnyConnected(): boolean {
    for (const status of this.connectionStates.values()) {
      if (status.connected) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查指定端点是否已连接
   *
   * @param endpoint - 端点地址
   * @returns 是否已连接
   */
  isEndpointConnected(endpoint: string): boolean {
    const status = this.connectionStates.get(endpoint);
    return status?.connected ?? false;
  }

  /**
   * 获取指定端点的状态
   *
   * @param endpoint - 端点地址
   * @returns 端点状态
   */
  getEndpointStatus(endpoint: string): SimpleConnectionStatus | undefined {
    return this.connectionStates.get(endpoint);
  }

  /**
   * 设置 MCP 服务管理器
   *
   * @param manager - MCP 服务管理器实例
   */
  setServiceManager(manager: IMCPServiceManager): void {
    this.mcpServiceManager = manager;
    console.debug("已设置 MCPServiceManager");

    // 同步更新所有连接的服务管理器
    for (const [endpoint, connection] of this.connections) {
      connection.setServiceManager(manager);
      console.debug(`已更新连接 ${sliceEndpoint(endpoint)} 的服务管理器`);
    }
  }

  /**
   * 连接已存在的接入点（不创建新实例）
   *
   * @param endpoint - 要连接的接入点地址
   */
  async connectExistingEndpoint(endpoint: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("EndpointManager 未初始化");
    }

    const endpointConnection = this.connections.get(endpoint);
    if (!endpointConnection) {
      throw new Error(
        `接入点 ${sliceEndpoint(endpoint)} 不存在，请先添加接入点`
      );
    }

    const currentState = this.connectionStates.get(endpoint);
    if (currentState?.connected) {
      console.debug(`接入点 ${sliceEndpoint(endpoint)} 已连接，跳过连接`);
      return;
    }

    console.info(`连接已存在的接入点: ${sliceEndpoint(endpoint)}`);
    await this.connectSingleEndpoint(endpoint, endpointConnection);
  }

  /**
   * 重连所有接入点
   *
   * @returns 重连结果统计
   */
  async reconnectAll(): Promise<ReconnectResult> {
    if (!this.isInitialized) {
      throw new Error("EndpointManager 未初始化，请先调用 initialize()");
    }

    console.info(`开始重连所有接入点，总数: ${this.connections.size}`);

    const reconnectPromises: Promise<void>[] = [];
    const results: Array<{
      endpoint: string;
      success: boolean;
      error?: string;
    }> = [];

    // 并发重连所有接入点
    for (const [endpoint, endpointConnection] of this.connections) {
      const promise = this.reconnectSingleEndpoint(endpoint, endpointConnection)
        .then(() => {
          results.push({ endpoint, success: true });
        })
        .catch((error) => {
          results.push({
            endpoint,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      reconnectPromises.push(promise);
    }

    // 等待所有重连完成
    await Promise.allSettled(reconnectPromises);

    // 统计结果
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.info(`重连完成: 成功 ${successCount}, 失败 ${failureCount}`);

    // 如果有失败的，输出错误信息
    if (failureCount > 0) {
      const failures = results.filter((r) => !r.success);
      console.error("重连失败的接入点:");
      for (const f of failures) {
        console.error(`  - ${sliceEndpoint(f.endpoint)}: ${f.error}`);
      }
    }

    return {
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * 重连指定的接入点
   *
   * @param endpoint - 要重连的接入点地址
   */
  async reconnectEndpoint(endpoint: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("EndpointManager 未初始化");
    }

    const endpointConnection = this.connections.get(endpoint);
    if (!endpointConnection) {
      throw new Error(
        `接入点 ${sliceEndpoint(endpoint)} 不存在，请先添加接入点`
      );
    }

    console.info(`重连接入点: ${sliceEndpoint(endpoint)}`);
    await this.reconnectSingleEndpoint(endpoint, endpointConnection);
  }

  /**
   * 更新小智接入点配置
   *
   * @param newEndpoints - 新的小智接入点列表
   */
  async updateEndpoints(newEndpoints: string[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("EndpointManager 未初始化");
    }

    console.info(
      `更新小智接入点配置，新小智接入点数量: ${newEndpoints.length}`
    );

    // 验证新小智接入点
    const validEndpoints = newEndpoints.filter((ep) => isValidEndpointUrl(ep));

    if (validEndpoints.length === 0) {
      throw new Error("没有有效的小智接入点");
    }

    // 计算变更
    const currentEndpoints = Array.from(this.connections.keys());
    const toAdd = validEndpoints.filter((ep) => !currentEndpoints.includes(ep));
    const toRemove = currentEndpoints.filter(
      (ep) => !validEndpoints.includes(ep)
    );

    console.info(
      `小智接入点变更 - 添加: ${toAdd.length}, 移除: ${toRemove.length}, 保持: ${currentEndpoints.length - toRemove.length}`
    );

    try {
      // 移除不需要的小智接入点
      for (const endpoint of toRemove) {
        await this.removeConnection(endpoint);
      }

      // 添加新小智接入点
      for (const endpoint of toAdd) {
        await this.addConnection(endpoint);
      }

      // 发射配置变更事件
      const changeEvent: ConfigChangeEvent = {
        type:
          toAdd.length > 0 && toRemove.length > 0
            ? "endpoints_updated"
            : toAdd.length > 0
              ? "endpoints_added"
              : "endpoints_removed",
        data: {
          added: toAdd.length > 0 ? toAdd : undefined,
          removed: toRemove.length > 0 ? toRemove : undefined,
          updated:
            toAdd.length > 0 && toRemove.length > 0
              ? validEndpoints
              : undefined,
        },
        timestamp: new Date(),
      };

      this.emit("configChange", changeEvent);
      console.info("小智接入点配置更新完成");
    } catch (error) {
      console.error("小智接入点配置更新失败:", error);
      throw error;
    }
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): {
    endpoints: string[];
    options: Required<ConnectionOptions>;
  } {
    return {
      endpoints: Array.from(this.connections.keys()),
      options: { ...this.options },
    };
  }

  /**
   * 资源清理
   */
  async cleanup(): Promise<void> {
    console.debug("开始清理 EndpointManager 资源");

    try {
      // 断开所有连接
      await this.disconnect();

      // 清理连接实例
      this.connections.clear();
      this.connectionStates.clear();

      // 重置状态
      this.isInitialized = false;
      this.isConnecting = false;

      console.debug("EndpointManager 资源清理完成");
    } catch (error) {
      console.error("EndpointManager 资源清理失败:", error);
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 验证初始化参数
   */
  private validateInitializeParams(endpoints: string[], tools: Tool[]): void {
    if (!Array.isArray(endpoints)) {
      throw new Error("小智接入点列表必须是数组");
    }

    if (!Array.isArray(tools)) {
      throw new Error("工具列表必须是数组");
    }

    // 验证小智接入点格式
    for (const endpoint of endpoints) {
      if (!endpoint || typeof endpoint !== "string") {
        throw new Error(`无效的小智接入点地址: ${endpoint}`);
      }

      if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
        throw new Error(`小智接入点地址必须是 WebSocket URL: ${endpoint}`);
      }
    }
  }

  /**
   * 创建单个连接
   */
  private async createConnection(
    endpoint: string,
    tools: Tool[]
  ): Promise<void> {
    console.debug(`创建连接实例: ${sliceEndpoint(endpoint)}`);

    try {
      // 创建 EndpointConnection 实例，传递重连延迟配置
      const endpointConnection = new EndpointConnection(
        endpoint,
        this.options.reconnectDelay
      );

      // 设置 MCP 服务管理器
      if (this.mcpServiceManager) {
        endpointConnection.setServiceManager(this.mcpServiceManager);
      }

      // 存储连接实例
      this.connections.set(endpoint, endpointConnection);

      // 初始化连接状态
      this.connectionStates.set(endpoint, {
        endpoint,
        connected: false,
        initialized: false,
      });

      console.debug(`连接实例创建成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      console.error(`创建连接实例失败 ${sliceEndpoint(endpoint)}:`, error);
      throw error;
    }
  }

  /**
   * 连接单个小智接入点
   */
  private async connectSingleEndpoint(
    endpoint: string,
    endpointConnection: EndpointConnection
  ): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      throw new Error(`小智接入点状态不存在: ${sliceEndpoint(endpoint)}`);
    }

    console.debug(`连接小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 更新状态为连接中
      status.connected = false;
      status.initialized = false;

      // 执行连接
      await endpointConnection.connect();

      // 更新连接成功状态
      status.connected = true;
      status.initialized = true;
      status.lastConnected = new Date();
      status.lastError = undefined;

      console.info(`小智接入点连接成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      // 更新连接失败状态
      status.connected = false;
      status.initialized = false;
      status.lastError = error instanceof Error ? error.message : String(error);

      console.error(`连接失败 ${sliceEndpoint(endpoint)}:`, error);

      // 直接抛出错误
      throw error;
    }
  }

  /**
   * 断开单个小智接入点
   */
  private async disconnectSingleEndpoint(
    endpoint: string,
    endpointConnection: EndpointConnection
  ): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      return;
    }

    console.debug(`断开小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 执行断开连接（EndpointConnection.disconnect 是同步方法）
      endpointConnection.disconnect();

      // 更新状态
      status.connected = false;
      status.initialized = false;

      console.debug(`小智接入点断开成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      console.error(`小智接入点断开失败 ${sliceEndpoint(endpoint)}:`, error);
      // 即使断开失败，也要更新状态
      status.connected = false;
      status.initialized = false;
    }
  }

  /**
   * 重连单个小智接入点
   */
  private async reconnectSingleEndpoint(
    endpoint: string,
    endpointConnection: EndpointConnection
  ): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      throw new Error(`小智接入点状态不存在: ${sliceEndpoint(endpoint)}`);
    }

    console.debug(`重连小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 执行重连
      await endpointConnection.reconnect();

      // 更新连接成功状态
      status.connected = true;
      status.initialized = true;
      status.lastConnected = new Date();
      status.lastError = undefined;

      console.info(`小智接入点重连成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      // 更新连接失败状态
      status.connected = false;
      status.initialized = false;
      status.lastError = error instanceof Error ? error.message : String(error);

      console.error(`重连失败 ${sliceEndpoint(endpoint)}:`, error);
      throw error;
    }
  }

  /**
   * 获取当前工具列表
   */
  private getCurrentTools(): Tool[] {
    if (!this.mcpServiceManager) {
      return [];
    }

    try {
      const rawTools = this.mcpServiceManager.getAllTools();
      // 转换工具格式以符合 MCP SDK 的 Tool 类型
      return rawTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: ensureToolJSONSchema(tool.inputSchema),
      }));
    } catch (error) {
      console.error("获取工具列表失败:", error);
      return [];
    }
  }

  // ====================
  // 向后兼容的方法别名
  // ====================

  /**
   * 添加接入点（addEndpoint 别名，用于向后兼容）
   *
   * @param endpoint - 小智接入点地址
   */
  async addEndpoint(endpoint: string): Promise<void> {
    return this.addConnection(endpoint);
  }

  /**
   * 移除接入点（removeEndpoint 别名，用于向后兼容）
   *
   * @param endpoint - 小智接入点地址
   */
  async removeEndpoint(endpoint: string): Promise<void> {
    return this.removeConnection(endpoint);
  }
}
