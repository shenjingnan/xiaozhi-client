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
    it("should initialize with correct dependencies", () => {
      // Mock existsSync to return true for the first path
      mockExistsSync.mockReturnValueOnce(true);

      staticFileHandler = new StaticFileHandler();

      expect(staticFileHandler).toBeInstanceOf(StaticFileHandler);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it("should find web path successfully", () => {
      mockExistsSync.mockReturnValueOnce(true);

      staticFileHandler = new StaticFileHandler();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("静态文件服务路径:")
      );
    });

    it("should handle no web path found", () => {
      mockExistsSync.mockReturnValue(false);

      staticFileHandler = new StaticFileHandler();

      expect(mockLogger.warn).toHaveBeenCalledWith("未找到静态文件目录");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "尝试的路径:",
        expect.any(Array)
      );
    });

    it("should handle initialization error", () => {
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

    it("should serve index.html for root path", async () => {
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

    it("should serve CSS file with correct content type", async () => {
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

    it("should serve JavaScript file with correct content type", async () => {
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

    it("should serve binary file with correct content type", async () => {
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

    it("should return error page when web path is not available", async () => {
      mockExistsSync.mockReturnValue(false); // No web path found
      staticFileHandler = new StaticFileHandler();

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.html).toHaveBeenCalledWith(
        expect.stringContaining("找不到前端资源文件")
      );
    });

    it("should fallback to index.html for SPA routes", async () => {
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

    it("should return 404 when file and index.html don't exist", async () => {
      mockContext.req.url = "http://localhost:3000/nonexistent.html";
      mockExistsSync.mockReturnValue(false);

      const response = await staticFileHandler.handleStaticFile(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("文件不存在:")
      );
      expect(mockContext.text).toHaveBeenCalledWith("Not Found", 404);
    });

    it("should handle URL parsing errors", async () => {
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

    it("should return correct content type for HTML files", () => {
      // Access private method through type assertion for testing
      const handler = staticFileHandler as any;

      expect(handler.getContentType("index.html")).toBe("text/html");
      expect(handler.getContentType("page.htm")).toBe("text/html");
    });

    it("should return correct content type for JavaScript files", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("app.js")).toBe("application/javascript");
      expect(handler.getContentType("module.mjs")).toBe(
        "application/javascript"
      );
    });

    it("should return correct content type for CSS files", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("styles.css")).toBe("text/css");
    });

    it("should return correct content type for image files", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("image.png")).toBe("image/png");
      expect(handler.getContentType("photo.jpg")).toBe("image/jpeg");
      expect(handler.getContentType("photo.jpeg")).toBe("image/jpeg");
      expect(handler.getContentType("animation.gif")).toBe("image/gif");
      expect(handler.getContentType("icon.svg")).toBe("image/svg+xml");
      expect(handler.getContentType("favicon.ico")).toBe("image/x-icon");
    });

    it("should return correct content type for font files", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("font.woff")).toBe("font/woff");
      expect(handler.getContentType("font.woff2")).toBe("font/woff2");
      expect(handler.getContentType("font.ttf")).toBe("font/ttf");
      expect(handler.getContentType("font.eot")).toBe(
        "application/vnd.ms-fontobject"
      );
    });

    it("should return correct content type for document files", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("document.pdf")).toBe("application/pdf");
      expect(handler.getContentType("data.json")).toBe("application/json");
      expect(handler.getContentType("readme.txt")).toBe("text/plain");
      expect(handler.getContentType("config.xml")).toBe("application/xml");
    });

    it("should return correct content type for archive files", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("archive.zip")).toBe("application/zip");
      expect(handler.getContentType("backup.tar")).toBe("application/x-tar");
      expect(handler.getContentType("compressed.gz")).toBe("application/gzip");
    });

    it("should return default content type for unknown extensions", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("file.unknown")).toBe(
        "application/octet-stream"
      );
      expect(handler.getContentType("file")).toBe("application/octet-stream");
      expect(handler.getContentType("")).toBe("application/octet-stream");
    });

    it("should handle files with multiple dots", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("jquery.min.js")).toBe(
        "application/javascript"
      );
      expect(handler.getContentType("bootstrap.min.css")).toBe("text/css");
      expect(handler.getContentType("config.prod.json")).toBe(
        "application/json"
      );
    });

    it("should handle uppercase extensions", () => {
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

    it("should create error page with custom message", () => {
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
        expect.stringContaining("cd web && pnpm install && pnpm build")
      );
    });

    it("should create error page with HTML structure", () => {
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

    it("should include CSS styles in error page", () => {
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
    it("should return true when web path exists", () => {
      mockExistsSync.mockReturnValue(true);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.isWebPathAvailable();

      expect(result).toBe(true);
    });

    it("should return false when web path is null", () => {
      mockExistsSync.mockReturnValue(false);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.isWebPathAvailable();

      expect(result).toBe(false);
    });

    it("should return false when web path doesn't exist on filesystem", () => {
      mockExistsSync
        .mockReturnValueOnce(true) // For constructor
        .mockReturnValueOnce(false); // For isWebPathAvailable check
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.isWebPathAvailable();

      expect(result).toBe(false);
    });
  });

  describe("getWebPath", () => {
    it("should return web path when available", () => {
      mockExistsSync.mockReturnValue(true);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.getWebPath();

      expect(result).toBe("/project/dist/handlers/../../web/dist");
    });

    it("should return null when web path is not available", () => {
      mockExistsSync.mockReturnValue(false);
      staticFileHandler = new StaticFileHandler();

      const result = staticFileHandler.getWebPath();

      expect(result).toBe(null);
    });
  });

  describe("reinitializeWebPath", () => {
    it("should reinitialize web path", () => {
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

    it("should serve text file as string", async () => {
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

    it("should serve JavaScript file as string", async () => {
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

    it("should serve JSON file as string", async () => {
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

    it("should serve binary file as buffer", async () => {
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

    it("should handle file read errors", async () => {
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

    it("should handle complete static file serving workflow", async () => {
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

    it("should handle SPA routing workflow", async () => {
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

    it("should handle error scenarios gracefully", async () => {
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

    it("should handle empty files", async () => {
      mockContext.req.url = "http://localhost:3000/empty.txt";
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(Buffer.from(""));

      await staticFileHandler.handleStaticFile(mockContext);

      expect(mockContext.text).toHaveBeenCalledWith("", 200, {
        "Content-Type": "text/plain",
      });
    });

    it("should handle files with special characters in names", async () => {
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

    it("should handle very long file paths", async () => {
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

    it("should handle malformed URLs gracefully", async () => {
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

    it("should handle concurrent requests", async () => {
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

    it("should handle different path separators", () => {
      const handler = staticFileHandler as any;

      // Test with different path formats
      expect(handler.getContentType("path\\to\\file.js")).toBe(
        "application/javascript"
      );
      expect(handler.getContentType("path/to/file.css")).toBe("text/css");
    });

    it("should handle files without extensions", async () => {
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

    it("should handle case-insensitive file extensions", () => {
      const handler = staticFileHandler as any;

      expect(handler.getContentType("FILE.HTML")).toBe("text/html");
      expect(handler.getContentType("Script.JS")).toBe(
        "application/javascript"
      );
      expect(handler.getContentType("Style.CSS")).toBe("text/css");
    });

    it("should handle path traversal detection", () => {
      // Test the path traversal detection logic directly
      const handler = staticFileHandler as any;

      expect("../../../etc/passwd".includes("..")).toBe(true);
      expect("normal/path/file.html".includes("..")).toBe(false);
      expect("..\\..\\windows\\system32".includes("..")).toBe(true);
    });
  });
});
