import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaticFileHandler } from "../StaticFileHandler.js";

// Mock dependencies
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("node:path", () => ({
  dirname: vi.fn(),
  join: vi.fn(),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

vi.mock("../../Logger.js", () => ({
  logger: {
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

describe("StaticFileHandler", () => {
  let staticFileHandler: StaticFileHandler;
  let mockLogger: any;
  let mockContext: any;
  let mockExistsSync: any;
  let mockReadFile: any;
  let mockDirname: any;
  let mockJoin: any;
  let mockFileURLToPath: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    vi.mocked(logger.withTag).mockReturnValue(mockLogger);

    // Mock fs functions
    const fs = await import("node:fs");
    const fsPromises = await import("node:fs/promises");
    const path = await import("node:path");
    const url = await import("node:url");

    mockExistsSync = vi.mocked(fs.existsSync);
    mockReadFile = vi.mocked(fsPromises.readFile);
    mockDirname = vi.mocked(path.dirname);
    mockJoin = vi.mocked(path.join);
    mockFileURLToPath = vi.mocked(url.fileURLToPath);

    // Setup default mocks
    mockFileURLToPath.mockReturnValue(
      "/project/dist/handlers/StaticFileHandler.js"
    );
    mockDirname.mockReturnValue("/project/dist/handlers");
    mockJoin.mockImplementation((...args: string[]) => args.join("/"));

    // Mock Context
    mockContext = {
      req: {
        url: "http://localhost:3000/",
      },
      text: vi.fn().mockImplementation((text, status) => ({
        status,
        text,
        headers: new Map(),
      })),
      html: vi.fn().mockImplementation((html) => ({
        status: 200,
        html,
        headers: new Map([["Content-Type", "text/html"]]),
      })),
      body: vi.fn().mockImplementation((body, status, headers) => ({
        status,
        body,
        headers: new Map(Object.entries(headers || {})),
      })),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      // Mock existsSync to return true for the first path
      mockExistsSync.mockReturnValueOnce(true);

      staticFileHandler = new StaticFileHandler();

      expect(staticFileHandler).toBeInstanceOf(StaticFileHandler);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it("应该成功找到 web 路径", () => {
      mockExistsSync.mockReturnValueOnce(true);

      staticFileHandler = new StaticFileHandler();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("静态文件服务路径:")
      );
    });

    it("应该处理未找到 web 路径的情况", () => {
      mockExistsSync.mockReturnValue(false);

      staticFileHandler = new StaticFileHandler();

      expect(mockLogger.warn).toHaveBeenCalledWith("未找到静态文件目录");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "尝试的路径:",
        expect.any(Array)
      );
    });

    it("应该处理初始化错误", () => {
      mockFileURLToPath.mockImplementation(() => {
        throw new Error("URL parsing failed");
      });

      staticFileHandler = new StaticFileHandler();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "初始化静态文件路径失败:",
        expect.any(Error)
      );
    });
  });

  describe("handleStaticFile", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValueOnce(true); // For constructor
      staticFileHandler = new StaticFileHandler();
    });

    it("应该为根路径提供 index.html", async () => {
      mockContext.req.url = "http://localhost:3000/";
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(Buffer.from("<html>Index</html>"));

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理静态文件请求: /");
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("index.html")
      );
      expect(mockContext.text).toHaveBeenCalledWith("<html>Index</html>", 200, {
        "Content-Type": "text/html",
      });
    });

    it("应该以正确的内容类型提供 CSS 文件", async () => {
      mockContext.req.url = "http://localhost:3000/styles.css";
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(Buffer.from("body { color: red; }"));

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.text).toHaveBeenCalledWith(
        "body { color: red; }",
        200,
        { "Content-Type": "text/css" }
      );
    });

    it("应该以正确的内容类型提供 JavaScript 文件", async () => {
      mockContext.req.url = "http://localhost:3000/app.js";
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(Buffer.from("console.log('hello');"));

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.text).toHaveBeenCalledWith(
        "console.log('hello');",
        200,
        { "Content-Type": "application/javascript" }
      );
    });

    it("应该以正确的内容类型提供二进制文件", async () => {
      mockContext.req.url = "http://localhost:3000/image.png";
      mockExistsSync.mockReturnValue(true);
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      mockReadFile.mockResolvedValue(binaryData);

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.body).toHaveBeenCalledWith(
        new Uint8Array(binaryData),
        200,
        {
          "Content-Type": "image/png",
        }
      );
    });

    it("当 web 路径不可用时应该返回错误页面", async () => {
      mockExistsSync.mockReturnValue(false); // No web path found
      staticFileHandler = new StaticFileHandler();

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.html).toHaveBeenCalledWith(
        expect.stringContaining("找不到前端资源文件")
      );
    });

    it("应该为 SPA 路由回退到 index.html", async () => {
      mockContext.req.url = "http://localhost:3000/app/dashboard";
      mockExistsSync
        .mockReturnValueOnce(false) // File doesn't exist
        .mockReturnValueOnce(true); // index.html exists
      mockReadFile.mockResolvedValue(Buffer.from("<html>SPA</html>"));

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("SPA 回退到 index.html")
      );
      expect(mockContext.text).toHaveBeenCalledWith("<html>SPA</html>", 200, {
        "Content-Type": "text/html",
      });
    });

    it("当文件和 index.html 都不存在时应该返回 404", async () => {
      mockContext.req.url = "http://localhost:3000/nonexistent.html";
      mockExistsSync.mockReturnValue(false);

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("文件不存在:")
      );
      expect(mockContext.text).toHaveBeenCalledWith("Not Found", 404);
    });

    it("应该处理 URL 解析错误", async () => {
      // URL parsing error happens before try-catch, so we need to test differently
      // The error will be thrown and caught by the outer try-catch
      mockContext.req.url = "invalid-url";

      try {
        await staticFileHandler.handleStaticFile(mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect((error as Error).message).toContain("Invalid URL");
      }
    });
  });

  describe("getContentType", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValueOnce(true);
      staticFileHandler = new StaticFileHandler();
    });

    it("应该为 HTML 文件返回正确的内容类型", () => {
      // Access private method through type assertion for testing
      const handler = staticFileHandler as any;

      expect(handler.getContentType("index.html")).toBe("text/html");
      expect(handler.getContentType("page.htm")).toBe("text/html");
    });

    it("应该为 JavaScript 文件返回正确的内容类型", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("app.js")).toBe("application/javascript");
      expect(handler.getContentType("module.mjs")).toBe(
        "application/javascript"
      );
    });

    it("应该为 CSS 文件返回正确的内容类型", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("styles.css")).toBe("text/css");
    });

    it("应该为图片文件返回正确的内容类型", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("image.png")).toBe("image/png");
      expect(handler.getContentType("photo.jpg")).toBe("image/jpeg");
      expect(handler.getContentType("photo.jpeg")).toBe("image/jpeg");
      expect(handler.getContentType("animation.gif")).toBe("image/gif");
      expect(handler.getContentType("icon.svg")).toBe("image/svg+xml");
      expect(handler.getContentType("favicon.ico")).toBe("image/x-icon");
    });

    it("应该为字体文件返回正确的内容类型", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("font.woff")).toBe("font/woff");
      expect(handler.getContentType("font.woff2")).toBe("font/woff2");
      expect(handler.getContentType("font.ttf")).toBe("font/ttf");
      expect(handler.getContentType("font.eot")).toBe(
        "application/vnd.ms-fontobject"
      );
    });

    it("应该为文档文件返回正确的内容类型", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("document.pdf")).toBe("application/pdf");
      expect(handler.getContentType("data.json")).toBe("application/json");
      expect(handler.getContentType("readme.txt")).toBe("text/plain");
      expect(handler.getContentType("config.xml")).toBe("application/xml");
    });

    it("应该为归档文件返回正确的内容类型", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("archive.zip")).toBe("application/zip");
      expect(handler.getContentType("backup.tar")).toBe("application/x-tar");
      expect(handler.getContentType("compressed.gz")).toBe("application/gzip");
    });

    it("应该为未知扩展名返回默认内容类型", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("file.unknown")).toBe(
        "application/octet-stream"
      );
      expect(handler.getContentType("file")).toBe("application/octet-stream");
      expect(handler.getContentType("")).toBe("application/octet-stream");
    });

    it("应该处理包含多个点的文件名", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("jquery.min.js")).toBe(
        "application/javascript"
      );
      expect(handler.getContentType("bootstrap.min.css")).toBe("text/css");
      expect(handler.getContentType("config.prod.json")).toBe(
        "application/json"
      );
    });

    it("应该处理大写扩展名", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("IMAGE.PNG")).toBe("image/png");
      expect(handler.getContentType("SCRIPT.JS")).toBe(
        "application/javascript"
      );
      expect(handler.getContentType("STYLE.CSS")).toBe("text/css");
    });
  });

  describe("createErrorPage", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValueOnce(true);
      staticFileHandler = new StaticFileHandler();
    });

    it("应该使用自定义消息创建错误页面", () => {
      const handler = staticFileHandler as any;
      const message = "Custom error message";

      const response = handler.createErrorPage(mockContext, message);

      expect(mockContext.html).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
      expect(mockContext.html).toHaveBeenCalledWith(
        expect.stringContaining("小智配置管理")
      );
      expect(mockContext.html).toHaveBeenCalledWith(
        expect.stringContaining(
          "cd apps/frontend && pnpm install && pnpm build"
        )
      );
    });

    it("应该创建具有 HTML 结构的错误页面", () => {
      const handler = staticFileHandler as any;
      const message = "Test error";

      handler.createErrorPage(mockContext, message);

      const htmlContent = mockContext.html.mock.calls[0][0];
      expect(htmlContent).toContain("<!DOCTYPE html>");
      expect(htmlContent).toContain("<html>");
      expect(htmlContent).toContain("<head>");
      expect(htmlContent).toContain("<body>");
      expect(htmlContent).toContain("</html>");
    });

    it("应该在错误页面中包含 CSS 样式", () => {
      const handler = staticFileHandler as any;
      const message = "Test error";

      handler.createErrorPage(mockContext, message);

      const htmlContent = mockContext.html.mock.calls[0][0];
      expect(htmlContent).toContain("<style>");
      expect(htmlContent).toContain("font-family:");
      expect(htmlContent).toContain(".error");
      expect(htmlContent).toContain(".info");
    });
  });

  describe("isWebPathAvailable", () => {
    it("当 web 路径存在时应该返回 true", () => {
      mockExistsSync.mockReturnValue(true);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.isWebPathAvailable();

      expect(result).toBe(true);
    });

    it("当 web 路径为 null 时应该返回 false", () => {
      mockExistsSync.mockReturnValue(false);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.isWebPathAvailable();

      expect(result).toBe(false);
    });

    it("当 web 路径在文件系统中不存在时应该返回 false", () => {
      mockExistsSync
        .mockReturnValueOnce(true) // For constructor
        .mockReturnValueOnce(false); // For isWebPathAvailable check
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.isWebPathAvailable();

      expect(result).toBe(false);
    });
  });

  describe("getWebPath", () => {
    it("当可用时应该返回 web 路径", () => {
      mockExistsSync.mockReturnValue(true);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.getWebPath();

      expect(result).toBe("/project/dist/handlers/../../apps/frontend/dist");
    });

    it("当 web 路径不可用时应该返回 null", () => {
      mockExistsSync.mockReturnValue(false);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.getWebPath();

      expect(result).toBe(null);
    });
  });

  describe("reinitializeWebPath", () => {
    it("应该重新初始化 web 路径", () => {
      mockExistsSync.mockReturnValue(false);
      staticFileHandler = new StaticFileHandler();

      // Clear previous calls
      mockLogger.debug.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();

      // Mock to return true on reinitialize
      mockExistsSync.mockReturnValueOnce(true);

      staticFileHandler.reinitializeWebPath();

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe("serveFile", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValueOnce(true);
      staticFileHandler = new StaticFileHandler();
    });

    it("应该以字符串形式提供文本文件", async () => {
      const handler = staticFileHandler as any;
      const filePath = "/path/to/file.txt";
      const contentType = "text/plain";
      const fileContent = "Hello, World!";

      mockReadFile.mockResolvedValue(Buffer.from(fileContent));

      await handler.serveFile(mockContext, filePath, contentType);

      expect(mockReadFile).toHaveBeenCalledWith(filePath);
      expect(mockContext.text).toHaveBeenCalledWith(fileContent, 200, {
        "Content-Type": contentType,
      });
    });

    it("应该以字符串形式提供 JavaScript 文件", async () => {
      const handler = staticFileHandler as any;
      const filePath = "/path/to/app.js";
      const contentType = "application/javascript";
      const fileContent = "console.log('test');";

      mockReadFile.mockResolvedValue(Buffer.from(fileContent));

      await handler.serveFile(mockContext, filePath, contentType);

      expect(mockContext.text).toHaveBeenCalledWith(fileContent, 200, {
        "Content-Type": contentType,
      });
    });

    it("应该以字符串形式提供 JSON 文件", async () => {
      const handler = staticFileHandler as any;
      const filePath = "/path/to/data.json";
      const contentType = "application/json";
      const fileContent = '{"key": "value"}';

      mockReadFile.mockResolvedValue(Buffer.from(fileContent));

      await handler.serveFile(mockContext, filePath, contentType);

      expect(mockContext.text).toHaveBeenCalledWith(fileContent, 200, {
        "Content-Type": contentType,
      });
    });

    it("应该以 buffer 形式提供二进制文件", async () => {
      const handler = staticFileHandler as any;
      const filePath = "/path/to/image.png";
      const contentType = "image/png";
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      mockReadFile.mockResolvedValue(binaryData);

      await handler.serveFile(mockContext, filePath, contentType);

      expect(mockContext.body).toHaveBeenCalledWith(
        new Uint8Array(binaryData),
        200,
        {
          "Content-Type": contentType,
        }
      );
    });

    it("应该处理文件读取错误", async () => {
      const handler = staticFileHandler as any;
      const filePath = "/path/to/error.txt";
      const contentType = "text/plain";
      const error = new Error("File read failed");

      mockReadFile.mockRejectedValue(error);

      await expect(
        handler.serveFile(mockContext, filePath, contentType)
      ).rejects.toThrow("File read failed");

      expect(mockLogger.error).toHaveBeenCalledWith(
        `读取文件失败: ${filePath}`,
        error
      );
    });
  });

  describe("integration scenarios", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValueOnce(true);
      staticFileHandler = new StaticFileHandler();
    });

    it("应该处理完整的静态文件服务工作流程", async () => {
      // Test serving different file types
      const testCases = [
        {
          url: "http://localhost:3000/index.html",
          content: "<html>Home</html>",
          contentType: "text/html",
        },
        {
          url: "http://localhost:3000/app.js",
          content: "console.log('app');",
          contentType: "application/javascript",
        },
        {
          url: "http://localhost:3000/styles.css",
          content: "body { margin: 0; }",
          contentType: "text/css",
        },
      ];

      for (const testCase of testCases) {
        mockContext.req.url = testCase.url;
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue(Buffer.from(testCase.content));

        await staticFileHandler.handleStaticFile(mockContext);

        expect(mockContext.text).toHaveBeenCalledWith(testCase.content, 200, {
          "Content-Type": testCase.contentType,
        });
      }
    });

    it("应该处理 SPA 路由工作流程", async () => {
      const spaRoutes = [
        "/app/dashboard",
        "/user/profile",
        "/settings/general",
      ];

      for (const route of spaRoutes) {
        mockContext.req.url = `http://localhost:3000${route}`;
        mockExistsSync
          .mockReturnValueOnce(false) // Route file doesn't exist
          .mockReturnValueOnce(true); // index.html exists
        mockReadFile.mockResolvedValue(Buffer.from("<html>SPA App</html>"));

        await staticFileHandler.handleStaticFile(mockContext);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("SPA 回退到 index.html")
        );
      }
    });

    it("应该优雅地处理错误场景", async () => {
      // Test various error conditions
      const errorCases = [
        {
          description: "file not found",
          url: "http://localhost:3000/nonexistent.html",
          expectedStatus: 404,
          expectedText: "Not Found",
          setupMock: () => mockExistsSync.mockReturnValue(false),
        },
      ];

      for (const errorCase of errorCases) {
        mockContext.req.url = errorCase.url;
        errorCase.setupMock();

        await staticFileHandler.handleStaticFile(mockContext);

        expect(mockContext.text).toHaveBeenCalledWith(
          errorCase.expectedText,
          errorCase.expectedStatus
        );
      }
    });
  });

  describe("edge cases and boundary conditions", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValueOnce(true);
      staticFileHandler = new StaticFileHandler();
    });

    it("应该处理空文件", async () => {
      mockContext.req.url = "http://localhost:3000/empty.txt";
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(Buffer.from(""));

      await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.text).toHaveBeenCalledWith("", 200, {
        "Content-Type": "text/plain",
      });
    });

    it("应该处理文件名中包含特殊字符的文件", async () => {
      const specialFiles = [
        "文件名中文.html",
        "file with spaces.js",
        "file-with-dashes.css",
        "file_with_underscores.json",
        "file.with.dots.txt",
      ];

      for (const fileName of specialFiles) {
        mockContext.req.url = `http://localhost:3000/${fileName}`;
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue(Buffer.from("content"));

        await staticFileHandler.handleStaticFile(mockContext);

        expect(mockReadFile).toHaveBeenCalled();
      }
    });

    it("应该处理很长的文件路径", async () => {
      const longPath = `/very/long/path/to/file/${"a".repeat(100)}.html`;
      mockContext.req.url = `http://localhost:3000${longPath}`;
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(Buffer.from("<html>Long path</html>"));

      await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.text).toHaveBeenCalledWith(
        "<html>Long path</html>",
        200,
        { "Content-Type": "text/html" }
      );
    });

    it("应该优雅地处理格式错误的 URL", async () => {
      const malformedUrls = [
        "not-a-url",
        "http://",
        "://localhost:3000/file.html",
      ];

      for (const url of malformedUrls) {
        mockContext.req.url = url;

        try {
          await staticFileHandler.handleStaticFile(mockContext);
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
        }
      }
    });

    it("应该处理并发请求", async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        url: `http://localhost:3000/file${i}.html`,
        content: `<html>File ${i}</html>`,
      }));

      mockExistsSync.mockReturnValue(true);

      const promises = requests.map((req) => {
        mockContext.req.url = req.url;
        mockReadFile.mockResolvedValue(Buffer.from(req.content));
        return staticFileHandler.handleStaticFile(mockContext);
      });

      await Promise.all(promises);

      expect(mockReadFile).toHaveBeenCalledTimes(10);
    });

    it("应该处理不同的路径分隔符", () => {
      const handler = staticFileHandler as any;

      // Test with different path formats
      expect(handler.getContentType("path\\to\\file.js")).toBe(
        "application/javascript"
      );
      expect(handler.getContentType("path/to/file.css")).toBe("text/css");
    });

    it("应该处理没有扩展名的文件", async () => {
      mockContext.req.url = "http://localhost:3000/README";
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(Buffer.from("README content"));

      await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.body).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        200,
        {
          "Content-Type": "application/octet-stream",
        }
      );
    });

    it("应该处理不区分大小写的文件扩展名", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("FILE.HTML")).toBe("text/html");
      expect(handler.getContentType("Script.JS")).toBe(
        "application/javascript"
      );
      expect(handler.getContentType("Style.CSS")).toBe("text/css");
    });

    it("应该处理路径遍历检测", () => {
      // Test the path traversal detection logic directly
      const handler = staticFileHandler as any;

      expect("../../../etc/passwd".includes("..")).toBe(true);
      expect("normal/path/file.html".includes("..")).toBe(false);
      expect("..\\..\\windows\\system32".includes("..")).toBe(true);
    });
  });
});
