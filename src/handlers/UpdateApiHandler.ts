import type { Context } from "hono";
import { z } from "zod";
import { logger } from "../Logger.js";
import { NPMManager } from "../services/NPMManager.js";

// 版本号请求格式验证
const UpdateRequestSchema = z.object({
  version: z.string().min(1, "版本号不能为空"),
});

export class UpdateApiHandler {
  private npmManager: NPMManager;
  private logger = logger.withTag("UpdateApiHandler");

  constructor() {
    this.npmManager = new NPMManager();
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

      // 直接执行安装
      this.logger.info(`开始安装 xiaozhi-client@${version}`);
      await this.npmManager.installVersion(version);

      return c.json({
        success: true,
        data: {
          version: version,
          message: `成功安装 xiaozhi-client@${version}`,
        },
        message: "安装完成",
      });
    } catch (error) {
      this.logger.error("安装失败:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INSTALL_FAILED",
            message: error instanceof Error ? error.message : "安装失败",
          },
        },
        500
      );
    }
  }
}
