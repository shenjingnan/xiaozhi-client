/**
 * 共享 MCP 管理器适配器
 *
 * 接收全局 MCPManager 实例的引用，不创建独立连接
 * 用于多个 Endpoint 共享同一个 MCPManager 实例
 *
 * @example
 * ```typescript
 * const globalMCPManager = new MCPManager();
 * await globalMCPManager.connect();
 *
 * const adapter = new SharedMCPAdapter(globalMCPManager);
 * const endpoint = new Endpoint("ws://...", adapter);
 * ```
 */

import type {
  IMCPServiceManager,
  EnhancedToolInfo,
  ToolCallResult,
} from "./types.js";

/**
 * 共享 MCP 管理器适配器
 * 实现 IMCPServiceManager 接口，将操作委托给全局 MCPManager
 */
export class SharedMCPAdapter implements IMCPServiceManager {
  private isInitialized = false;

  /**
   * 构造函数
   *
   * @param globalMCPManager - 全局 MCPManager 实例
   */
  constructor(private globalMCPManager: IMCPServiceManager) {
    if (!globalMCPManager) {
      throw new Error("全局 MCPManager 不能为空");
    }
  }

  /**
   * 初始化适配器
   *
   * 注意：此方法不会连接 MCP 服务，因为全局实例已在外部连接
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 全局实例已经在外部连接，这里只标记状态
    this.isInitialized = true;
  }

  /**
   * 获取所有工具列表
   *
   * 从全局 MCPManager 获取工具列表，并转换为增强格式
   */
  getAllTools(): EnhancedToolInfo[] {
    // 直接使用 IMCPServiceManager 接口的 getAllTools() 方法
    return this.globalMCPManager.getAllTools();
  }

  /**
   * 调用工具
   *
   * 将工具调用委托给全局 MCPManager
   *
   * @param toolName - 工具名称（格式：serviceName__toolName）
   * @param arguments_ - 工具调用参数
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    // 直接使用 IMCPServiceManager 接口的 callTool() 方法
    // toolName 已经是完整格式（serviceName__toolName）
    return this.globalMCPManager.callTool(toolName, arguments_);
  }

  /**
   * 清理资源
   *
   * 注意：此方法不会断开全局 MCPManager，由创建者负责管理
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    // 不断开全局 MCPManager
  }
}
