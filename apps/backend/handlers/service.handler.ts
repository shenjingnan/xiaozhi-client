/**
 * 服务控制 API HTTP 路由处理器
 * 提供服务启动、停止、重启、健康检查等 RESTful API 接口
 */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { logger } from "@/Logger.js";
import type { Logger } from "@/Logger.js";
import { SERVICE_RESTART_DELAYS } from "@/constants/timeout.constants.js";
import type { MCPServiceManager } from "@/lib/mcp";
import type { EventBus } from "@/services/event-bus.service.js";
import { getEventBus } from "@/services/event-bus.service.js";
import type { StatusService } from "@/services/status.service.js";
import type { AppContext } from "@/types/hono.context.js";
import { requireMCPServiceManager } from "@/types/hono.context.js";
import type { Context } from "hono";

/**
 * 服务 API 处理器
 */
export class ServiceApiHandler {
  private logger: Logger;
  private statusService: StatusService;
  private eventBus: EventBus;

  constructor(statusService: StatusService) {
    this.logger = logger;
    this.statusService = statusService;
    this.eventBus = getEventBus();
  }

  /**
   * 通用的 xiaozhi 进程启动方法
   * @param args 命令行参数（如 ["start", "--daemon"]）
   * @returns 启动的子进程
   */
  private spawnXiaozhiProcess(args: string[]): ChildProcess {
    const child = spawn("xiaozhi", args, {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
      },
    });

    child.unref();
    this.logger.info(`MCP 服务命令已发送: xiaozhi ${args.join(" ")}`);

    return child;
  }

  /**
   * 重启服务
   * POST /api/services/restart
   */
  async restartService(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理服务重启请求");

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

      // 从 Context 获取 MCP 服务管理器
      const mcpServiceManager = requireMCPServiceManager(c);

      // 异步执行重启，不阻塞响应
      setTimeout(async () => {
        try {
          await this.executeRestart(mcpServiceManager);
          // 服务重启需要一些时间，延迟发送成功状态
          setTimeout(() => {
            this.statusService.updateRestartStatus("completed");
          }, SERVICE_RESTART_DELAYS.SUCCESS_NOTIFICATION_DELAY);
        } catch (error) {
          c.get("logger").error("服务重启失败:", error);
          this.statusService.updateRestartStatus(
            "failed",
            error instanceof Error ? error.message : "未知错误"
          );
        }
      }, SERVICE_RESTART_DELAYS.EXECUTION_DELAY);

      return c.success(null, "重启请求已接收");
    } catch (error) {
      c.get("logger").error("处理重启请求失败:", error);
      return c.fail(
        "RESTART_REQUEST_ERROR",
        error instanceof Error ? error.message : "处理重启请求失败",
        undefined,
        500
      );
    }
  }

  /**
   * 执行服务重启
   * @param mcpServiceManager MCP 服务管理器实例
   */
  private async executeRestart(
    mcpServiceManager: MCPServiceManager
  ): Promise<void> {
    this.logger.info("正在重启 MCP 服务...");

    try {
      // 获取当前服务状态
      const status = mcpServiceManager.getStatus();

      if (!status.isRunning) {
        this.logger.warn("MCP 服务未运行，尝试启动服务");

        // 如果服务未运行，尝试启动服务
        this.spawnXiaozhiProcess(["start", "--daemon"]);
        return;
      }

      // 执行重启命令，始终使用 daemon 模式
      this.spawnXiaozhiProcess(["restart", "--daemon"]);
    } catch (error) {
      this.logger.error("重启服务失败:", error);
      throw error;
    }
  }

  /**
   * 停止服务
   * POST /api/services/stop
   */
  async stopService(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理服务停止请求");

      // 执行停止命令
      this.spawnXiaozhiProcess(["stop"]);

      return c.success(null, "停止请求已接收");
    } catch (error) {
      c.get("logger").error("处理停止请求失败:", error);
      return c.fail(
        "STOP_REQUEST_ERROR",
        error instanceof Error ? error.message : "处理停止请求失败",
        undefined,
        500
      );
    }
  }

  /**
   * 启动服务
   * POST /api/services/start
   */
  async startService(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理服务启动请求");

      // 执行启动命令
      this.spawnXiaozhiProcess(["start", "--daemon"]);

      return c.success(null, "启动请求已接收");
    } catch (error) {
      c.get("logger").error("处理启动请求失败:", error);
      return c.fail(
        "START_REQUEST_ERROR",
        error instanceof Error ? error.message : "处理启动请求失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取服务状态
   * GET /api/services/status
   */
  async getServiceStatus(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取服务状态请求");

      const mcpServiceManager = requireMCPServiceManager(c);
      const status = mcpServiceManager.getStatus();

      c.get("logger").debug("获取服务状态成功");
      return c.success(status);
    } catch (error) {
      c.get("logger").error("获取服务状态失败:", error);
      return c.fail(
        "SERVICE_STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取服务状态失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取服务健康状态
   * GET /api/services/health
   */
  async getServiceHealth(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取服务健康状态请求");

      // 简单的健康检查
      const health = {
        status: "healthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
      };

      c.get("logger").debug("获取服务健康状态成功");
      return c.success(health);
    } catch (error) {
      c.get("logger").error("获取服务健康状态失败:", error);
      return c.fail(
        "SERVICE_HEALTH_READ_ERROR",
        error instanceof Error ? error.message : "获取服务健康状态失败",
        undefined,
        500
      );
    }
  }
}
