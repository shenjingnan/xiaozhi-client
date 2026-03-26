/**
 * 工具管理 API 客户端
 * 负责所有自定义工具相关的操作
 */

import type { CustomMCPToolWithStats } from "@xiaozhi-client/shared-types";
import { type ApiResponse, HttpClient } from "./http-client";

/**
 * CustomMCPTool 接口定义
 * 使用共享类型，与后端保持一致
 */
export type CustomMCPTool = CustomMCPToolWithStats;

/**
 * 工具管理 API 客户端
 */
export class ToolApiClient extends HttpClient {
  /**
   * 添加自定义工具
   * 支持新的类型化格式和向后兼容的旧格式
   */
  async addCustomTool(
    workflow: any,
    customName?: string,
    customDescription?: string,
    parameterConfig?: any
  ): Promise<any>;

  /**
   * 添加自定义工具（新格式）
   * 支持多种工具类型：MCP 工具、Coze 工作流等
   */
  async addCustomTool(request: {
    type: "mcp" | "coze" | "http" | "function";
    data: any;
  }): Promise<any>;

  async addCustomTool(
    param1: any,
    customName?: string,
    customDescription?: string,
    parameterConfig?: any
  ): Promise<any> {
    // 判断是否为新格式调用
    if (typeof param1 === "object" && "type" in param1 && "data" in param1) {
      // 新格式：类型化请求
      const response: ApiResponse<{ tool: any }> = await this.request(
        "/api/tools/custom",
        {
          method: "POST",
          body: JSON.stringify(param1),
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "添加自定义工具失败");
      }
      return response.data.tool;
    }
    // 旧格式：向后兼容
    const workflow = param1;
    const response: ApiResponse<{ tool: any }> = await this.request(
      "/api/tools/custom",
      {
        method: "POST",
        body: JSON.stringify({
          workflow,
          customName,
          customDescription,
          parameterConfig,
        }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "添加自定义工具失败");
    }
    return response.data.tool;
  }

  /**
   * 更新自定义工具配置
   * @param toolName 工具名称
   * @param updateRequest 更新请求
   */
  async updateCustomTool(
    toolName: string,
    updateRequest: {
      type: "mcp" | "coze" | "http" | "function";
      data: any;
    }
  ): Promise<any> {
    const response: ApiResponse<{ tool: any }> = await this.request(
      `/api/tools/custom/${encodeURIComponent(toolName)}`,
      {
        method: "PUT",
        body: JSON.stringify(updateRequest),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "更新自定义工具失败");
    }
    return response.data.tool;
  }

  /**
   * 删除自定义工具
   */
  async removeCustomTool(toolName: string): Promise<void> {
    const response: ApiResponse = await this.request(
      `/api/tools/custom/${encodeURIComponent(toolName)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.success) {
      throw new Error(response.error?.message || "删除自定义工具失败");
    }
  }

  /**
   * 获取自定义工具列表
   */
  async getCustomTools(): Promise<any[]> {
    const response: ApiResponse<{ tools: any[] }> =
      await this.request("/api/tools/custom");
    if (!response.success || !response.data) {
      throw new Error("获取自定义工具列表失败");
    }
    return response.data.tools;
  }

  /**
   * 获取工具列表
   * 调用 /api/tools/list 端点，返回 { list: CustomMCPTool[], total: number } 格式
   * @param status 筛选状态：'enabled'（已启用）、'disabled'（未启用）、'all'（全部，默认）
   * @param sortConfig 排序配置：可选的排序字段
   */
  async getToolsList(
    status: "enabled" | "disabled" | "all" = "all",
    sortConfig?: { field: string }
  ): Promise<CustomMCPToolWithStats[]> {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (status !== "all") {
      queryParams.append("status", status);
    }

    // 添加排序参数
    if (sortConfig) {
      queryParams.append("sortBy", sortConfig.field);
    }

    const url = `/api/tools/list${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const response: ApiResponse<{ list: CustomMCPTool[]; total: number }> =
      await this.request(url);
    if (!response.success || !response.data) {
      throw new Error("获取工具列表失败");
    }
    return response.data.list;
  }
}
