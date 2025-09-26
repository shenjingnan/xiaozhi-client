import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import { type EventBus, getEventBus } from "../services/EventBus.js";
import type { IndependentXiaozhiConnectionManager } from "../services/IndependentXiaozhiConnectionManager.js";
import type { ConnectionStatus } from "../services/IndependentXiaozhiConnectionManager.js";

/**
 * 统一响应格式接口
 */
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

interface ApiSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 端点操作请求接口
 */
interface EndpointOperationRequest {
  endpoint: string;
}

/**
 * 端点操作成功响应接口
 */
interface EndpointOperationResponse {
  success: boolean;
  message: string;
  endpoint: string;
  status: ConnectionStatus;
  operation: "connect" | "disconnect" | "reconnect";
}

/**
 * 端点操作错误响应接口
 */
interface EndpointOperationError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * MCP 端点 API 处理器
 */
export class MCPEndpointApiHandler {
  private logger: Logger;
  private xiaozhiConnectionManager: IndependentXiaozhiConnectionManager;
  private eventBus: EventBus;

  constructor(xiaozhiConnectionManager: IndependentXiaozhiConnectionManager) {
    this.logger = logger.withTag("MCPEndpointApiHandler");
    this.xiaozhiConnectionManager = xiaozhiConnectionManager;
    this.eventBus = getEventBus();
  }

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(
    code: string,
    message: string,
    endpoint?: string,
    details?: any
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
   * 创建端点操作响应
   */
  private createEndpointOperationResponse(
    endpoint: string,
    status: ConnectionStatus,
    operation: "connect" | "disconnect" | "reconnect",
    message?: string
  ): EndpointOperationResponse {
    return {
      success: true,
      message: message || `端点 ${operation} 操作成功`,
      endpoint,
      status,
      operation,
    };
  }

  /**
   * 获取接入点状态
   * GET /api/endpoints/:endpoint/status
   */
  async getEndpointStatus(c: Context): Promise<Response> {
    try {
      const endpoint = decodeURIComponent(c.req.param("endpoint"));
      this.logger.debug(`处理获取接入点状态请求: ${endpoint}`);

      // 验证端点参数
      if (!endpoint || typeof endpoint !== "string") {
        const errorResponse = this.createErrorResponse(
          "INVALID_ENDPOINT",
          "端点参数无效",
          endpoint
        );
        return c.json(errorResponse, 400);
      }

      // 获取连接状态
      const connectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const endpointStatus = connectionStatus.find(
        (status) => status.endpoint === endpoint
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
      const endpoint = c.req.param("endpoint");
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
   * POST /api/endpoints/:endpoint/connect
   */
  async connectEndpoint(c: Context): Promise<Response> {
    try {
      const endpoint = decodeURIComponent(c.req.param("endpoint"));
      this.logger.info(`处理接入点连接请求: ${endpoint}`);

      // 验证端点参数
      if (!endpoint || typeof endpoint !== "string") {
        const errorResponse = this.createErrorResponse(
          "INVALID_ENDPOINT",
          "端点参数无效",
          endpoint
        );
        return c.json(errorResponse, 400);
      }

      // 检查端点是否已连接
      const connectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const existingStatus = connectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      if (existingStatus?.connected) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_ALREADY_CONNECTED",
          "端点已连接",
          endpoint
        );
        return c.json(errorResponse, 409);
      }

      // 执行连接操作 - 添加端点
      await this.xiaozhiConnectionManager.addEndpoint(endpoint);

      // 获取连接后的状态
      const updatedConnectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const endpointStatus = updatedConnectionStatus.find(
        (status) => status.endpoint === endpoint
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
      this.eventBus.emitEvent("status:updated", {
        status: { endpoint, connected: true, operation: "connect" },
        source: "http-api",
      });

      this.logger.info(`接入点连接成功: ${endpoint}`);
      const response = this.createEndpointOperationResponse(
        endpoint,
        endpointStatus,
        "connect",
        "接入点连接成功"
      );
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点连接失败:", error);
      const endpoint = c.req.param("endpoint");
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
   * POST /api/endpoints/:endpoint/disconnect
   */
  async disconnectEndpoint(c: Context): Promise<Response> {
    try {
      const endpoint = decodeURIComponent(c.req.param("endpoint"));
      this.logger.info(`处理接入点断开请求: ${endpoint}`);

      // 验证端点参数
      if (!endpoint || typeof endpoint !== "string") {
        const errorResponse = this.createErrorResponse(
          "INVALID_ENDPOINT",
          "端点参数无效",
          endpoint
        );
        return c.json(errorResponse, 400);
      }

      // 检查端点是否存在且已连接
      const connectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const existingStatus = connectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      if (!existingStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_FOUND",
          "端点不存在",
          endpoint
        );
        return c.json(errorResponse, 404);
      }

      if (!existingStatus.connected) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_CONNECTED",
          "端点未连接",
          endpoint
        );
        return c.json(errorResponse, 409);
      }

      // 执行断开操作
      await this.xiaozhiConnectionManager.disconnectEndpoint(endpoint);

      // 获取断开后的状态
      const updatedConnectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const endpointStatus = updatedConnectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      // 发送断开成功事件
      this.eventBus.emitEvent("status:updated", {
        status: { endpoint, connected: false, operation: "disconnect" },
        source: "http-api",
      });

      this.logger.info(`接入点断开成功: ${endpoint}`);
      const fallbackStatus: ConnectionStatus = {
        endpoint,
        connected: false,
        initialized: true,
        isReconnecting: false,
        reconnectAttempts: 0,
        nextReconnectTime: undefined,
        reconnectDelay: 0,
      };
      const response = this.createEndpointOperationResponse(
        endpoint,
        endpointStatus || fallbackStatus,
        "disconnect",
        "接入点断开成功"
      );
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点断开失败:", error);
      const endpoint = c.req.param("endpoint");
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_DISCONNECT_ERROR",
        error instanceof Error ? error.message : "接入点断开失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 重连指定接入点
   * POST /api/endpoints/:endpoint/reconnect
   */
  async reconnectEndpoint(c: Context): Promise<Response> {
    try {
      const endpoint = decodeURIComponent(c.req.param("endpoint"));
      this.logger.info(`处理接入点重连请求: ${endpoint}`);

      // 验证端点参数
      if (!endpoint || typeof endpoint !== "string") {
        const errorResponse = this.createErrorResponse(
          "INVALID_ENDPOINT",
          "端点参数无效",
          endpoint
        );
        return c.json(errorResponse, 400);
      }

      // 检查端点是否存在
      const connectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const existingStatus = connectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      if (!existingStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_FOUND",
          "端点不存在",
          endpoint
        );
        return c.json(errorResponse, 404);
      }

      // 如果端点已连接，先断开
      if (existingStatus.connected) {
        await this.xiaozhiConnectionManager.disconnectEndpoint(endpoint);
      }

      // 执行重连操作
      await this.xiaozhiConnectionManager.triggerReconnect(endpoint);

      // 获取重连后的状态
      const updatedConnectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const endpointStatus = updatedConnectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      if (!endpointStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_STATUS_NOT_FOUND",
          "无法获取端点连接状态",
          endpoint
        );
        return c.json(errorResponse, 500);
      }

      // 发送重连成功事件
      this.eventBus.emitEvent("status:updated", {
        status: { endpoint, connected: true, operation: "reconnect" },
        source: "http-api",
      });

      this.logger.info(`接入点重连成功: ${endpoint}`);
      const response = this.createEndpointOperationResponse(
        endpoint,
        endpointStatus,
        "reconnect",
        "接入点重连成功"
      );
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点重连失败:", error);
      const endpoint = c.req.param("endpoint");
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_RECONNECT_ERROR",
        error instanceof Error ? error.message : "接入点重连失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }
}
