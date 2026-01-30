import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HTTP_CONTENT_TYPES, HTTP_STATUS_CODES } from "@/constants/index.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type { Context } from "hono";
import { BaseHandler } from "./base.handler.js";

/**
 * 静态文件处理器
 */
export class StaticFileHandler extends BaseHandler {
  private logger: Logger;
  private webPath: string | null = null;

  constructor() {
    super();
    this.logger = logger;
    this.initializeWebPath();
  }

  /**
   * 初始化 Web 路径
   */
  private initializeWebPath(): void {
    try {
      // 获取当前文件所在目录
      const __dirname = dirname(fileURLToPath(import.meta.url));

      logger.debug(`当前文件目录: ${__dirname}`);

      // 确定web目录路径
      // 支持 Nx 构建的 dist/frontend 目录结构
      const possibleWebPaths = [
        // Nx 构建的主要路径：dist/frontend/
        // 对于 dist/backend/handlers/StaticFileHandler.js -> ../../../frontend
        // 对于 dist/backend/cli.js -> ../../frontend
        // 对于 dist/cli.js -> ../frontend
        join(__dirname, "..", "..", "..", "frontend"),
        join(__dirname, "..", "..", "frontend"),
        join(__dirname, "..", "frontend"),

        // 兼容旧构建路径：从 dist 目录向上查找 apps/frontend/dist
        join(__dirname, "..", "..", "apps", "frontend", "dist"),
        join(__dirname, "..", "apps", "frontend", "dist"),

        // 备用路径：查找未构建的 apps/frontend 目录（开发模式）
        join(__dirname, "..", "..", "apps", "frontend"),
        join(__dirname, "..", "apps", "frontend"),

        // 兼容路径：保持对旧 web 目录的支持（向后兼容）
        join(__dirname, "..", "..", "web", "dist"),
        join(__dirname, "..", "web", "dist"),

        // 备用兼容路径：查找未构建的 web 目录（开发模式）
        join(__dirname, "..", "..", "web"),
        join(__dirname, "..", "web"),

        // 兜底路径：从源码目录查找（开发模式下的源码执行）
        join(__dirname, "..", "..", "..", "apps", "frontend", "dist"),
        join(__dirname, "..", "..", "..", "apps", "frontend"),
        join(__dirname, "..", "..", "..", "web", "dist"),
        join(__dirname, "..", "..", "..", "web"),
      ];

      // 查找第一个存在的路径
      this.webPath =
        possibleWebPaths.find((p) => {
          const exists = existsSync(p);
          logger.debug(`检查路径 ${p}: ${exists ? "存在" : "不存在"}`);
          return exists;
        }) || null;

      if (this.webPath) {
        logger.debug(`静态文件服务路径: ${this.webPath}`);
      } else {
        logger.warn("未找到静态文件目录");
        logger.debug("尝试的路径:", possibleWebPaths);
      }
    } catch (error) {
      logger.error("初始化静态文件路径失败:", error);
    }
  }

  /**
   * 处理静态文件请求
   * GET /*
   */
  async handleStaticFile(c: Context): Promise<Response> {
    const pathname = new URL(c.req.url).pathname;

    try {
      c.logger.debug(`处理静态文件请求: ${pathname}`);

      if (!this.webPath) {
        return this.createErrorPage(c, "找不到前端资源文件");
      }

      // 处理路径
      let filePath = pathname;
      if (filePath === "/") {
        filePath = "/index.html";
      }

      // 安全性检查：防止路径遍历
      if (filePath.includes("..")) {
        c.logger.warn(`路径遍历攻击尝试: ${filePath}`);
        return c.text("Forbidden", HTTP_STATUS_CODES.FORBIDDEN);
      }

      const fullPath = join(this.webPath, filePath);

      // 检查文件是否存在
      if (!existsSync(fullPath)) {
        // 对于 SPA，返回 index.html
        const indexPath = join(this.webPath, "index.html");
        if (existsSync(indexPath)) {
          c.logger.debug(`SPA 回退到 index.html: ${pathname}`);
          return this.serveFile(c, indexPath, HTTP_CONTENT_TYPES.TEXT_HTML);
        }

        c.logger.debug(`文件不存在: ${fullPath}`);
        return c.text("Not Found", HTTP_STATUS_CODES.NOT_FOUND);
      }

      // 确定 Content-Type
      const contentType = this.getContentType(fullPath);

      c.logger.debug(`服务静态文件: ${fullPath}, Content-Type: ${contentType}`);
      return this.serveFile(c, fullPath, contentType);
    } catch (error) {
      c.logger.error(`服务静态文件错误 (${pathname}):`, error);
      return c.text(
        "Internal Server Error",
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 服务文件
   */
  private async serveFile(
    c: Context,
    filePath: string,
    contentType: string
  ): Promise<Response> {
    try {
      const content = await readFile(filePath);

      // 对于文本文件，返回字符串；对于二进制文件，返回 ArrayBuffer
      if (
        contentType.startsWith("text/") ||
        contentType.includes("javascript") ||
        contentType.includes("json")
      ) {
        return c.text(content.toString(), 200, { "Content-Type": contentType });
      }

      return c.body(new Uint8Array(content), 200, {
        "Content-Type": contentType,
      });
    } catch (error) {
      logger.error(`读取文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 获取文件的 Content-Type
   */
  private getContentType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();

    const contentTypes: Record<string, string> = {
      html: HTTP_CONTENT_TYPES.TEXT_HTML,
      htm: HTTP_CONTENT_TYPES.TEXT_HTML,
      js: HTTP_CONTENT_TYPES.APPLICATION_JAVASCRIPT,
      mjs: HTTP_CONTENT_TYPES.APPLICATION_JAVASCRIPT,
      css: HTTP_CONTENT_TYPES.TEXT_CSS,
      json: HTTP_CONTENT_TYPES.APPLICATION_JSON,
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      eot: "application/vnd.ms-fontobject",
      pdf: HTTP_CONTENT_TYPES.APPLICATION_PDF,
      txt: HTTP_CONTENT_TYPES.TEXT_PLAIN,
      xml: HTTP_CONTENT_TYPES.APPLICATION_XML,
      zip: HTTP_CONTENT_TYPES.APPLICATION_ZIP,
      tar: "application/x-tar",
      gz: "application/gzip",
    };

    return (
      contentTypes[ext || ""] || HTTP_CONTENT_TYPES.APPLICATION_OCTET_STREAM
    );
  }

  /**
   * 创建错误页面
   */
  private createErrorPage(c: Context, message: string): Response {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>小智配置管理</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          .error {
            color: #e53e3e;
            background: #fed7d7;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #e53e3e;
          }
          .info {
            background: #e6f3ff;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #0066cc;
            margin-top: 20px;
          }
          pre {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
          }
          h1 {
            color: #2d3748;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <h1>小智配置管理</h1>
        <div class="error">
          <p><strong>错误：</strong>${message}</p>
        </div>
        <div class="info">
          <p><strong>解决方案：</strong></p>
          <p>请先构建前端项目：</p>
          <pre>cd apps/frontend && pnpm install && pnpm build</pre>
          <p><em>如果上面的路径不存在，可以尝试旧路径：</em></p>
          <pre>cd web && pnpm install && pnpm build</pre>
          <p>然后重新启动服务器。</p>
        </div>
      </body>
      </html>
    `;

    return c.html(errorHtml);
  }

  /**
   * 检查静态文件目录是否存在
   */
  isWebPathAvailable(): boolean {
    return this.webPath !== null && existsSync(this.webPath);
  }

  /**
   * 获取静态文件目录路径
   */
  getWebPath(): string | null {
    return this.webPath;
  }

  /**
   * 重新初始化 Web 路径
   */
  reinitializeWebPath(): void {
    this.initializeWebPath();
  }
}
