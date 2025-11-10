import { spawn } from "node:child_process";
import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import { createContainer } from "../cli/Container.js";
import { type EventBus, getEventBus } from "../services/EventBus.js";
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

      // 检查是否已有重启进程在进行
      const currentRestartStatus = this.statusService.getRestartStatus();
      if (currentRestartStatus?.status === "restarting") {
        const errorResponse = this.createErrorResponse(
          "RESTART_IN_PROGRESS",
          "服务重启正在进行中，请等待完成后再试"
        );
        return c.json(errorResponse, 409);
      }

      // 发射重启请求事件
      this.eventBus.emitEvent("service:restart:requested", {
        serviceName: "xiaozhi-client",
        source: "http-api",
        delay: 0,
        attempt: 1,
        timestamp: Date.now(),
      });

      // 更新重启状态
      this.statusService.updateRestartStatus(
        "restarting",
        undefined,
        "xiaozhi-client",
        1
      );

      // 发射重启开始事件
      this.eventBus.emitEvent("service:restart:started", {
        serviceName: "xiaozhi-client",
        attempt: 1,
        timestamp: Date.now(),
      });

      // 异步执行重启，不阻塞响应
      this.executeRestartWithMonitoring();

      return c.json(
        this.createSuccessResponse(
          {
            message: "重启请求已接收",
            estimatedDuration: "10-15秒",
            status: "restarting",
          },
          "重启请求已接收"
        )
      );
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
   * 带监控的重启执行
   */
  private async executeRestartWithMonitoring(): Promise<void> {
    const startTime = Date.now();
    let attempt = 1;
    const maxAttempts = 3;

    while (attempt <= maxAttempts) {
      try {
        this.logger.info(`开始执行重启尝试 ${attempt}/${maxAttempts}`);

        // 发射重启执行事件
        this.eventBus.emitEvent("service:restart:execute", {
          serviceName: "xiaozhi-client",
          attempt,
          timestamp: Date.now(),
        });

        // 执行重启
        await this.executeRestart();

        // 重启成功
        const duration = Date.now() - startTime;
        this.logger.info(`服务重启成功，耗时: ${duration}ms`);

        this.eventBus.emitEvent("service:restart:completed", {
          serviceName: "xiaozhi-client",
          attempt,
          timestamp: Date.now(),
        });

        // 延迟更新状态，给新进程启动时间
        setTimeout(() => {
          this.statusService.updateRestartStatus("completed");
        }, 3000);

        return;
      } catch (error) {
        this.logger.error(`重启尝试 ${attempt} 失败:`, error);

        if (attempt === maxAttempts) {
          // 最后一次尝试失败
          const duration = Date.now() - startTime;
          this.logger.error(`服务重启失败，总耗时: ${duration}ms`);

          this.eventBus.emitEvent("service:restart:failed", {
            serviceName: "xiaozhi-client",
            error: error instanceof Error ? error : new Error(String(error)),
            attempt,
            timestamp: Date.now(),
          });

          this.statusService.updateRestartStatus(
            "failed",
            error instanceof Error
              ? error.message
              : `重启失败，已尝试 ${maxAttempts} 次`
          );
        } else {
          // 等待后重试
          this.logger.info(
            `等待 ${5000 * attempt}ms 后进行第 ${attempt + 1} 次尝试`
          );
          await this.sleep(5000 * attempt);
        }
      }

      attempt++;
    }
  }

  /**
   * 执行服务重启
   */
  private async executeRestart(): Promise<void> {
    this.logger.info("正在重启 MCP 服务...");

    try {
      // 1. 先优雅停止当前服务
      await this.gracefulShutdown();

      // 2. 清理所有单例和资源
      await this.cleanupResources();

      // 3. 等待一段时间确保资源完全释放
      await this.sleep(2000);

      // 4. 启动新进程
      await this.startNewProcess();
    } catch (error) {
      this.logger.error("重启服务失败:", error);
      throw error;
    }
  }

  /**
   * 优雅停止当前服务
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.info("正在优雅停止当前服务...");

    try {
      // 获取当前服务状态
      const container = await createContainer();
      const serviceManager = container.get("serviceManager") as any;
      const status = await serviceManager.getStatus();

      if (status.running) {
        // 如果服务正在运行，发送停止信号
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
        this.logger.info("停止服务命令已发送");

        // 等待服务停止
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          await this.sleep(1000);
          try {
            const currentStatus = await serviceManager.getStatus();
            if (!currentStatus.running) {
              this.logger.info("服务已停止");
              break;
            }
          } catch (error) {
            // 服务可能已经停止，状态检查失败是正常的
            this.logger.debug("状态检查失败，可能服务已停止");
            break;
          }
          attempts++;
        }

        if (attempts >= maxAttempts) {
          this.logger.warn("服务停止超时，继续执行重启流程");
        }
      } else {
        this.logger.info("服务当前未运行");
      }
    } catch (error) {
      this.logger.warn("停止服务时出现错误，继续执行重启:", error);
    }
  }

  /**
   * 清理所有资源
   */
  private async cleanupResources(): Promise<void> {
    this.logger.info("正在清理系统资源...");

    try {
      // 清理全局单例
      await this.cleanupSingletons();

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      this.logger.info("资源清理完成");
    } catch (error) {
      this.logger.warn("清理资源时出现错误:", error);
    }
  }

  /**
   * 清理全局单例
   */
  private async cleanupSingletons(): Promise<void> {
    try {
      // 清理 MCP 服务管理器单例
      const { MCPServiceManagerSingleton } = await import(
        "../services/MCPServiceManagerSingleton.js"
      );
      if (MCPServiceManagerSingleton.cleanup) {
        await MCPServiceManagerSingleton.cleanup();
      }

      // 清理小智连接管理器单例
      const { XiaozhiConnectionManagerSingleton } = await import(
        "../services/XiaozhiConnectionManagerSingleton.js"
      );
      if (XiaozhiConnectionManagerSingleton.cleanup) {
        await XiaozhiConnectionManagerSingleton.cleanup();
      }

      // 销毁事件总线
      const { destroyEventBus } = await import("../services/EventBus.js");
      destroyEventBus();

      this.logger.debug("全局单例清理完成");
    } catch (error) {
      this.logger.warn("清理全局单例时出现错误:", error);
    }
  }

  /**
   * 启动新进程
   */
  private async startNewProcess(): Promise<void> {
    this.logger.info("正在启动新进程...");

    try {
      // 执行启动命令
      const startArgs = ["start", "--daemon"];
      const child = spawn("xiaozhi", startArgs, {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
          NODE_ENV: process.env.NODE_ENV || "production",
        },
      });

      child.unref();
      this.logger.info("新进程启动命令已发送");

      // 验证新进程是否成功启动
      setTimeout(async () => {
        try {
          const container = await createContainer();
          const serviceManager = container.get("serviceManager") as any;
          const status = await serviceManager.getStatus();

          if (status.running) {
            this.logger.info("新进程启动成功");
            this.statusService.updateRestartStatus("completed");
          } else {
            this.logger.error("新进程启动失败");
            this.statusService.updateRestartStatus("failed", "新进程启动失败");
          }
        } catch (error) {
          this.logger.error("验证新进程状态时出错:", error);
          this.statusService.updateRestartStatus(
            "failed",
            error instanceof Error ? error.message : "验证新进程状态失败"
          );
        }
      }, 5000);
    } catch (error) {
      this.logger.error("启动新进程失败:", error);
      this.statusService.updateRestartStatus(
        "failed",
        error instanceof Error ? error.message : "启动新进程失败"
      );
      throw error;
    }
  }

  /**
   * 延迟工具方法
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
