/**
 * MCP Context 模式示例 Handler
 * 展示如何使用 Hono Context 中的 MCPServiceManager 实例
 * 替代直接使用 Singleton 模式
 */

import type { Context } from "hono";
import { createErrorResponse } from "@middlewares/index.js";
import { getMCPServiceManager, requireMCPServiceManager } from "@middlewares/mcpServiceManager.middleware.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP Context 模式示例 Handler
 * 展示新的依赖注入模式的使用方式
 */
export class MCPContextExampleHandler {
  /**
   * 获取所有可用工具列表
   * 展示基本的 Context 模式使用
   */
  async getTools(c: Context): Promise<Response> {
    try {
      // 从 Context 中获取 MCPServiceManager 实例
      const serviceManager = getMCPServiceManager(c);

      if (!serviceManager) {
        const errorResponse = createErrorResponse(
          "SERVICE_MANAGER_NOT_AVAILABLE",
          "MCP 服务管理器未初始化"
        );
        return c.json(errorResponse, 503);
      }

      // 获取所有工具
      const tools = serviceManager.getAllTools();

      return c.json({
        success: true,
        data: {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            serviceName: tool.serviceName,
            originalName: tool.originalName,
          })),
          count: tools.length,
        },
        message: "成功获取工具列表",
      });
    } catch (error) {
      const logger = c.get("logger");
      logger?.error("获取工具列表失败:", error);

      const errorResponse = createErrorResponse(
        "GET_TOOLS_FAILED",
        error instanceof Error ? error.message : "获取工具列表失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 调用指定工具
   * 展示 requireMCPServiceManager 的使用
   */
  async callTool(c: Context): Promise<Response> {
    try {
      // 使用 requireMCPServiceManager 确保实例存在
      const serviceManager = requireMCPServiceManager(c);

      // 获取请求参数
      const { toolName, arguments: args } = await c.req.json();

      if (!toolName) {
        const errorResponse = createErrorResponse(
          "MISSING_TOOL_NAME",
          "缺少工具名称参数"
        );
        return c.json(errorResponse, 400);
      }

      // 检查工具是否存在
      if (!serviceManager.hasTool(toolName)) {
        const errorResponse = createErrorResponse(
          "TOOL_NOT_FOUND",
          `工具 ${toolName} 不存在`
        );
        return c.json(errorResponse, 404);
      }

      // 调用工具
      const result = await serviceManager.callTool(toolName, args || {});

      return c.json({
        success: true,
        data: {
          result: result.content,
          toolName,
          arguments: args,
        },
        message: "工具调用成功",
      });
    } catch (error) {
      const logger = c.get("logger");
      logger?.error("工具调用失败:", error);

      const errorResponse = createErrorResponse(
        "TOOL_CALL_FAILED",
        error instanceof Error ? error.message : "工具调用失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取服务状态
   * 展示复杂业务逻辑中的 Context 模式使用
   */
  async getServiceStatus(c: Context): Promise<Response> {
    try {
      const serviceManager = getMCPServiceManager(c);

      if (!serviceManager) {
        const errorResponse = createErrorResponse(
          "SERVICE_MANAGER_NOT_AVAILABLE",
          "MCP 服务管理器未初始化"
        );
        return c.json(errorResponse, 503);
      }

      // 获取服务状态
      const status = serviceManager.getStatus();
      const connectedServices = serviceManager.getConnectedServices();

      return c.json({
        success: true,
        data: {
          isRunning: status.isRunning,
          totalTools: status.totalTools,
          availableTools: status.availableTools,
          services: status.services,
          connectedServices,
          connectionCount: connectedServices.length,
        },
        message: "成功获取服务状态",
      });
    } catch (error) {
      const logger = c.get("logger");
      logger?.error("获取服务状态失败:", error);

      const errorResponse = createErrorResponse(
        "GET_STATUS_FAILED",
        error instanceof Error ? error.message : "获取服务状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 重启指定服务
   * 展示异步操作中的 Context 模式使用
   */
  async restartService(c: Context): Promise<Response> {
    try {
      const serviceManager = requireMCPServiceManager(c);

      // 获取请求参数
      const { serviceName } = await c.req.json();

      if (!serviceName) {
        const errorResponse = createErrorResponse(
          "MISSING_SERVICE_NAME",
          "缺少服务名称参数"
        );
        return c.json(errorResponse, 400);
      }

      const logger = c.get("logger");
      logger?.info(`正在重启服务: ${serviceName}`);

      // 重启服务
      await serviceManager.stopService(serviceName);
      await serviceManager.startService(serviceName);

      logger?.info(`服务重启成功: ${serviceName}`);

      return c.json({
        success: true,
        data: {
          serviceName,
          restartedAt: new Date().toISOString(),
        },
        message: `服务 ${serviceName} 重启成功`,
      });
    } catch (error) {
      const logger = c.get("logger");
      logger?.error("重启服务失败:", error);

      const errorResponse = createErrorResponse(
        "RESTART_SERVICE_FAILED",
        error instanceof Error ? error.message : "重启服务失败"
      );
      return c.json(errorResponse, 500);
    }
  }
}

// 导出单例实例
export const mcpContextExampleHandler = new MCPContextExampleHandler();