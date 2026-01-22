/**
 * EndpointManager
 * 管理多个小智接入点的连接，共享外部传入的 MCPManager
 *
 * 使用方式：
 * ```typescript
 * // 1. 先创建并配置 MCPManager
 * const mcpManager = new MCPManager();
 * mcpManager.addServer("calculator", { command: "npx", args: ["-y", "calculator-mcp"] });
 * await mcpManager.connect();
 *
 * // 2. 创建 EndpointManager 并设置 MCPManager
 * const manager = new EndpointManager();
 * manager.setMcpManager(mcpManager);
 *
 * // 3. 添加接入点
 * manager.addEndpoint("ws://endpoint1");
 * await manager.connect();
 * ```
 */

import { EventEmitter } from "node:events";
import type { Endpoint } from "./endpoint.js";
import type {
  EndpointManagerConfig,
  SimpleConnectionStatus,
  IMCPServiceManager,
} from "./types.js";
import { sliceEndpoint } from "./utils.js";
import { SharedMCPAdapter } from "./shared-mcp-adapter.js";
import { Endpoint as EndpointClass } from "./endpoint.js";

/**
 * 小智接入点管理器
 * 负责管理多个小智接入点的连接，共享 MCP 服务
 *
 * 注意：MCPManager 必须通过 setMcpManager() 方法设置，且由外部管理其生命周期
 */
export class EndpointManager extends EventEmitter {
  private endpoints: Map<string, Endpoint> = new Map();
  private connectionStates: Map<string, SimpleConnectionStatus> = new Map();
  private mcpManager: IMCPServiceManager | null = null;
  private sharedMCPAdapter: SharedMCPAdapter | null = null;

  /**
   * 构造函数
   *
   * @param config - 可选的配置
   */
  constructor(private config?: EndpointManagerConfig) {
    super();
    console.debug("[EndpointManager] 实例已创建");
  }

  /**
   * 设置 MCPManager 实例
   *
   * 注意：MCPManager 的生命周期由外部管理，EndpointManager 不负责连接和断开
   *
   * @param mcpManager - 外部创建并已连接的 MCPManager 实例
   */
  setMcpManager(mcpManager: IMCPServiceManager): void {
    if (this.sharedMCPAdapter) {
      throw new Error("MCPManager 已经设置，不能重复设置");
    }

    this.mcpManager = mcpManager;
    this.sharedMCPAdapter = new SharedMCPAdapter(mcpManager);

    // 监听 MCP 服务连接事件（如果支持 EventEmitter）
    if ("on" in mcpManager && typeof mcpManager.on === "function") {
      mcpManager.on("connected", (data: any) => {
        console.info(
          `[EndpointManager] MCP 服务已连接: ${data.serverName}, 工具数: ${data.tools?.length || 0}`
        );
      });

      mcpManager.on("error", (data: any) => {
        console.error(
          `[EndpointManager] MCP 服务连接失败: ${data.serverName}`,
          data.error
        );
      });
    }

    console.info("[EndpointManager] MCPManager 已设置");
  }

  /**
   * 添加 Endpoint（支持 URL 字符串或 Endpoint 实例）
   *
   * @param endpoint - Endpoint URL 字符串或 Endpoint 实例
   */
  addEndpoint(endpoint: string | Endpoint): void {
    // 如果是字符串，创建新的 Endpoint 实例
    if (typeof endpoint === "string") {
      if (!this.sharedMCPAdapter) {
        throw new Error(
          "MCPManager 未设置，请先调用 setMcpManager() 方法设置 MCPManager"
        );
      }

      const endpointInstance = new EndpointClass(
        endpoint,
        this.sharedMCPAdapter,
        this.config?.defaultReconnectDelay
      );

      return this.addEndpointInternal(endpointInstance);
    }

    // 原有的 Endpoint 实例处理逻辑
    return this.addEndpointInternal(endpoint);
  }

  /**
   * 内部添加 Endpoint 方法
   */
  private addEndpointInternal(endpoint: Endpoint): void {
    const url = endpoint.getUrl();

    if (this.endpoints.has(url)) {
      console.debug(
        `[EndpointManager] 接入点 ${sliceEndpoint(url)} 已存在，跳过添加`
      );
      return;
    }

    console.debug(`[EndpointManager] 添加接入点: ${sliceEndpoint(url)}`);

    this.endpoints.set(url, endpoint);
    this.connectionStates.set(url, {
      endpoint: url,
      connected: false,
      initialized: false,
    });

    // 发射事件
    this.emit("endpointAdded", { endpoint: url });
  }

  /**
   * 移除 Endpoint 实例
   *
   * @param endpoint - Endpoint 实例
   */
  removeEndpoint(endpoint: Endpoint): void {
    const url = endpoint.getUrl();

    if (!this.endpoints.has(url)) {
      console.debug(
        `[EndpointManager] 接入点 ${sliceEndpoint(url)} 不存在，跳过移除`
      );
      return;
    }

    console.debug(`[EndpointManager] 移除接入点: ${sliceEndpoint(url)}`);

    // 断开连接
    endpoint.disconnect();

    // 清理状态
    this.endpoints.delete(url);
    this.connectionStates.delete(url);

    // 发射事件
    this.emit("endpointRemoved", { endpoint: url });
  }

  /**
   * 连接所有 Endpoint
   *
   * 注意：此方法不负责连接 MCPManager，MCPManager 必须在调用此方法前已连接
   */
  async connect(): Promise<void> {
    // 连接所有未连接的 Endpoint
    console.debug(
      `[EndpointManager] 开始连接接入点，总数: ${this.endpoints.size}`
    );

    const promises: Promise<void>[] = [];

    for (const [url, endpoint] of this.endpoints) {
      const status = this.connectionStates.get(url);

      // 跳过已连接的端点
      if (status?.connected) {
        console.debug(
          `[EndpointManager] 接入点已连接，跳过: ${sliceEndpoint(url)}`
        );
        continue;
      }

      promises.push(
        this.connectSingleEndpoint(url, endpoint).catch((error) => {
          console.error(`[EndpointManager] 连接失败: ${sliceEndpoint(url)}`, error);
          // 更新失败状态
          const status = this.connectionStates.get(url);
          if (status) {
            status.connected = false;
            status.initialized = false;
            status.lastError =
              error instanceof Error ? error.message : String(error);
          }
        })
      );
    }

    await Promise.allSettled(promises);

    // 统计连接结果
    const connectedCount = Array.from(this.connectionStates.values()).filter(
      (s) => s.connected
    ).length;

    console.info(
      `[EndpointManager] 连接完成: 成功 ${connectedCount}/${this.endpoints.size}`
    );
  }

  /**
   * 断开所有连接
   *
   * 注意：此方法不断开 MCPManager，MCPManager 的生命周期由外部管理
   */
  async disconnect(): Promise<void> {
    console.debug("[EndpointManager] 开始断开所有连接");

    const promises: Promise<void>[] = [];

    for (const endpoint of this.endpoints.values()) {
      promises.push(
        Promise.resolve().then(() => {
          endpoint.disconnect();
        })
      );
    }

    await Promise.allSettled(promises);

    // 重置所有状态
    for (const status of this.connectionStates.values()) {
      status.connected = false;
      status.initialized = false;
    }

    console.debug("[EndpointManager] 所有接入点已断开连接");
  }

  /**
   * 获取所有 Endpoint URL
   */
  getEndpoints(): string[] {
    return Array.from(this.endpoints.keys());
  }

  /**
   * 获取指定 Endpoint 实例
   *
   * @param url - Endpoint URL
   */
  getEndpoint(url: string): Endpoint | undefined {
    return this.endpoints.get(url);
  }

  /**
   * 获取所有连接状态
   */
  getConnectionStatus(): SimpleConnectionStatus[] {
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
   * @param url - 端点 URL
   */
  isEndpointConnected(url: string): boolean {
    const status = this.connectionStates.get(url);
    return status?.connected ?? false;
  }

  /**
   * 获取指定端点的状态
   *
   * @param url - 端点 URL
   */
  getEndpointStatus(url: string): SimpleConnectionStatus | undefined {
    return this.connectionStates.get(url);
  }

  /**
   * 重连所有端点
   */
  async reconnectAll(): Promise<void> {
    console.info("[EndpointManager] 开始重连所有接入点");

    const promises: Promise<void>[] = [];

    for (const [url, endpoint] of this.endpoints) {
      promises.push(
        this.reconnectSingleEndpoint(url, endpoint).catch((error) => {
          console.error(`[EndpointManager] 重连失败: ${sliceEndpoint(url)}`, error);
        })
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * 重连指定的端点
   *
   * @param url - 要重连的端点 URL
   */
  async reconnectEndpoint(url: string): Promise<void> {
    const endpoint = this.endpoints.get(url);
    if (!endpoint) {
      throw new Error(`接入点不存在: ${sliceEndpoint(url)}`);
    }

    await this.reconnectSingleEndpoint(url, endpoint);
  }

  /**
   * 清除所有端点
   *
   * 注意：此方法不会清理 MCPManager，MCPManager 的生命周期由外部管理
   */
  async clearEndpoints(): Promise<void> {
    console.debug("[EndpointManager] 清除所有接入点");

    await this.disconnect();

    this.endpoints.clear();
    this.connectionStates.clear();

    // 注意：不清理 MCPManager，由外部管理
    // this.mcpManager = null;
    // this.sharedMCPAdapter = null;

    console.info("[EndpointManager] 所有接入点已清除");
  }

  /**
   * 清理资源
   *
   * 注意：此方法不会清理 MCPManager，MCPManager 的生命周期由外部管理
   */
  async cleanup(): Promise<void> {
    console.debug("[EndpointManager] 开始清理资源");

    await this.clearEndpoints();

    console.debug("[EndpointManager] 资源清理完成");
  }

  // ==================== 私有方法 ====================

  /**
   * 连接单个端点
   */
  public async connectSingleEndpoint(
    url: string,
    endpoint: Endpoint
  ): Promise<void> {
    const status = this.connectionStates.get(url);
    if (!status) {
      throw new Error(`端点状态不存在: ${sliceEndpoint(url)}`);
    }

    console.debug(`[EndpointManager] 连接端点: ${sliceEndpoint(url)}`);

    // 更新状态为连接中
    status.connected = false;
    status.initialized = false;

    // 执行连接
    await endpoint.connect();

    // 更新连接成功状态
    status.connected = true;
    status.initialized = true;
    status.lastConnected = new Date();
    status.lastError = undefined;

    console.info(`[EndpointManager] 端点连接成功: ${sliceEndpoint(url)}`);
  }

  /**
   * 重连单个端点
   */
  private async reconnectSingleEndpoint(
    url: string,
    endpoint: Endpoint
  ): Promise<void> {
    const status = this.connectionStates.get(url);
    if (!status) {
      throw new Error(`端点状态不存在: ${sliceEndpoint(url)}`);
    }

    console.debug(`[EndpointManager] 重连端点: ${sliceEndpoint(url)}`);

    // 执行重连
    await endpoint.reconnect();

    // 更新连接成功状态
    status.connected = true;
    status.initialized = true;
    status.lastConnected = new Date();
    status.lastError = undefined;

    console.info(`[EndpointManager] 端点重连成功: ${sliceEndpoint(url)}`);
  }
}
