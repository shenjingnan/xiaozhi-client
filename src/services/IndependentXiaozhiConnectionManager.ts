import { EventEmitter } from "node:events";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { type Logger, logger } from "../Logger.js";
import { ProxyMCPServer } from "../ProxyMCPServer.js";
import { type EventBus, getEventBus } from "../services/EventBus.js";
import { sliceEndpoint } from "../utils/mcpServerUtils.js";

// 使用接口定义避免循环依赖
interface IMCPServiceManager {
  getAllTools(): Tool[];
}

// 配置变更事件类型
export interface ConfigChangeEvent {
  type:
    | "endpoints_added"
    | "endpoints_removed"
    | "endpoints_updated"
    | "options_updated";
  data: {
    added?: string[];
    removed?: string[];
    updated?: string[];
    oldOptions?: Partial<IndependentConnectionOptions>;
    newOptions?: Partial<IndependentConnectionOptions>;
  };
  timestamp: Date;
}

// 错误类型枚举
// 独立连接选项接口
export interface IndependentConnectionOptions {
  reconnectInterval?: number; // 重连间隔（毫秒），默认 5000
  maxReconnectAttempts?: number; // 最大重连次数，默认 3
  connectionTimeout?: number; // 连接超时时间（毫秒），默认 10000
  errorRecoveryEnabled?: boolean; // 启用错误恢复，默认 true
  errorNotificationEnabled?: boolean; // 启用错误通知，默认 true
}

// 连接状态接口
export interface SimpleConnectionStatus {
  endpoint: string;
  connected: boolean;
  initialized: boolean;
  // 保留必要的重连相关状态
  isReconnecting: boolean;
  lastReconnectAttempt?: Date;
  reconnectDelay: number;
}

// 保持向后兼容的连接状态接口
export interface ConnectionStatus extends SimpleConnectionStatus {
  nextReconnectTime: undefined;
  // 保留必要字段用于向后兼容
  lastConnected?: Date;
  lastError?: string;
  reconnectAttempts: number;
}

// 连接状态枚举
export enum XiaozhiConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

// 默认配置
const DEFAULT_OPTIONS: Required<IndependentConnectionOptions> = {
  reconnectInterval: 5000,
  maxReconnectAttempts: 3,
  connectionTimeout: 10000,
  errorRecoveryEnabled: true,
  errorNotificationEnabled: true,
};

// zod 验证 schema
const IndependentConnectionOptionsSchema = z
  .object({
    reconnectInterval: z
      .number()
      .min(100, "reconnectInterval 必须是大于等于 100 的数字")
      .optional(),
    maxReconnectAttempts: z
      .number()
      .min(0, "maxReconnectAttempts 必须是大于等于 0 的数字")
      .optional(),
    connectionTimeout: z
      .number()
      .min(1000, "connectionTimeout 必须是大于等于 1000 的数字")
      .optional(),
    errorRecoveryEnabled: z.boolean().optional(),
    errorNotificationEnabled: z.boolean().optional(),
  })
  .strict();

/**
 * 小智接入点管理器
 * 负责管理多个小智接入点的连接，每个小智接入点独立运行
 */
export class IndependentXiaozhiConnectionManager extends EventEmitter {
  // 连接实例管理
  private connections: Map<string, ProxyMCPServer> = new Map();
  private connectionStates: Map<string, ConnectionStatus> = new Map();

  // 核心依赖
  private mcpServiceManager: IMCPServiceManager | null = null;
  private logger: Logger;
  private eventBus: EventBus;

  // 状态管理
  private isInitialized = false;
  private isConnecting = false;

  // 配置选项
  private options: Required<IndependentConnectionOptions>;

  // 重连管理
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options?: IndependentConnectionOptions) {
    super();
    this.logger = logger;
    this.eventBus = getEventBus();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.logger.debug("[IndependentXiaozhiConnectionManager] 实例已创建");
    this.logger.debug(
      "[IndependentXiaozhiConnectionManager] 配置选项:",
      this.options
    );
  }

  /**
   * 初始化连接管理器
   * @param endpoints 小智接入点列表
   * @param tools 工具列表
   */
  async initialize(endpoints: string[], tools: Tool[]): Promise<void> {
    if (this.isInitialized) return;

    this.logger.debug(
      `开始初始化 IndependentXiaozhiConnectionManager，小智接入点数量: ${endpoints.length}`
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

      this.logger.debug(
        `IndependentXiaozhiConnectionManager 初始化完成，管理 ${this.connections.size} 个连接`
      );
    } catch (error) {
      this.logger.error(
        "IndependentXiaozhiConnectionManager 初始化失败:",
        error
      );
      await this.cleanup(); // 清理部分创建的连接
      throw error;
    }
  }

  /**
   * 连接所有小智接入点
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error(
        "IndependentXiaozhiConnectionManager 未初始化，请先调用 initialize()"
      );
    }

    if (this.isConnecting) return;

    this.isConnecting = true;
    this.logger.debug(`开始连接所有小智接入点，总数: ${this.connections.size}`);

    try {
      const connectionPromises: Promise<void>[] = [];

      // 并发连接所有小智接入点
      for (const [endpoint, proxyServer] of this.connections) {
        connectionPromises.push(
          this.connectSingleEndpoint(endpoint, proxyServer)
        );
      }

      // 等待所有连接完成（允许部分失败）
      const results = await Promise.allSettled(connectionPromises);

      // 统计连接结果
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failureCount = results.length - successCount;

      this.logger.info(
        `小智接入点连接完成 - 成功: ${successCount}, 失败: ${failureCount}`
      );

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
    this.logger.debug("开始断开所有连接");

    // 清理重连定时器
    this.clearAllReconnectTimers();

    // 断开所有连接
    const disconnectPromises: Promise<void>[] = [];
    for (const [endpoint, proxyServer] of this.connections) {
      disconnectPromises.push(
        this.disconnectSingleEndpoint(endpoint, proxyServer)
      );
    }

    await Promise.allSettled(disconnectPromises);
    this.logger.info("所有小智接入点已断开连接");
  }

  /**
   * 动态添加小智接入点
   * @param endpoint 小智接入点地址
   */
  async addEndpoint(endpoint: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("IndependentXiaozhiConnectionManager 未初始化");
    }

    if (this.connections.has(endpoint)) {
      this.logger.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 已存在，跳过添加`
      );
      return;
    }

    this.logger.debug(`动态添加小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 获取当前工具列表
      const tools = this.getCurrentTools();

      // 创建新连接
      await this.createConnection(endpoint, tools);

      // 如果管理器已连接，则连接新小智接入点
      if (this.isAnyConnected()) {
        const proxyServer = this.connections.get(endpoint)!;
        await this.connectSingleEndpoint(endpoint, proxyServer);
      }

      this.logger.info(`添加接入点成功： ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      this.logger.error(
        `添加小智接入点失败： ${sliceEndpoint(endpoint)}`,
        error
      );
      // 清理失败的连接
      this.connections.delete(endpoint);
      this.connectionStates.delete(endpoint);
      throw error;
    }
  }

  /**
   * 动态移除小智接入点
   * @param endpoint 小智接入点地址
   */
  async removeEndpoint(endpoint: string): Promise<void> {
    if (!this.connections.has(endpoint)) {
      this.logger.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 不存在，跳过移除`
      );
      return;
    }

    this.logger.debug(`动态移除小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      const proxyServer = this.connections.get(endpoint)!;

      // 断开连接
      await this.disconnectSingleEndpoint(endpoint, proxyServer);

      // 清理资源
      this.connections.delete(endpoint);
      this.connectionStates.delete(endpoint);

      // 清理重连定时器
      const timer = this.reconnectTimers.get(endpoint);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(endpoint);
      }

      this.logger.info(`移除小智接入点成功：${sliceEndpoint(endpoint)}`);
    } catch (error) {
      this.logger.error(
        `移除小智接入点失败： ${sliceEndpoint(endpoint)}`,
        error
      );
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
   * @param endpoint 要断开的小智接入点
   */
  async disconnectEndpoint(endpoint: string): Promise<void> {
    const proxyServer = this.connections.get(endpoint);
    if (!proxyServer) {
      this.logger.debug(`接入点不存在，跳过断开: ${sliceEndpoint(endpoint)}`);
      return;
    }

    this.logger.info(`断开连接接入点: ${sliceEndpoint(endpoint)}`);

    try {
      await this.disconnectSingleEndpoint(endpoint, proxyServer);
    } catch (error) {
      this.logger.error(
        `断开连接接入点失败： ${sliceEndpoint(endpoint)}`,
        error
      );
      throw error;
    }
  }

  /**
   * 清除所有小智接入点
   */
  async clearEndpoints(): Promise<void> {
    this.logger.debug("清除所有接入点");

    // 断开所有连接
    const disconnectPromises = Array.from(this.connections.keys()).map(
      (endpoint) => this.removeEndpoint(endpoint)
    );
    await Promise.allSettled(disconnectPromises);

    this.logger.info("所有接入点已清除");
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
   * 设置 MCP 服务管理器
   * @param manager MCP 服务管理器实例
   */
  setServiceManager(manager: IMCPServiceManager): void {
    this.mcpServiceManager = manager;
    this.logger.debug("已设置 MCPServiceManager");

    // 如果已有连接，同步工具到所有连接
    if (this.connections.size > 0) {
      this.syncToolsToAllConnections();
    }
  }

  /**
   * 手动触发指定小智接入点的重连
   * @param endpoint 小智接入点地址
   */
  async triggerReconnect(endpoint: string): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      throw new Error(`小智接入点 ${endpoint} 不存在`);
    }

    if (status.connected) {
      this.logger.warn(
        `小智接入点 ${sliceEndpoint(endpoint)} 已连接，无需重连`
      );
      return;
    }

    this.logger.info(`手动触发重连: ${sliceEndpoint(endpoint)}`);

    // 清理现有的重连定时器
    const existingTimer = this.reconnectTimers.get(endpoint);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.reconnectTimers.delete(endpoint);
    }

    // 立即执行重连
    await this.performReconnect(endpoint);
  }

  /**
   * 停止指定小智接入点的重连
   * @param endpoint 小智接入点地址
   */
  stopReconnect(endpoint: string): void {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      this.logger.warn(`小智接入点 ${sliceEndpoint(endpoint)} 不存在`);
      return;
    }

    const timer = this.reconnectTimers.get(endpoint);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(endpoint);
      status.isReconnecting = false;
      status.nextReconnectTime = undefined;
      this.logger.info(`已停止小智接入点 ${sliceEndpoint(endpoint)} 的重连`);
    }
  }

  /**
   * 停止所有小智接入点的重连
   */
  stopAllReconnects(): void {
    this.logger.info("停止所有小智接入点的重连");

    for (const [endpoint] of this.reconnectTimers) {
      this.stopReconnect(endpoint);
    }
  }

  /**
   * 发射接入点状态变更事件
   */
  private emitEndpointStatusChanged(
    endpoint: string,
    connected: boolean,
    operation: "connect" | "disconnect" | "reconnect",
    success: boolean,
    message?: string,
    source = "connection-manager"
  ): void {
    this.eventBus.emitEvent("endpoint:status:changed", {
      endpoint,
      connected,
      operation,
      success,
      message,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * 获取重连统计信息
   */
  getReconnectStats(): Record<
    string,
    {
      endpoint: string;
      reconnectAttempts: number;
      isReconnecting: boolean;
      nextReconnectTime?: Date;
      lastReconnectAttempt?: Date;
      reconnectDelay: number;
      // errorType?: ConnectionErrorType; // 已移除 - 错误类型不再分类
      recentReconnectHistory: Array<{
        timestamp: Date;
        success: boolean;
        error?: string;
        delay: number;
      }>;
    }
  > {
    const stats: Record<string, any> = {};

    for (const [endpoint, status] of this.connectionStates) {
      stats[endpoint] = {
        endpoint,
        reconnectAttempts: status.reconnectAttempts,
        isReconnecting: status.isReconnecting,
        nextReconnectTime: status.nextReconnectTime,
        lastReconnectAttempt: status.lastReconnectAttempt,
        reconnectDelay: status.reconnectDelay,
        // errorType: status.errorType, // 错误类型已移除
        // recentReconnectHistory: status.reconnectHistory.slice(-5), // 重连历史记录已移除
      };
    }

    return stats;
  }

  /**
   * 验证小智接入点配置
   */
  private validateEndpoints(endpoints: string[]): {
    valid: string[];
    invalid: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const endpoint of endpoints) {
      if (!endpoint || typeof endpoint !== "string") {
        invalid.push(endpoint);
        continue;
      }

      if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
        invalid.push(endpoint);
        continue;
      }

      // 检查是否是有效的 URL
      try {
        new URL(endpoint);
        valid.push(endpoint);
      } catch {
        invalid.push(endpoint);
      }
    }

    return { valid, invalid };
  }

  /**
   * 验证连接选项 (使用 zod 实现)
   */
  private validateOptions(options: Partial<IndependentConnectionOptions>): {
    valid: boolean;
    errors: string[];
  } {
    const result = IndependentConnectionOptionsSchema.safeParse(options);

    if (result.success) {
      return { valid: true, errors: [] };
    }

    const errors = result.error.errors.map((err) => err.message);
    return { valid: false, errors };
  }

  /**
   * 更新小智接入点配置
   * @param newEndpoints 新的小智接入点列表
   * @param tools 工具列表
   */
  async updateEndpoints(
    newEndpoints: string[],
    tools: Tool[] = []
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("IndependentXiaozhiConnectionManager 未初始化");
    }

    this.logger.info(
      `更新小智接入点配置，新小智接入点数量: ${newEndpoints.length}`
    );

    // 验证新小智接入点
    const { valid: validEndpoints, invalid: invalidEndpoints } =
      this.validateEndpoints(newEndpoints);

    if (invalidEndpoints.length > 0) {
      this.logger.warn(`发现无效小智接入点: ${invalidEndpoints.join(", ")}`);
    }

    if (validEndpoints.length === 0) {
      throw new Error("没有有效的小智接入点");
    }

    // 计算变更
    const currentEndpoints = Array.from(this.connections.keys());
    const toAdd = validEndpoints.filter((ep) => !currentEndpoints.includes(ep));
    const toRemove = currentEndpoints.filter(
      (ep) => !validEndpoints.includes(ep)
    );
    const toKeep = currentEndpoints.filter((ep) => validEndpoints.includes(ep));

    this.logger.info(
      `小智接入点变更 - 添加: ${toAdd.length}, 移除: ${toRemove.length}, 保持: ${toKeep.length}`
    );

    try {
      // 移除不需要的小智接入点
      for (const endpoint of toRemove) {
        await this.removeEndpoint(endpoint);
      }

      // 添加新小智接入点
      for (const endpoint of toAdd) {
        await this.addEndpoint(endpoint);
      }

      // 发送配置变更事件
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
      this.logger.info("小智接入点配置更新完成");
    } catch (error) {
      this.logger.error("小智接入点配置更新失败:", error);
      throw error;
    }
  }

  /**
   * 更新连接选项
   * @param newOptions 新的连接选项
   */
  updateOptions(newOptions: Partial<IndependentConnectionOptions>): void {
    this.logger.info("更新连接选项");

    // 验证新选项
    const { valid, errors } = this.validateOptions(newOptions);

    if (!valid) {
      throw new Error(`无效的连接选项: ${errors.join(", ")}`);
    }

    const oldOptions = { ...this.options };

    // 更新选项
    this.options = { ...this.options, ...newOptions };

    // 发送配置变更事件
    const changeEvent: ConfigChangeEvent = {
      type: "options_updated",
      data: {
        oldOptions,
        newOptions,
      },
      timestamp: new Date(),
    };

    this.emit("configChange", changeEvent);
    this.logger.info("连接选项更新完成");
    this.logger.debug("新的配置选项:", this.options);
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): {
    endpoints: string[];
    options: Required<IndependentConnectionOptions>;
  } {
    return {
      endpoints: Array.from(this.connections.keys()),
      options: { ...this.options },
    };
  }

  /**
   * 热重载配置
   * @param config 新配置
   */
  async reloadConfig(config: {
    endpoints?: string[];
    options?: Partial<IndependentConnectionOptions>;
    tools?: Tool[];
  }): Promise<void> {
    this.logger.info("开始热重载配置");

    try {
      // 更新选项（如果提供）
      if (config.options) {
        this.updateOptions(config.options);
      }

      // 更新小智接入点（如果提供）
      if (config.endpoints) {
        await this.updateEndpoints(config.endpoints, config.tools || []);
      }

      this.logger.info("配置热重载完成");
    } catch (error) {
      this.logger.error("配置热重载失败:", error);
      throw error;
    }
  }

  /**
   * 连接预热机制
   * @param endpoints 要预热的小智接入点列表
   */
  async prewarmConnections(endpoints: string[] = []): Promise<void> {
    const targetEndpoints =
      endpoints.length > 0 ? endpoints : Array.from(this.connections.keys());

    this.logger.info(`开始预热连接，小智接入点数量: ${targetEndpoints.length}`);

    const prewarmPromises = targetEndpoints.map(async (endpoint) => {
      try {
        const connection = this.connections.get(endpoint);
        if (connection) {
          // 执行预热操作（例如建立连接、验证状态等）
          this.logger.debug(`小智接入点 ${sliceEndpoint(endpoint)} 预热完成`);
        }
      } catch (error) {
        this.logger.warn(
          `小智接入点 ${sliceEndpoint(endpoint)} 预热失败:`,
          error
        );
      }
    });

    await Promise.all(prewarmPromises);
    this.logger.info("连接预热完成");
  }

  /**
   * 资源清理
   */
  async cleanup(): Promise<void> {
    this.logger.info("开始清理 IndependentXiaozhiConnectionManager 资源");

    try {
      // 断开所有连接
      await this.disconnect();

      // 清理连接实例
      this.connections.clear();
      this.connectionStates.clear();

      // 重置状态
      this.isInitialized = false;
      this.isConnecting = false;

      this.logger.info("IndependentXiaozhiConnectionManager 资源清理完成");
    } catch (error) {
      this.logger.error(
        "IndependentXiaozhiConnectionManager 资源清理失败:",
        error
      );
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 验证初始化参数
   */
  private validateInitializeParams(endpoints: string[], tools: Tool[]): void {
    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      throw new Error("小智接入点列表不能为空");
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
    this.logger.debug(`创建连接实例: ${sliceEndpoint(endpoint)}`);

    try {
      // 创建 ProxyMCPServer 实例
      const proxyServer = new ProxyMCPServer(endpoint);

      // 设置 MCP 服务管理器
      if (this.mcpServiceManager) {
        proxyServer.setServiceManager(this.mcpServiceManager);
      }

      // 存储连接实例
      this.connections.set(endpoint, proxyServer);

      // 初始化连接状态
      this.connectionStates.set(endpoint, {
        endpoint,
        connected: false,
        initialized: false,
        isReconnecting: false,
        lastReconnectAttempt: undefined,
        reconnectDelay: this.options.reconnectInterval,
        reconnectAttempts: 0,
        nextReconnectTime: undefined,
      });

      this.logger.debug(`连接实例创建成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      this.logger.error(`创建连接实例失败 ${sliceEndpoint(endpoint)}:`, error);
      throw error;
    }
  }

  /**
   * 连接单个小智接入点
   */
  private async connectSingleEndpoint(
    endpoint: string,
    proxyServer: ProxyMCPServer
  ): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      throw new Error(`小智接入点状态不存在: ${sliceEndpoint(endpoint)}`);
    }

    this.logger.debug(`连接小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 更新状态为连接中
      status.connected = false;
      status.initialized = false;

      // 执行连接
      await proxyServer.connect();

      // 更新连接成功状态
      status.connected = true;
      status.initialized = true;
      status.lastConnected = new Date();
      status.lastError = undefined;
      status.reconnectAttempts = 0;

      // 发射连接成功事件
      this.emitEndpointStatusChanged(
        endpoint,
        true,
        "connect",
        true,
        "接入点连接成功",
        "connection-manager"
      );

      this.logger.info(`小智接入点连接成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      // 更新连接失败状态
      status.connected = false;
      status.initialized = false;
      status.lastError = error instanceof Error ? error.message : String(error);
      status.reconnectAttempts++;

      // 发射连接失败事件
      this.emitEndpointStatusChanged(
        endpoint,
        false,
        "connect",
        false,
        error instanceof Error ? error.message : "连接失败",
        "connection-manager"
      );

      this.logger.error(
        `小智接入点连接失败 ${sliceEndpoint(endpoint)}:`,
        error
      );

      // 启动重连（如果未超过最大重连次数）
      this.scheduleReconnect(endpoint);

      throw error;
    }
  }

  /**
   * 断开单个小智接入点
   */
  private async disconnectSingleEndpoint(
    endpoint: string,
    proxyServer: ProxyMCPServer
  ): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      return;
    }

    this.logger.debug(`断开小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 执行断开连接（ProxyMCPServer.disconnect 是同步方法）
      proxyServer.disconnect();

      // 更新状态
      status.connected = false;
      status.initialized = false;

      // 发射断开连接成功事件
      this.emitEndpointStatusChanged(
        endpoint,
        false,
        "disconnect",
        true,
        "接入点断开成功",
        "connection-manager"
      );

      this.logger.debug(`小智接入点断开成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      this.logger.error(
        `小智接入点断开失败 ${sliceEndpoint(endpoint)}:`,
        error
      );
      // 即使断开失败，也要更新状态
      status.connected = false;
      status.initialized = false;

      // 发射断开连接失败事件
      this.emitEndpointStatusChanged(
        endpoint,
        false,
        "disconnect",
        false,
        error instanceof Error ? error.message : "断开失败",
        "connection-manager"
      );
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
      return this.mcpServiceManager.getAllTools();
    } catch (error) {
      this.logger.error("获取工具列表失败:", error);
      return [];
    }
  }

  /**
   * 同步工具到所有连接
   */
  private syncToolsToAllConnections(): void {
    if (!this.mcpServiceManager) {
      return;
    }

    this.logger.debug("同步工具到所有连接");

    for (const [endpoint, proxyServer] of this.connections) {
      try {
        proxyServer.setServiceManager(this.mcpServiceManager);
        this.logger.debug(`工具同步成功: ${sliceEndpoint(endpoint)}`);
      } catch (error) {
        this.logger.error(`工具同步失败 ${sliceEndpoint(endpoint)}:`, error);
      }
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(endpoint: string): void {
    const status = this.connectionStates.get(endpoint);
    if (!status) return;

    // 简单的重连限制
    if (status.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.logger.warn(`停止重连 ${sliceEndpoint(endpoint)}: 达到最大重连次数`);
      return;
    }

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(endpoint);
      this.performReconnect(endpoint);
    }, this.options.reconnectInterval);

    this.reconnectTimers.set(endpoint, timer);
  }

  /**
   * 执行重连
   */
  private async performReconnect(endpoint: string): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) return;

    const proxyServer = this.connections.get(endpoint);
    if (!proxyServer) {
      this.logger.warn(`重连时找不到代理服务器: ${sliceEndpoint(endpoint)}`);
      return;
    }

    try {
      status.isReconnecting = true;
      status.lastReconnectAttempt = new Date();

      // 重连：先断开现有连接，然后重新连接
      try {
        await proxyServer.disconnect();
      } catch (error) {
        // 断开连接失败不影响重连，继续尝试连接
        this.logger.debug(
          `断开连接失败（继续重连）: ${sliceEndpoint(endpoint)}:`,
          error
        );
      }

      // 重新连接
      await proxyServer.connect();

      // 更新连接成功状态
      status.connected = true;
      status.initialized = true;
      status.lastConnected = new Date();
      status.lastError = undefined;
      status.reconnectAttempts = 0;
      status.isReconnecting = false;

      // 发射重连成功事件
      this.emitEndpointStatusChanged(
        endpoint,
        true,
        "reconnect",
        true,
        "接入点重连成功",
        "connection-manager"
      );

      this.logger.info(`重连成功 ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      // 更新连接失败状态
      status.connected = false;
      status.initialized = false;
      status.lastError = error instanceof Error ? error.message : String(error);
      status.reconnectAttempts++;
      status.isReconnecting = false;

      // 发射重连失败事件
      this.emitEndpointStatusChanged(
        endpoint,
        false,
        "reconnect",
        false,
        error instanceof Error ? error.message : "重连失败",
        "connection-manager"
      );

      this.logger.error(`重连失败 ${sliceEndpoint(endpoint)}:`, error);

      // 继续启动重连（如果未超过最大重连次数）
      this.scheduleReconnect(endpoint);
    }
  }

  /**
   * 清理所有重连定时器
   */
  private clearAllReconnectTimers(): void {
    for (const [, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }
}
