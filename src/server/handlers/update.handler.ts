import type { Context } from "hono";
import { z } from "zod";
/**
 * 更新 API HTTP 路由处理器
 * 提供版本更新和 NPM 包安装相关的 RESTful API 接口
 *
 * 支持两种模式：
 * - POST /api/update：触发安装，返回 installId
 * - GET /api/install/logs?installId=xxx：SSE 日志流式推送
 */
import { InstallLogStream, NPMManager } from "../lib/npm";
import { getEventBus } from "../services/event-bus.service.js";
import type { AppContext } from "../types/hono.context.js";
import { BaseHandler } from "./base.handler.js";

// 版本号请求格式验证
const UpdateRequestSchema = z.object({
  version: z.string().min(1, "版本号不能为空"),
});

/**
 * 更新 API 处理器
 */
export class UpdateApiHandler extends BaseHandler {
  private npmManager: NPMManager;
  private eventBus = getEventBus();
  private activeInstalls: Map<string, boolean> = new Map();
  private logStream: InstallLogStream;

  constructor(logStream?: InstallLogStream) {
    super();
    this.logStream = logStream ?? new InstallLogStream();
    this.npmManager = new NPMManager(this.eventBus, this.logStream);
  }

  /**
   * 获取日志流实例（供外部访问）
   */
  getLogStream(): InstallLogStream {
    return this.logStream;
  }

  /**
   * 执行版本更新
   * POST /api/update
   * Body: { version: string }
   * Response: { success, data: { version, installId }, message }
   */
  async performUpdate(c: Context<AppContext>): Promise<Response> {
    try {
      const body = await this.parseJsonBody<{ version: string }>(
        c,
        "请求体格式错误"
      );

      // 使用 zod 进行参数验证
      const parseResult = UpdateRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return c.fail(
          "INVALID_VERSION",
          "请求参数格式错误",
          parseResult.error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
          400
        );
      }

      const { version } = parseResult.data;

      // 检查是否有正在进行的安装
      const hasActiveInstall = Array.from(this.activeInstalls.values()).some(
        (v) => v
      );
      if (hasActiveInstall) {
        return c.fail(
          "INSTALL_IN_PROGRESS",
          "已有安装进程正在进行，请等待完成后再试",
          undefined,
          409
        );
      }

      const logger = c.get("logger");

      // 生成 installId（在 handler 层生成，确保能立即返回给前端）
      const installId = `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.activeInstalls.set(installId, true);

      // 异步启动安装（不阻塞响应）
      this.npmManager
        .installVersion(version, installId)
        .then(() => {
          // 安装成功，保持标记 1 分钟供 SSE 消费者连接
          setTimeout(() => {
            this.activeInstalls.delete(installId);
          }, 60_000);
        })
        .catch((error) => {
          logger.error("安装过程失败:", error);
          this.activeInstalls.delete(installId);
        });

      return c.success(
        {
          version,
          installId,
          message: "安装已启动，请通过 SSE 日志流查看进度",
        },
        "安装请求已接受"
      );
    } catch (error) {
      return this.handleError(c, error, "处理安装请求", "REQUEST_FAILED");
    }
  }

  /**
   * SSE 安装日志流端点
   * GET /api/install/logs?installId=xxx
   *
   * 返回 text/event-stream 格式的实时安装日志。
   * 前端使用 EventSource API 订阅此端点。
   */
  async getInstallLogs(c: Context<AppContext>): Promise<Response> {
    const installId = c.req.query("installId");

    if (!installId) {
      return c.fail(
        "MISSING_INSTALL_ID",
        "缺少 installId 参数",
        undefined,
        400
      );
    }

    // 检查安装会话是否存在
    if (!this.logStream.hasSession(installId)) {
      return c.fail(
        "INSTALL_NOT_FOUND",
        "未找到对应的安装任务，请先发起安装请求",
        undefined,
        404
      );
    }

    // 创建 SSE 流
    const stream = this.logStream.createSSEStream(installId);
    if (!stream) {
      return c.fail("STREAM_ERROR", "无法创建日志流", undefined, 500);
    }

    // 返回 SSE 响应
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
      },
    });
  }
}
