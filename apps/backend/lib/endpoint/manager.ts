import { EventEmitter } from "node:events";
import type { MCPServiceManager, MCPToolItem } from "@/lib/mcp/index.js";
import { ensureToolJSONSchema } from "@/lib/mcp/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigManager } from "@root/configManager.js";
import type { EventBus } from "@services/EventBus.js";
import { getEventBus } from "@services/EventBus.js";
import { sliceEndpoint } from "@utils/mcpServerUtils.js";
import { z } from "zod";
import { ProxyMCPServer } from "./connection.js";

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
  connectionTimeout?: number; // 连接超时时间（毫秒），默认 10000
}

// 连接状态接口
export interface SimpleConnectionStatus {
  endpoint: string;
  connected: boolean;
  initialized: boolean;
  lastConnected?: Date;
  lastError?: string;
}

// 保持向后兼容的连接状态接口
export interface ConnectionStatus extends SimpleConnectionStatus {
  // 移除所有重连相关字段
}

// 连接状态枚举
export enum XiaozhiConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

// 默认配置
const DEFAULT_OPTIONS: Required<IndependentConnectionOptions> = {
  connectionTimeout: 10000,
};

// zod 验证 schema
const IndependentConnectionOptionsSchema = z
  .object({
    connectionTimeout: z
      .number()
      .min(1000, "connectionTimeout 必须是大于等于 1000 的数字")
      .optional(),
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
  private mcpServiceManager: MCPServiceManager | null = null;
  private configManager: ConfigManager;
  private eventBus: EventBus;

  // 状态管理
  private isInitialized = false;
  private isConnecting = false;

  // 配置选项
  private options: Required<IndependentConnectionOptions>;

  constructor(
    configManager: ConfigManager,
    options?: IndependentConnectionOptions
  ) {
    super();
    this.configManager = configManager;
    this.eventBus = getEventBus();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    console.debug("[IndependentXiaozhiConnectionManager] 实例已创建");
    console.debug(
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

    console.debug(
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

      console.debug(
        `IndependentXiaozhiConnectionManager 初始化完成，管理 ${this.connections.size} 个连接`
      );
    } catch (error) {
      console.error("IndependentXiaozhiConnectionManager 初始化失败:", error);
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
    console.debug(`开始连接所有小智接入点，总数: ${this.connections.size}`);

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
    for (const [endpoint, proxyServer] of this.connections) {
      disconnectPromises.push(
        this.disconnectSingleEndpoint(endpoint, proxyServer)
      );
    }

    await Promise.allSettled(disconnectPromises);
    console.debug("所有小智接入点已断开连接");
  }

  /**
   * 动态添加小智接入点
   * @param endpoint 小智接入点地址
   */
  async addEndpoint(endpoint: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("IndependentXiaozhiConnectionManager 未初始化");
    }

    // 检查连接管理器中的重复性
    if (this.connections.has(endpoint)) {
      console.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 已存在于连接管理器中，跳过添加`
      );
      return;
    }

    // 检查配置文件中的重复性
    if (this.checkConfigDuplicate(endpoint)) {
      throw new Error(`接入点 ${sliceEndpoint(endpoint)} 已存在于配置文件中`);
    }

    console.debug(`动态添加小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      // 先更新配置文件
      this.configManager.addMcpEndpoint(endpoint);

      try {
        // 获取当前工具列表
        const tools = this.getCurrentTools();

        // 创建新连接
        await this.createConnection(endpoint, tools);

        // 自动连接新添加的接入点
        const proxyServer = this.connections.get(endpoint);
        if (!proxyServer) {
          throw new Error(`无法获取接入点连接: ${endpoint}`);
        }
        await this.connectSingleEndpoint(endpoint, proxyServer);

        console.info(`添加接入点成功： ${sliceEndpoint(endpoint)}`);
      } catch (error) {
        // 回滚配置文件更改
        try {
          this.configManager.removeMcpEndpoint(endpoint);
          console.debug(`配置文件回滚成功: ${sliceEndpoint(endpoint)}`);
        } catch (rollbackError) {
          console.error(
            `配置文件回滚失败: ${sliceEndpoint(endpoint)}`,
            rollbackError
          );
        }

        // 清理失败的连接
        this.connections.delete(endpoint);
        this.connectionStates.delete(endpoint);

        console.error(`添加小智接入点失败： ${sliceEndpoint(endpoint)}`, error);
        throw error;
      }
    } catch (error) {
      console.error(
        `添加小智接入点失败（配置文件操作）： ${sliceEndpoint(endpoint)}`,
        error
      );
      throw error;
    }
  }

  /**
   * 动态移除小智接入点
   * @param endpoint 小智接入点地址
   */
  async removeEndpoint(endpoint: string): Promise<void> {
    if (!this.connections.has(endpoint)) {
      console.debug(
        `小智接入点 ${sliceEndpoint(endpoint)} 不存在于连接管理器中，跳过移除`
      );
      return;
    }

    console.debug(`动态移除小智接入点: ${sliceEndpoint(endpoint)}`);

    try {
      const proxyServer = this.connections.get(endpoint);
      if (!proxyServer) {
        throw new Error(`无法获取接入点连接: ${endpoint}`);
      }

      // 先更新配置文件
      this.configManager.removeMcpEndpoint(endpoint);

      try {
        // 断开连接
        await this.disconnectSingleEndpoint(endpoint, proxyServer);

        // 清理资源
        this.connections.delete(endpoint);
        this.connectionStates.delete(endpoint);

        console.info(`移除小智接入点成功：${sliceEndpoint(endpoint)}`);
      } catch (error) {
        // 回滚配置文件更改
        try {
          this.configManager.addMcpEndpoint(endpoint);
          console.debug(`配置文件回滚成功: ${sliceEndpoint(endpoint)}`);
        } catch (rollbackError) {
          console.error(
            `配置文件回滚失败: ${sliceEndpoint(endpoint)}`,
            rollbackError
          );
        }

        console.error(`移除小智接入点失败： ${sliceEndpoint(endpoint)}`, error);
        throw error;
      }
    } catch (error) {
      console.error(
        `移除小智接入点失败（配置文件操作）： ${sliceEndpoint(endpoint)}`,
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
      console.debug(`接入点不存在，跳过断开: ${sliceEndpoint(endpoint)}`);
      return;
    }

    console.info(`断开连接接入点: ${sliceEndpoint(endpoint)}`);

    try {
      await this.disconnectSingleEndpoint(endpoint, proxyServer);
    } catch (error) {
      console.error(`断开连接接入点失败： ${sliceEndpoint(endpoint)}`, error);
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
      (endpoint) => this.removeEndpoint(endpoint)
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
   * 设置 MCP 服务管理器
   * @param manager MCP 服务管理器实例
   */
  setServiceManager(manager: MCPServiceManager): void {
    this.mcpServiceManager = manager;
    console.debug("已设置 MCPServiceManager");

    // 如果已有连接，同步工具到所有连接
    if (this.connections.size > 0) {
      this.syncToolsToAllConnections();
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
   * 连接已存在的接入点（不创建新实例）
   * @param endpoint 要连接的接入点地址
   * @throws Error 如果接入点不存在或已连接
   */
  async connectExistingEndpoint(endpoint: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("IndependentXiaozhiConnectionManager 未初始化");
    }

    const proxyServer = this.connections.get(endpoint);
    if (!proxyServer) {
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
    await this.connectSingleEndpoint(endpoint, proxyServer);
  }

  /**
   * 等待指定时间（用于状态同步）
   * @param ms 等待时间（毫秒）
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    console.info(
      `更新小智接入点配置，新小智接入点数量: ${newEndpoints.length}`
    );

    // 验证新小智接入点
    const { valid: validEndpoints, invalid: invalidEndpoints } =
      this.validateEndpoints(newEndpoints);

    if (invalidEndpoints.length > 0) {
      console.warn(`发现无效小智接入点: ${invalidEndpoints.join(", ")}`);
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

    console.info(
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
      console.info("小智接入点配置更新完成");
    } catch (error) {
      console.error("小智接入点配置更新失败:", error);
      throw error;
    }
  }

  /**
   * 更新连接选项
   * @param newOptions 新的连接选项
   */
  updateOptions(newOptions: Partial<IndependentConnectionOptions>): void {
    console.info("更新连接选项");

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
    console.info("连接选项更新完成");
    console.debug("新的配置选项:", this.options);
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
    console.info("开始热重载配置");

    try {
      // 更新选项（如果提供）
      if (config.options) {
        this.updateOptions(config.options);
      }

      // 更新小智接入点（如果提供）
      if (config.endpoints) {
        await this.updateEndpoints(config.endpoints, config.tools || []);
      }

      console.info("配置热重载完成");
    } catch (error) {
      console.error("配置热重载失败:", error);
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

    console.info(`开始预热连接，小智接入点数量: ${targetEndpoints.length}`);

    const prewarmPromises = targetEndpoints.map(async (endpoint) => {
      try {
        const connection = this.connections.get(endpoint);
        if (connection) {
          // 执行预热操作（例如建立连接、验证状态等）
          console.debug(`小智接入点 ${sliceEndpoint(endpoint)} 预热完成`);
        }
      } catch (error) {
        console.warn(`小智接入点 ${sliceEndpoint(endpoint)} 预热失败:`, error);
      }
    });

    await Promise.all(prewarmPromises);
    console.info("连接预热完成");
  }

  /**
   * 资源清理
   */
  async cleanup(): Promise<void> {
    console.debug("开始清理 IndependentXiaozhiConnectionManager 资源");

    try {
      // 断开所有连接
      await this.disconnect();

      // 清理连接实例
      this.connections.clear();
      this.connectionStates.clear();

      // 重置状态
      this.isInitialized = false;
      this.isConnecting = false;

      console.debug("IndependentXiaozhiConnectionManager 资源清理完成");
    } catch (error) {
      console.error("IndependentXiaozhiConnectionManager 资源清理失败:", error);
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 检查配置文件中的重复接入点
   * @param endpoint 要检查的接入点地址
   * @returns 如果接入点已存在于配置文件中，返回 true
   */
  private checkConfigDuplicate(endpoint: string): boolean {
    try {
      const configEndpoints = this.configManager.getMcpEndpoints();
      return configEndpoints.includes(endpoint);
    } catch (error) {
      console.error(`检查配置文件重复性失败: ${error}`);
      // 如果配置文件读取失败，保守起见认为接入点已存在
      return true;
    }
  }

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
    proxyServer: ProxyMCPServer
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
      await proxyServer.connect();

      // 更新连接成功状态
      status.connected = true;
      status.initialized = true;
      status.lastConnected = new Date();
      status.lastError = undefined;

      // 发射连接成功事件
      this.emitEndpointStatusChanged(
        endpoint,
        true,
        "connect",
        true,
        "接入点连接成功",
        "connection-manager"
      );

      console.info(`小智接入点连接成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      // 更新连接失败状态
      status.connected = false;
      status.initialized = false;
      status.lastError = error instanceof Error ? error.message : String(error);

      // 发射连接失败事件
      this.emitEndpointStatusChanged(
        endpoint,
        false,
        "connect",
        false,
        error instanceof Error ? error.message : "连接失败",
        "connection-manager"
      );

      console.error(`连接失败 ${sliceEndpoint(endpoint)}:`, error);

      // 直接抛出错误，不再重连
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

    console.debug(`断开小智接入点: ${sliceEndpoint(endpoint)}`);

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

      console.debug(`小智接入点断开成功: ${sliceEndpoint(endpoint)}`);
    } catch (error) {
      console.error(`小智接入点断开失败 ${sliceEndpoint(endpoint)}:`, error);
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
      const rawTools = this.mcpServiceManager.getAllTools();
      // 转换工具格式以符合 MCP SDK 的 Tool 类型
      return rawTools.map((tool: MCPToolItem) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: ensureToolJSONSchema(tool.inputSchema),
      }));
    } catch (error) {
      console.error("获取工具列表失败:", error);
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

    console.debug("同步工具到所有连接");

    for (const [endpoint, proxyServer] of this.connections) {
      try {
        proxyServer.setServiceManager(this.mcpServiceManager);
        console.debug(`工具同步成功: ${sliceEndpoint(endpoint)}`);
      } catch (error) {
        console.error(`工具同步失败 ${sliceEndpoint(endpoint)}:`, error);
      }
    }
  }
}
