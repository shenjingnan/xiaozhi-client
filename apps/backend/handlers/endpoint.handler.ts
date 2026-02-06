import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import type { EventBus } from "@/services/event-bus.service.js";
import { getEventBus } from "@/services/event-bus.service.js";
import type { AppContext } from "@/types/hono.context.js";
import {
  requireConfigManager,
  requireEndpointManager,
} from "@/types/hono.context.js";
import type { ConfigManager } from "@xiaozhi-client/config";
import type {
  ConnectionStatus,
  EndpointManager,
} from "@xiaozhi-client/endpoint";
import type { Context } from "hono";

/**
 * 验证结果类型定义
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * 端点 API 处理器
 * 支持通过 HTTP API 动态管理端点（添加、删除、连接、断开、查询状态）
 * 端点变更会自动同步到配置文件，确保重启后状态保持一致
 * 使用 Context-based 依赖注入模式，从 Hono Context 获取依赖
 */
export class EndpointHandler {
  private logger: Logger;
  private eventBus: EventBus;

  constructor() {
    this.logger = logger;
    this.eventBus = getEventBus();
  }

  /**
   * 从 Context 获取 EndpointManager 实例
   */
  private getEndpointManager(c: Context<AppContext>): EndpointManager {
    return requireEndpointManager(c);
  }

  /**
   * 从 Context 获取 ConfigManager 实例
   */
  private getConfigManager(_c: Context<AppContext>): ConfigManager {
    return requireConfigManager();
  }

  /**
   * 从请求体中解析端点参数
   * @param c Hono 上下文
   * @param errorErrorCode 错误码，用于区分不同操作的错误
   * @returns 解析结果，成功时包含 endpoint，失败时包含可直接返回的 Response
   */
  private async parseEndpointFromBody(
    c: Context<AppContext>,
    errorErrorCode: string
  ): Promise<
    { ok: true; endpoint: string } | { ok: false; response: Response }
  > {
    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch (error) {
      this.logger.error("JSON解析失败:", error);
      return {
        ok: false,
        response: c.fail(
          errorErrorCode,
          "JSON解析失败",
          error instanceof Error ? error.message : undefined,
          500
        ),
      };
    }

    const endpoint = body.endpoint;

    // 验证端点参数
    if (!endpoint || typeof endpoint !== "string") {
      return {
        ok: false,
        response: c.fail("INVALID_ENDPOINT", "端点参数无效", undefined, 500),
      };
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
   * 获取接入点状态
   * POST /api/endpoint/status
   */
  async getEndpointStatus(c: Context<AppContext>): Promise<Response> {
    const endpointManager = this.getEndpointManager(c);
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
      const connectionStatus = endpointManager.getConnectionStatus();
      const endpointStatus = connectionStatus.find(
        (status: ConnectionStatus) => status.endpoint === endpoint
      );

      if (!endpointStatus) {
        return c.fail("ENDPOINT_NOT_FOUND", "端点不存在", undefined, 500);
      }

      this.logger.debug(`获取接入点状态成功: ${endpoint}`);
      return c.success(endpointStatus);
    } catch (error) {
      this.logger.error("获取接入点状态失败:", error);
      return c.fail(
        "ENDPOINT_STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取接入点状态失败",
        undefined,
        500
      );
    }
  }

  /**
   * 连接指定接入点
   * POST /api/endpoint/connect
   */
  async connectEndpoint(c: Context<AppContext>): Promise<Response> {
    const endpointManager = this.getEndpointManager(c);
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
      const endpointInstance = endpointManager.getEndpoint(endpoint);

      if (!endpointInstance) {
        return c.fail(
          "ENDPOINT_NOT_FOUND",
          "端点不存在，请先添加接入点",
          undefined,
          500
        );
      }

      // 执行连接操作
      await endpointManager.connect(endpoint);

      // 获取连接后的状态
      const updatedConnectionStatus = endpointManager.getConnectionStatus();
      const endpointStatus = updatedConnectionStatus.find(
        (status: ConnectionStatus) => status.endpoint === endpoint
      );

      if (!endpointStatus) {
        return c.fail(
          "ENDPOINT_STATUS_NOT_FOUND",
          "无法获取端点连接状态",
          undefined,
          500
        );
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
      return c.success(endpointStatus);
    } catch (error) {
      this.logger.error("接入点连接失败:", error);
      return c.fail(
        "ENDPOINT_CONNECT_ERROR",
        error instanceof Error ? error.message : "接入点连接失败",
        undefined,
        500
      );
    }
  }

  /**
   * 断开指定接入点
   * POST /api/endpoint/disconnect
   */
  async disconnectEndpoint(c: Context<AppContext>): Promise<Response> {
    const endpointManager = this.getEndpointManager(c);
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
      const endpointInstance = endpointManager.getEndpoint(endpoint);

      if (!endpointInstance) {
        return c.fail("ENDPOINT_NOT_FOUND", "端点不存在", undefined, 500);
      }

      // 执行断开操作
      await endpointManager.disconnect(endpoint);

      // 获取断开后的状态
      const updatedConnectionStatus = endpointManager.getConnectionStatus();
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
      return c.success(endpointStatus || fallbackStatus);
    } catch (error) {
      this.logger.error("接入点断开失败:", error);
      return c.fail(
        "ENDPOINT_DISCONNECT_ERROR",
        error instanceof Error ? error.message : "接入点断开失败",
        undefined,
        500
      );
    }
  }

  /**
   * 添加新接入点
   * POST /api/endpoint/add
   * 流程：验证 URL → 检查存在性 → 创建实例 → 添加到管理器 → 连接 → 更新配置
   */
  async addEndpoint(c: Context<AppContext>): Promise<Response> {
    const endpointManager = this.getEndpointManager(c);
    const configManager = this.getConfigManager(c);
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
        return c.fail(
          "INVALID_ENDPOINT_FORMAT",
          validation.errors.join(", "),
          undefined,
          500
        );
      }

      // 2. 检查端点是否已存在
      const existingEndpoint = endpointManager.getEndpoint(endpoint);
      if (existingEndpoint) {
        return c.fail("ENDPOINT_ALREADY_EXISTS", "端点已存在", undefined, 500);
      }

      // 3. 添加端点到管理器（使用 URL 字符串）
      endpointManager.addEndpoint(endpoint);
      this.logger.debug(`端点已添加到管理器: ${endpoint}`);

      // 4. 获取新添加的端点实例
      const newEndpoint = endpointManager.getEndpoint(endpoint);
      if (!newEndpoint) {
        return c.fail(
          "ENDPOINT_NOT_FOUND_AFTER_ADD",
          "端点添加后未找到",
          undefined,
          500
        );
      }

      // 5. 连接新端点
      try {
        await endpointManager.connect(endpoint);
        this.logger.debug(`端点已连接: ${endpoint}`);
      } catch (connectError) {
        this.logger.warn(
          `端点连接失败，但已添加到管理器: ${endpoint}`,
          connectError
        );
        // 连接失败不中断流程，端点已添加但未连接
      }

      // 6. 更新配置文件
      try {
        configManager.addMcpEndpoint(endpoint);
        this.logger.debug(`端点已添加到配置文件: ${endpoint}`);
      } catch (configError) {
        this.logger.error(`添加端点到配置文件失败: ${endpoint}`, configError);
        // 配置更新失败，需要回滚：优先尝试断开连接，其次从管理器移除端点
        try {
          await newEndpoint.disconnect();
          this.logger.debug(`回滚时已断开端点连接: ${endpoint}`);
        } catch (disconnectError) {
          // 断开失败只记录警告，不影响后续回滚流程
          this.logger.warn(
            `回滚时断开端点连接失败，将继续从管理器移除端点: ${endpoint}`,
            disconnectError
          );
        }
        // 从管理器移除端点
        endpointManager.removeEndpoint(newEndpoint);
        throw configError;
      }

      // 8. 获取连接后的状态
      const connectionStatus = endpointManager.getConnectionStatus();
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

      const defaultEndpointStatus = {
        endpoint,
        connected: false,
        initialized: true,
      };
      return c.success(
        endpointStatus || defaultEndpointStatus,
        "接入点添加成功"
      );
    } catch (error) {
      this.logger.error("添加接入点失败:", error);
      return c.fail(
        "ENDPOINT_ADD_ERROR",
        error instanceof Error ? error.message : "添加接入点失败",
        undefined,
        500
      );
    }
  }

  /**
   * 移除接入点
   * POST /api/endpoint/remove
   * 流程：断开连接 → 从管理器移除 → 更新配置文件
   */
  async removeEndpoint(c: Context<AppContext>): Promise<Response> {
    const endpointManager = this.getEndpointManager(c);
    const configManager = this.getConfigManager(c);
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
      const endpointInstance = endpointManager.getEndpoint(endpoint);
      if (!endpointInstance) {
        return c.fail("ENDPOINT_NOT_FOUND", "端点不存在", undefined, 500);
      }

      // 记录断开前的连接状态
      const wasConnected = endpointInstance.isConnected();

      // 先从配置文件移除端点，确保配置与运行时状态保持一致
      try {
        configManager.removeMcpEndpoint(endpoint);
        this.logger.debug(`端点已从配置文件中移除: ${endpoint}`);
      } catch (error) {
        this.logger.error(`从配置文件移除端点失败: ${endpoint}`, error);
        // 配置更新失败是致命错误，中断移除操作
        throw error;
      }

      // 再从管理器移除端点
      // EndpointManager.removeEndpoint 内部会再次调用 disconnect（幂等操作）
      // 并清理状态和发射 endpointRemoved 事件
      endpointManager.removeEndpoint(endpointInstance);
      this.logger.debug(`端点已从管理器中移除: ${endpoint}`);

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

      return c.success(
        {
          endpoint,
          operation: "removed",
          wasConnected,
        },
        "接入点移除成功"
      );
    } catch (error) {
      this.logger.error("移除接入点失败:", error);

      return c.fail(
        "ENDPOINT_REMOVE_ERROR",
        error instanceof Error ? error.message : "移除接入点失败",
        undefined,
        500
      );
    }
  }
}
