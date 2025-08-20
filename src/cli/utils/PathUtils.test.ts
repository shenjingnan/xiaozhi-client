import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathUtils } from "./PathUtils.js";

// Mock process.argv
const originalArgv = process.argv;

describe("PathUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe("getExecutablePath", () => {
    it("should return correct path based on current CLI script location", () => {
      // Mock process.argv[1] to simulate CLI script path
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getExecutablePath("WebServerStandalone");
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "WebServerStandalone.js"
      );

      expect(result).toBe(expected);
    });

    it("should handle different CLI script locations", () => {
      process.argv = ["node", "/opt/xiaozhi/dist/cli.js"];

      const result = PathUtils.getExecutablePath("mcpServerProxy");
      const expected = path.join("/opt/xiaozhi/dist", "mcpServerProxy.js");

      expect(result).toBe(expected);
    });

    it("should work with relative paths", () => {
      process.argv = ["node", "./dist/cli.js"];

      const result = PathUtils.getExecutablePath("test");
      const expected = path.join("./dist", "test.js");

      expect(result).toBe(expected);
    });
  });

  describe("getWebServerStandalonePath", () => {
    it("should return correct WebServerStandalone path", () => {
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getWebServerStandalonePath();
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "WebServerStandalone.js"
      );

      expect(result).toBe(expected);
    });
  });

  describe("getMcpServerProxyPath", () => {
    it("should return correct mcpServerProxy path", () => {
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getMcpServerProxyPath();
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "mcpServerProxy.js"
      );

      expect(result).toBe(expected);
    });
  });

  describe("path resolution consistency", () => {
    it("should maintain consistent path resolution across different methods", () => {
      process.argv = ["node", "/test/dist/cli.js"];

      const webServerPath = PathUtils.getWebServerStandalonePath();
      const mcpProxyPath = PathUtils.getMcpServerProxyPath();
      const customPath = PathUtils.getExecutablePath("custom");

      // All paths should be in the same directory
      const webServerDir = path.dirname(webServerPath);
      const mcpProxyDir = path.dirname(mcpProxyPath);
      const customDir = path.dirname(customPath);

      expect(webServerDir).toBe(mcpProxyDir);
      expect(mcpProxyDir).toBe(customDir);
      expect(customDir).toBe("/test/dist");
    });
  });

  describe("edge cases", () => {
    it("should handle empty executable name", () => {
      process.argv = ["node", "/test/dist/cli.js"];

      const result = PathUtils.getExecutablePath("");
      const expected = path.join("/test/dist", ".js");

      expect(result).toBe(expected);
    });

    it("should handle executable name with extension", () => {
      process.argv = ["node", "/test/dist/cli.js"];

      const result = PathUtils.getExecutablePath("test.exe");
      const expected = path.join("/test/dist", "test.exe.js");

      expect(result).toBe(expected);
    });

    it("should handle complex directory structures", () => {
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
