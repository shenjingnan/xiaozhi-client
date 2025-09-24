import { EventEmitter } from "node:events";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";
import { ProxyMCPServer } from "../ProxyMCPServer.js";

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
// 独立连接选项接口（简化版本）
export interface IndependentConnectionOptions {
  healthCheckInterval?: number; // 健康检查间隔（毫秒），默认 60000
  reconnectInterval?: number; // 重连间隔（毫秒），默认 5000
  maxReconnectAttempts?: number; // 最大重连次数，默认 3
  connectionTimeout?: number; // 连接超时时间（毫秒），默认 10000
  errorRecoveryEnabled?: boolean; // 启用错误恢复，默认 true
  errorNotificationEnabled?: boolean; // 启用错误通知，默认 true
}

// 连接状态接口
// 简化的连接状态接口
export interface SimpleConnectionStatus {
  endpoint: string;
  connected: boolean;
  initialized: boolean;
  isHealthy: boolean; // 简化的健康状态字段
  lastHealthCheck?: Date;
  consecutiveFailures: number;
  healthCheckEnabled: boolean;
  // 保留必要的重连相关状态
  isReconnecting: boolean;
  lastReconnectAttempt?: Date;
  reconnectDelay: number;
}

// 保持向后兼容的连接状态接口
export interface ConnectionStatus extends SimpleConnectionStatus {
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

// 默认配置（简化版本）
const DEFAULT_OPTIONS: Required<IndependentConnectionOptions> = {
  healthCheckInterval: 60000, // 60秒健康检查间隔
  reconnectInterval: 5000,
  maxReconnectAttempts: 3,
  connectionTimeout: 10000,
  errorRecoveryEnabled: true,
  errorNotificationEnabled: true,
};

const sliceEndpoint = (endpoint: string) =>
  `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;

/**
 * 独立小智连接管理器（简化版本）
 * 负责管理多个小智接入点的连接，每个小智接入点独立运行，无负载均衡和故障转移
 * 
 * 简化特性：
 * - 移除复杂的健康度评分系统
 * - 简化错误处理，不再分类错误类型
 * - 使用固定60秒重连间隔
 * - 移除复杂的连接池管理
 * - 简化性能监控和内存优化
 */
export class IndependentXiaozhiConnectionManager extends EventEmitter {
  // 连接实例管理
  private connections: Map<string, ProxyMCPServer> = new Map();
  private connectionStates: Map<string, ConnectionStatus> = new Map();

  // 核心依赖
  private mcpServiceManager: IMCPServiceManager | null = null;
  private logger: Logger;

  // 状态管理
  private isInitialized = false;
  private isConnecting = false;

  // 配置选项
  private options: Required<IndependentConnectionOptions>;

  // 健康检查和重连管理
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  // 连接池管理（简化版本）
  private idleCleanupInterval: NodeJS.Timeout | null = null;

  // 性能监控 - 简化版本
  private performanceMetrics = {
    connectionStartTime: 0,
    totalConnectionTime: 0,
    connectionCount: 0,
  };

  constructor(options?: IndependentConnectionOptions) {
    super();
    this.logger = logger;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.logger.info("[IndependentXiaozhiConnectionManager] 实例已创建");
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

      // 简化性能指标初始化

      // 简化版本，不启动空闲连接清理定时器

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
    this.performanceMetrics.connectionStartTime = Date.now();
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

      // 更新性能指标
      const connectionTime =
        Date.now() - this.performanceMetrics.connectionStartTime;
      this.performanceMetrics.totalConnectionTime += connectionTime;
      this.performanceMetrics.connectionCount++;

      this.logger.info(
        `小智接入点连接完成 - 成功: ${successCount}, 失败: ${failureCount}, 耗时: ${connectionTime}ms`
      );

      // 如果所有连接都失败，抛出错误
      if (successCount === 0) {
        throw new Error("所有小智接入点连接失败");
      }

      // 启动健康检查
      this.startHealthCheck();
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 断开所有连接
   */
  async disconnect(): Promise<void> {
    this.logger.debug("开始断开所有连接");

    // 停止健康检查
    this.stopHealthCheck();

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
   * 发送消息到指定小智接入点
   * @param endpoint 目标小智接入点
   * @param message 消息内容
   */
  async sendMessage(endpoint: string, message: any): Promise<void> {
    const proxyServer = this.connections.get(endpoint);
    if (!proxyServer) {
      throw new Error("接入点不存在");
    }

    // 简化连接状态检查
    const status = this.connectionStates.get(endpoint);
    if (!status || !status.connected) {
      throw new Error("接入点未连接");
    }

    try {
      // 简化消息发送 - 在独立架构中此方法功能受限
      this.logger.warn(
        "sendMessage 方法在独立架构中功能受限，建议使用工具调用"
      );
    } catch (error) {
      this.logger.error(
        `发送消息到接入点失败： ${sliceEndpoint(endpoint)}`,
        error
      );
      throw error;
    }
  }

  /**
   * 获取所有连接状态
   */
  getConnectionStatus(): ConnectionStatus[] {
    return Array.from(this.connectionStates.values());
  }

  /**
   * 获取健康的连接列表（兼容性方法）
   * @deprecated 此方法为兼容性保留，新代码应使用 getConnectionStatus()
   */
  getHealthyConnections(): ProxyMCPServer[] {
    console.warn(
      "⚠️ getHealthyConnections() 方法已废弃，在独立架构中不再支持负载均衡"
    );
    const healthyConnections: ProxyMCPServer[] = [];
    for (const [endpoint, proxyServer] of this.connections) {
      const status = this.connectionStates.get(endpoint);
      if (status?.connected) {
        healthyConnections.push(proxyServer);
      }
    }
    return healthyConnections;
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
   * 启用/禁用指定小智接入点的健康检查
   * @param endpoint 小智接入点地址
   * @param enabled 是否启用
   */
  setHealthCheckEnabled(endpoint: string, enabled: boolean): void {
    const status = this.connectionStates.get(endpoint);
    if (status) {
      status.healthCheckEnabled = enabled;
      this.logger.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 健康检查已${enabled ? "启用" : "禁用"}`
      );
    } else {
      this.logger.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 不存在，无法设置健康检查状态`
      );
    }
  }

  
  /**
   * 手动触发健康检查
   */
  async triggerHealthCheck(): Promise<void> {
    this.logger.info("手动触发健康检查");
    await this.performHealthCheck();
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
    await this.performSimpleReconnect(endpoint);
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
   * 验证连接选项
   */
  private validateOptions(options: Partial<IndependentConnectionOptions>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (options.healthCheckInterval !== undefined) {
      if (
        typeof options.healthCheckInterval !== "number" ||
        options.healthCheckInterval < 1000
      ) {
        errors.push("healthCheckInterval 必须是大于等于 1000 的数字");
      }
    }

    if (options.reconnectInterval !== undefined) {
      if (
        typeof options.reconnectInterval !== "number" ||
        options.reconnectInterval < 100
      ) {
        errors.push("reconnectInterval 必须是大于等于 100 的数字");
      }
    }

    if (options.maxReconnectAttempts !== undefined) {
      if (
        typeof options.maxReconnectAttempts !== "number" ||
        options.maxReconnectAttempts < 0
      ) {
        errors.push("maxReconnectAttempts 必须是大于等于 0 的数字");
      }
    }

    if (options.connectionTimeout !== undefined) {
      if (
        typeof options.connectionTimeout !== "number" ||
        options.connectionTimeout < 1000
      ) {
        errors.push("connectionTimeout 必须是大于等于 1000 的数字");
      }
    }

    return { valid: errors.length === 0, errors };
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
   * 连接预热机制（简化版本）
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
          await this.performHealthCheck();
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
    this.logger.info(`连接预热完成`);
  }

  /**
   * 更新性能指标（简化版本）
   */
  private updatePerformanceMetrics(): void {
    // 简化版本，不进行复杂的内存跟踪
  }

  
  
  /**
   * 获取性能指标（简化版本）
   */
  getPerformanceMetrics(): {
    connectionTime: {
      total: number;
      count: number;
    };
    totalConnections: number;
    healthyConnections: number;
  } {
    this.updatePerformanceMetrics();

    const healthyConnections = Array.from(
      this.connectionStates.values()
    ).filter((status) => status.connected && status.isHealthy).length;

    return {
      connectionTime: {
        total: this.performanceMetrics.totalConnectionTime,
        count: this.performanceMetrics.connectionCount,
      },
      totalConnections: this.connections.size,
      healthyConnections,
    };
  }

  
  /**
   * 资源清理
   */
  async cleanup(): Promise<void> {
    this.logger.info("开始清理 IndependentXiaozhiConnectionManager 资源");

    try {
      // 断开所有连接
      await this.disconnect();

      // 简化版本，不需要停止空闲连接清理定时器

  
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
        isHealthy: true, // 初始状态为健康
        lastHealthCheck: undefined,
        consecutiveFailures: 0,
        healthCheckEnabled: true,
        isReconnecting: false,
        lastReconnectAttempt: undefined,
        reconnectDelay: this.options.reconnectInterval,
        // 保留向后兼容字段
        reconnectAttempts: 0,
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

      this.logger.info(`小智接入点连接成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      // 更新连接失败状态
      status.connected = false;
      status.initialized = false;
      status.lastError = error instanceof Error ? error.message : String(error);
      status.reconnectAttempts++;

      this.logger.error(
        `小智接入点连接失败 ${sliceEndpoint(endpoint)}:`,
        error
      );

      // 启动重连（如果未超过最大重连次数）
      this.scheduleSimpleReconnect(endpoint);

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

      this.logger.debug(`小智接入点断开成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      this.logger.error(
        `小智接入点断开失败 ${sliceEndpoint(endpoint)}:`,
        error
      );
      // 即使断开失败，也要更新状态
      status.connected = false;
      status.initialized = false;
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
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      return; // 已经启动
    }

    this.logger.debug(
      `启动健康检查，间隔: ${this.options.healthCheckInterval}ms`
    );

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.debug("健康检查已停止");
    }
  }

  /**
   * 执行健康检查（简化版本）
   * 仅进行基本的连接检查，不计算复杂的健康度评分
   */
  private async performHealthCheck(): Promise<void> {
    this.logger.debug("执行简化健康检查");
    const healthCheckPromises: Promise<void>[] = [];

    for (const [endpoint, proxyServer] of this.connections) {
      const status = this.connectionStates.get(endpoint);
      if (!status || !status.healthCheckEnabled) continue;

      healthCheckPromises.push(this.performSingleHealthCheck(endpoint, status));
    }

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 执行单个小智接入点的健康检查（简化版本）
   */
  private async performSingleHealthCheck(
    endpoint: string,
    status: ConnectionStatus
  ): Promise<void> {
    try {
      const proxyServer = this.connections.get(endpoint);
      if (!proxyServer) {
        throw new Error(`连接实例不存在: ${sliceEndpoint(endpoint)}`);
      }

      // 简单的连接检查
      await this.checkSimpleConnectionHealth(proxyServer);

      // 简化状态更新
      status.isHealthy = true;
      status.consecutiveFailures = 0;
      status.lastHealthCheck = new Date();
    } catch (error) {
      // 使用统一的错误处理方法
      this.handleHealthCheckError(endpoint, status, error);
    }
  }

  /**
   * 检查连接健康状态（简化版本）
   */
  private async checkSimpleConnectionHealth(proxyServer: any): Promise<void> {
    // 仅检查连接是否存活，不计算响应时间
    if (!proxyServer) {
      throw new Error("连接实例不存在");
    }

    if (!proxyServer.isConnected()) {
      throw new Error("连接未建立");
    }

    // 简单的ping/pong检查
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  /**
   * 安排简化的重连
   */
  private scheduleSimpleReconnect(endpoint: string): void {
    const status = this.connectionStates.get(endpoint);
    if (!status) return;

    // 简单的重连限制
    if (status.consecutiveFailures >= 5) {
      this.logger.warn(`停止重连 ${sliceEndpoint(endpoint)}: 连续失败次数过多`);
      return;
    }

    // 固定60秒重连间隔
    const delay = 60000;
    this.logger.info(`计划重连 ${sliceEndpoint(endpoint)}，延迟 ${delay}ms`);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(endpoint);
      this.performSimpleReconnect(endpoint);
    }, delay);

    this.reconnectTimers.set(endpoint, timer);
  }

  /**
   * 执行简化的重连
   */
  private async performSimpleReconnect(endpoint: string): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) return;
    
    try {
      status.isReconnecting = true;
      status.lastReconnectAttempt = new Date();
      
      // 简单的重连逻辑
      await this.connectToEndpoint(endpoint);
      
      status.isHealthy = true;
      status.consecutiveFailures = 0;
      status.isReconnecting = false;
      
      this.logger.info(`重连成功 ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      status.isHealthy = false;
      status.isReconnecting = false;
      
      this.logger.error(`重连失败 ${sliceEndpoint(endpoint)}:`, error);
    }
  }

  
  /**
   * 统一处理健康检查错误（简化版本）
   * 不再区分错误类型，统一处理所有连接错误
   */
  private handleHealthCheckError(
    endpoint: string,
    status: ConnectionStatus,
    error: any
  ): void {
    // 统一错误处理，不区分类型
    status.isHealthy = false;
    status.consecutiveFailures++;
    status.lastHealthCheck = new Date();
    status.lastError = (error as Error).message;
    
    this.logger.warn(`健康检查失败 ${sliceEndpoint(endpoint)}: ${(error as Error).message}`);
    
    // 发送错误事件（简化版本，不区分错误类型）
    this.emit("connectionError", {
      endpoint: endpoint,
      error: error,
      consecutiveFailures: status.consecutiveFailures,
      timestamp: new Date(),
    });
    
    // 简单重连触发
    if (status.consecutiveFailures >= 3) {
      this.scheduleSimpleReconnect(endpoint);
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
