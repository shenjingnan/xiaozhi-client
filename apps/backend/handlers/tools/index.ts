/**
 * 工具处理器模块统一导出
 *
 * 提供工具相关的所有处理器和验证服务的统一导出接口。
 * 本模块将原有的 2733 行 MCPToolHandler 拆分为多个职责单一的处理器类。
 *
 * @packageDocumentation
 */

import { ToolCallHandler } from "./tool-call.handler.js";
import { ToolControlHandler } from "./tool-control.handler.js";
import { ToolListHandler } from "./tool-list.handler.js";
import { ToolManagementHandler } from "./tool-management.handler.js";
import { ToolValidationService } from "./tool-validation.service.js";

// 导出所有子处理器和服务
export { ToolCallHandler } from "./tool-call.handler.js";
export { ToolControlHandler } from "./tool-control.handler.js";
export { ToolListHandler } from "./tool-list.handler.js";
export { ToolManagementHandler } from "./tool-management.handler.js";
export { ToolValidationService } from "./tool-validation.service.js";

/**
 * MCP 工具处理器（重构版）
 *
 * 将原有的单一巨大类拆分为多个职责单一的处理器类：
 * - ToolCallHandler: 工具调用逻辑
 * - ToolListHandler: 工具列表查询
 * - ToolManagementHandler: 工具 CRUD 操作
 * - ToolControlHandler: 工具状态控制（启用/禁用/切换）
 * - ToolValidationService: 工具验证逻辑
 *
 * 本类作为聚合器，组合所有子处理器，保持 API 向后兼容。
 */
export class MCPToolHandler {
  private toolCallHandler: ToolCallHandler;
  private toolListHandler: ToolListHandler;
  private toolManagementHandler: ToolManagementHandler;
  private toolControlHandler: ToolControlHandler;

  constructor() {
    const validationService = new ToolValidationService();
    this.toolCallHandler = new ToolCallHandler();
    this.toolListHandler = new ToolListHandler();
    this.toolManagementHandler = new ToolManagementHandler(validationService);
    this.toolControlHandler = new ToolControlHandler(validationService);
  }

  /**
   * 调用 MCP 工具
   * POST /api/tools/call
   */
  async callTool(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolCallHandler.callTool(c);
  }

  /**
   * 获取自定义 MCP 工具列表
   * GET /api/tools/custom
   */
  async getCustomTools(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolListHandler.getCustomTools(c);
  }

  /**
   * 获取可用工具列表
   * GET /api/tools/list
   */
  async listTools(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolListHandler.listTools(c);
  }

  /**
   * 获取服务工具列表
   * POST /api/tools/mcp/list
   */
  async listMCPTools(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolListHandler.listMCPTools(c);
  }

  /**
   * 添加自定义 MCP 工具
   * POST /api/tools/custom
   */
  async addCustomTool(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolManagementHandler.addCustomTool(c);
  }

  /**
   * 更新自定义 MCP 工具配置
   * PUT /api/tools/custom/:toolName
   */
  async updateCustomTool(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolManagementHandler.updateCustomTool(c);
  }

  /**
   * 删除自定义 MCP 工具
   * DELETE /api/tools/custom/:toolName
   */
  async removeCustomTool(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolManagementHandler.removeCustomTool(c);
  }

  /**
   * 统一的 MCP 工具管理接口
   * POST /api/tools/mcp/manage
   */
  async manageMCPTool(c: import("hono").Context<import("@/types/hono.context.js").AppContext>): Promise<Response> {
    return this.toolControlHandler.manageMCPTool(c);
  }
}
