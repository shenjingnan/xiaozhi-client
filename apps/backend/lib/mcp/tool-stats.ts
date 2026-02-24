/**
 * MCP 工具统计管理器
 * 负责工具使用统计信息的更新和跟踪
 */

import { logger } from "@/Logger.js";
import { configManager } from "@xiaozhi-client/config";

/**
 * 工具统计信息接口
 */
export interface ToolStatsInfo {
  /** 工具名称 */
  toolName: string;
  /** 服务名称 */
  serviceName: string;
  /** 原始工具名称 */
  originalToolName: string;
  /** 是否调用成功 */
  isSuccess: boolean;
  /** 当前时间 */
  currentTime: string;
}

/**
 * 工具统计管理器类
 * 处理工具调用后的统计信息更新
 */
export class ToolStatsManager {
  /**
   * 更新工具调用统计信息
   * @param info 工具统计信息
   */
  async updateStats(info: ToolStatsInfo): Promise<void> {
    const {
      toolName,
      serviceName,
      originalToolName,
      isSuccess,
      currentTime,
    } = info;

    try {
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

        logger.debug(`[ToolStatsManager] 已更新工具 ${toolName} 的统计信息`);
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

        logger.debug("[ToolStatsManager] 已更新工具的失败调用统计信息", {
          toolName,
        });
      }
    } catch (error) {
      logger.error("[ToolStatsManager] 更新工具统计信息失败", {
        toolName,
        error,
      });
      throw error;
    }
  }

  /**
   * 安全更新工具统计（带错误处理）
   * @param info 工具统计信息
   */
  async updateStatsSafe(info: ToolStatsInfo): Promise<void> {
    try {
      await this.updateStats(info);
    } catch (error) {
      const action = info.isSuccess ? "统计信息" : "失败统计信息";
      logger.warn("[ToolStatsManager] 更新工具统计信息失败", {
        toolName: info.toolName,
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
   * @private
   */
  private async updateCustomMCPToolStats(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, true);
      logger.debug(
        `[ToolStatsManager] 已更新 customMCP 工具 ${toolName} 使用统计`
      );
    } catch (error) {
      logger.error(
        `[ToolStatsManager] 更新 customMCP 工具 ${toolName} 统计失败`,
        { error }
      );
      throw error;
    }
  }

  /**
   * 更新 customMCP 工具最后使用时间
   * @param toolName 工具名称
   * @param currentTime 当前时间
   * @private
   */
  private async updateCustomMCPToolLastUsedTime(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, false); // 只更新时间，不增加计数
      logger.debug(
        `[ToolStatsManager] 已更新 customMCP 工具 ${toolName} 最后使用时间`
      );
    } catch (error) {
      logger.error(
        `[ToolStatsManager] 更新 customMCP 工具 ${toolName} 最后使用时间失败`,
        { error }
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具统计信息
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param currentTime 当前时间
   * @private
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
        `[ToolStatsManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 统计`
      );
    } catch (error) {
      logger.error(
        `[ToolStatsManager] 更新 MCP 服务工具 ${serviceName}/${toolName} 统计失败`,
        { error }
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具最后使用时间
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param currentTime 当前时间
   * @private
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
        `[ToolStatsManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间`
      );
    } catch (error) {
      logger.error(
        `[ToolStatsManager] 更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间失败`,
        { error }
      );
      throw error;
    }
  }

  /**
   * 清理所有统计更新锁
   */
  clearAllLocks(): void {
    try {
      configManager.clearAllStatsUpdateLocks();
      logger.info("[ToolStatsManager] 统计更新锁已清理");
    } catch (error) {
      logger.error("[ToolStatsManager] 清理统计更新锁失败", { error });
    }
  }
}
