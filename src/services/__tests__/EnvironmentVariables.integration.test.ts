/**
 * 环境变量传递集成测试
 * 验证 MCP 服务环境变量传递修复是否正确工作
 */

import { describe, expect, it } from "vitest";
import { convertLegacyToNew } from "../../adapters/ConfigAdapter.js";
import type { LocalMCPServerConfig } from "../../configManager.js";
import { MCPTransportType } from "../MCPService.js";

describe("环境变量传递集成测试", () => {
  describe("配置转换", () => {
    it("应该正确传递环境变量从用户配置到 MCPServiceConfig", () => {
      // 1. 模拟用户配置（类似 xiaozhi.config.json 中的配置）
      const userConfig: LocalMCPServerConfig = {
        command: "npx",
        args: ["-y", "@amap/amap-maps-mcp-server"],
        env: {
          AMAP_MAPS_API_KEY: "1ec31da021b2702787841ea4ee822de3",
          NODE_ENV: "production",
        },
      };

      // 2. 通过 ConfigAdapter 转换配置
      const mcpServiceConfig = convertLegacyToNew("amap-maps", userConfig);

      // 3. 验证转换后的配置包含环境变量
      expect(mcpServiceConfig).toEqual({
        name: "amap-maps",
        type: MCPTransportType.STDIO,
        command: "npx",
        args: ["-y", "@amap/amap-maps-mcp-server"],
        env: {
          AMAP_MAPS_API_KEY: "1ec31da021b2702787841ea4ee822de3",
          NODE_ENV: "production",
        },
        reconnect: expect.any(Object),
        ping: expect.any(Object),
        timeout: 30000,
      });
    });

    it("应该处理没有环境变量的配置", () => {
      const userConfig: LocalMCPServerConfig = {
        command: "node",
        args: ["calculator.js"],
        // 没有 env 字段
      };

      const mcpServiceConfig = convertLegacyToNew("calculator", userConfig);

      expect(mcpServiceConfig.env).toBeUndefined();
      expect(mcpServiceConfig.name).toBe("calculator");
      expect(mcpServiceConfig.command).toBe("node");
      expect(mcpServiceConfig.args).toEqual([
        expect.stringContaining("calculator.js"),
      ]);
    });

    it("应该处理空的环境变量对象", () => {
      const userConfig: LocalMCPServerConfig = {
        command: "python",
        args: ["server.py"],
        env: {}, // 空的环境变量对象
      };

      const mcpServiceConfig = convertLegacyToNew("python-service", userConfig);

      expect(mcpServiceConfig.env).toEqual({});
      expect(mcpServiceConfig.name).toBe("python-service");
      expect(mcpServiceConfig.command).toBe("python");
      expect(mcpServiceConfig.args).toEqual([
        expect.stringContaining("server.py"),
      ]);
    });

    it("应该处理多个环境变量", () => {
      const userConfig: LocalMCPServerConfig = {
        command: "node",
        args: ["complex-server.js"],
        env: {
          API_KEY: "secret-key",
          DATABASE_URL: "postgresql://localhost:5432/db",
          DEBUG: "true",
          PORT: "3000",
        },
      };

      const mcpServiceConfig = convertLegacyToNew(
        "complex-service",
        userConfig
      );

      expect(mcpServiceConfig.env).toEqual({
        API_KEY: "secret-key",
        DATABASE_URL: "postgresql://localhost:5432/db",
        DEBUG: "true",
        PORT: "3000",
      });
      expect(mcpServiceConfig.name).toBe("complex-service");
      expect(mcpServiceConfig.command).toBe("node");
      expect(mcpServiceConfig.args).toEqual([
        expect.stringContaining("complex-server.js"),
      ]);
    });
  });

  describe("真实场景模拟", () => {
    it("应该模拟 amap-maps 服务的完整配置流程", () => {
      // 模拟用户在 xiaozhi.config.json 中的实际配置
      const amapConfig: LocalMCPServerConfig = {
        command: "npx",
        args: ["-y", "@amap/amap-maps-mcp-server"],
        env: {
          AMAP_MAPS_API_KEY: "1ec31da021b2702787841ea4ee822de3",
        },
      };

      // 完整的配置转换流程
      const serviceConfig = convertLegacyToNew("amap-maps", amapConfig);

      // 验证配置转换结果
      expect(serviceConfig).toEqual({
        name: "amap-maps",
        type: MCPTransportType.STDIO,
        command: "npx",
        args: ["-y", "@amap/amap-maps-mcp-server"],
        env: {
          AMAP_MAPS_API_KEY: "1ec31da021b2702787841ea4ee822de3",
        },
        reconnect: expect.any(Object),
        ping: expect.any(Object),
        timeout: 30000,
      });
    });
  });
});
