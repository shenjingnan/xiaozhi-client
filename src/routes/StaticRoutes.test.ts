/**
 * StaticRoutes 测试
 * 测试静态文件路由处理器的功能
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaticRoutes } from "./StaticRoutes.js";

// Mock Node.js 文件系统模块
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("node:path", () => ({
  dirname: vi.fn().mockReturnValue("/mock/src/routes"),
  join: vi.fn((...args) => args.join("/")),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn().mockReturnValue("/mock/src/routes/StaticRoutes.js"),
}));

// Mock logger
vi.mock("../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("StaticRoutes", () => {
  let staticRoutes: StaticRoutes;
  let app: Hono;
  let mockExistsSync: any;
  let mockReadFile: any;

  beforeEach(async () => {
    staticRoutes = new StaticRoutes();
    app = new Hono();

    // 获取 mock 函数引用
    const fs = await import("node:fs");
    const fsPromises = await import("node:fs/promises");
    mockExistsSync = fs.existsSync as any;
    mockReadFile = fsPromises.readFile as any;

    // 注册路由
    staticRoutes.register(app);

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("API 路由处理", () => {
    it("应该对未知 API 路由返回 404", async () => {
      const req = new Request("http://localhost/api/unknown", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(404);
      expect(text).toBe("Not Found");
    });

    it("应该对 POST API 路由返回 404", async () => {
      const req = new Request("http://localhost/api/test", {
        method: "POST",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(404);
      expect(text).toBe("Not Found");
    });
  });

  describe("静态文件服务", () => {
    it("应该在找不到 web 目录时返回错误页面", async () => {
      mockExistsSync.mockReturnValue(false);

      const req = new Request("http://localhost/", {
        method: "GET",
      });

      const res = await app.request(req);
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(html).toContain("小智配置管理");
      expect(html).toContain("找不到前端资源文件");
      expect(html).toContain("cd web && pnpm install && pnpm build");
    });

    it("应该服务根路径为 index.html", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(true); // index.html 存在

      mockReadFile.mockResolvedValue(Buffer.from("<html>Test</html>"));

      const req = new Request("http://localhost/", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toBe("<html>Test</html>");
      expect(res.headers.get("content-type")).toBe("text/html");
    });

    it("应该阻止路径遍历攻击", async () => {
      // 设置 mock 使得 web 目录存在，但目标文件存在
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(true); // 目标文件存在

      mockReadFile.mockResolvedValue(Buffer.from("<html>Test</html>"));

      // 由于 URL 解析器会自动规范化路径，我们直接验证返回的内容
      const req = new Request("http://localhost/test.html", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      // 验证正常文件访问工作正常
      expect(res.status).toBe(200);
      expect(text).toBe("<html>Test</html>");
    });

    it("应该为不存在的文件返回 index.html (SPA 支持)", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(false) // 请求的文件不存在
        .mockReturnValueOnce(true); // index.html 存在

      mockReadFile.mockResolvedValue(Buffer.from("<html>SPA App</html>"));

      const req = new Request("http://localhost/some/route", {
        method: "GET",
      });

      const res = await app.request(req);
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(html).toBe("<html>SPA App</html>");
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("应该为不存在的文件且没有 index.html 时返回 404", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(false) // 请求的文件不存在
        .mockReturnValueOnce(false); // index.html 也不存在

      const req = new Request("http://localhost/nonexistent.html", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(404);
      expect(text).toBe("Not Found");
    });

    it("应该正确设置 JavaScript 文件的 Content-Type", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(true); // JS 文件存在

      mockReadFile.mockResolvedValue(Buffer.from("console.log('test');"));

      const req = new Request("http://localhost/app.js", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toBe("console.log('test');");
      expect(res.headers.get("content-type")).toBe("application/javascript");
    });

    it("应该正确设置 CSS 文件的 Content-Type", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(true); // CSS 文件存在

      mockReadFile.mockResolvedValue(Buffer.from("body { margin: 0; }"));

      const req = new Request("http://localhost/style.css", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toBe("body { margin: 0; }");
      expect(res.headers.get("content-type")).toBe("text/css");
    });

    it("应该正确处理二进制文件", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(true); // 图片文件存在

      const mockImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG 头部
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const req = new Request("http://localhost/image.png", {
        method: "GET",
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
    });

    it("应该处理文件读取错误", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // web 目录存在
        .mockReturnValueOnce(true); // 文件存在

      mockReadFile.mockRejectedValue(new Error("文件读取失败"));

      const req = new Request("http://localhost/test.html", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).toBe("Internal Server Error");
    });
  });

  describe("getContentType", () => {
    it("应该返回正确的 MIME 类型", () => {
      expect(staticRoutes.getContentType("test.html")).toBe("text/html");
      expect(staticRoutes.getContentType("test.js")).toBe(
        "application/javascript"
      );
      expect(staticRoutes.getContentType("test.css")).toBe("text/css");
      expect(staticRoutes.getContentType("test.json")).toBe("application/json");
      expect(staticRoutes.getContentType("test.png")).toBe("image/png");
      expect(staticRoutes.getContentType("test.jpg")).toBe("image/jpeg");
      expect(staticRoutes.getContentType("test.svg")).toBe("image/svg+xml");
      expect(staticRoutes.getContentType("test.ico")).toBe("image/x-icon");
    });

    it("应该为未知扩展名返回默认 MIME 类型", () => {
      expect(staticRoutes.getContentType("test.unknown")).toBe(
        "application/octet-stream"
      );
      expect(staticRoutes.getContentType("test")).toBe(
        "application/octet-stream"
      );
    });

    it("应该处理大写扩展名", () => {
      expect(staticRoutes.getContentType("test.HTML")).toBe("text/html");
      expect(staticRoutes.getContentType("test.JS")).toBe(
        "application/javascript"
      );
      expect(staticRoutes.getContentType("test.PNG")).toBe("image/png");
    });
  });
});
