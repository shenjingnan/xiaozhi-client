/**
 * 更新 API 处理器
 *
 * 提供版本更新相关的 HTTP API 接口
 * - 执行版本更新 (POST /api/update)
 *
 * 安装过程通过 WebSocket 推送实时日志
 */

import { NPMManager } from "@/lib/npm";
import { getEventBus } from "@/services/event-bus.service.js";
import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";
import { z } from "zod";
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

  constructor() {
    super();
    this.npmManager = new NPMManager(this.eventBus);
  }

  /**
   * 执行版本更新
   * POST /api/update
   * Body: { version: string }
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
          parseResult.error.errors.map((err) => ({
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
      // 立即返回响应，安装过程通过 WebSocket 推送
      this.npmManager.installVersion(version).catch((error) => {
        logger.error("安装过程失败:", error);
      });

      return c.success(
        {
          version: version,
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );
    } catch (error) {
      return this.handleError(c, error, "处理安装请求", "REQUEST_FAILED");
    }
  }
}
