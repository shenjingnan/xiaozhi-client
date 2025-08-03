/**
 * MCP 服务工具函数测试
 */

import { describe, expect, it } from "vitest";
import {
  getMcpServerCommunicationType,
  getMcpServerTypeDisplayName,
  isSSEMcpServer,
  isStdioMcpServer,
  isStreamableHTTPMcpServer,
} from "./mcpServerUtils";

describe("MCP Server Utils", () => {
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

    it("应该正确识别 streamable-http 类型的服务（无 type 字段）", () => {
      const httpConfig = {
        url: "https://mcp.amap.com/mcp?key=1ec31da021b2702787841ea4ee822de3",
      };

      expect(getMcpServerCommunicationType(httpConfig)).toBe("streamable-http");
    });

    it("应该正确识别 streamable-http 类型的服务（有 type 字段）", () => {
      const httpConfigWithType = {
        type: "streamable-http" as const,
        url: "https://example.com/mcp",
      };

      expect(getMcpServerCommunicationType(httpConfigWithType)).toBe(
        "streamable-http"
      );
    });

    it("应该在传入无效配置时抛出错误", () => {
      expect(() => getMcpServerCommunicationType(null as any)).toThrow(
        "服务配置必须是一个有效的对象"
      );
      expect(() => getMcpServerCommunicationType(undefined as any)).toThrow(
        "服务配置必须是一个有效的对象"
      );
      expect(() => getMcpServerCommunicationType("invalid" as any)).toThrow(
        "服务配置必须是一个有效的对象"
      );
    });

    it("应该在无法识别配置类型时抛出错误", () => {
      const invalidConfig = {
        someField: "value",
      };

      expect(() => getMcpServerCommunicationType(invalidConfig)).toThrow(
        "无法识别的 MCP 服务配置类型"
      );
    });
  });

  describe("类型检查函数", () => {
    const stdioConfig = { command: "node", args: ["test.js"] };
    const sseConfig = { type: "sse" as const, url: "https://example.com/sse" };
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

  describe("实际示例配置测试", () => {
    it("应该正确处理示例中的所有配置", () => {
      const configs = {
        calculator: {
          command: "node",
          args: ["./mcpServers/calculator.js"],
        },
        datetime: {
          command: "node",
          args: ["./mcpServers/datetime.js"],
        },
        gaotie: {
          type: "sse" as const,
          url: "https://mcp.api-inference.modelscope.net/d3cfd34529ae4e/sse",
        },
        "amap-maps-streamableHTTP": {
          url: "https://mcp.amap.com/mcp?key=1ec31da021b2702787841ea4ee822de3",
        },
      };

      expect(getMcpServerCommunicationType(configs.calculator)).toBe("stdio");
      expect(getMcpServerCommunicationType(configs.datetime)).toBe("stdio");
      expect(getMcpServerCommunicationType(configs.gaotie)).toBe("sse");
      expect(
        getMcpServerCommunicationType(configs["amap-maps-streamableHTTP"])
      ).toBe("streamable-http");

      // 验证结果输出
      console.log("\n=== 用户示例配置测试结果 ===");
      for (const [name, config] of Object.entries(configs)) {
        const type = getMcpServerCommunicationType(config);
        console.log(`${name}: ${type}`);
      }
    });
  });
});
