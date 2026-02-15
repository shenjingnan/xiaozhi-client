import { logger } from "@/Logger.js";
import { configManager } from "@xiaozhi-client/config";

/**
 * MCP 统计管理器
 * 负责管理工具调用统计信息的更新
 */
export class MCPStatsManager {
  constructor() {
    // 统计管理器不需要特殊初始化
  }

  /**
   * 更新工具调用统计信息的通用方法
   * @param toolName 工具名称
   * @param serviceName 服务名称
   * @param originalToolName 原始工具名称
   * @param isSuccess 是否调用成功
   */
  async updateToolStats(
    toolName: string,
    serviceName: string,
    originalToolName: string,
    isSuccess: boolean
  ): Promise<void> {
    try {
      const currentTime = new Date().toISOString();

      if (isSuccess) {
        // 成功调用：更新使用统计
        await this.updateCustomMCPToolStats(toolName, currentTime);

        // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
        if (serviceName !== "customMCP") {
          await this.updateMCPServerToolStats(
            serviceName,
            originalToolName,
            currentTime
          );
        }

        logger.debug(`[StatsManager] 已更新工具 ${toolName} 的统计信息`);
      } else {
        // 失败调用：只更新最后使用时间
        await this.updateCustomMCPToolLastUsedTime(toolName, currentTime);

        // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
        if (serviceName !== "customMCP") {
          await this.updateMCPServerToolLastUsedTime(
            serviceName,
            originalToolName,
            currentTime
          );
        }

        logger.debug("[StatsManager] 已更新工具的失败调用统计信息", {
          toolName,
        });
      }
    } catch (error) {
      logger.error("[StatsManager] 更新工具统计信息失败:", { toolName, error });
      throw error;
    }
  }

  /**
   * 统一的统计更新处理方法（带错误处理）
   * @param toolName 工具名称
   * @param serviceName 服务名称
   * @param originalToolName 原始工具名称
   * @param isSuccess 是否调用成功
   */
  async updateToolStatsSafe(
    toolName: string,
    serviceName: string,
    originalToolName: string,
    isSuccess: boolean
  ): Promise<void> {
    try {
      await this.updateToolStats(
        toolName,
        serviceName,
        originalToolName,
        isSuccess
      );
    } catch (error) {
      const action = isSuccess ? "统计信息" : "失败统计信息";
      logger.warn("[StatsManager] 更新工具统计信息失败:", {
        toolName,
        action,
        error,
      });
      // 统计更新失败不应该影响主流程，所以这里只记录警告
    }
  }

  /**
   * 更新 customMCP 工具统计信息
   * @param toolName 工具名称
   * @param currentTime 当前时间
   */
  private async updateCustomMCPToolStats(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, true);
      logger.debug(`[StatsManager] 已更新 customMCP 工具 ${toolName} 使用统计`);
    } catch (error) {
      logger.error(
        `[StatsManager] 更新 customMCP 工具 ${toolName} 统计失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 customMCP 工具最后使用时间
   * @param toolName 工具名称
   * @param currentTime 当前时间
   */
  private async updateCustomMCPToolLastUsedTime(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, false); // 只更新时间，不增加计数
      logger.debug(
        `[StatsManager] 已更新 customMCP 工具 ${toolName} 最后使用时间`
      );
    } catch (error) {
      logger.error(
        `[StatsManager] 更新 customMCP 工具 ${toolName} 最后使用时间失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具统计信息
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param currentTime 当前时间
   */
  private async updateMCPServerToolStats(
    serviceName: string,
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateMCPServerToolStatsWithLock(
        serviceName,
        toolName,
        currentTime,
        true
      );
      logger.debug(
        `[StatsManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 统计`
      );
    } catch (error) {
      logger.error(
        `[StatsManager] 更新 MCP 服务工具 ${serviceName}/${toolName} 统计失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具最后使用时间
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param currentTime 当前时间
   */
  private async updateMCPServerToolLastUsedTime(
    serviceName: string,
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateMCPServerToolStatsWithLock(
        serviceName,
        toolName,
        currentTime,
        false
      ); // 只更新时间，不增加计数
      logger.debug(
        `[StatsManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间`
      );
    } catch (error) {
      logger.error(
        `[StatsManager] 更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 获取统计更新监控信息
   * @returns 统计更新监控信息
   */
  getStatsUpdateInfo(): {
    activeLocks: string[];
    totalLocks: number;
  } {
    try {
      const activeLocks = configManager.getStatsUpdateLocks();
      return {
        activeLocks,
        totalLocks: activeLocks.length,
      };
    } catch (error) {
      logger.warn("[StatsManager] 获取统计更新监控信息失败:", error);
      return {
        activeLocks: [],
        totalLocks: 0,
      };
    }
  }

  /**
   * 清理统计更新锁
   * 用于服务停止时的清理工作
   */
  clearAllStatsUpdateLocks(): void {
    try {
      configManager.clearAllStatsUpdateLocks();
      logger.info("[StatsManager] 统计更新锁已清理");
    } catch (error) {
      logger.error("[StatsManager] 清理统计更新锁失败:", error);
    }
  }
}
