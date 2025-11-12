import { spawn } from "node:child_process";
import type { Context } from "hono";
import type { Logger } from "../Logger.js";
import { logger } from "../Logger.js";
import { createContainer } from "../cli/Container.js";
import type { EventBus } from "../services/EventBus.js";
import { getEventBus } from "../services/EventBus.js";
import type { StatusService } from "../services/StatusService.js";

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
 * 服务 API 处理器
 */
export class ServiceApiHandler {
  private logger: Logger;
  private statusService: StatusService;
  private eventBus: EventBus;

  constructor(statusService: StatusService) {
    this.logger = logger.withTag("ServiceApiHandler");
    this.statusService = statusService;
    this.eventBus = getEventBus();
  }

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(
    code: string,
    message: string,
    details?: any
  ): ApiErrorResponse {
    return {
      error: {
        code,
        message,
        details,
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
   * 重启服务
   * POST /api/services/restart
   */
  async restartService(c: Context): Promise<Response> {
    try {
      this.logger.info("处理服务重启请求");

      // 发射重启请求事件
      this.eventBus.emitEvent("service:restart:requested", {
        serviceName: "unknown", // 由于是HTTP API触发的，服务名未知
        source: "http-api",
        delay: 0,
        attempt: 1,
        timestamp: Date.now(),
      });

      // 更新重启状态
      this.statusService.updateRestartStatus("restarting");

      // 异步执行重启，不阻塞响应
      setTimeout(async () => {
        try {
          await this.executeRestart();
          // 服务重启需要一些时间，延迟发送成功状态
          setTimeout(() => {
            this.statusService.updateRestartStatus("completed");
          }, 5000);
        } catch (error) {
          this.logger.error("服务重启失败:", error);
          this.statusService.updateRestartStatus(
            "failed",
            error instanceof Error ? error.message : "未知错误"
          );
        }
      }, 500);

      return c.json(this.createSuccessResponse(null, "重启请求已接收"));
    } catch (error) {
      this.logger.error("处理重启请求失败:", error);
      const errorResponse = this.createErrorResponse(
        "RESTART_REQUEST_ERROR",
        error instanceof Error ? error.message : "处理重启请求失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 执行服务重启
   */
  private async executeRestart(): Promise<void> {
    this.logger.info("正在重启 MCP 服务...");

    try {
      // 获取当前服务状态
      const container = await createContainer();
      const serviceManager = container.get("serviceManager") as any;
      const status = await serviceManager.getStatus();

      if (!status.running) {
        this.logger.warn("MCP 服务未运行，尝试启动服务");

        // 如果服务未运行，尝试启动服务
        const startArgs = ["start", "--daemon"];
        const child = spawn("xiaozhi", startArgs, {
          detached: true,
          stdio: "ignore",
          env: {
            ...process.env,
            XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
          },
        });
        child.unref();
        this.logger.info("MCP 服务启动命令已发送");
        return;
      }

      // 获取服务运行模式
      const isDaemon = status.mode === "daemon";

      // 执行重启命令
      const restartArgs = ["restart"];
      if (isDaemon) {
        restartArgs.push("--daemon");
      }

      // 在子进程中执行重启命令
      const child = spawn("xiaozhi", restartArgs, {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
        },
      });

      child.unref();
      this.logger.info("MCP 服务重启命令已发送");
    } catch (error) {
      this.logger.error("重启服务失败:", error);
      throw error;
    }
  }

  /**
   * 停止服务
   * POST /api/services/stop
   */
  async stopService(c: Context): Promise<Response> {
    try {
      this.logger.info("处理服务停止请求");

      // 执行停止命令
      const stopArgs = ["stop"];
      const child = spawn("xiaozhi", stopArgs, {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
        },
      });

      child.unref();
      this.logger.info("MCP 服务停止命令已发送");

      return c.json(this.createSuccessResponse(null, "停止请求已接收"));
    } catch (error) {
      this.logger.error("处理停止请求失败:", error);
      const errorResponse = this.createErrorResponse(
        "STOP_REQUEST_ERROR",
        error instanceof Error ? error.message : "处理停止请求失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 启动服务
   * POST /api/services/start
   */
  async startService(c: Context): Promise<Response> {
    try {
      this.logger.info("处理服务启动请求");

      // 执行启动命令
      const startArgs = ["start", "--daemon"];
      const child = spawn("xiaozhi", startArgs, {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
        },
      });

      child.unref();
      this.logger.info("MCP 服务启动命令已发送");

      return c.json(this.createSuccessResponse(null, "启动请求已接收"));
    } catch (error) {
      this.logger.error("处理启动请求失败:", error);
      const errorResponse = this.createErrorResponse(
        "START_REQUEST_ERROR",
        error instanceof Error ? error.message : "处理启动请求失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取服务状态
   * GET /api/services/status
   */
  async getServiceStatus(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取服务状态请求");

      const container = await createContainer();
      const serviceManager = container.get("serviceManager") as any;
      const status = await serviceManager.getStatus();

      this.logger.debug("获取服务状态成功");
      return c.json(this.createSuccessResponse(status));
    } catch (error) {
      this.logger.error("获取服务状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "SERVICE_STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取服务状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取服务健康状态
   * GET /api/services/health
   */
  async getServiceHealth(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取服务健康状态请求");

      // 简单的健康检查
      const health = {
        status: "healthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
      };

      this.logger.debug("获取服务健康状态成功");
      return c.json(this.createSuccessResponse(health));
    } catch (error) {
      this.logger.error("获取服务健康状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "SERVICE_HEALTH_READ_ERROR",
        error instanceof Error ? error.message : "获取服务健康状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }
}
