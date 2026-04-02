/**
 * MCP 工具调用 API 处理器
 * 处理通过 HTTP API 调用 MCP 工具的请求
 *
 * 该模块采用组合模式，将不同职责委托给专门的处理器：
 * - CallHandler: 工具调用处理
 * - ListHandler: 工具列表查询
 * - CustomHandler: 自定义工具 CRUD
 * - ManageHandler: MCP 工具管理
 */

import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";
import { CallHandler } from "./call.handler.js";
import { CustomHandler } from "./custom.handler.js";
import { ListHandler } from "./list.handler.js";
import { ManageHandler } from "./manage.handler.js";

/**
 * MCP 工具调用 API 处理器
 *
 * 该类作为统一入口，将请求委托给各个专门的处理器处理。
 * 保持向后兼容性，所有公共 API 保持不变。
 */
export class MCPToolHandler {
  private callHandler: CallHandler;
  private listHandler: ListHandler;
  private customHandler: CustomHandler;
  private manageHandler: ManageHandler;

  constructor() {
    this.callHandler = new CallHandler();
    this.listHandler = new ListHandler();
    this.customHandler = new CustomHandler();
    this.manageHandler = new ManageHandler();
  }

  /**
   * 调用 MCP 工具
   * POST /api/tools/call
   */
  async callTool(c: Context<AppContext>): Promise<Response> {
    return this.callHandler.callTool(c);
  }

  /**
   * 获取自定义 MCP 工具列表
   * GET /api/tools/custom
   */
  async getCustomTools(c: Context<AppContext>): Promise<Response> {
    return this.listHandler.getCustomTools(c);
  }

  /**
   * 获取可用工具列表
   * GET /api/tools/list?status=enabled|disabled|all&sortBy=name
   */
  async listTools(c: Context<AppContext>): Promise<Response> {
    return this.listHandler.listTools(c);
  }

  /**
   * 添加自定义 MCP 工具
   * POST /api/tools/custom
   */
  async addCustomTool(c: Context<AppContext>): Promise<Response> {
    return this.customHandler.addCustomTool(c);
  }

  /**
   * 更新自定义 MCP 工具配置
   * PUT /api/tools/custom/:toolName
   */
  async updateCustomTool(c: Context<AppContext>): Promise<Response> {
    return this.customHandler.updateCustomTool(c);
  }

  /**
   * 删除自定义 MCP 工具
   * DELETE /api/tools/custom/:toolName
   */
  async removeCustomTool(c: Context<AppContext>): Promise<Response> {
    return this.customHandler.removeCustomTool(c);
  }

  /**
   * 统一的 MCP 工具管理接口
   * POST /api/tools/mcp/manage
   */
  async manageMCPTool(c: Context<AppContext>): Promise<Response> {
    return this.manageHandler.manageMCPTool(c);
  }

  /**
   * 获取服务工具列表
   * POST /api/tools/mcp/list
   */
  async listMCPTools(c: Context<AppContext>): Promise<Response> {
    return this.manageHandler.listMCPTools(c);
  }
}

// 导出各个子处理器，以便单独使用
export { CallHandler } from "./call.handler.js";
export { ListHandler } from "./list.handler.js";
export { CustomHandler } from "./custom.handler.js";
export { ManageHandler } from "./manage.handler.js";

// 导出工具函数
export * from "./utils/index.js";
