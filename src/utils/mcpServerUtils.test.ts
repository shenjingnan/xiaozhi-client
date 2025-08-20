/**
 * MCP 服务工具函数测试 - 服务端版本
 */

import { describe, expect, it } from "vitest";
import {
  getMcpServerCommunicationType,
  getMcpServerTypeDisplayName,
  isSSEMcpServer,
  isStdioMcpServer,
  isStreamableHTTPMcpServer,
  validateMcpServerConfig,
} from "./mcpServerUtils";

describe("MCP Server Utils - Server Side", () => {
  describe("getMcpServerCommunicationType", () => {
    it("应该正确识别 stdio 类型的服务", () => {
      const stdioConfig = {
        command: "node",
        args: ["./mcpServers/calculator.js"],
      };

      expect(getMcpServerCommunicationType(stdioConfig)).toBe("stdio");
    });

    it("应该正确识别带有环境变量的 stdio 类型服务", () => {
      const stdioConfigWithEnv = {
        command: "node",
        args: ["./mcpServers/datetime.js"],
        env: { NODE_ENV: "production" },
      };

      expect(getMcpServerCommunicationType(stdioConfigWithEnv)).toBe("stdio");
    });

    it("应该正确识别 sse 类型的服务", () => {
      const sseConfig = {
        type: "sse" as const,
        url: "https://mcp.api-inference.modelscope.net/d3cfd34529ae4e/sse",
      };

      expect(getMcpServerCommunicationType(sseConfig)).toBe("sse");
    });

    it("应该正确识别 streamable-http 类型的服务（带 type）", () => {
      const httpConfig = {
        type: "streamable-http" as const,
        url: "https://mcp.amap.com/mcp?key=1ec31da021b2702787841ea4ee822de3",
      };

      expect(getMcpServerCommunicationType(httpConfig)).toBe("streamable-http");
    });

    it("应该正确识别 streamable-http 类型的服务（不带 type）", () => {
      const httpConfig = {
        url: "https://mcp.amap.com/mcp?key=1ec31da021b2702787841ea4ee822de3",
      };

      expect(getMcpServerCommunicationType(httpConfig)).toBe("streamable-http");
    });

    it("应该对无效配置抛出错误", () => {
      expect(() => getMcpServerCommunicationType({})).toThrow(
        "无法识别的 MCP 服务配置类型"
      );

      expect(() => getMcpServerCommunicationType(null as any)).toThrow(
        "服务配置必须是一个有效的对象"
      );
    });
  });

  describe("类型检查函数", () => {
    const stdioConfig = { command: "node", args: ["test.js"] };
    const sseConfig = {
      type: "sse" as const,
      url: "https://example.com/sse",
    };
    const httpConfig = { url: "https://example.com/http" };

    it("isStdioMcpServer 应该正确识别 stdio 类型", () => {
      expect(isStdioMcpServer(stdioConfig)).toBe(true);
      expect(isStdioMcpServer(sseConfig)).toBe(false);
      expect(isStdioMcpServer(httpConfig)).toBe(false);
    });

    it("isSSEMcpServer 应该正确识别 sse 类型", () => {
      expect(isSSEMcpServer(stdioConfig)).toBe(false);
      expect(isSSEMcpServer(sseConfig)).toBe(true);
      expect(isSSEMcpServer(httpConfig)).toBe(false);
    });

    it("isStreamableHTTPMcpServer 应该正确识别 streamable-http 类型", () => {
      expect(isStreamableHTTPMcpServer(stdioConfig)).toBe(false);
      expect(isStreamableHTTPMcpServer(sseConfig)).toBe(false);
      expect(isStreamableHTTPMcpServer(httpConfig)).toBe(true);
    });
  });

  describe("getMcpServerTypeDisplayName", () => {
    it("应该返回正确的显示名称", () => {
      const stdioConfig = { command: "node", args: ["test.js"] };
      const sseConfig = {
        type: "sse" as const,
        url: "https://example.com/sse",
      };
      const httpConfig = { url: "https://example.com/http" };

      expect(getMcpServerTypeDisplayName(stdioConfig)).toBe("本地进程 (stdio)");
      expect(getMcpServerTypeDisplayName(sseConfig)).toBe("服务器推送 (SSE)");
      expect(getMcpServerTypeDisplayName(httpConfig)).toBe("流式 HTTP");
    });
  });

  describe("validateMcpServerConfig", () => {
    it("应该验证 stdio 配置", () => {
      const validStdio = {
        command: "node",
        args: ["test.js"],
      };

      const result = validateMcpServerConfig("test-server", validStdio);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("应该验证 sse 配置", () => {
      const validSSE = {
        type: "sse",
        url: "https://example.com/sse",
      };

      const result = validateMcpServerConfig("test-server", validSSE);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("应该验证 streamable-http 配置", () => {
      const validHTTP = {
        url: "https://example.com/mcp",
      };

      const result = validateMcpServerConfig("test-server", validHTTP);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("应该检测 stdio 配置错误", () => {
      const invalidStdio = {
        command: "node",
        // 缺少 args
      };

      const result = validateMcpServerConfig("test-server", invalidStdio);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("args 字段必须是数组");
    });

    it("应该检测 sse 配置错误", () => {
      const invalidSSE = {
        type: "sse",
        // 缺少 url
      };

      const result = validateMcpServerConfig("test-server", invalidSSE);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("缺少必需的 url 字段");
    });

    it("应该检测 streamable-http 配置错误", () => {
      const invalidHTTP = {
        type: "streamable-http",
        // 缺少 url
      };

      const result = validateMcpServerConfig("test-server", invalidHTTP);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("缺少必需的 url 字段");
    });

    it("应该检测无效的配置对象", () => {
      const result = validateMcpServerConfig("test-server", null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("配置必须是一个对象");
    });
  });
});
