/**
 * 静态文件路由处理器
 * 处理静态文件服务和 SPA 路由
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Hono } from "hono";
import { logger } from "../Logger.js";
import type { RouteHandler } from "../types/WebServerTypes.js";

/**
 * 静态文件路由处理器
 * 负责处理静态文件服务和 SPA 回退路由
 */
export class StaticRoutes implements RouteHandler {
  private readonly contentTypes: Record<string, string> = {
    html: "text/html",
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };

  /**
   * 注册静态文件路由
   * @param app Hono 应用实例
   */
  register(app: Hono): void {
    // 处理未知的 API 路由 - 返回 404
    app.all("/api/*", async (c) => {
      logger.warn(`未知的 API 路由: ${c.req.url}`);
      return c.text("Not Found", 404);
    });

    // 静态文件服务 - 放在最后作为回退
    app.get("*", async (c) => {
      return this.serveStaticFile(c);
    });
  }

  /**
   * 服务静态文件
   * 从 WebServer.ts 迁移的静态文件服务逻辑
   * @param c Hono 上下文对象
   */
  private async serveStaticFile(c: any) {
    const pathname = new URL(c.req.url).pathname;

    try {
      // 获取当前文件所在目录
      const __dirname = dirname(fileURLToPath(import.meta.url));

      // 确定web目录路径
      const possibleWebPaths = [
        join(__dirname, "..", "..", "web", "dist"), // 构建后的目录
        join(__dirname, "..", "..", "web"), // 开发目录
        join(process.cwd(), "web", "dist"), // 当前工作目录
        join(process.cwd(), "web"),
      ];

      const webPath = possibleWebPaths.find((p) => existsSync(p));

      if (!webPath) {
        // 如果找不到 web 目录，返回简单的 HTML 页面
        const errorHtml = this.generateErrorPage();
        return c.html(errorHtml);
      }

      // 处理路径
      let filePath = pathname;
      if (filePath === "/") {
        filePath = "/index.html";
      }

      // 安全性检查：防止路径遍历
      if (filePath.includes("..")) {
        logger.warn(`路径遍历攻击尝试: ${filePath}`);
        return c.text("Forbidden", 403);
      }

      const fullPath = join(webPath, filePath);

      // 检查文件是否存在
      if (!existsSync(fullPath)) {
        // 对于 SPA，返回 index.html
        const indexPath = join(webPath, "index.html");
        if (existsSync(indexPath)) {
          const content = await readFile(indexPath);
          return c.html(content.toString());
        }
        logger.warn(`文件不存在: ${fullPath}`);
        return c.text("Not Found", 404);
      }

      // 读取文件
      const content = await readFile(fullPath);

      // 设置正确的 Content-Type
      const ext = fullPath.split(".").pop()?.toLowerCase();
      const contentType =
        this.contentTypes[ext || ""] || "application/octet-stream";

      // 对于文本文件，返回字符串；对于二进制文件，返回 ArrayBuffer
      if (
        contentType.startsWith("text/") ||
        contentType.includes("javascript") ||
        contentType.includes("json")
      ) {
        return c.text(content.toString(), 200, { "Content-Type": contentType });
      }

      return c.body(content, 200, { "Content-Type": contentType });
    } catch (error) {
      logger.error("静态文件服务错误:", error);
      return c.text("Internal Server Error", 500);
    }
  }

  /**
   * 生成错误页面 HTML
   * @returns 错误页面 HTML 字符串
   */
  private generateErrorPage(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>小智配置管理</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: sans-serif; 
            max-width: 800px; 
            margin: 50px auto; 
            padding: 20px; 
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .error { 
            color: #e53e3e; 
            background: #fed7d7; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          h1 {
            color: #2d3748;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
          }
          pre {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>小智配置管理</h1>
          <div class="error">
            <p><strong>错误：找不到前端资源文件。</strong></p>
            <p>请先构建前端项目：</p>
            <pre>cd web && pnpm install && pnpm build</pre>
          </div>
          <p>如果问题持续存在，请检查以下目录是否存在：</p>
          <ul>
            <li><code>web/dist/</code> - 构建后的前端文件</li>
            <li><code>web/</code> - 开发环境前端文件</li>
          </ul>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 检查是否为文本文件类型
   * @param contentType MIME 类型
   * @returns 是否为文本文件
   */
  private isTextFile(contentType: string): boolean {
    return (
      contentType.startsWith("text/") ||
      contentType.includes("javascript") ||
      contentType.includes("json") ||
      contentType.includes("xml")
    );
  }

  /**
   * 获取文件的 MIME 类型
   * @param filePath 文件路径
   * @returns MIME 类型
   */
  getContentType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return this.contentTypes[ext || ""] || "application/octet-stream";
  }
}
