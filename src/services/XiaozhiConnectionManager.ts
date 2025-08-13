import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ProxyMCPServer } from "../ProxyMCPServer.js";
import { Logger } from "../logger.js";

// 使用接口定义避免循环依赖
interface IMCPServiceManager {
  getAllTools(): Tool[];
}

// 连接选项接口
export interface XiaozhiConnectionOptions {
  healthCheckInterval?: number;      // 健康检查间隔（毫秒），默认 30000
  reconnectInterval?: number;        // 重连间隔（毫秒），默认 5000
  maxReconnectAttempts?: number;     // 最大重连次数，默认 10
  loadBalanceStrategy?: 'round-robin' | 'random' | 'health-based'; // 负载均衡策略，默认 'round-robin'
  connectionTimeout?: number;        // 连接超时时间（毫秒），默认 10000
}

// 连接状态接口
export interface ConnectionStatus {
  endpoint: string;
  connected: boolean;
  initialized: boolean;
  lastConnected?: Date;
  lastError?: string;
  reconnectAttempts: number;
  healthScore: number;              // 健康度评分 (0-100)
  lastHealthCheck?: Date;
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
  loadBalanceStrategy: 'round-robin',
  connectionTimeout: 10000,
};

/**
 * 小智连接管理器
 * 负责管理多个小智接入点的连接，提供统一的连接管理、健康检查、负载均衡等功能
 */
export class XiaozhiConnectionManager {
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

  constructor(options?: XiaozhiConnectionOptions) {
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

    this.logger.info(`开始初始化 XiaozhiConnectionManager，端点数量: ${endpoints.length}`);

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
      this.logger.info(`XiaozhiConnectionManager 初始化完成，管理 ${this.connections.size} 个连接`);

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
      throw new Error("XiaozhiConnectionManager 未初始化，请先调用 initialize()");
    }

    if (this.isConnecting) {
      this.logger.warn("连接操作正在进行中，请等待完成");
      return;
    }

    this.isConnecting = true;
    this.logger.info(`开始连接所有端点，总数: ${this.connections.size}`);

    try {
      const connectionPromises: Promise<void>[] = [];

      // 并发连接所有端点
      for (const [endpoint, proxyServer] of this.connections) {
        connectionPromises.push(this.connectSingleEndpoint(endpoint, proxyServer));
      }

      // 等待所有连接完成（允许部分失败）
      const results = await Promise.allSettled(connectionPromises);

      // 统计连接结果
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      this.logger.info(`连接完成 - 成功: ${successCount}, 失败: ${failureCount}`);

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
      disconnectPromises.push(this.disconnectSingleEndpoint(endpoint, proxyServer));
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
      if (!endpoint || typeof endpoint !== 'string') {
        throw new Error(`无效的端点地址: ${endpoint}`);
      }

      if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
        throw new Error(`端点地址必须是 WebSocket URL: ${endpoint}`);
      }
    }
  }

  /**
   * 创建单个连接
   */
  private async createConnection(endpoint: string, tools: Tool[]): Promise<void> {
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
  private async connectSingleEndpoint(endpoint: string, proxyServer: ProxyMCPServer): Promise<void> {
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
  private async disconnectSingleEndpoint(endpoint: string, proxyServer: ProxyMCPServer): Promise<void> {
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

    this.logger.debug(`启动健康检查，间隔: ${this.options.healthCheckInterval}ms`);

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
  private performHealthCheck(): void {
    this.logger.debug("执行健康检查");

    for (const [endpoint, status] of this.connectionStates) {
      // 更新健康检查时间
      status.lastHealthCheck = new Date();

      // 简单的健康度评估（后续可以扩展更复杂的逻辑）
      if (status.connected) {
        status.healthScore = Math.min(100, status.healthScore + 5);
      } else {
        status.healthScore = Math.max(0, status.healthScore - 10);
      }
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(endpoint: string): void {
    const status = this.connectionStates.get(endpoint);
    if (!status || status.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    // 清理现有的重连定时器
    const existingTimer = this.reconnectTimers.get(endpoint);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 计算重连延迟（指数退避）
    const delay = Math.min(
      this.options.reconnectInterval * (2 ** status.reconnectAttempts),
      30000 // 最大延迟 30 秒
    );

    this.logger.debug(`安排重连 ${endpoint}，延迟: ${delay}ms，尝试次数: ${status.reconnectAttempts + 1}`);

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(endpoint);

      const proxyServer = this.connections.get(endpoint);
      if (proxyServer) {
        try {
          await this.connectSingleEndpoint(endpoint, proxyServer);
        } catch (error) {
          // 重连失败，错误已在 connectSingleEndpoint 中处理
        }
      }
    }, delay);

    this.reconnectTimers.set(endpoint, timer);
  }

  /**
   * 清理所有重连定时器
   */
  private clearAllReconnectTimers(): void {
    for (const [endpoint, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }
}
