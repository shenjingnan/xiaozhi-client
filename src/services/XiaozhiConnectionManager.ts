import { EventEmitter } from "node:events";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../Logger.js";
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
    oldOptions?: Partial<XiaozhiConnectionOptions>;
    newOptions?: Partial<XiaozhiConnectionOptions>;
  };
  timestamp: Date;
}

// 重连策略枚举
export enum ReconnectStrategy {
  EXPONENTIAL_BACKOFF = "exponential_backoff",
  LINEAR_BACKOFF = "linear_backoff",
  FIXED_INTERVAL = "fixed_interval",
  ADAPTIVE = "adaptive",
}

// 错误类型枚举
export enum ConnectionErrorType {
  NETWORK_ERROR = "network_error",
  AUTHENTICATION_ERROR = "authentication_error",
  SERVER_ERROR = "server_error",
  TIMEOUT_ERROR = "timeout_error",
  UNKNOWN_ERROR = "unknown_error",
}

// 连接选项接口
export interface XiaozhiConnectionOptions {
  healthCheckInterval?: number; // 健康检查间隔（毫秒），默认 30000
  reconnectInterval?: number; // 重连间隔（毫秒），默认 5000
  maxReconnectAttempts?: number; // 最大重连次数，默认 10
  loadBalanceStrategy?: "round-robin" | "random" | "health-based"; // 负载均衡策略，默认 'round-robin'
  connectionTimeout?: number; // 连接超时时间（毫秒），默认 10000
  reconnectStrategy?: ReconnectStrategy; // 重连策略，默认 exponential_backoff
  maxReconnectDelay?: number; // 最大重连延迟（毫秒），默认 30000
  reconnectBackoffMultiplier?: number; // 退避乘数，默认 2
  jitterEnabled?: boolean; // 是否启用抖动，默认 true
}

// 连接状态接口
export interface ConnectionStatus {
  endpoint: string;
  connected: boolean;
  initialized: boolean;
  lastConnected?: Date;
  lastError?: string;
  reconnectAttempts: number;
  healthScore: number; // 健康度评分 (0-100)
  lastHealthCheck?: Date;
  responseTime?: number; // 响应时间（毫秒）
  consecutiveFailures: number; // 连续失败次数
  totalRequests: number; // 总请求次数
  successfulRequests: number; // 成功请求次数
  lastSuccessTime?: Date; // 最后成功时间
  healthCheckEnabled: boolean; // 是否启用健康检查
  // 重连相关状态
  isReconnecting: boolean; // 是否正在重连
  nextReconnectTime?: Date; // 下次重连时间
  lastReconnectAttempt?: Date; // 最后重连尝试时间
  reconnectDelay: number; // 当前重连延迟（毫秒）
  errorType?: ConnectionErrorType; // 错误类型
  reconnectHistory: Array<{
    // 重连历史
    timestamp: Date;
    success: boolean;
    error?: string;
    delay: number;
  }>;
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
const DEFAULT_OPTIONS: Required<XiaozhiConnectionOptions> = {
  healthCheckInterval: 30000,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  loadBalanceStrategy: "round-robin",
  connectionTimeout: 10000,
  reconnectStrategy: ReconnectStrategy.EXPONENTIAL_BACKOFF,
  maxReconnectDelay: 30000,
  reconnectBackoffMultiplier: 2,
  jitterEnabled: true,
};

/**
 * 小智连接管理器
 * 负责管理多个小智接入点的连接，提供统一的连接管理、健康检查、负载均衡等功能
 */
export class XiaozhiConnectionManager extends EventEmitter {
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
  private options: Required<XiaozhiConnectionOptions>;

  // 健康检查和重连管理
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  // 负载均衡状态
  private roundRobinIndex = 0;
  private lastSelectedEndpoint: string | null = null;

  // 性能监控
  private performanceMetrics = {
    connectionStartTime: 0,
    totalConnectionTime: 0,
    averageConnectionTime: 0,
    connectionCount: 0,
    memoryUsage: {
      initial: 0,
      current: 0,
      peak: 0,
    },
    prewarmedConnections: new Set<string>(),
  };

  constructor(options?: XiaozhiConnectionOptions) {
    super();
    this.logger = new Logger();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.logger.info("XiaozhiConnectionManager 实例已创建");
    this.logger.debug("配置选项:", this.options);
  }

  /**
   * 初始化连接管理器
   * @param endpoints 小智接入点列表
   * @param tools 工具列表
   */
  async initialize(endpoints: string[], tools: Tool[]): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("XiaozhiConnectionManager 已经初始化，跳过重复初始化");
      return;
    }

    this.logger.info(
      `开始初始化 XiaozhiConnectionManager，端点数量: ${endpoints.length}`
    );

    try {
      // 验证输入参数
      this.validateInitializeParams(endpoints, tools);

      // 清理现有连接（如果有）
      await this.cleanup();

      // 为每个端点创建连接实例
      for (const endpoint of endpoints) {
        await this.createConnection(endpoint, tools);
      }

      this.isInitialized = true;

      // 记录初始内存使用
      this.performanceMetrics.memoryUsage.initial =
        process.memoryUsage().heapUsed;
      this.performanceMetrics.memoryUsage.current =
        this.performanceMetrics.memoryUsage.initial;
      this.performanceMetrics.memoryUsage.peak =
        this.performanceMetrics.memoryUsage.initial;

      this.logger.info(
        `XiaozhiConnectionManager 初始化完成，管理 ${this.connections.size} 个连接`
      );
    } catch (error) {
      this.logger.error("XiaozhiConnectionManager 初始化失败:", error);
      await this.cleanup(); // 清理部分创建的连接
      throw error;
    }
  }

  /**
   * 连接所有端点
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error(
        "XiaozhiConnectionManager 未初始化，请先调用 initialize()"
      );
    }

    if (this.isConnecting) {
      this.logger.warn("连接操作正在进行中，请等待完成");
      return;
    }

    this.isConnecting = true;
    this.performanceMetrics.connectionStartTime = Date.now();
    this.logger.info(`开始连接所有端点，总数: ${this.connections.size}`);

    try {
      const connectionPromises: Promise<void>[] = [];

      // 并发连接所有端点
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
      this.performanceMetrics.averageConnectionTime =
        this.performanceMetrics.totalConnectionTime /
        this.performanceMetrics.connectionCount;

      this.logger.info(
        `连接完成 - 成功: ${successCount}, 失败: ${failureCount}, 耗时: ${connectionTime}ms`
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
    this.logger.info("开始断开所有连接");

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
    this.logger.info("所有连接已断开");
  }

  /**
   * 动态添加端点
   * @param endpoint 端点地址
   */
  async addEndpoint(endpoint: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("XiaozhiConnectionManager 未初始化");
    }

    if (this.connections.has(endpoint)) {
      this.logger.warn(`端点 ${endpoint} 已存在，跳过添加`);
      return;
    }

    this.logger.info(`动态添加端点: ${endpoint}`);

    try {
      // 获取当前工具列表
      const tools = this.getCurrentTools();

      // 创建新连接
      await this.createConnection(endpoint, tools);

      // 如果管理器已连接，则连接新端点
      if (this.isAnyConnected()) {
        const proxyServer = this.connections.get(endpoint)!;
        await this.connectSingleEndpoint(endpoint, proxyServer);
      }

      this.logger.info(`端点 ${endpoint} 添加成功`);
    } catch (error) {
      this.logger.error(`添加端点 ${endpoint} 失败:`, error);
      // 清理失败的连接
      this.connections.delete(endpoint);
      this.connectionStates.delete(endpoint);
      throw error;
    }
  }

  /**
   * 动态移除端点
   * @param endpoint 端点地址
   */
  async removeEndpoint(endpoint: string): Promise<void> {
    if (!this.connections.has(endpoint)) {
      this.logger.warn(`端点 ${endpoint} 不存在，跳过移除`);
      return;
    }

    this.logger.info(`动态移除端点: ${endpoint}`);

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

      this.logger.info(`端点 ${endpoint} 移除成功`);
    } catch (error) {
      this.logger.error(`移除端点 ${endpoint} 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取健康的连接列表
   */
  getHealthyConnections(): ProxyMCPServer[] {
    const healthyConnections: ProxyMCPServer[] = [];

    for (const [endpoint, proxyServer] of this.connections) {
      const status = this.connectionStates.get(endpoint);
      if (status?.connected && status.healthScore > 50) {
        healthyConnections.push(proxyServer);
      }
    }

    return healthyConnections;
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
    this.logger.info("已设置 MCPServiceManager");

    // 如果已有连接，同步工具到所有连接
    if (this.connections.size > 0) {
      this.syncToolsToAllConnections();
    }
  }

  /**
   * 启用/禁用指定端点的健康检查
   * @param endpoint 端点地址
   * @param enabled 是否启用
   */
  setHealthCheckEnabled(endpoint: string, enabled: boolean): void {
    const status = this.connectionStates.get(endpoint);
    if (status) {
      status.healthCheckEnabled = enabled;
      this.logger.info(
        `端点 ${endpoint} 健康检查已${enabled ? "启用" : "禁用"}`
      );
    } else {
      this.logger.warn(`端点 ${endpoint} 不存在，无法设置健康检查状态`);
    }
  }

  /**
   * 获取健康检查统计信息
   */
  getHealthCheckStats(): Record<
    string,
    {
      endpoint: string;
      healthScore: number;
      successRate: number;
      averageResponseTime: number;
      consecutiveFailures: number;
      lastHealthCheck?: Date;
      lastSuccessTime?: Date;
    }
  > {
    const stats: Record<string, any> = {};

    for (const [endpoint, status] of this.connectionStates) {
      const successRate =
        status.totalRequests > 0
          ? (status.successfulRequests / status.totalRequests) * 100
          : 0;

      stats[endpoint] = {
        endpoint,
        healthScore: status.healthScore,
        successRate: Math.round(successRate * 100) / 100,
        averageResponseTime: status.responseTime || 0,
        consecutiveFailures: status.consecutiveFailures,
        lastHealthCheck: status.lastHealthCheck,
        lastSuccessTime: status.lastSuccessTime,
      };
    }

    return stats;
  }

  /**
   * 手动触发健康检查
   */
  async triggerHealthCheck(): Promise<void> {
    this.logger.info("手动触发健康检查");
    await this.performHealthCheck();
  }

  /**
   * 手动触发指定端点的重连
   * @param endpoint 端点地址
   */
  async triggerReconnect(endpoint: string): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      throw new Error(`端点 ${endpoint} 不存在`);
    }

    if (status.connected) {
      this.logger.warn(`端点 ${endpoint} 已连接，无需重连`);
      return;
    }

    this.logger.info(`手动触发重连: ${endpoint}`);

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
   * 停止指定端点的重连
   * @param endpoint 端点地址
   */
  stopReconnect(endpoint: string): void {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      this.logger.warn(`端点 ${endpoint} 不存在`);
      return;
    }

    const timer = this.reconnectTimers.get(endpoint);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(endpoint);
      status.isReconnecting = false;
      status.nextReconnectTime = undefined;
      this.logger.info(`已停止端点 ${endpoint} 的重连`);
    }
  }

  /**
   * 停止所有端点的重连
   */
  stopAllReconnects(): void {
    this.logger.info("停止所有端点的重连");

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
      errorType?: ConnectionErrorType;
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
        errorType: status.errorType,
        recentReconnectHistory: status.reconnectHistory.slice(-5), // 最近5次
      };
    }

    return stats;
  }

  /**
   * 验证端点配置
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
  private validateOptions(options: Partial<XiaozhiConnectionOptions>): {
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

    if (options.maxReconnectDelay !== undefined) {
      if (
        typeof options.maxReconnectDelay !== "number" ||
        options.maxReconnectDelay < 1000
      ) {
        errors.push("maxReconnectDelay 必须是大于等于 1000 的数字");
      }
    }

    if (options.reconnectBackoffMultiplier !== undefined) {
      if (
        typeof options.reconnectBackoffMultiplier !== "number" ||
        options.reconnectBackoffMultiplier < 1
      ) {
        errors.push("reconnectBackoffMultiplier 必须是大于等于 1 的数字");
      }
    }

    if (options.loadBalanceStrategy !== undefined) {
      const validStrategies = ["round-robin", "random", "health-based"];
      if (!validStrategies.includes(options.loadBalanceStrategy)) {
        errors.push(
          `loadBalanceStrategy 必须是以下值之一: ${validStrategies.join(", ")}`
        );
      }
    }

    if (options.reconnectStrategy !== undefined) {
      const validStrategies = Object.values(ReconnectStrategy);
      if (!validStrategies.includes(options.reconnectStrategy)) {
        errors.push(
          `reconnectStrategy 必须是以下值之一: ${validStrategies.join(", ")}`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 更新端点配置
   * @param newEndpoints 新的端点列表
   * @param tools 工具列表
   */
  async updateEndpoints(
    newEndpoints: string[],
    tools: Tool[] = []
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("XiaozhiConnectionManager 未初始化");
    }

    this.logger.info(`更新端点配置，新端点数量: ${newEndpoints.length}`);

    // 验证新端点
    const { valid: validEndpoints, invalid: invalidEndpoints } =
      this.validateEndpoints(newEndpoints);

    if (invalidEndpoints.length > 0) {
      this.logger.warn(`发现无效端点: ${invalidEndpoints.join(", ")}`);
    }

    if (validEndpoints.length === 0) {
      throw new Error("没有有效的端点");
    }

    // 计算变更
    const currentEndpoints = Array.from(this.connections.keys());
    const toAdd = validEndpoints.filter((ep) => !currentEndpoints.includes(ep));
    const toRemove = currentEndpoints.filter(
      (ep) => !validEndpoints.includes(ep)
    );
    const toKeep = currentEndpoints.filter((ep) => validEndpoints.includes(ep));

    this.logger.info(
      `端点变更 - 添加: ${toAdd.length}, 移除: ${toRemove.length}, 保持: ${toKeep.length}`
    );

    try {
      // 移除不需要的端点
      for (const endpoint of toRemove) {
        await this.removeEndpoint(endpoint);
      }

      // 添加新端点
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
      this.logger.info("端点配置更新完成");
    } catch (error) {
      this.logger.error("端点配置更新失败:", error);
      throw error;
    }
  }

  /**
   * 更新连接选项
   * @param newOptions 新的连接选项
   */
  updateOptions(newOptions: Partial<XiaozhiConnectionOptions>): void {
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
    options: Required<XiaozhiConnectionOptions>;
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
    options?: Partial<XiaozhiConnectionOptions>;
    tools?: Tool[];
  }): Promise<void> {
    this.logger.info("开始热重载配置");

    try {
      // 更新选项（如果提供）
      if (config.options) {
        this.updateOptions(config.options);
      }

      // 更新端点（如果提供）
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
   * 根据负载均衡策略选择最佳连接
   * @param excludeEndpoints 要排除的端点列表
   */
  selectBestConnection(excludeEndpoints: string[] = []): ProxyMCPServer | null {
    const healthyConnections = this.getHealthyConnections();

    if (healthyConnections.length === 0) {
      this.logger.warn("没有健康的连接可用");
      return null;
    }

    // 过滤掉要排除的端点
    const availableConnections = healthyConnections.filter((connection) => {
      const endpoint = this.getEndpointByConnection(connection);
      return endpoint && !excludeEndpoints.includes(endpoint);
    });

    if (availableConnections.length === 0) {
      this.logger.warn("没有可用的连接（排除指定端点后）");
      return null;
    }

    let selectedConnection: ProxyMCPServer;

    switch (this.options.loadBalanceStrategy) {
      case "round-robin":
        selectedConnection = this.selectRoundRobin(availableConnections);
        break;

      case "random":
        selectedConnection = this.selectRandom(availableConnections);
        break;

      case "health-based":
        selectedConnection = this.selectHealthBased(availableConnections);
        break;

      default:
        selectedConnection = this.selectRoundRobin(availableConnections);
    }

    // 更新最后选择的端点
    this.lastSelectedEndpoint =
      this.getEndpointByConnection(selectedConnection);

    return selectedConnection;
  }

  /**
   * 轮询算法选择连接
   */
  private selectRoundRobin(connections: ProxyMCPServer[]): ProxyMCPServer {
    if (connections.length === 0) {
      throw new Error("没有可用的连接");
    }

    const connection = connections[this.roundRobinIndex % connections.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % connections.length;

    return connection;
  }

  /**
   * 随机算法选择连接
   */
  private selectRandom(connections: ProxyMCPServer[]): ProxyMCPServer {
    if (connections.length === 0) {
      throw new Error("没有可用的连接");
    }

    const randomIndex = Math.floor(Math.random() * connections.length);
    return connections[randomIndex];
  }

  /**
   * 基于健康度的选择算法
   */
  private selectHealthBased(connections: ProxyMCPServer[]): ProxyMCPServer {
    if (connections.length === 0) {
      throw new Error("没有可用的连接");
    }

    // 获取所有连接的健康度信息
    const connectionHealths = connections.map((connection) => {
      const endpoint = this.getEndpointByConnection(connection);
      const status = endpoint ? this.connectionStates.get(endpoint) : null;
      return {
        connection,
        endpoint,
        healthScore: status?.healthScore || 0,
        responseTime: status?.responseTime || Number.POSITIVE_INFINITY,
        successRate:
          status && status.totalRequests > 0
            ? (status.successfulRequests / status.totalRequests) * 100
            : 0,
      };
    });

    // 按健康度排序（健康度高、响应时间短、成功率高的优先）
    connectionHealths.sort((a, b) => {
      // 首先按健康度排序
      if (a.healthScore !== b.healthScore) {
        return b.healthScore - a.healthScore;
      }

      // 健康度相同时，按成功率排序
      if (a.successRate !== b.successRate) {
        return b.successRate - a.successRate;
      }

      // 成功率相同时，按响应时间排序
      return a.responseTime - b.responseTime;
    });

    // 使用加权随机选择，健康度高的连接被选中的概率更大
    const totalWeight = connectionHealths.reduce(
      (sum, item) => sum + (item.healthScore + 1),
      0
    );
    let randomWeight = Math.random() * totalWeight;

    for (const item of connectionHealths) {
      randomWeight -= item.healthScore + 1;
      if (randomWeight <= 0) {
        return item.connection;
      }
    }

    // 如果没有选中任何连接，返回健康度最高的
    return connectionHealths[0].connection;
  }

  /**
   * 根据连接实例获取端点地址
   */
  private getEndpointByConnection(connection: ProxyMCPServer): string | null {
    for (const [endpoint, conn] of this.connections) {
      if (conn === connection) {
        return endpoint;
      }
    }
    return null;
  }

  /**
   * 获取负载均衡统计信息
   */
  getLoadBalanceStats(): {
    strategy: string;
    totalConnections: number;
    healthyConnections: number;
    lastSelectedEndpoint: string | null;
    roundRobinIndex: number;
    connectionWeights: Record<
      string,
      {
        healthScore: number;
        responseTime: number;
        successRate: number;
        weight: number;
      }
    >;
  } {
    const healthyConnections = this.getHealthyConnections();
    const connectionWeights: Record<string, any> = {};

    for (const [endpoint, status] of this.connectionStates) {
      const successRate =
        status.totalRequests > 0
          ? (status.successfulRequests / status.totalRequests) * 100
          : 0;

      // 计算权重（用于健康度选择算法）
      const weight = status.healthScore + 1;

      connectionWeights[endpoint] = {
        healthScore: status.healthScore,
        responseTime: status.responseTime || 0,
        successRate: Math.round(successRate * 100) / 100,
        weight,
      };
    }

    return {
      strategy: this.options.loadBalanceStrategy,
      totalConnections: this.connections.size,
      healthyConnections: healthyConnections.length,
      lastSelectedEndpoint: this.lastSelectedEndpoint,
      roundRobinIndex: this.roundRobinIndex,
      connectionWeights,
    };
  }

  /**
   * 切换负载均衡策略
   * @param strategy 新的负载均衡策略
   */
  setLoadBalanceStrategy(
    strategy: "round-robin" | "random" | "health-based"
  ): void {
    const oldStrategy = this.options.loadBalanceStrategy;
    this.options.loadBalanceStrategy = strategy;

    // 重置轮询索引
    if (strategy === "round-robin") {
      this.roundRobinIndex = 0;
    }

    this.logger.info(`负载均衡策略已从 ${oldStrategy} 切换到 ${strategy}`);

    // 发送配置变更事件
    const changeEvent: ConfigChangeEvent = {
      type: "options_updated",
      data: {
        oldOptions: { loadBalanceStrategy: oldStrategy },
        newOptions: { loadBalanceStrategy: strategy },
      },
      timestamp: new Date(),
    };

    this.emit("configChange", changeEvent);
  }

  /**
   * 执行故障转移
   * @param failedEndpoint 失败的端点
   */
  async performFailover(
    failedEndpoint: string
  ): Promise<ProxyMCPServer | null> {
    this.logger.warn(`执行故障转移，失败端点: ${failedEndpoint}`);

    // 选择备用连接（排除失败的端点）
    const backupConnection = this.selectBestConnection([failedEndpoint]);

    if (!backupConnection) {
      this.logger.error("故障转移失败：没有可用的备用连接");
      return null;
    }

    const backupEndpoint = this.getEndpointByConnection(backupConnection);
    this.logger.info(`故障转移成功，切换到端点: ${backupEndpoint}`);

    return backupConnection;
  }

  /**
   * 连接预热机制
   * @param endpoints 要预热的端点列表
   */
  async prewarmConnections(endpoints: string[] = []): Promise<void> {
    const targetEndpoints =
      endpoints.length > 0 ? endpoints : Array.from(this.connections.keys());

    this.logger.info(`开始预热连接，端点数量: ${targetEndpoints.length}`);

    const prewarmPromises = targetEndpoints.map(async (endpoint) => {
      if (this.performanceMetrics.prewarmedConnections.has(endpoint)) {
        this.logger.debug(`端点 ${endpoint} 已预热，跳过`);
        return;
      }

      try {
        const connection = this.connections.get(endpoint);
        if (connection) {
          // 执行预热操作（例如建立连接、验证状态等）
          await this.performHealthCheck();
          this.performanceMetrics.prewarmedConnections.add(endpoint);
          this.logger.debug(`端点 ${endpoint} 预热完成`);
        }
      } catch (error) {
        this.logger.warn(`端点 ${endpoint} 预热失败:`, error);
      }
    });

    await Promise.all(prewarmPromises);
    this.logger.info(
      `连接预热完成，成功预热 ${this.performanceMetrics.prewarmedConnections.size} 个端点`
    );
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(): void {
    const currentMemory = process.memoryUsage().heapUsed;
    this.performanceMetrics.memoryUsage.current = currentMemory;

    if (currentMemory > this.performanceMetrics.memoryUsage.peak) {
      this.performanceMetrics.memoryUsage.peak = currentMemory;
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): {
    connectionTime: {
      total: number;
      average: number;
      count: number;
    };
    memoryUsage: {
      initial: number;
      current: number;
      peak: number;
      growth: number;
      growthPercentage: number;
    };
    prewarmedConnections: number;
    totalConnections: number;
    healthyConnections: number;
  } {
    this.updatePerformanceMetrics();

    const memoryGrowth =
      this.performanceMetrics.memoryUsage.current -
      this.performanceMetrics.memoryUsage.initial;
    const growthPercentage =
      this.performanceMetrics.memoryUsage.initial > 0
        ? (memoryGrowth / this.performanceMetrics.memoryUsage.initial) * 100
        : 0;

    return {
      connectionTime: {
        total: this.performanceMetrics.totalConnectionTime,
        average: this.performanceMetrics.averageConnectionTime,
        count: this.performanceMetrics.connectionCount,
      },
      memoryUsage: {
        initial: this.performanceMetrics.memoryUsage.initial,
        current: this.performanceMetrics.memoryUsage.current,
        peak: this.performanceMetrics.memoryUsage.peak,
        growth: memoryGrowth,
        growthPercentage: Math.round(growthPercentage * 100) / 100,
      },
      prewarmedConnections: this.performanceMetrics.prewarmedConnections.size,
      totalConnections: this.connections.size,
      healthyConnections: this.getHealthyConnections().length,
    };
  }

  /**
   * 优化内存使用
   */
  optimizeMemoryUsage(): void {
    this.logger.info("开始内存优化");

    // 清理过期的重连历史记录和健康检查历史
    for (const [, status] of this.connectionStates) {
      if (status.reconnectHistory && status.reconnectHistory.length > 10) {
        // 只保留最近10次记录
        status.reconnectHistory = status.reconnectHistory.slice(-10);
      }

      // 清理过期的健康检查历史
      // 重置一些累积的统计数据以防止无限增长
      if (status.totalRequests > 10000) {
        // 重置计数器，但保持比率
        const successRate = status.successfulRequests / status.totalRequests;
        status.totalRequests = 1000;
        status.successfulRequests = Math.round(successRate * 1000);
      }
    }

    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }

    this.updatePerformanceMetrics();
    this.logger.info("内存优化完成");
  }

  /**
   * 资源清理
   */
  async cleanup(): Promise<void> {
    this.logger.info("开始清理 XiaozhiConnectionManager 资源");

    try {
      // 断开所有连接
      await this.disconnect();

      // 清理连接实例
      this.connections.clear();
      this.connectionStates.clear();

      // 重置状态
      this.isInitialized = false;
      this.isConnecting = false;
      this.roundRobinIndex = 0;
      this.lastSelectedEndpoint = null;

      this.logger.info("XiaozhiConnectionManager 资源清理完成");
    } catch (error) {
      this.logger.error("XiaozhiConnectionManager 资源清理失败:", error);
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 验证初始化参数
   */
  private validateInitializeParams(endpoints: string[], tools: Tool[]): void {
    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      throw new Error("端点列表不能为空");
    }

    if (!Array.isArray(tools)) {
      throw new Error("工具列表必须是数组");
    }

    // 验证端点格式
    for (const endpoint of endpoints) {
      if (!endpoint || typeof endpoint !== "string") {
        throw new Error(`无效的端点地址: ${endpoint}`);
      }

      if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
        throw new Error(`端点地址必须是 WebSocket URL: ${endpoint}`);
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
    this.logger.debug(`创建连接实例: ${endpoint}`);

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
        reconnectAttempts: 0,
        healthScore: 100, // 初始健康度为满分
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0,
        healthCheckEnabled: true,
        isReconnecting: false,
        reconnectDelay: this.options.reconnectInterval,
        reconnectHistory: [],
      });

      this.logger.debug(`连接实例创建成功: ${endpoint}`);
    } catch (error) {
      this.logger.error(`创建连接实例失败 ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * 连接单个端点
   */
  private async connectSingleEndpoint(
    endpoint: string,
    proxyServer: ProxyMCPServer
  ): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      throw new Error(`端点状态不存在: ${endpoint}`);
    }

    this.logger.debug(`连接端点: ${endpoint}`);

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
      status.healthScore = 100;

      this.logger.info(`端点连接成功: ${endpoint}`);
    } catch (error) {
      // 更新连接失败状态
      status.connected = false;
      status.initialized = false;
      status.lastError = error instanceof Error ? error.message : String(error);
      status.reconnectAttempts++;
      status.healthScore = Math.max(0, status.healthScore - 20);

      this.logger.error(`端点连接失败 ${endpoint}:`, error);

      // 启动重连（如果未超过最大重连次数）
      this.scheduleReconnect(endpoint);

      throw error;
    }
  }

  /**
   * 断开单个端点
   */
  private async disconnectSingleEndpoint(
    endpoint: string,
    proxyServer: ProxyMCPServer
  ): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      return;
    }

    this.logger.debug(`断开端点: ${endpoint}`);

    try {
      // 执行断开连接（ProxyMCPServer.disconnect 是同步方法）
      proxyServer.disconnect();

      // 更新状态
      status.connected = false;
      status.initialized = false;

      this.logger.debug(`端点断开成功: ${endpoint}`);
    } catch (error) {
      this.logger.error(`端点断开失败 ${endpoint}:`, error);
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
        this.logger.debug(`工具同步成功: ${endpoint}`);
      } catch (error) {
        this.logger.error(`工具同步失败 ${endpoint}:`, error);
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
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    this.logger.debug("执行健康检查");

    const healthCheckPromises: Promise<void>[] = [];

    for (const [endpoint, status] of this.connectionStates) {
      if (!status.healthCheckEnabled) {
        continue;
      }

      healthCheckPromises.push(this.performSingleHealthCheck(endpoint, status));
    }

    // 并发执行所有健康检查
    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 执行单个端点的健康检查
   */
  private async performSingleHealthCheck(
    endpoint: string,
    status: ConnectionStatus
  ): Promise<void> {
    const startTime = Date.now();
    status.lastHealthCheck = new Date();
    status.totalRequests++;

    try {
      const proxyServer = this.connections.get(endpoint);
      if (!proxyServer) {
        throw new Error(`连接实例不存在: ${endpoint}`);
      }

      // 执行健康检查（这里使用简单的连接状态检查）
      // 在实际实现中，可以调用 ProxyMCPServer 的 ping 方法或其他健康检查方法
      await this.checkConnectionHealth(proxyServer, endpoint);

      // 健康检查成功
      const responseTime = Date.now() - startTime;
      this.handleHealthCheckSuccess(status, responseTime);
    } catch (error) {
      // 健康检查失败
      const responseTime = Date.now() - startTime;
      this.handleHealthCheckFailure(status, error as Error, responseTime);
    }
  }

  /**
   * 检查连接健康状态
   */
  private async checkConnectionHealth(
    proxyServer: any,
    endpoint: string
  ): Promise<void> {
    // 检查基本连接状态
    if (!proxyServer) {
      throw new Error("连接实例不存在");
    }

    // 这里可以扩展更复杂的健康检查逻辑
    // 例如：发送 ping 请求、检查工具列表等

    // 模拟健康检查延迟
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 如果连接状态为断开，抛出错误
    const status = this.connectionStates.get(endpoint);
    if (!status?.connected) {
      throw new Error("连接已断开");
    }
  }

  /**
   * 处理健康检查成功
   */
  private handleHealthCheckSuccess(
    status: ConnectionStatus,
    responseTime: number
  ): void {
    status.successfulRequests++;
    status.consecutiveFailures = 0;
    status.responseTime = responseTime;
    status.lastSuccessTime = new Date();

    // 更新健康度评分
    this.updateHealthScore(status, true, responseTime);

    this.logger.debug(
      `健康检查成功: ${status.endpoint}, 响应时间: ${responseTime}ms, 健康度: ${status.healthScore}`
    );
  }

  /**
   * 处理健康检查失败
   */
  private handleHealthCheckFailure(
    status: ConnectionStatus,
    error: Error,
    responseTime: number
  ): void {
    status.consecutiveFailures++;
    status.responseTime = responseTime;
    status.lastError = error.message;

    // 更新健康度评分
    this.updateHealthScore(status, false, responseTime);

    this.logger.warn(
      `健康检查失败: ${status.endpoint}, 错误: ${error.message}, 连续失败: ${status.consecutiveFailures}, 健康度: ${status.healthScore}`
    );

    // 如果连续失败次数过多，考虑触发重连
    if (status.consecutiveFailures >= 3 && status.connected) {
      this.logger.warn(
        `端点 ${status.endpoint} 连续失败 ${status.consecutiveFailures} 次，可能需要重连`
      );
      // 这里可以触发重连逻辑
    }
  }

  /**
   * 更新健康度评分
   */
  private updateHealthScore(
    status: ConnectionStatus,
    success: boolean,
    responseTime: number
  ): void {
    const baseScore = status.healthScore;

    if (success) {
      // 成功时增加健康度
      let increment = 5;

      // 根据响应时间调整增量
      if (responseTime < 100) {
        increment = 10; // 响应快，增量大
      } else if (responseTime < 500) {
        increment = 7; // 响应中等
      } else if (responseTime < 1000) {
        increment = 5; // 响应慢
      } else {
        increment = 2; // 响应很慢
      }

      status.healthScore = Math.min(100, baseScore + increment);
    } else {
      // 失败时减少健康度
      let decrement = 15;

      // 根据连续失败次数调整减量
      if (status.consecutiveFailures >= 5) {
        decrement = 30; // 连续失败多次，减量大
      } else if (status.consecutiveFailures >= 3) {
        decrement = 20;
      }

      status.healthScore = Math.max(0, baseScore - decrement);
    }

    // 计算成功率并调整健康度
    if (status.totalRequests > 0) {
      const successRate = status.successfulRequests / status.totalRequests;

      // 如果成功率低于 50%，进一步降低健康度
      if (successRate < 0.5) {
        status.healthScore = Math.max(0, status.healthScore - 10);
      }
      // 如果成功率高于 90%，适当提升健康度
      else if (successRate > 0.9) {
        status.healthScore = Math.min(100, status.healthScore + 5);
      }
    }
  }

  /**
   * 分类连接错误类型
   */
  private classifyConnectionError(error: Error): ConnectionErrorType {
    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("timed out")
    ) {
      return ConnectionErrorType.TIMEOUT_ERROR;
    }

    if (
      errorMessage.includes("network") ||
      errorMessage.includes("connection refused") ||
      errorMessage.includes("econnrefused") ||
      errorMessage.includes("enotfound")
    ) {
      return ConnectionErrorType.NETWORK_ERROR;
    }

    if (
      errorMessage.includes("auth") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("forbidden") ||
      errorMessage.includes("401") ||
      errorMessage.includes("403")
    ) {
      return ConnectionErrorType.AUTHENTICATION_ERROR;
    }

    if (
      errorMessage.includes("server") ||
      errorMessage.includes("500") ||
      errorMessage.includes("502") ||
      errorMessage.includes("503") ||
      errorMessage.includes("504")
    ) {
      return ConnectionErrorType.SERVER_ERROR;
    }

    return ConnectionErrorType.UNKNOWN_ERROR;
  }

  /**
   * 计算重连延迟
   */
  private calculateReconnectDelay(status: ConnectionStatus): number {
    const baseDelay = this.options.reconnectInterval;
    const maxDelay = this.options.maxReconnectDelay;
    const multiplier = this.options.reconnectBackoffMultiplier;
    const attempts = status.reconnectAttempts;

    let delay: number;

    switch (this.options.reconnectStrategy) {
      case ReconnectStrategy.FIXED_INTERVAL:
        delay = baseDelay;
        break;

      case ReconnectStrategy.LINEAR_BACKOFF:
        delay = baseDelay * (attempts + 1);
        break;

      case ReconnectStrategy.EXPONENTIAL_BACKOFF:
        delay = baseDelay * multiplier ** attempts;
        break;

      case ReconnectStrategy.ADAPTIVE:
        // 自适应策略：根据错误类型和历史成功率调整
        delay = this.calculateAdaptiveDelay(
          status,
          baseDelay,
          multiplier,
          attempts
        );
        break;

      default:
        delay = baseDelay * multiplier ** attempts;
    }

    // 限制最大延迟
    delay = Math.min(delay, maxDelay);

    // 添加抖动以避免雷群效应
    if (this.options.jitterEnabled) {
      const jitter = delay * 0.1 * Math.random(); // 10% 的随机抖动
      delay += jitter;
    }

    return Math.round(delay);
  }

  /**
   * 计算自适应重连延迟
   */
  private calculateAdaptiveDelay(
    status: ConnectionStatus,
    baseDelay: number,
    multiplier: number,
    attempts: number
  ): number {
    let delay = baseDelay;

    // 根据错误类型调整
    switch (status.errorType) {
      case ConnectionErrorType.NETWORK_ERROR:
        // 网络错误，使用指数退避
        delay = baseDelay * multiplier ** attempts;
        break;

      case ConnectionErrorType.AUTHENTICATION_ERROR:
        // 认证错误，延迟更长
        delay = baseDelay * multiplier ** attempts * 2;
        break;

      case ConnectionErrorType.SERVER_ERROR:
        // 服务器错误，适中延迟
        delay = baseDelay * (1 + attempts);
        break;

      case ConnectionErrorType.TIMEOUT_ERROR:
        // 超时错误，线性增长
        delay = baseDelay * (1 + attempts * 0.5);
        break;

      default:
        delay = baseDelay * multiplier ** attempts;
    }

    // 根据历史成功率调整
    if (status.reconnectHistory.length > 0) {
      const recentHistory = status.reconnectHistory.slice(-5); // 最近5次
      const successRate =
        recentHistory.filter((h) => h.success).length / recentHistory.length;

      if (successRate < 0.2) {
        // 成功率很低，增加延迟
        delay *= 1.5;
      } else if (successRate > 0.8) {
        // 成功率很高，减少延迟
        delay *= 0.8;
      }
    }

    return delay;
  }

  /**
   * 检查是否应该重连
   */
  private shouldReconnect(status: ConnectionStatus): boolean {
    // 检查重连次数限制
    if (status.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.logger.warn(
        `端点 ${status.endpoint} 已达到最大重连次数 ${this.options.maxReconnectAttempts}`
      );
      return false;
    }

    // 检查错误类型
    if (status.errorType === ConnectionErrorType.AUTHENTICATION_ERROR) {
      // 认证错误通常不应该重连太多次
      if (status.reconnectAttempts >= 3) {
        this.logger.warn(`端点 ${status.endpoint} 认证错误，停止重连`);
        return false;
      }
    }

    // 检查连续失败次数
    if (status.consecutiveFailures >= 10) {
      this.logger.warn(`端点 ${status.endpoint} 连续失败次数过多，停止重连`);
      return false;
    }

    return true;
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(endpoint: string): void {
    const status = this.connectionStates.get(endpoint);
    if (!status) {
      return;
    }

    // 分类错误类型
    if (status.lastError) {
      status.errorType = this.classifyConnectionError(
        new Error(status.lastError)
      );
    }

    // 检查是否应该重连
    if (!this.shouldReconnect(status)) {
      status.isReconnecting = false;
      return;
    }

    // 清理现有的重连定时器
    const existingTimer = this.reconnectTimers.get(endpoint);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 计算重连延迟
    const delay = this.calculateReconnectDelay(status);
    status.reconnectDelay = delay;
    status.isReconnecting = true;
    status.nextReconnectTime = new Date(Date.now() + delay);

    this.logger.info(
      `安排重连 ${endpoint}，延迟: ${delay}ms，尝试次数: ${status.reconnectAttempts + 1}，错误类型: ${status.errorType}`
    );

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(endpoint);
      await this.performReconnect(endpoint);
    }, delay);

    this.reconnectTimers.set(endpoint, timer);
  }

  /**
   * 执行重连
   */
  private async performReconnect(endpoint: string): Promise<void> {
    const status = this.connectionStates.get(endpoint);
    const proxyServer = this.connections.get(endpoint);

    if (!status || !proxyServer) {
      return;
    }

    status.lastReconnectAttempt = new Date();
    status.isReconnecting = true;

    this.logger.info(
      `开始重连 ${endpoint}，第 ${status.reconnectAttempts + 1} 次尝试`
    );

    try {
      await this.connectSingleEndpoint(endpoint, proxyServer);

      // 重连成功
      status.isReconnecting = false;
      status.reconnectHistory.push({
        timestamp: new Date(),
        success: true,
        delay: status.reconnectDelay,
      });

      this.logger.info(`重连成功 ${endpoint}`);
    } catch (error) {
      // 重连失败
      status.isReconnecting = false;
      status.reconnectHistory.push({
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
        delay: status.reconnectDelay,
      });

      this.logger.error(`重连失败 ${endpoint}:`, error);

      // 继续安排下次重连
      this.scheduleReconnect(endpoint);
    }

    // 限制重连历史记录数量
    if (status.reconnectHistory.length > 20) {
      status.reconnectHistory = status.reconnectHistory.slice(-20);
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
