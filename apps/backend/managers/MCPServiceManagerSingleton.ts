/**
 * MCP 服务管理器全局单例
 * 用于在 API Handler 中获取服务状态
 */

import { MCPServiceManager } from "@/lib/mcp";
import { configManager } from "@/lib/config/manager";

/**
 * MCP 服务管理器全局单例类
 */
class MCPServiceManagerSingleton {
  private static instance: MCPServiceManager | null = null;

  /**
   * 获取 MCP 服务管理器单例实例
   */
  static getInstance(): MCPServiceManager {
    if (!this.instance) {
      const configs = configManager.getMcpServers();
      this.instance = new MCPServiceManager(configs);
    }
    return this.instance;
  }

  /**
   * 重置单例实例（主要用于测试）
   */
  static reset(): void {
    this.instance = null;
  }
}

/**
 * 导出单例实例供外部使用
 */
export const mcpServiceManager = MCPServiceManagerSingleton.getInstance();

export default MCPServiceManagerSingleton;
