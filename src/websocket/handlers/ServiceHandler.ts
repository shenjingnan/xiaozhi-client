/**
 * 服务相关 WebSocket 消息处理器
 * 处理服务重启和状态相关的 WebSocket 消息
 */

import { spawn } from "node:child_process";
import type { WebSocket } from "ws";
import { logger } from "../../Logger.js";
import type { MessageHandler } from "../../types/WebServerTypes.js";
import { WebSocketMessageType } from "../types.js";

/**
 * 重启状态类型
 */
export type RestartStatus = "restarting" | "completed" | "failed";

/**
 * 服务消息处理器
 * 负责处理服务重启相关的 WebSocket 消息
 */
export class ServiceHandler implements MessageHandler {
  private broadcastCallback?: (message: any) => void;
  private createContainer?: () => Promise<any>;

  /**
   * 判断是否可以处理指定类型的消息
   * @param messageType 消息类型
   * @returns 是否可以处理
   */
  canHandle(messageType: string): boolean {
    return [WebSocketMessageType.RESTART_SERVICE].includes(
      messageType as WebSocketMessageType
    );
  }

  /**
   * 处理 WebSocket 消息
   * @param ws WebSocket 连接实例
   * @param message 消息对象
   */
  async handle(ws: WebSocket, message: any): Promise<void> {
    try {
      switch (message.type) {
        case WebSocketMessageType.RESTART_SERVICE:
          await this.handleRestartService(ws, message);
          break;

        default:
          logger.warn(`ServiceHandler: 未知消息类型 ${message.type}`);
          this.sendError(ws, `未知消息类型: ${message.type}`);
      }
    } catch (error) {
      logger.error("ServiceHandler: 消息处理错误:", error);
      this.sendError(
        ws,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 处理重启服务消息
   * @param ws WebSocket 连接实例
   * @param message 消息对象
   */
  private async handleRestartService(
    ws: WebSocket,
    message: any
  ): Promise<void> {
    try {
      // 处理手动重启请求
      logger.info("收到手动重启服务请求");
      this.broadcastRestartStatus("restarting");

      // 延迟执行重启
      setTimeout(async () => {
        try {
          await this.restartService();
          // 服务重启需要一些时间，延迟发送成功状态
          setTimeout(() => {
            this.broadcastRestartStatus("completed");
          }, 5000);
        } catch (error) {
          logger.error(
            `手动重启失败: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          this.broadcastRestartStatus(
            "failed",
            error instanceof Error ? error.message : "未知错误"
          );
        }
      }, 500);
    } catch (error) {
      logger.error("处理重启服务请求失败:", error);
      this.sendError(ws, "处理重启服务请求失败");
    }
  }

  /**
   * 重启服务的内部方法
   * 从 WebServer.ts 迁移的重启逻辑
   */
  private async restartService(): Promise<void> {
    logger.info("正在重启 MCP 服务...");

    try {
      if (!this.createContainer) {
        throw new Error("createContainer 函数未设置");
      }

      // 获取当前服务状态
      const container = await this.createContainer();
      const serviceManager = container.get("serviceManager") as any;
      const status = await serviceManager.getStatus();

      if (!status.running) {
        logger.warn("MCP 服务未运行，尝试启动服务");

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
        logger.info("MCP 服务启动命令已发送");
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
      logger.info(`MCP 服务重启命令已发送 (模式: ${status.mode})`);
    } catch (error) {
      logger.error("重启服务失败:", error);
      throw error;
    }
  }

  /**
   * 广播重启状态
   * @param status 重启状态
   * @param error 错误信息（可选）
   */
  private broadcastRestartStatus(status: RestartStatus, error?: string): void {
    if (this.broadcastCallback) {
      this.broadcastCallback({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status,
          error,
          timestamp: Date.now(),
        },
      });
    }
  }

  /**
   * 发送错误消息
   * @param ws WebSocket 连接实例
   * @param error 错误信息
   */
  private sendError(ws: WebSocket, error: string): void {
    try {
      ws.send(
        JSON.stringify({
          type: WebSocketMessageType.ERROR,
          error,
          timestamp: Date.now(),
        })
      );
    } catch (sendError) {
      logger.error("发送错误消息失败:", sendError);
    }
  }

  /**
   * 设置广播回调函数
   * @param callback 广播回调函数
   */
  setBroadcastCallback(callback: (message: any) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * 设置容器创建函数
   * @param createContainer 容器创建函数
   */
  setCreateContainer(createContainer: () => Promise<any>): void {
    this.createContainer = createContainer;
  }

  /**
   * 手动触发服务重启
   * 提供给外部调用的接口
   */
  async triggerRestart(): Promise<void> {
    try {
      logger.info("手动触发服务重启");
      this.broadcastRestartStatus("restarting");

      await this.restartService();

      // 延迟发送成功状态
      setTimeout(() => {
        this.broadcastRestartStatus("completed");
      }, 5000);
    } catch (error) {
      logger.error("手动重启失败:", error);
      this.broadcastRestartStatus(
        "failed",
        error instanceof Error ? error.message : "未知错误"
      );
      throw error;
    }
  }
}
