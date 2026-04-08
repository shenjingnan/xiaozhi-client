/**
 * 统一的 HTTP API 客户端
 * 负责所有的配置管理、状态查询和服务控制操作
 *
 * @deprecated 推荐直接使用具体的 API 客户端类
 * @example
 * import { ConfigApiClient, StatusApiClient } from './services/api-clients';
 * const configClient = new ConfigApiClient();
 * const statusClient = new StatusApiClient();
 */

import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  AppConfig,
  ClientStatus,
  CustomMCPToolWithStats,
  MCPErrorCode,
  MCPServerAddRequest,
  MCPServerConfig,
  MCPServerListResponse,
  MCPServerStatus,
  VoicesResponse,
} from "@xiaozhi-client/shared-types";

import {
  ConfigApiClient,
  type CustomMCPTool,
  EndpointApiClient,
  type EndpointStatusResponse,
  type FullStatus,
  MCPServerApiClient,
  MCPToolApiClient,
  type MCPToolListRequest,
  type MCPToolListResponse,
  type MCPToolManageRequest,
  type MCPToolManageResponse,
  type PromptFileInfo,
  type RestartStatus,
  ServiceControlApiClient,
  type ServiceHealth,
  type ServiceStatus,
  StatusApiClient,
  ToolApiClient,
  VersionApiClient,
  type VersionInfo,
} from "./api-clients";

// 重新导出所有类型以保持向后兼容
export type {
  ApiErrorResponse,
  ApiSuccessResponse,
  AppConfig,
  ClientStatus,
  CustomMCPToolWithStats,
  MCPErrorCode,
  MCPServerAddRequest,
  MCPServerConfig,
  MCPServerListResponse,
  MCPServerStatus,
  VoicesResponse,
};

// 重新导出 API 客户端类型
export type {
  PromptFileInfo,
  RestartStatus,
  FullStatus,
  VersionInfo,
  EndpointStatusResponse,
  ServiceStatus,
  ServiceHealth,
  CustomMCPTool,
  MCPToolManageRequest,
  MCPToolManageResponse,
  MCPToolListRequest,
  MCPToolListResponse,
};

/**
 * API 响应格式（向后兼容）
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 统一的 API 客户端门面类
 * 将所有 API 客户端组合在一起，提供向后兼容的接口
 *
 * @deprecated 推荐直接使用具体的 API 客户端类
 * @see {@link ./api-clients/index.ts} 获取独立的 API 客户端类
 */
export class ApiClient {
  private config: ConfigApiClient;
  private status: StatusApiClient;
  private tool: ToolApiClient;
  private service: ServiceControlApiClient;
  private version: VersionApiClient;
  private endpoint: EndpointApiClient;
  private mcpServer: MCPServerApiClient;
  private mcpTool: MCPToolApiClient;

  constructor(baseUrl?: string) {
    this.config = new ConfigApiClient(baseUrl);
    this.status = new StatusApiClient(baseUrl);
    this.tool = new ToolApiClient(baseUrl);
    this.service = new ServiceControlApiClient(baseUrl);
    this.version = new VersionApiClient(baseUrl);
    this.endpoint = new EndpointApiClient(baseUrl);
    this.mcpServer = new MCPServerApiClient(baseUrl);
    this.mcpTool = new MCPToolApiClient(baseUrl);
  }

  // ==================== 配置管理 API ====================

  /**
   * 获取完整配置
   */
  async getConfig(): Promise<AppConfig> {
    return this.config.getConfig();
  }

  /**
   * 更新配置
   */
  async updateConfig(config: AppConfig): Promise<void> {
    return this.config.updateConfig(config);
  }

  /**
   * 获取 MCP 端点
   */
  async getMcpEndpoint(): Promise<string> {
    return this.config.getMcpEndpoint();
  }

  /**
   * 获取 MCP 端点列表
   */
  async getMcpEndpoints(): Promise<string[]> {
    return this.config.getMcpEndpoints();
  }

  /**
   * 获取 MCP 服务配置
   */
  async getMcpServers(): Promise<Record<string, any>> {
    return this.config.getMcpServers();
  }

  /**
   * 获取连接配置
   */
  async getConnectionConfig(): Promise<any> {
    return this.config.getConnectionConfig();
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<AppConfig> {
    return this.config.reloadConfig();
  }

  /**
   * 获取配置文件路径
   */
  async getConfigPath(): Promise<string> {
    return this.config.getConfigPath();
  }

  /**
   * 检查配置是否存在
   */
  async checkConfigExists(): Promise<boolean> {
    return this.config.checkConfigExists();
  }

  /**
   * 获取提示词文件列表
   */
  async getPromptFiles(): Promise<PromptFileInfo[]> {
    return this.config.getPromptFiles();
  }

  /**
   * 获取提示词文件内容
   */
  async getPromptFileContent(
    path: string
  ): Promise<{ fileName: string; relativePath: string; content: string }> {
    return this.config.getPromptFileContent(path);
  }

  /**
   * 更新提示词文件内容
   */
  async updatePromptFileContent(
    path: string,
    content: string
  ): Promise<{ fileName: string; relativePath: string; content: string }> {
    return this.config.updatePromptFileContent(path, content);
  }

  /**
   * 创建新的提示词文件
   */
  async createPromptFile(
    fileName: string,
    content: string
  ): Promise<{ fileName: string; relativePath: string; content: string }> {
    return this.config.createPromptFile(fileName, content);
  }

  /**
   * 删除提示词文件
   */
  async deletePromptFile(path: string): Promise<void> {
    return this.config.deletePromptFile(path);
  }

  // ==================== 状态管理 API ====================

  /**
   * 获取完整状态
   */
  async getStatus(): Promise<FullStatus> {
    return this.status.getStatus();
  }

  /**
   * 获取客户端状态
   */
  async getClientStatus(): Promise<ClientStatus> {
    return this.status.getClientStatus();
  }

  /**
   * 获取重启状态
   */
  async getRestartStatus(): Promise<RestartStatus | null> {
    return this.status.getRestartStatus();
  }

  /**
   * 检查客户端是否连接
   */
  async checkClientConnected(): Promise<boolean> {
    return this.status.checkClientConnected();
  }

  /**
   * 获取最后心跳时间
   */
  async getLastHeartbeat(): Promise<number | null> {
    return this.status.getLastHeartbeat();
  }

  /**
   * 获取活跃的 MCP 服务器列表
   */
  async getActiveMCPServers(): Promise<string[]> {
    return this.status.getActiveMCPServers();
  }

  /**
   * 更新客户端状态
   */
  async updateClientStatus(status: Partial<ClientStatus>): Promise<void> {
    return this.status.updateClientStatus(status);
  }

  /**
   * 设置活跃的 MCP 服务器列表
   */
  async setActiveMCPServers(servers: string[]): Promise<void> {
    return this.status.setActiveMCPServers(servers);
  }

  /**
   * 重置状态
   */
  async resetStatus(): Promise<void> {
    return this.status.resetStatus();
  }

  // ==================== 工具管理 API ====================

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
    return this.tool.addCustomTool(
      param1,
      customName,
      customDescription,
      parameterConfig
    );
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
    return this.tool.updateCustomTool(toolName, updateRequest);
  }

  /**
   * 删除自定义工具
   */
  async removeCustomTool(toolName: string): Promise<void> {
    return this.tool.removeCustomTool(toolName);
  }

  /**
   * 获取自定义工具列表
   */
  async getCustomTools(): Promise<any[]> {
    return this.tool.getCustomTools();
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
    return this.tool.getToolsList(status, sortConfig);
  }

  // ==================== 服务控制 API ====================

  /**
   * 重启服务
   */
  async restartService(): Promise<void> {
    return this.service.restartService();
  }

  /**
   * 停止服务
   */
  async stopService(): Promise<void> {
    return this.service.stopService();
  }

  /**
   * 启动服务
   */
  async startService(): Promise<void> {
    return this.service.startService();
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    return this.service.getServiceStatus();
  }

  /**
   * 获取服务健康状态
   */
  async getServiceHealth(): Promise<ServiceHealth> {
    return this.service.getServiceHealth();
  }

  // ==================== 版本信息 API ====================

  /**
   * 获取 TTS 音色列表
   */
  async getTTSVoices(): Promise<VoicesResponse> {
    return this.version.getTTSVoices();
  }

  /**
   * 获取版本信息
   */
  async getVersion(): Promise<VersionInfo> {
    return this.version.getVersion();
  }

  /**
   * 获取版本号（简化接口）
   */
  async getVersionSimple(): Promise<{ version: string }> {
    return this.version.getVersionSimple();
  }

  /**
   * 获取可用版本列表
   * @param type 版本类型：'stable'（正式版）、'rc'（预览版）、'beta'（测试版）、'all'（全部）
   */
  async getAvailableVersions(
    type: "stable" | "rc" | "beta" | "all" = "stable"
  ): Promise<{
    versions: string[];
    type: string;
    total: number;
  }> {
    return this.version.getAvailableVersions(type);
  }

  /**
   * 检查最新版本
   * 返回当前版本、最新版本以及是否有更新
   */
  async getLatestVersion(): Promise<{
    currentVersion: string;
    latestVersion: string | null;
    hasUpdate: boolean;
    error?: string;
  }> {
    return this.version.getLatestVersion();
  }

  /**
   * 清除版本缓存
   */
  async clearVersionCache(): Promise<void> {
    return this.version.clearVersionCache();
  }

  /**
   * 更新版本
   */
  async updateVersion(version: string): Promise<any> {
    return this.version.updateVersion(version);
  }

  // ==================== 端点管理 API ====================

  /**
   * 获取接入点状态
   */
  async getEndpointStatus(endpoint: string): Promise<EndpointStatusResponse> {
    return this.endpoint.getEndpointStatus(endpoint);
  }

  /**
   * 连接接入点
   */
  async connectEndpoint(endpoint: string): Promise<void> {
    return this.endpoint.connectEndpoint(endpoint);
  }

  /**
   * 断开接入点
   */
  async disconnectEndpoint(endpoint: string): Promise<void> {
    return this.endpoint.disconnectEndpoint(endpoint);
  }

  /**
   * 重连接入点
   */
  async reconnectEndpoint(endpoint: string): Promise<void> {
    return this.endpoint.reconnectEndpoint(endpoint);
  }

  /**
   * 添加新接入点
   */
  async addEndpoint(endpoint: string): Promise<EndpointStatusResponse> {
    return this.endpoint.addEndpoint(endpoint);
  }

  /**
   * 移除接入点
   */
  async removeEndpoint(endpoint: string): Promise<void> {
    return this.endpoint.removeEndpoint(endpoint);
  }

  // ==================== MCP 服务器管理 API ====================

  /**
   * 添加 MCP 服务器
   * POST /api/mcp-servers
   */
  async addMCPServer(
    name: string,
    config: MCPServerConfig
  ): Promise<MCPServerStatus> {
    return this.mcpServer.addMCPServer(name, config);
  }

  /**
   * 删除 MCP 服务器
   * DELETE /api/mcp-servers/:serverName
   */
  async removeMCPServer(
    serverName: string
  ): Promise<{ name: string; operation: string; affectedTools: string[] }> {
    return this.mcpServer.removeMCPServer(serverName);
  }

  /**
   * 获取 MCP 服务器状态
   * GET /api/mcp-servers/:serverName/status
   */
  async getMCPServerStatus(serverName: string): Promise<MCPServerStatus> {
    return this.mcpServer.getMCPServerStatus(serverName);
  }

  /**
   * 获取所有 MCP 服务器列表
   * GET /api/mcp-servers
   */
  async listMCPServers(): Promise<MCPServerListResponse> {
    return this.mcpServer.listMCPServers();
  }

  /**
   * 检查 MCP 服务器是否存在
   * GET /api/mcp-servers/:serverName/exists
   */
  async checkMCPServerExists(serverName: string): Promise<boolean> {
    return this.mcpServer.checkMCPServerExists(serverName);
  }

  /**
   * 更新 MCP 服务器配置
   * PUT /api/mcp-servers/:serverName
   */
  async updateMCPServer(
    serverName: string,
    config: MCPServerConfig
  ): Promise<MCPServerStatus> {
    return this.mcpServer.updateMCPServer(serverName, config);
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
    return this.mcpServer.callTool(serviceName, toolName, args);
  }

  /**
   * 重启 MCP 服务器
   * POST /api/mcp-servers/:serverName/restart
   */
  async restartMCPServer(serverName: string): Promise<MCPServerStatus> {
    return this.mcpServer.restartMCPServer(serverName);
  }

  // ==================== MCP 工具管理 API ====================

  /**
   * 管理 MCP 工具（启用/禁用/查询状态/切换）
   * POST /api/tools/mcp/manage
   * @param request 管理请求
   * @returns 工具状态信息
   */
  async manageMCPTool(
    request: MCPToolManageRequest
  ): Promise<MCPToolManageResponse> {
    return this.mcpTool.manageMCPTool(request);
  }

  /**
   * 获取 MCP 工具列表
   * POST /api/tools/mcp/list
   * @param request 列表请求（可选）
   * @returns 工具列表信息
   */
  async listMCPTools(
    request?: MCPToolListRequest
  ): Promise<MCPToolListResponse> {
    return this.mcpTool.listMCPTools(request);
  }
}

// 创建默认的 API 客户端实例
export const apiClient = new ApiClient();

// 导出 API 响应格式（向后兼容）
export type { ApiResponse };

// 导出独立的 API 客户端类（推荐使用）
export {
  ConfigApiClient,
  StatusApiClient,
  ToolApiClient,
  ServiceControlApiClient,
  VersionApiClient,
  EndpointApiClient,
  MCPServerApiClient,
  MCPToolApiClient,
} from "./api-clients";
