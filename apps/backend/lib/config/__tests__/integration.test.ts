/**
 * 适配器集成测试
 * 验证适配器的基本功能和兼容性
 */

import {
  convertLegacyToNew,
  getConfigTypeDescription,
} from "@/lib/config/adapter.js";
import type {
  LocalMCPServerConfig,
  SSEMCPServerConfig,
} from "@/lib/config/manager.js";
import { MCPTransportType } from "@/lib/mcp/types";
import { describe, expect, it } from "vitest";

describe("适配器集成测试", () => {
  describe("配置转换功能", () => {
    it("应该正确转换本地配置", () => {
      const legacyConfig: LocalMCPServerConfig = {
        command: "python",
        args: ["-m", "calculator"],
      };

      const result = convertLegacyToNew("calculator", legacyConfig);

      expect(result.name).toBe("calculator");
      expect(result.type).toBe(MCPTransportType.STDIO);
      expect(result.command).toBe("python");
      expect(result.args).toEqual(["-m", "calculator"]);
    });

    it("应该正确转换 SSE 配置", () => {
      const legacyConfig: SSEMCPServerConfig = {
        type: "sse",
        url: "https://example.com/sse",
      };

      const result = convertLegacyToNew("sse-service", legacyConfig);

      expect(result.name).toBe("sse-service");
      expect(result.type).toBe(MCPTransportType.SSE);
      expect(result.url).toBe("https://example.com/sse");
    });

    it("应该正确识别 ModelScope 配置", () => {
      const legacyConfig: SSEMCPServerConfig = {
        type: "sse",
        url: "https://api.modelscope.net/mcp/sse",
      };

      const result = convertLegacyToNew("modelscope", legacyConfig);

      expect(result.name).toBe("modelscope");
      expect(result.type).toBe(MCPTransportType.SSE);
      expect(result.url).toBe("https://api.modelscope.net/mcp/sse");
      expect(result.modelScopeAuth).toBe(true);
    });

    it("应该正确转换 Streamable HTTP 配置", () => {
      const legacyConfig = {
        url: "https://api.example.com/mcp",
      };

      const result = convertLegacyToNew("http-service", legacyConfig);

      expect(result.name).toBe("http-service");
      expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      expect(result.url).toBe("https://api.example.com/mcp");
    });
  });

  describe("配置类型描述", () => {
    it("应该返回正确的配置描述", () => {
      const localConfig: LocalMCPServerConfig = {
        command: "python",
        args: ["-m", "server"],
      };
      expect(getConfigTypeDescription(localConfig)).toBe("本地进程 (python)");

      const sseConfig: SSEMCPServerConfig = {
        type: "sse",
        url: "https://example.com/sse",
      };
      expect(getConfigTypeDescription(sseConfig)).toBe(
        "SSE (https://example.com/sse)"
      );

      const modelScopeConfig: SSEMCPServerConfig = {
        type: "sse",
        url: "https://modelscope.net/api/sse",
      };
      expect(getConfigTypeDescription(modelScopeConfig)).toBe(
        "SSE (ModelScope) (https://modelscope.net/api/sse)"
      );
    });
  });

  describe("错误处理", () => {
    it("应该在无效配置时抛出错误", () => {
      expect(() =>
        convertLegacyToNew("", { command: "test", args: [] })
      ).toThrow("服务名称必须是非空字符串");

      expect(() => convertLegacyToNew("test", null as any)).toThrow(
        "配置对象不能为空"
      );

      expect(() =>
        convertLegacyToNew("test", { invalid: "config" } as any)
      ).toThrow("无法识别的配置类型");
    });
  });
});
