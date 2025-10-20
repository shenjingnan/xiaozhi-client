import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import type { ConfigManager } from "../configManager.js";
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
 * MCP 端点 API 处理器
 */
export class MCPEndpointApiHandler {
  private logger: Logger;
  private xiaozhiConnectionManager: IndependentXiaozhiConnectionManager;
  private configManager: ConfigManager;
  private eventBus: EventBus;

  constructor(
    xiaozhiConnectionManager: IndependentXiaozhiConnectionManager,
    configManager: ConfigManager
  ) {
    this.logger = logger.withTag("MCPEndpointApiHandler");
    this.xiaozhiConnectionManager = xiaozhiConnectionManager;
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
   * 获取接入点状态
   * POST /api/endpoint/status
   */
  async getEndpointStatus(c: Context): Promise<Response> {
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_STATUS_READ_ERROR",
        error instanceof Error ? error.message : "JSON解析失败"
      );
      return c.json(errorResponse, 500);
    }

    const endpoint = body.endpoint;

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
    try {
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
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_CONNECT_ERROR",
        error instanceof Error ? error.message : "JSON解析失败"
      );
      return c.json(errorResponse, 500);
    }

    const endpoint = body.endpoint;
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
    try {
      // 检查端点是否存在
      const connectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const existingStatus = connectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      if (!existingStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_NOT_FOUND",
          "端点不存在，请先添加接入点",
          endpoint
        );
        return c.json(errorResponse, 404);
      }

      if (existingStatus.connected) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_ALREADY_CONNECTED",
          "端点已连接",
          endpoint
        );
        return c.json(errorResponse, 409);
      }

      // 执行连接操作 - 连接已存在的端点
      await this.xiaozhiConnectionManager.connectExistingEndpoint(endpoint);

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
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_DISCONNECT_ERROR",
        error instanceof Error ? error.message : "JSON解析失败"
      );
      return c.json(errorResponse, 500);
    }

    const endpoint = body.endpoint;
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
    try {
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
        isReconnecting: false,
        reconnectAttempts: 0,
        nextReconnectTime: undefined,
        reconnectDelay: 0,
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
   * 重连指定接入点
   * POST /api/endpoint/reconnect
   */
  async reconnectEndpoint(c: Context): Promise<Response> {
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_RECONNECT_ERROR",
        error instanceof Error ? error.message : "JSON解析失败"
      );
      return c.json(errorResponse, 500);
    }

    const endpoint = body.endpoint;
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

    try {
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
      this.eventBus.emitEvent("endpoint:status:changed", {
        endpoint,
        connected: true,
        operation: "reconnect",
        success: true,
        message: "接入点重连成功",
        timestamp: Date.now(),
        source: "http-api",
      });

      this.logger.info(`接入点重连成功: ${endpoint}`);
      const response = this.createSuccessResponse(endpointStatus);
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点重连失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_RECONNECT_ERROR",
        error instanceof Error ? error.message : "接入点重连失败",
        endpoint
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 添加新接入点
   * POST /api/endpoint/add
   */
  async addEndpoint(c: Context): Promise<Response> {
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_ADD_ERROR",
        error instanceof Error ? error.message : "JSON解析失败"
      );
      return c.json(errorResponse, 500);
    }

    const endpoint = body.endpoint;

    // 验证端点参数
    if (!endpoint || typeof endpoint !== "string") {
      const errorResponse = this.createErrorResponse(
        "INVALID_ENDPOINT",
        "端点参数无效",
        endpoint
      );
      return c.json(errorResponse, 400);
    }
    try {
      // 检查端点是否已存在
      const connectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const existingStatus = connectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      if (existingStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_ALREADY_EXISTS",
          "接入点已存在",
          endpoint
        );
        return c.json(errorResponse, 409);
      }

      // 执行添加操作
      await this.xiaozhiConnectionManager.addEndpoint(endpoint);

      // 获取添加后的状态
      const updatedConnectionStatus =
        this.xiaozhiConnectionManager.getConnectionStatus();
      const endpointStatus = updatedConnectionStatus.find(
        (status) => status.endpoint === endpoint
      );

      if (!endpointStatus) {
        const errorResponse = this.createErrorResponse(
          "ENDPOINT_STATUS_NOT_FOUND",
          "无法获取端点状态",
          endpoint
        );
        return c.json(errorResponse, 500);
      }

      // 发送添加成功事件
      this.eventBus.emitEvent("endpoint:status:changed", {
        endpoint,
        connected: false,
        operation: "add",
        success: true,
        message: "接入点添加成功",
        timestamp: Date.now(),
        source: "http-api",
      });

      this.logger.info(`接入点添加成功: ${endpoint}`);
      const response = this.createSuccessResponse(endpointStatus);
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点添加失败:", error);
      let errorCode = "ENDPOINT_ADD_ERROR";
      let httpStatus = 500;

      // 处理特定错误类型
      if (error instanceof Error) {
        if (error.message.includes("已存在于配置文件中")) {
          errorCode = "ENDPOINT_ALREADY_IN_CONFIG";
          httpStatus = 409;
        } else if (error.message.includes("已存在")) {
          errorCode = "ENDPOINT_ALREADY_EXISTS";
          httpStatus = 409;
        } else if (error.message.includes("端点必须是非空字符串")) {
          errorCode = "INVALID_ENDPOINT";
          httpStatus = 400;
        }
      }

      const errorResponse = this.createErrorResponse(
        errorCode,
        error instanceof Error ? error.message : "接入点添加失败",
        undefined
      );
      return c.json(errorResponse, httpStatus as any);
    }
  }

  /**
   * 移除接入点
   * DELETE /api/endpoint/remove
   */
  async removeEndpoint(c: Context): Promise<Response> {
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      const errorResponse = this.createErrorResponse(
        "ENDPOINT_REMOVE_ERROR",
        error instanceof Error ? error.message : "JSON解析失败"
      );
      return c.json(errorResponse, 500);
    }

    const endpoint = body.endpoint;
    this.logger.info(`处理接入点移除请求: ${endpoint}`);

    // 验证端点参数
    if (!endpoint || typeof endpoint !== "string") {
      const errorResponse = this.createErrorResponse(
        "INVALID_ENDPOINT",
        "端点参数无效",
        endpoint
      );
      return c.json(errorResponse, 400);
    }
    try {
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

      // 如果端点已连接，先断开连接
      if (existingStatus.connected) {
        await this.xiaozhiConnectionManager.disconnectEndpoint(endpoint);
      }

      // 执行移除操作
      await this.xiaozhiConnectionManager.removeEndpoint(endpoint);

      // 发送移除成功事件
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
      const response = this.createSuccessResponse({
        endpoint,
        operation: "remove",
        success: true,
        message: "接入点移除成功",
      });
      return c.json(response);
    } catch (error) {
      this.logger.error("接入点移除失败:", error);
      let errorCode = "ENDPOINT_REMOVE_ERROR";
      let httpStatus = 500;

      // 处理特定错误类型
      if (error instanceof Error) {
        if (error.message.includes("不存在")) {
          errorCode = "ENDPOINT_NOT_FOUND";
          httpStatus = 404;
        } else if (error.message.includes("端点必须是非空字符串")) {
          errorCode = "INVALID_ENDPOINT";
          httpStatus = 400;
        }
      }

      const errorResponse = this.createErrorResponse(
        errorCode,
        error instanceof Error ? error.message : "接入点移除失败",
        endpoint
      );
      return c.json(errorResponse, httpStatus as any);
    }
  }
}
