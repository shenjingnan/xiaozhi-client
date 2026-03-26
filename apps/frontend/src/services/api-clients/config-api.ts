/**
 * 配置管理 API 客户端
 * 负责所有配置相关的操作
 */

import type { AppConfig } from "@xiaozhi-client/shared-types";
import { type ApiResponse, HttpClient } from "./http-client";

/**
 * 提示词文件信息接口
 */
export interface PromptFileInfo {
  /** 文件名 */
  fileName: string;
  /** 相对路径（相对于配置文件所在目录） */
  relativePath: string;
}

/**
 * 配置管理 API 客户端
 */
export class ConfigApiClient extends HttpClient {
  /**
   * 获取完整配置
   */
  async getConfig(): Promise<AppConfig> {
    const response: ApiResponse<AppConfig> = await this.request("/api/config");
    if (!response.success || !response.data) {
      throw new Error("获取配置失败");
    }
    return response.data;
  }

  /**
   * 更新配置
   */
  async updateConfig(config: AppConfig): Promise<void> {
    const response: ApiResponse = await this.request("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });

    if (!response.success) {
      throw new Error(response.error?.message || "配置更新失败");
    }
  }

  /**
   * 获取 MCP 端点
   */
  async getMcpEndpoint(): Promise<string> {
    const response: ApiResponse<{ endpoint: string }> = await this.request(
      "/api/config/mcp-endpoint"
    );
    if (!response.success || !response.data) {
      throw new Error("获取 MCP 端点失败");
    }
    return response.data.endpoint;
  }

  /**
   * 获取 MCP 端点列表
   */
  async getMcpEndpoints(): Promise<string[]> {
    const response: ApiResponse<{ endpoints: string[] }> = await this.request(
      "/api/config/mcp-endpoints"
    );
    if (!response.success || !response.data) {
      throw new Error("获取 MCP 端点列表失败");
    }
    return response.data.endpoints;
  }

  /**
   * 获取 MCP 服务配置
   */
  async getMcpServers(): Promise<Record<string, any>> {
    const response: ApiResponse<{ servers: Record<string, any> }> =
      await this.request("/api/config/mcp-servers");
    if (!response.success || !response.data) {
      throw new Error("获取 MCP 服务配置失败");
    }
    return response.data.servers;
  }

  /**
   * 获取连接配置
   */
  async getConnectionConfig(): Promise<any> {
    const response: ApiResponse<{ connection: any }> = await this.request(
      "/api/config/connection"
    );
    if (!response.success || !response.data) {
      throw new Error("获取连接配置失败");
    }
    return response.data.connection;
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<AppConfig> {
    const response: ApiResponse<AppConfig> = await this.request(
      "/api/config/reload",
      { method: "POST" }
    );
    if (!response.success || !response.data) {
      throw new Error("重新加载配置失败");
    }
    return response.data;
  }

  /**
   * 获取配置文件路径
   */
  async getConfigPath(): Promise<string> {
    const response: ApiResponse<{ path: string }> =
      await this.request("/api/config/path");
    if (!response.success || !response.data) {
      throw new Error("获取配置文件路径失败");
    }
    return response.data.path;
  }

  /**
   * 检查配置是否存在
   */
  async checkConfigExists(): Promise<boolean> {
    const response: ApiResponse<{ exists: boolean }> =
      await this.request("/api/config/exists");
    if (!response.success || response.data?.exists === undefined) {
      throw new Error("检查配置是否存在失败");
    }
    return response.data.exists;
  }

  /**
   * 获取提示词文件列表
   */
  async getPromptFiles(): Promise<PromptFileInfo[]> {
    const response: ApiResponse<{ prompts: PromptFileInfo[] }> =
      await this.request("/api/config/prompts");
    if (!response.success || !response.data) {
      throw new Error("获取提示词文件列表失败");
    }
    return response.data.prompts;
  }

  /**
   * 获取提示词文件内容
   */
  async getPromptFileContent(
    path: string
  ): Promise<{ fileName: string; relativePath: string; content: string }> {
    const response: ApiResponse<{
      fileName: string;
      relativePath: string;
      content: string;
    }> = await this.request(
      `/api/config/prompts/content?path=${encodeURIComponent(path)}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "获取提示词文件内容失败");
    }
    return response.data;
  }

  /**
   * 更新提示词文件内容
   */
  async updatePromptFileContent(
    path: string,
    content: string
  ): Promise<{ fileName: string; relativePath: string; content: string }> {
    const response: ApiResponse<{
      fileName: string;
      relativePath: string;
      content: string;
    }> = await this.request("/api/config/prompts/content", {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    });
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "更新提示词文件内容失败");
    }
    return response.data;
  }

  /**
   * 创建新的提示词文件
   */
  async createPromptFile(
    fileName: string,
    content: string
  ): Promise<{ fileName: string; relativePath: string; content: string }> {
    const response: ApiResponse<{
      fileName: string;
      relativePath: string;
      content: string;
    }> = await this.request("/api/config/prompts/content", {
      method: "POST",
      body: JSON.stringify({ fileName, content }),
    });
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "创建提示词文件失败");
    }
    return response.data;
  }

  /**
   * 删除提示词文件
   */
  async deletePromptFile(path: string): Promise<void> {
    const response: ApiResponse = await this.request(
      `/api/config/prompts/content?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
      }
    );
    if (!response.success) {
      throw new Error(response.error?.message || "删除提示词文件失败");
    }
  }
}
