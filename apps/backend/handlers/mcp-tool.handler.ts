/**
 * MCP 工具处理器（向后兼容层）
 * @deprecated 此文件仅为向后兼容保留，新代码应使用 tool/ 目录下的专用处理器
 *
 * 此文件将原来的 MCPToolHandler 拆分为三个专用处理器：
 * - ToolCallingHandler: 工具调用相关功能
 * - CustomToolHandler: 自定义工具 CRUD 操作
 * - MCPToolManagementHandler: MCP 工具管理功能
 *
 * 为了保持向后兼容性，此文件提供一个组合类，将所有方法聚合在一起。
 */

import type { AppContext } from "@/types/hono.context.js";
import {
  CustomToolHandler,
  MCPToolManagementHandler,
  ToolCallingHandler,
} from "./tool/index.js";
import type { Context } from "hono";

/**
 * @deprecated MCPToolHandler 已被拆分为专用处理器，请使用 ToolCallingHandler、CustomToolHandler 或 MCPToolManagementHandler
 *
 * 为了向后兼容，此类聚合了所有工具相关的方法
 */
export class MCPToolHandler extends ToolCallingHandler {
  private customToolHandler: CustomToolHandler;
  private mcpToolManagementHandler: MCPToolManagementHandler;

  constructor() {
    super();
    this.customToolHandler = new CustomToolHandler();
    this.mcpToolManagementHandler = new MCPToolManagementHandler();
  }

  /**
   * 获取自定义 MCP 工具列表
   * GET /api/tools/custom
   * @deprecated 请使用 CustomToolHandler.getCustomTools
   */
  async getCustomTools(c: Context<AppContext>): Promise<Response> {
    return this.customToolHandler.getCustomTools(c);
  }

  /**
   * 添加自定义 MCP 工具
   * POST /api/tools/custom
   * @deprecated 请使用 CustomToolHandler.addCustomTool
   */
  async addCustomTool(c: Context<AppContext>): Promise<Response> {
    return this.customToolHandler.addCustomTool(c);
  }

  /**
   * 更新自定义 MCP 工具配置
   * PUT /api/tools/custom/:toolName
   * @deprecated 请使用 CustomToolHandler.updateCustomTool
   */
  async updateCustomTool(c: Context<AppContext>): Promise<Response> {
    return this.customToolHandler.updateCustomTool(c);
  }

  /**
   * 删除自定义 MCP 工具
   * DELETE /api/tools/custom/:toolName
   * @deprecated 请使用 CustomToolHandler.removeCustomTool
   */
  async removeCustomTool(c: Context<AppContext>): Promise<Response> {
    return this.customToolHandler.removeCustomTool(c);
  }

  /**
   * 获取可用工具列表
   * GET /api/tools/list
   * @deprecated 请使用 MCPToolManagementHandler.listTools
   */
  async listTools(c: Context<AppContext>): Promise<Response> {
    return this.mcpToolManagementHandler.listTools(c);
  }

  /**
   * 统一的 MCP 工具管理接口
   * POST /api/tools/mcp/manage
   * @deprecated 请使用 MCPToolManagementHandler.manageMCPTool
   */
  async manageMCPTool(c: Context<AppContext>): Promise<Response> {
    return this.mcpToolManagementHandler.manageMCPTool(c);
  }

  /**
   * 获取服务工具列表
   * POST /api/tools/mcp/list
   * @deprecated 请使用 MCPToolManagementHandler.listMCPTools
   */
  async listMCPTools(c: Context<AppContext>): Promise<Response> {
    return this.mcpToolManagementHandler.listMCPTools(c);
  }
}

// 同时导出新的专用处理器供外部使用
export {
  CustomToolHandler,
  MCPToolManagementHandler,
  ToolCallingHandler,
} from "./tool/index.js";
