/**
 * MCP 服务器管理 API 客户端
 * 负责所有 MCP 服务器相关的操作
 */

import type {
  MCPServerAddRequest,
  MCPServerConfig,
  MCPServerListResponse,
  MCPServerStatus,
} from "@xiaozhi-client/shared-types";
import { type ApiResponse, HttpClient } from "./http-client";

/**
 * MCP 服务器管理 API 客户端
 */
export class MCPServerApiClient extends HttpClient {
  /**
   * 添加 MCP 服务器
   * POST /api/mcp-servers
   */
  async addMCPServer(
    name: string,
    config: MCPServerConfig
  ): Promise<MCPServerStatus> {
    const requestData: MCPServerAddRequest = { name, config };

    const response: ApiResponse<MCPServerStatus> = await this.request(
      "/api/mcp-servers",
      {
        method: "POST",
        body: JSON.stringify(requestData),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "添加 MCP 服务器失败");
    }

    return response.data;
  }

  /**
   * 删除 MCP 服务器
   * DELETE /api/mcp-servers/:serverName
   */
  async removeMCPServer(
    serverName: string
  ): Promise<{ name: string; operation: string; affectedTools: string[] }> {
    const response: ApiResponse<{
      name: string;
      operation: string;
      affectedTools: string[];
    }> = await this.request(
      `/api/mcp-servers/${encodeURIComponent(serverName)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "删除 MCP 服务器失败");
    }

    return response.data;
  }

  /**
   * 获取 MCP 服务器状态
   * GET /api/mcp-servers/:serverName/status
   */
  async getMCPServerStatus(serverName: string): Promise<MCPServerStatus> {
    const response: ApiResponse<MCPServerStatus> = await this.request(
      `/api/mcp-servers/${encodeURIComponent(serverName)}/status`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "获取 MCP 服务器状态失败");
    }

    return response.data;
  }

  /**
   * 获取所有 MCP 服务器列表
   * GET /api/mcp-servers
   */
  async listMCPServers(): Promise<MCPServerListResponse> {
    const response: ApiResponse<MCPServerListResponse> =
      await this.request("/api/mcp-servers");

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "获取 MCP 服务器列表失败");
    }

    return response.data;
  }

  /**
   * 检查 MCP 服务器是否存在
   * GET /api/mcp-servers/:serverName/exists
   */
  async checkMCPServerExists(serverName: string): Promise<boolean> {
    try {
      const response: ApiResponse<{ exists: boolean }> = await this.request(
        `/api/mcp-servers/${encodeURIComponent(serverName)}/exists`
      );

      return response.success ? response.data?.exists || false : false;
    } catch (error) {
      // 如果返回 404，说明服务器不存在
      if (error instanceof Error && error.message.includes("404")) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 更新 MCP 服务器配置
   * PUT /api/mcp-servers/:serverName
   */
  async updateMCPServer(
    serverName: string,
    config: MCPServerConfig
  ): Promise<MCPServerStatus> {
    const response: ApiResponse<MCPServerStatus> = await this.request(
      `/api/mcp-servers/${encodeURIComponent(serverName)}`,
      {
        method: "PUT",
        body: JSON.stringify({ config }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "更新 MCP 服务器配置失败");
    }

    return response.data;
  }

  /**
   * 调用 MCP 工具
   * POST /api/tools/call
   */
  async callTool(
    serviceName: string,
    toolName: string,
    args: any = {}
  ): Promise<any> {
    const response: ApiResponse = await this.request("/api/tools/call", {
      method: "POST",
      body: JSON.stringify({
        serviceName,
        toolName,
        args,
      }),
    });

    if (!response.success) {
      throw new Error(response.error?.message || "调用工具失败");
    }

    return response.data;
  }

  /**
   * 重启 MCP 服务器
   * POST /api/mcp-servers/:serverName/restart
   */
  async restartMCPServer(serverName: string): Promise<MCPServerStatus> {
    const response: ApiResponse<MCPServerStatus> = await this.request(
      `/api/mcp-servers/${encodeURIComponent(serverName)}/restart`,
      {
        method: "POST",
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "重启 MCP 服务器失败");
    }

    return response.data;
  }
}
