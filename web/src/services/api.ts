/**
 * 统一的 HTTP API 客户端
 * 负责所有的配置管理、状态查询和服务控制操作
 */

import type { AppConfig, ClientStatus } from "../types";

/**
 * CustomMCPTool 接口定义
 * 对应后端的 CustomMCPTool 接口
 */
export interface CustomMCPTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: {
    type: "mcp" | "proxy";
    platform?: "coze";
    config: {
      serviceName: string;
      toolName: string;
    };
  };
  stats?: {
    usageCount?: number;
    lastUsedTime?: string;
  };
}

/**
 * API 响应格式
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * 服务状态接口
 */
interface ServiceStatus {
  running: boolean;
  mode?: string;
  pid?: number;
}

/**
 * 服务健康状态接口
 */
interface ServiceHealth {
  status: string;
  timestamp: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  version: string;
}

/**
 * 版本信息接口
 */
interface VersionInfo {
  name: string;
  version: string;
  description: string;
  author: string;
}

/**
 * 重启状态接口
 */
interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * 接入点状态响应接口
 */
interface EndpointStatusResponse {
  endpoint: string;
  connected: boolean;
  initialized: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  nextReconnectTime?: number;
  reconnectDelay: number;
}

/**
 * 完整状态接口
 */
interface FullStatus {
  client: ClientStatus;
  restart?: RestartStatus;
  timestamp: number;
}

/**
 * HTTP API 客户端类
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // 从当前页面 URL 推断 API 基础 URL
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      this.baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    }
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData: ApiErrorResponse = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // 如果无法解析错误响应，使用默认错误消息
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  // ==================== 配置管理 API ====================

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
      throw new Error(response.message || "配置更新失败");
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
    const response: ApiResponse<{ path: string }> = await this.request(
      "/api/config/path"
    );
    if (!response.success || !response.data) {
      throw new Error("获取配置文件路径失败");
    }
    return response.data.path;
  }

  /**
   * 检查配置是否存在
   */
  async checkConfigExists(): Promise<boolean> {
    const response: ApiResponse<{ exists: boolean }> = await this.request(
      "/api/config/exists"
    );
    if (!response.success || response.data?.exists === undefined) {
      throw new Error("检查配置是否存在失败");
    }
    return response.data.exists;
  }

  // ==================== 状态管理 API ====================

  /**
   * 获取完整状态
   */
  async getStatus(): Promise<FullStatus> {
    const response: ApiResponse<FullStatus> = await this.request("/api/status");
    if (!response.success || !response.data) {
      throw new Error("获取状态失败");
    }
    return response.data;
  }

  /**
   * 获取客户端状态
   */
  async getClientStatus(): Promise<ClientStatus> {
    const response: ApiResponse<ClientStatus> = await this.request(
      "/api/status/client"
    );
    if (!response.success || !response.data) {
      throw new Error("获取客户端状态失败");
    }
    return response.data;
  }

  /**
   * 获取重启状态
   */
  async getRestartStatus(): Promise<RestartStatus | null> {
    const response: ApiResponse<RestartStatus> = await this.request(
      "/api/status/restart"
    );
    if (!response.success) {
      throw new Error("获取重启状态失败");
    }
    return response.data || null;
  }

  /**
   * 检查客户端是否连接
   */
  async checkClientConnected(): Promise<boolean> {
    const response: ApiResponse<{ connected: boolean }> = await this.request(
      "/api/status/connected"
    );
    if (!response.success || response.data?.connected === undefined) {
      throw new Error("检查客户端连接失败");
    }
    return response.data.connected;
  }

  /**
   * 获取最后心跳时间
   */
  async getLastHeartbeat(): Promise<number | null> {
    const response: ApiResponse<{ lastHeartbeat?: number }> =
      await this.request("/api/status/heartbeat");
    if (!response.success) {
      throw new Error("获取最后心跳时间失败");
    }
    return response.data?.lastHeartbeat || null;
  }

  /**
   * 获取活跃的 MCP 服务器列表
   */
  async getActiveMCPServers(): Promise<string[]> {
    const response: ApiResponse<{ servers: string[] }> = await this.request(
      "/api/status/mcp-servers"
    );
    if (!response.success || !response.data) {
      throw new Error("获取活跃 MCP 服务器失败");
    }
    return response.data.servers;
  }

  /**
   * 更新客户端状态
   */
  async updateClientStatus(status: Partial<ClientStatus>): Promise<void> {
    const response: ApiResponse = await this.request("/api/status/client", {
      method: "PUT",
      body: JSON.stringify(status),
    });

    if (!response.success) {
      throw new Error(response.message || "更新客户端状态失败");
    }
  }

  /**
   * 设置活跃的 MCP 服务器列表
   */
  async setActiveMCPServers(servers: string[]): Promise<void> {
    const response: ApiResponse = await this.request(
      "/api/status/mcp-servers",
      {
        method: "PUT",
        body: JSON.stringify({ servers }),
      }
    );

    if (!response.success) {
      throw new Error(response.message || "设置活跃 MCP 服务器失败");
    }
  }

  /**
   * 重置状态
   */
  async resetStatus(): Promise<void> {
    const response: ApiResponse = await this.request("/api/status/reset", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.message || "重置状态失败");
    }
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
        throw new Error(response.message || "添加自定义工具失败");
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
      throw new Error(response.message || "添加自定义工具失败");
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
      throw new Error(response.message || "更新自定义工具失败");
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
      throw new Error(response.message || "删除自定义工具失败");
    }
  }

  /**
   * 获取自定义工具列表
   */
  async getCustomTools(): Promise<any[]> {
    const response: ApiResponse<{ tools: any[] }> = await this.request(
      "/api/tools/custom"
    );
    if (!response.success || !response.data) {
      throw new Error("获取自定义工具列表失败");
    }
    return response.data.tools;
  }

  /**
   * 获取工具列表
   * 调用 /api/tools/list 端点，返回 { list: CustomMCPTool[], total: number } 格式
   * @param status 筛选状态：'enabled'（已启用）、'disabled'（未启用）、'all'（全部，默认）
   */
  async getToolsList(
    status: "enabled" | "disabled" | "all" = "all"
  ): Promise<CustomMCPTool[]> {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (status !== "all") {
      queryParams.append("status", status);
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

  // ==================== 服务控制 API ====================

  /**
   * 重启服务
   */
  async restartService(): Promise<void> {
    const response: ApiResponse = await this.request("/api/services/restart", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.message || "重启服务失败");
    }
  }

  /**
   * 停止服务
   */
  async stopService(): Promise<void> {
    const response: ApiResponse = await this.request("/api/services/stop", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.message || "停止服务失败");
    }
  }

  /**
   * 启动服务
   */
  async startService(): Promise<void> {
    const response: ApiResponse = await this.request("/api/services/start", {
      method: "POST",
    });

    if (!response.success) {
      throw new Error(response.message || "启动服务失败");
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    const response: ApiResponse<ServiceStatus> = await this.request(
      "/api/services/status"
    );
    if (!response.success || !response.data) {
      throw new Error("获取服务状态失败");
    }
    return response.data;
  }

  /**
   * 获取服务健康状态
   */
  async getServiceHealth(): Promise<ServiceHealth> {
    const response: ApiResponse<ServiceHealth> = await this.request(
      "/api/services/health"
    );
    if (!response.success || !response.data) {
      throw new Error("获取服务健康状态失败");
    }
    return response.data;
  }

  // ==================== 版本信息 API ====================

  /**
   * 获取版本信息
   */
  async getVersion(): Promise<VersionInfo> {
    const response: ApiResponse<VersionInfo> = await this.request(
      "/api/version"
    );
    if (!response.success || !response.data) {
      throw new Error("获取版本信息失败");
    }
    return response.data;
  }

  /**
   * 获取版本号（简化接口）
   */
  async getVersionSimple(): Promise<{ version: string }> {
    const response: ApiResponse<{ version: string }> = await this.request(
      "/api/version/simple"
    );
    if (!response.success || !response.data) {
      throw new Error("获取版本号失败");
    }
    return response.data;
  }

  /**
   * 清除版本缓存
   */
  async clearVersionCache(): Promise<void> {
    const response: ApiResponse = await this.request(
      "/api/version/cache/clear",
      {
        method: "POST",
      }
    );
    if (!response.success) {
      throw new Error(response.message || "清除版本缓存失败");
    }
  }

  // ==================== 端点管理 API ====================

  /**
   * 获取接入点状态
   */
  async getEndpointStatus(endpoint: string): Promise<EndpointStatusResponse> {
    const response: ApiResponse<EndpointStatusResponse> = await this.request(
      `/api/endpoints/${encodeURIComponent(endpoint)}/status`
    );
    if (!response.success || !response.data) {
      throw new Error("获取接入点状态失败");
    }
    return response.data;
  }

  /**
   * 连接接入点
   */
  async connectEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request(
      `/api/endpoints/${encodeURIComponent(endpoint)}/connect`,
      { method: "POST" }
    );
    if (!response.success) {
      throw new Error(response.message || "连接接入点失败");
    }
  }

  /**
   * 断开接入点
   */
  async disconnectEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request(
      `/api/endpoints/${encodeURIComponent(endpoint)}/disconnect`,
      { method: "POST" }
    );
    if (!response.success) {
      throw new Error(response.message || "断开接入点失败");
    }
  }

  /**
   * 重连接入点
   */
  async reconnectEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request(
      `/api/endpoints/${encodeURIComponent(endpoint)}/reconnect`,
      { method: "POST" }
    );
    if (!response.success) {
      throw new Error(response.message || "重连接入点失败");
    }
  }

  /**
   * 添加新接入点
   */
  async addEndpoint(endpoint: string): Promise<EndpointStatusResponse> {
    const response: ApiResponse<EndpointStatusResponse> = await this.request(
      "/api/endpoints/add",
      {
        method: "POST",
        body: JSON.stringify({ endpoint }),
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || "添加接入点失败");
    }
    return response.data;
  }

  /**
   * 移除接入点
   */
  async removeEndpoint(endpoint: string): Promise<void> {
    const response: ApiResponse = await this.request(
      `/api/endpoints/${encodeURIComponent(endpoint)}`,
      { method: "DELETE" }
    );
    if (!response.success) {
      throw new Error(response.message || "移除接入点失败");
    }
  }
}

// 创建默认的 API 客户端实例
export const apiClient = new ApiClient();

// 导出类型
export type {
  ApiResponse,
  ApiErrorResponse,
  ServiceStatus,
  ServiceHealth,
  RestartStatus,
  FullStatus,
  VersionInfo,
  EndpointStatusResponse,
};
