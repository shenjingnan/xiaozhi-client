import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type { EventBus } from "@services/EventBus.js";
import { getEventBus } from "@services/EventBus.js";
import type { ConfigManager } from "@xiaozhi-client/config";
import type {
  ConnectionStatus,
  EndpointConfig,
  EndpointManager,
} from "@xiaozhi-client/endpoint";
import { Endpoint } from "@xiaozhi-client/endpoint";
import type { Context } from "hono";

/**
 * HTTP 状态码类型定义
 */
type HttpStatusCode =
  | 200 // OK
  | 400 // Bad Request
  | 401 // Unauthorized
  | 403 // Forbidden
  | 404 // Not Found
  | 409 // Conflict
  | 500 // Internal Server Error
  | 503; // Service Unavailable;

/**
 * 错误详情类型定义
 */
interface ErrorDetails {
  endpoint?: string;
  [key: string]: unknown;
}

/**
 * 统一响应格式接口
 */
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
}

interface ApiSuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 端点操作成功响应接口
 */
interface EndpointOperationResponse {
  success: boolean;
  message: string;
  data: {
    endpoint: string;
    status: ConnectionStatus;
    operation: "connect" | "disconnect" | "reconnect" | "add" | "remove";
  };
}

/**
 * 验证结果类型定义
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MCP 端点 API 处理器
 * 注意：此 API 处理器与当前的 EndpointManager 设计不兼容
 * 当前 EndpointManager 不支持通过 API 动态添加/删除端点
 * 这些端点操作需要在 EndpointManager 初始化时完成
 */
export class MCPEndpointApiHandler {
  private logger: Logger;
  private endpointManager: EndpointManager;
  private configManager: ConfigManager;
  private eventBus: EventBus;

  constructor(endpointManager: EndpointManager, configManager: ConfigManager) {
    this.logger = logger;
    this.endpointManager = endpointManager;
    this.configManager = configManager;
    this.eventBus = getEventBus();
  }

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(
    code: string,
    message: string,
    endpoint?: string,
    details?: Record<string, unknown>
  ): ApiErrorResponse {
    return {
      error: {
        code,
        message,
        details: endpoint ? { endpoint, ...details } : details,
      },
    };
  }

  /**
   * 创建统一的成功响应
   */
  private createSuccessResponse<T>(
    data?: T,
    message?: string
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 从请求体中解析端点参数
   * @param c Hono 上下文
   * @param errorErrorCode 错误码，用于区分不同操作的错误
   * @returns 解析结果，成功时包含 endpoint，失败时包含可直接返回的 Response
   */
  private async parseEndpointFromBody(
    c: Context,
    errorErrorCode: string
  ): Promise<
    { ok: true; endpoint: string } | { ok: false; response: Response }
  > {
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      const errorResponse = this.createErrorResponse(
        errorErrorCode,
        error instanceof Error ? error.message : "JSON解析失败"
      );
      return { ok: false, response: c.json(errorResponse, 500) };
    }

    const endpoint = body.endpoint;

    // 验证端点参数
    if (!endpoint || typeof endpoint !== "string") {
      const errorResponse = this.createErrorResponse(
        "INVALID_ENDPOINT",
        "端点参数无效",
        endpoint
      );
      return { ok: false, response: c.json(errorResponse, 400) };
    }

    return { ok: true, endpoint };
  }

  /**
   * 验证端点 URL 格式
   * @param endpoint 端点 URL
   * @returns 验证结果
   */
  private validateEndpoint(endpoint: string): ValidationResult {
    const errors: string[] = [];

    if (!endpoint || typeof endpoint !== "string") {
      errors.push("端点必须是非空字符串");
      return { isValid: false, errors };
    }

    try {
      new URL(endpoint);
    } catch {
      errors.push("端点 URL 格式无效");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 构建 Endpoint 配置
   * 从 ConfigManager 获取 mcpServers 和相关配置
   * @returns Endpoint 配置对象
   */
  private buildEndpointConfig(): EndpointConfig {
    const config = this.configManager.getConfig();
    const connectionConfig = config.connection || {};

    return {
      mcpServers: config.mcpServers || {},
      reconnectDelay: connectionConfig.reconnectInterval || 2000,
      modelscopeApiKey: config.modelscope?.apiKey,
    };
  }

  /**
   * 获取接入点状态
   * POST /api/endpoint/status
   */
  async getEndpointStatus(c: Context): Promise<Response> {
    const parseResult = await this.parseEndpointFromBody(
      c,
      "ENDPOINT_STATUS_READ_ERROR"
    );
    if (!parseResult.ok) {
      return parseResult.response;
    }

    const endpoint = parseResult.endpoint;
    this.logger.debug(`处理获取接入点状态请求: ${endpoint}`);
    try {
      // 获取连接状态
      const connectionStatus = this.endpointManager.getConnectionStatus();
      const endpointStatus = connectionStatus.find(
        (status: ConnectionStatus) => status.endpoint === endpoint
      );

      if (!endpointStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_FOUND",
          "端点不存在",
          endpoint
        );
        return c.json(errorResponse, 404);
      }

      this.logger.debug(`获取接入点状态成功: ${endpoint}`);
      return c.json(this.createSuccessResponse(endpointStatus));
    } catch (error) {
      this.logger.error("获取接入点状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取接入点状态失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 连接指定接入点
   * POST /api/endpoint/connect
   */
  async connectEndpoint(c: Context): Promise<Response> {
    const parseResult = await this.parseEndpointFromBody(
      c,
      "ENDPOINT_CONNECT_ERROR"
    );
    if (!parseResult.ok) {
      return parseResult.response;
    }

    const endpoint = parseResult.endpoint;
    this.logger.info(`处理接入点连接请求: ${endpoint}`);
    try {
      // 获取端点实例
      const endpointInstance = this.endpointManager.getEndpoint(endpoint);

      if (!endpointInstance) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_FOUND",
          "端点不存在，请先添加接入点",
          endpoint
        );
        return c.json(errorResponse, 404);
      }

      // 检查是否已连接
      if (endpointInstance.isConnected()) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_ALREADY_CONNECTED",
          "端点已连接",
          endpoint
        );
        return c.json(errorResponse, 409);
      }

      // 执行连接操作
      await endpointInstance.connect();

      // 获取连接后的状态
      const updatedConnectionStatus =
        this.endpointManager.getConnectionStatus();
      const endpointStatus = updatedConnectionStatus.find(
        (status: ConnectionStatus) => status.endpoint === endpoint
      );

      if (!endpointStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_STATUS_NOT_FOUND",
          "无法获取端点连接状态",
          endpoint
        );
        return c.json(errorResponse, 500);
      }

      // 发送连接成功事件
      this.eventBus.emitEvent("endpoint:status:changed", {
        endpoint,
        connected: true,
        operation: "connect",
        success: true,
        message: "接入点连接成功",
        timestamp: Date.now(),
        source: "http-api",
      });

      this.logger.info(`接入点连接成功: ${endpoint}`);
      const response = this.createSuccessResponse(endpointStatus);
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点连接失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_CONNECT_ERROR",
        error instanceof Error ? error.message : "接入点连接失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 断开指定接入点
   * POST /api/endpoint/disconnect
   */
  async disconnectEndpoint(c: Context): Promise<Response> {
    const parseResult = await this.parseEndpointFromBody(
      c,
      "ENDPOINT_DISCONNECT_ERROR"
    );
    if (!parseResult.ok) {
      return parseResult.response;
    }

    const endpoint = parseResult.endpoint;
    this.logger.info(`处理接入点断开请求: ${endpoint}`);
    try {
      // 获取端点实例
      const endpointInstance = this.endpointManager.getEndpoint(endpoint);

      if (!endpointInstance) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_FOUND",
          "端点不存在",
          endpoint
        );
        return c.json(errorResponse, 404);
      }

      // 检查是否已连接
      if (!endpointInstance.isConnected()) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_CONNECTED",
          "端点未连接",
          endpoint
        );
        return c.json(errorResponse, 409);
      }

      // 执行断开操作
      await endpointInstance.disconnect();

      // 获取断开后的状态
      const updatedConnectionStatus =
        this.endpointManager.getConnectionStatus();
      const endpointStatus = updatedConnectionStatus.find(
        (status: ConnectionStatus) => status.endpoint === endpoint
      );

      // 发送断开成功事件
      this.eventBus.emitEvent("endpoint:status:changed", {
        endpoint,
        connected: false,
        operation: "disconnect",
        success: true,
        message: "接入点断开成功",
        timestamp: Date.now(),
        source: "http-api",
      });

      this.logger.info(`接入点断开成功: ${endpoint}`);
      const fallbackStatus: ConnectionStatus = {
        endpoint,
        connected: false,
        initialized: true,
      };
      const response = this.createSuccessResponse(
        endpointStatus || fallbackStatus
      );
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点断开失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_DISCONNECT_ERROR",
        error instanceof Error ? error.message : "接入点断开失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 添加新接入点
   * POST /api/endpoint/add
   * 流程：验证 URL → 检查存在性 → 创建实例 → 添加到管理器 → 连接 → 更新配置
   */
  async addEndpoint(c: Context): Promise<Response> {
    const parseResult = await this.parseEndpointFromBody(
      c,
      "ENDPOINT_ADD_ERROR"
    );
    if (!parseResult.ok) {
      return parseResult.response;
    }

    const endpoint = parseResult.endpoint;
    this.logger.info(`处理接入点添加请求: ${endpoint}`);

    try {
      // 1. 验证端点 URL 格式
      const validation = this.validateEndpoint(endpoint);
      if (!validation.isValid) {
        const errorResponse = this.createErrorResponse(
          "INVALID_ENDPOINT_FORMAT",
          validation.errors.join(", "),
          endpoint
        );
        return c.json(errorResponse, 400);
      }

      // 2. 检查端点是否已存在
      const existingEndpoint = this.endpointManager.getEndpoint(endpoint);
      if (existingEndpoint) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_ALREADY_EXISTS",
          "端点已存在",
          endpoint
        );
        return c.json(errorResponse, 409);
      }

      // 3. 构建 EndpointConfig
      const endpointConfig = this.buildEndpointConfig();

      // 4. 创建新的 Endpoint 实例
      const newEndpoint = new Endpoint(endpoint, endpointConfig);

      // 5. 添加到 EndpointManager
      this.endpointManager.addEndpoint(newEndpoint);
      this.logger.debug(`端点已添加到管理器: ${endpoint}`);

      // 6. 连接新端点（Endpoint 内部会自动使用 mcpServers 配置聚合工具）
      try {
        this.endpointManager.connectSingleEndpoint(endpoint, newEndpoint);
        this.logger.debug(`端点已连接: ${endpoint}`);
      } catch (connectError) {
        this.logger.warn(
          `端点连接失败，但已添加到管理器: ${endpoint}`,
          connectError
        );
        // 连接失败不中断流程，端点已添加但未连接
      }

      // 7. 更新配置文件
      try {
        this.configManager.addMcpEndpoint(endpoint);
        this.logger.debug(`端点已添加到配置文件: ${endpoint}`);
      } catch (configError) {
        this.logger.error(`添加端点到配置文件失败: ${endpoint}`, configError);
        // 配置更新失败，需要回滚：从管理器移除端点
        this.endpointManager.removeEndpoint(newEndpoint);
        throw configError;
      }

      // 8. 获取连接后的状态
      const connectionStatus = this.endpointManager.getConnectionStatus();
      const endpointStatus = connectionStatus.find(
        (status: ConnectionStatus) => status.endpoint === endpoint
      );

      // 9. 发送事件通知
      this.eventBus.emitEvent("endpoint:status:changed", {
        endpoint,
        connected: endpointStatus?.connected ?? false,
        operation: "add",
        success: true,
        message: "接入点添加成功",
        timestamp: Date.now(),
        source: "http-api",
      });

      this.logger.info(`接入点添加成功: ${endpoint}`);

      const response = this.createSuccessResponse(
        {
          endpoint,
          status: endpointStatus || {
            endpoint,
            connected: false,
            initialized: true,
          },
          operation: "added",
        },
        "接入点添加成功"
      );
      return c.json(response, 201);
    } catch (error) {
      this.logger.error("添加接入点失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_ADD_ERROR",
        error instanceof Error ? error.message : "添加接入点失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 移除接入点
   * POST /api/endpoint/remove
   * 流程：断开连接 → 从管理器移除 → 更新配置文件
   */
  async removeEndpoint(c: Context): Promise<Response> {
    const parseResult = await this.parseEndpointFromBody(
      c,
      "ENDPOINT_REMOVE_ERROR"
    );
    if (!parseResult.ok) {
      return parseResult.response;
    }

    const endpoint = parseResult.endpoint;
    this.logger.info(`处理接入点移除请求: ${endpoint}`);

    try {
      // 检查端点是否存在
      const endpointInstance = this.endpointManager.getEndpoint(endpoint);
      if (!endpointInstance) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_FOUND",
          "端点不存在",
          endpoint
        );
        return c.json(errorResponse, 404);
      }

      // 记录断开前的连接状态
      const wasConnected = endpointInstance.isConnected();

      // 先断开连接，即使失败也继续执行移除操作
      if (wasConnected) {
        try {
          await endpointInstance.disconnect();
          this.logger.debug(`端点已断开连接: ${endpoint}`);
        } catch (error) {
          this.logger.warn(
            `断开端点连接失败，继续移除操作: ${endpoint}`,
            error
          );
          // 继续执行移除操作
        }
      }

      // 从管理器移除端点
      // EndpointManager.removeEndpoint 内部会再次调用 disconnect（幂等操作）
      // 并清理状态和发射 endpointRemoved 事件
      this.endpointManager.removeEndpoint(endpointInstance);
      this.logger.debug(`端点已从管理器中移除: ${endpoint}`);

      // 从配置文件移除端点
      try {
        this.configManager.removeMcpEndpoint(endpoint);
        this.logger.debug(`端点已从配置文件中移除: ${endpoint}`);
      } catch (error) {
        this.logger.error(`从配置文件移除端点失败: ${endpoint}`, error);
        // 配置更新失败是致命错误，需要抛出
        throw error;
      }

      // 发送事件通知
      this.eventBus.emitEvent("endpoint:status:changed", {
        endpoint,
        connected: false,
        operation: "remove",
        success: true,
        message: "接入点移除成功",
        timestamp: Date.now(),
        source: "http-api",
      });

      this.logger.info(`接入点移除成功: ${endpoint}`);

      const response = this.createSuccessResponse(
        {
          endpoint,
          operation: "removed",
          wasConnected,
        },
        "接入点移除成功"
      );
      return c.json(response, 200);
    } catch (error) {
      this.logger.error("移除接入点失败:", error);

      const errorResponse = this.createErrorResponse(
        "ENDPOINT_REMOVE_ERROR",
        error instanceof Error ? error.message : "移除接入点失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }
}
