/**
 * ConfigAdapter 和 MCPService 集成测试
 * 验证两个组件的协同工作和类型推断一致性
 */

import { MCPService, MCPTransportType } from "@/lib/mcp";
import {
  convertLegacyConfigBatch,
  convertLegacyToNew,
  getConfigTypeDescription,
} from "@xiaozhi-client/config";
import type {
  HTTPMCPServerConfig,
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
} from "@xiaozhi-client/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 统一的mockLogger定义
let mockLogger: any;

beforeEach(() => {
  vi.clearAllMocks();
  mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  };
});

describe("ConfigAdapter 和 MCPService 集成测试", () => {
  describe("类型推断一致性测试", () => {
    it("ConfigAdapter 和 MCPService 应该对相同的配置推断出相同的类型", () => {
      const testCases = [
        {
          name: "简单 SSE 服务",
          url: "https://example.com/sse",
          expectedType: MCPTransportType.SSE,
        },
        {
          name: "高德地图 SSE 服务",
          url: "https://mcp.amap.com/sse?key=1ec31da021b2702787841ea4ee822de3",
          expectedType: MCPTransportType.SSE,
        },
        {
          name: "复杂 ModelScope SSE 服务",
          url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
          expectedType: MCPTransportType.SSE,
        },
        {
          name: "简单 MCP 服务",
          url: "https://example.com/mcp",
          expectedType: MCPTransportType.HTTP,
        },
        {
          name: "复杂 ModelScope MCP 服务",
          url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
          expectedType: MCPTransportType.HTTP,
        },
        {
          name: "其他 API 服务",
          url: "https://example.com/api/v1/tools",
          expectedType: MCPTransportType.HTTP,
        },
        {
          name: "根路径服务",
          url: "https://example.com/",
          expectedType: MCPTransportType.HTTP,
        },
      ];

      for (const testCase of testCases) {
        // ConfigAdapter 推断
        const legacyConfig: MCPServerConfig = { url: testCase.url };
        const configAdapterResult = convertLegacyToNew(
          testCase.name,
          legacyConfig
        );

        // MCPService 推断
        const mcpServiceConfig = { name: testCase.name, url: testCase.url };
        const mcpService = new MCPService(mcpServiceConfig);
        const mcpServiceResult = mcpService.getConfig();

        // 验证两个组件的推断结果一致
        expect(configAdapterResult.type).toBe(testCase.expectedType);
        expect(mcpServiceResult.type).toBe(testCase.expectedType);
        expect(configAdapterResult.type).toBe(mcpServiceResult.type);
      }
    });

    it("应该正确处理本地 stdio 配置的一致性", () => {
      const testCases = [
        {
          name: "Node.js 服务",
          command: "node",
          args: ["server.js"],
          expectedType: MCPTransportType.STDIO,
        },
        {
          name: "Python 服务",
          command: "python",
          args: ["-m", "server"],
          expectedType: MCPTransportType.STDIO,
        },
        {
          name: "NPX 服务",
          command: "npx",
          args: ["-y", "@amap/amap-maps-mcp-server"],
          expectedType: MCPTransportType.STDIO,
        },
      ];

      for (const testCase of testCases) {
        // ConfigAdapter 处理
        const legacyConfig: LocalMCPServerConfig = {
          command: testCase.command,
          args: testCase.args,
        };
        const configAdapterResult = convertLegacyToNew(
          testCase.name,
          legacyConfig
        );

        // MCPService 处理
        const mcpServiceConfig = {
          name: testCase.name,
          command: testCase.command,
          args: testCase.args,
        };
        const mcpService = new MCPService(mcpServiceConfig);
        const mcpServiceResult = mcpService.getConfig();

        // 验证两个组件的处理结果一致
        expect(configAdapterResult.type).toBe(testCase.expectedType);
        expect(mcpServiceResult.type).toBe(testCase.expectedType);
        expect(configAdapterResult.type).toBe(mcpServiceResult.type);
        expect(configAdapterResult.command).toBe(testCase.command);
        expect(mcpServiceResult.command).toBe(testCase.command);
      }
    });
  });

  describe("显式类型配置一致性测试", () => {
    it("应该正确处理显式指定的 SSE 类型", () => {
      const legacyConfig: SSEMCPServerConfig = {
        type: "sse",
        url: "https://example.com/mcp", // 这个 URL 会推断为 MCP，但显式指定为 SSE
      };

      const configAdapterResult = convertLegacyToNew(
        "explicit-sse",
        legacyConfig
      );

      const mcpServiceConfig = {
        name: "explicit-sse",
        type: MCPTransportType.SSE,
        url: "https://example.com/mcp",
      };
      const mcpService = new MCPService(mcpServiceConfig);
      const mcpServiceResult = mcpService.getConfig();

      expect(configAdapterResult.type).toBe(MCPTransportType.SSE);
      expect(mcpServiceResult.type).toBe(MCPTransportType.SSE);
      expect(configAdapterResult.type).toBe(mcpServiceResult.type);
    });

    it("应该正确处理显式指定的 streamable-http 类型", () => {
      const legacyConfig: StreamableHTTPMCPServerConfig = {
        type: "streamable-http",
        url: "https://example.com/sse", // 这个 URL 会推断为 SSE，但显式指定为 HTTP
      };

      const configAdapterResult = convertLegacyToNew(
        "explicit-http",
        legacyConfig
      );

      const mcpServiceConfig = {
        name: "explicit-http",
        type: MCPTransportType.HTTP,
        url: "https://example.com/sse",
      };
      const mcpService = new MCPService(mcpServiceConfig);
      const mcpServiceResult = mcpService.getConfig();

      expect(configAdapterResult.type).toBe(MCPTransportType.HTTP);
      expect(mcpServiceResult.type).toBe(MCPTransportType.HTTP);
      expect(configAdapterResult.type).toBe(mcpServiceResult.type);
    });
  });

  describe("批量配置转换一致性测试", () => {
    it("应该正确批量转换配置并保持类型一致性", () => {
      const legacyConfigs: Record<string, MCPServerConfig> = {
        "node-calculator": {
          command: "node",
          args: ["calculator.js"],
        },
        "sse-service": {
          type: "sse",
          url: "https://example.com/sse",
        },
        "modelscope-sse": {
          url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
        },
        "modelscope-mcp": {
          url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
        },
        "amap-maps": {
          url: "https://mcp.amap.com/sse?key=1ec31da021b2702787841ea4ee822de3",
        },
      };

      // ConfigAdapter 批量转换
      const batchResult = convertLegacyConfigBatch(legacyConfigs);

      // 验证每个服务的类型推断
      expect(batchResult["node-calculator"].type).toBe(MCPTransportType.STDIO);
      expect(batchResult["sse-service"].type).toBe(MCPTransportType.SSE);
      expect(batchResult["modelscope-sse"].type).toBe(MCPTransportType.SSE);
      expect(batchResult["modelscope-mcp"].type).toBe(MCPTransportType.HTTP);
      expect(batchResult["amap-maps"].type).toBe(MCPTransportType.SSE);

      // 逐个验证与 MCPService 的一致性
      for (const [serviceName, legacyConfig] of Object.entries(legacyConfigs)) {
        const configAdapterConfig = batchResult[serviceName];

        // 为 MCPService 创建对应的配置
        const mcpServiceConfig: any = { name: serviceName };
        if ("command" in legacyConfig) {
          mcpServiceConfig.command = legacyConfig.command;
          mcpServiceConfig.args = legacyConfig.args;
        } else {
          mcpServiceConfig.url = legacyConfig.url;
          if ("type" in legacyConfig) {
            mcpServiceConfig.type =
              legacyConfig.type === "sse"
                ? MCPTransportType.SSE
                : MCPTransportType.HTTP;
          }
        }

        const mcpService = new MCPService(mcpServiceConfig);
        const mcpServiceConfigResult = mcpService.getConfig();

        // 验证类型一致性
        expect(configAdapterConfig.type).toBe(mcpServiceConfigResult.type);
      }
    });
  });

  describe("配置描述功能一致性测试", () => {
    it("getConfigTypeDescription 应该与推断的类型一致", () => {
      const testCases = [
        {
          config: {
            command: "node",
            args: ["server.js"],
          } as LocalMCPServerConfig,
          expectedType: MCPTransportType.STDIO,
          expectedDescriptionIncludes: ["本地进程", "node"],
        },
        {
          config: {
            type: "sse",
            url: "https://example.com/sse",
          } as SSEMCPServerConfig,
          expectedType: MCPTransportType.SSE,
          expectedDescriptionIncludes: ["SSE", "https://example.com/sse"],
        },
        {
          config: {
            type: "http",
            url: "https://example.com/mcp",
          } as HTTPMCPServerConfig,
          expectedType: MCPTransportType.HTTP,
          expectedDescriptionIncludes: ["HTTP", "https://example.com/mcp"],
        },
        {
          config: {
            url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
          } as MCPServerConfig,
          expectedType: MCPTransportType.SSE,
          expectedDescriptionIncludes: ["SSE", "ModelScope"],
        },
      ];

      for (const testCase of testCases) {
        const description = getConfigTypeDescription(testCase.config);

        // 验证描述包含预期的关键词
        for (const keyword of testCase.expectedDescriptionIncludes) {
          expect(description).toContain(keyword);
        }

        // 通过 ConfigAdapter 验证类型推断
        const adapterResult = convertLegacyToNew(
          "test-service",
          testCase.config
        );
        expect(adapterResult.type).toBe(testCase.expectedType);
      }
    });
  });

  describe("异常处理一致性测试", () => {
    it("应该一致地处理无效配置", () => {
      const invalidConfigs = [
        { name: "empty-config", config: {} as any },
        { name: "null-config", config: null as any },
        { name: "invalid-url-config", config: { url: "not-a-valid-url" } },
      ];

      for (const { name, config } of invalidConfigs) {
        // ConfigAdapter 处理
        let adapterError: Error | null = null;
        let adapterResult: any = null;

        try {
          adapterResult = convertLegacyToNew(name, config);
        } catch (error) {
          adapterError = error as Error;
        }

        // MCPService 处理
        let serviceError: Error | null = null;
        let serviceResult: any = null;

        try {
          const service = new MCPService({ name, ...config });
          serviceResult = service.getConfig();
        } catch (error) {
          serviceError = error as Error;
        }

        // 验证错误处理的一致性
        if (adapterError && serviceError) {
          // 两个都应该抛出错误
          expect(adapterError).toBeInstanceOf(Error);
          expect(serviceError).toBeInstanceOf(Error);
        } else if (adapterResult && serviceResult) {
          // 两个都应该成功处理
          expect(adapterResult.type).toBeDefined();
          expect(serviceResult.type).toBeDefined();
          expect(adapterResult.type).toBe(serviceResult.type);
        } else {
          // 至少一个处理失败了，这种情况不应该发生
          throw new Error(`不一致的处理结果: ${name}`);
        }
      }
    });

    it("应该一致地处理空服务名称", () => {
      const config = { url: "https://example.com/sse" };

      // ConfigAdapter 应该抛出错误
      expect(() => convertLegacyToNew("", config)).toThrow();

      // MCPService 应该抛出错误
      expect(
        () => new MCPService({ name: "", url: "https://example.com/sse" })
      ).toThrow();
    });
  });

  describe("端到端工作流程测试", () => {
    it("应该支持完整的配置转换和服务创建流程", () => {
      // 模拟真实的配置场景
      const userConfigs = {
        // 本地计算器服务
        calculator: {
          command: "node",
          args: ["./mcpServers/calculator.js"],
        } as LocalMCPServerConfig,

        // 高德地图服务
        amap: {
          url: "https://mcp.amap.com/sse?key=1ec31da021b2702787841ea4ee822de3",
        } as MCPServerConfig,

        // ModelScope 搜索服务
        search: {
          url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
        } as MCPServerConfig,

        // ModelScope 推理服务
        inference: {
          url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
        } as MCPServerConfig,

        // 显式指定的 SSE 服务
        explicitSse: {
          type: "sse",
          url: "https://api.example.com/custom-endpoint",
        } as SSEMCPServerConfig,
      };

      // 第一步：批量转换配置
      const convertedConfigs = convertLegacyConfigBatch(userConfigs);

      // 验证转换结果
      expect(convertedConfigs.calculator.type).toBe(MCPTransportType.STDIO);
      expect(convertedConfigs.amap.type).toBe(MCPTransportType.SSE);
      expect(convertedConfigs.search.type).toBe(MCPTransportType.SSE);
      expect(convertedConfigs.inference.type).toBe(MCPTransportType.HTTP);
      expect(convertedConfigs.explicitSse.type).toBe(MCPTransportType.SSE);

      // 第二步：使用转换后的配置创建 MCPService 实例
      const services: Record<string, MCPService> = {};

      for (const [serviceName, config] of Object.entries(convertedConfigs)) {
        services[serviceName] = new MCPService(config);
      }

      // 第三步：验证所有服务都能正确获取配置
      for (const [serviceName, service] of Object.entries(services)) {
        const serviceConfig = service.getConfig();

        // 验证配置完整性
        expect(serviceConfig.type).toBeDefined();

        // 验证类型一致性
        expect(serviceConfig.type).toBe(convertedConfigs[serviceName].type);

        // 根据类型验证必需字段
        if (serviceConfig.type === MCPTransportType.STDIO) {
          expect(serviceConfig.command).toBeDefined();
        } else {
          expect(serviceConfig.url).toBeDefined();
        }
      }

      // 第四步：验证配置描述功能
      for (const [serviceName, originalConfig] of Object.entries(userConfigs)) {
        const description = getConfigTypeDescription(originalConfig);
        expect(typeof description).toBe("string");
        expect(description.length).toBeGreaterThan(0);

        // 验证描述包含相关信息，但不一定包含服务名称
        if ("command" in originalConfig) {
          expect(description).toContain("本地进程");
        } else if ("url" in originalConfig) {
          expect(description).toContain(originalConfig.url);
        }
      }
    });

    it("应该支持动态配置更新场景", () => {
      // 模拟配置更新场景
      const initialConfig = {
        url: "https://example.com/api/v1",
      };

      // 初始转换和服务创建
      const initialConverted = convertLegacyToNew(
        "dynamic-service",
        initialConfig
      );
      const initialService = new MCPService(initialConverted);

      expect(initialConverted.type).toBe(MCPTransportType.HTTP);
      expect(initialService.getConfig().type).toBe(MCPTransportType.HTTP);

      // 配置更新为 SSE 端点
      const updatedConfig = {
        url: "https://example.com/sse",
      };

      const updatedConverted = convertLegacyToNew(
        "dynamic-service",
        updatedConfig
      );
      const updatedService = new MCPService(updatedConverted);

      expect(updatedConverted.type).toBe(MCPTransportType.SSE);
      expect(updatedService.getConfig().type).toBe(MCPTransportType.SSE);

      // 验证更新前后的类型不同
      expect(initialConverted.type).not.toBe(updatedConverted.type);
    });
  });

  describe("性能和边界测试", () => {
    it("应该高效处理大量配置", () => {
      // 创建大量测试配置
      const largeConfigSet: Record<string, MCPServerConfig> = {};
      const serviceCount = 100;

      for (let i = 0; i < serviceCount; i++) {
        const serviceType = i % 3;
        switch (serviceType) {
          case 0:
            largeConfigSet[`stdio-${i}`] = {
              command: "node",
              args: [`service-${i}.js`],
            };
            break;
          case 1:
            largeConfigSet[`sse-${i}`] = {
              url: `https://example.com/service-${i}/sse`,
            };
            break;
          case 2:
            largeConfigSet[`http-${i}`] = {
              url: `https://example.com/service-${i}/mcp`,
            };
            break;
        }
      }

      // 批量转换应该在合理时间内完成
      const startTime = performance.now();
      const batchResult = convertLegacyConfigBatch(largeConfigSet);
      const endTime = performance.now();

      // 验证转换时间（应该少于1秒）
      expect(endTime - startTime).toBeLessThan(1000);

      // 验证结果完整性
      expect(Object.keys(batchResult)).toHaveLength(serviceCount);

      // 验证类型分布
      let stdioCount = 0;
      let sseCount = 0;
      let httpCount = 0;

      for (const config of Object.values(batchResult)) {
        switch (config.type) {
          case MCPTransportType.STDIO:
            stdioCount++;
            break;
          case MCPTransportType.SSE:
            sseCount++;
            break;
          case MCPTransportType.HTTP:
            httpCount++;
            break;
        }
      }

      expect(stdioCount).toBe(34); // i%3=0 有 34 个服务
      expect(sseCount).toBe(33); // i%3=1 有 33 个服务
      expect(httpCount).toBe(33); // i%3=2 有 33 个服务
    });

    it("应该处理极长的 URL", () => {
      const longPath = `${"/a".repeat(1000)}/sse`;
      const longUrl = `https://example.com${longPath}`;

      const config = { url: longUrl };

      // ConfigAdapter 应该能处理
      const adapterResult = convertLegacyToNew("long-url-service", config);
      expect(adapterResult.type).toBe(MCPTransportType.SSE);

      // MCPService 应该能处理
      const service = new MCPService({
        name: "long-url-service",
        url: longUrl,
      });
      const serviceResult = service.getConfig();
      expect(serviceResult.type).toBe(MCPTransportType.SSE);
    });
  });
});
