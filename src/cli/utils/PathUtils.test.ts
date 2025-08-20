import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathUtils } from "./PathUtils.js";

// Mock process.argv
const originalArgv = process.argv;

describe("PathUtils 路径工具", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe("getExecutablePath 获取可执行文件路径", () => {
    it("应该基于当前 CLI 脚本位置返回正确路径", () => {
      // Mock process.argv[1] to simulate CLI script path
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getExecutablePath("WebServerStandalone");
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "WebServerStandalone.js"
      );

      expect(result).toBe(expected);
    });

    it("应该处理不同的 CLI 脚本位置", () => {
      process.argv = ["node", "/opt/xiaozhi/dist/cli.js"];

      const result = PathUtils.getExecutablePath("mcpServerProxy");
      const expected = path.join("/opt/xiaozhi/dist", "mcpServerProxy.js");

      expect(result).toBe(expected);
    });

    it("应该支持相对路径", () => {
      process.argv = ["node", "./dist/cli.js"];

      const result = PathUtils.getExecutablePath("test");
      const expected = path.join("./dist", "test.js");

      expect(result).toBe(expected);
    });
  });

  describe("getWebServerStandalonePath 获取 WebServer 独立启动路径", () => {
    it("应该返回正确的 WebServerStandalone 路径", () => {
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getWebServerStandalonePath();
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "WebServerStandalone.js"
      );

      expect(result).toBe(expected);
    });
  });

  describe("getMcpServerProxyPath 获取 MCP 服务器代理路径", () => {
    it("应该返回正确的 mcpServerProxy 路径", () => {
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getMcpServerProxyPath();
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "mcpServerProxy.js"
      );

      expect(result).toBe(expected);
    });
  });

  describe("路径解析一致性", () => {
    it("应该在不同方法间保持一致的路径解析", () => {
      // 使用跨平台的路径格式
      const testCliPath = path.join("/test", "dist", "cli.js");
      process.argv = ["node", testCliPath];

      const webServerPath = PathUtils.getWebServerStandalonePath();
      const mcpProxyPath = PathUtils.getMcpServerProxyPath();
      const customPath = PathUtils.getExecutablePath("custom");

      // All paths should be in the same directory
      const webServerDir = path.dirname(webServerPath);
      const mcpProxyDir = path.dirname(mcpProxyPath);
      const customDir = path.dirname(customPath);

      expect(webServerDir).toBe(mcpProxyDir);
      expect(mcpProxyDir).toBe(customDir);
      // 使用跨平台的期望路径
      const expectedDir = path.join("/test", "dist");
      expect(customDir).toBe(expectedDir);
    });
  });

  describe("边界情况", () => {
    it("应该处理空的可执行文件名", () => {
      process.argv = ["node", "/test/dist/cli.js"];

      const result = PathUtils.getExecutablePath("");
      const expected = path.join("/test/dist", ".js");

      expect(result).toBe(expected);
    });

    it("应该处理带扩展名的可执行文件名", () => {
      process.argv = ["node", "/test/dist/cli.js"];

      const result = PathUtils.getExecutablePath("test.exe");
      const expected = path.join("/test/dist", "test.exe.js");

      expect(result).toBe(expected);
    });

    it("应该处理复杂的目录结构", () => {
      process.argv = [
        "node",
        "/very/deep/nested/directory/structure/dist/cli.js",
      ];

      const result = PathUtils.getExecutablePath("app");
      const expected = path.join(
        "/very/deep/nested/directory/structure/dist",
        "app.js"
      );

      expect(result).toBe(expected);
    });
  });
});
