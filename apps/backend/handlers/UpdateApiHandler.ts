import { NPMManager } from "@/lib/npm";
import { logger } from "@root/Logger.js";
import { getEventBus } from "@services/EventBus.js";
import type { Context } from "hono";
import { z } from "zod";

// 版本号请求格式验证
const UpdateRequestSchema = z.object({
  version: z.string().min(1, "版本号不能为空"),
});

export class UpdateApiHandler {
  private npmManager: NPMManager;
  private logger = logger.withTag("UpdateApiHandler");
  private eventBus = getEventBus();
  private activeInstalls: Map<string, boolean> = new Map();

  constructor() {
    this.npmManager = new NPMManager(this.eventBus);
  }

  /**
   * 执行版本更新
   * POST /api/update
   * Body: { version: string }
   */
  async performUpdate(c: Context): Promise<Response> {
    try {
      const body = await c.req.json();

      // 使用 zod 进行参数验证
      const parseResult = UpdateRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_VERSION",
              message: "请求参数格式错误",
              details: parseResult.error.errors.map((err) => ({
                field: err.path.join("."),
                message: err.message,
              })),
            },
          },
          400
        );
      }

      const { version } = parseResult.data;

      // 检查是否有正在进行的安装
      const hasActiveInstall = Array.from(this.activeInstalls.values()).some(
        (v) => v
      );
      if (hasActiveInstall) {
        return c.json(
          {
            success: false,
            error: {
              code: "INSTALL_IN_PROGRESS",
              message: "已有安装进程正在进行，请等待完成后再试",
            },
          },
          409
        );
      }

      // 立即返回响应，安装过程通过 WebSocket 推送
      this.npmManager.installVersion(version).catch((error) => {
        this.logger.error("安装过程失败:", error);
      });

      return c.json({
        success: true,
        data: {
          version: version,
          message: "安装已启动，请查看实时日志",
        },
        message: "安装请求已接受",
      });
    } catch (error) {
      this.logger.error("处理安装请求失败:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "REQUEST_FAILED",
            message: error instanceof Error ? error.message : "请求处理失败",
          },
        },
        500
      );
    }
  }
}
