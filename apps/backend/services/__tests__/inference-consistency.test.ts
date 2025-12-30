import { MCPService, MCPTransportType } from "@/lib/mcp";
import { convertLegacyToNew } from "@xiaozhi/config";
import { describe, expect, it } from "vitest";

describe("MCPService 和 ConfigAdapter 推断逻辑一致性测试", () => {
  const testCases = [
    {
      name: "简单 SSE 路径",
      url: "https://example.com/sse",
      expectedType: MCPTransportType.SSE,
    },
    {
      name: "复杂 ModelScope SSE 路径",
      url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
      expectedType: MCPTransportType.SSE,
    },
    {
      name: "高德地图 SSE 路径",
      url: "https://mcp.amap.com/sse?key=1ec31da021b2702787841ea4ee822de3",
      expectedType: MCPTransportType.SSE,
    },
    {
      name: "简单 MCP 路径",
      url: "https://example.com/mcp",
      expectedType: MCPTransportType.STREAMABLE_HTTP,
    },
    {
      name: "复杂 ModelScope MCP 路径",
      url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
      expectedType: MCPTransportType.STREAMABLE_HTTP,
    },
    {
      name: "其他 API 路径",
      url: "https://example.com/api/v1/tools",
      expectedType: MCPTransportType.STREAMABLE_HTTP,
    },
    {
      name: "根路径",
      url: "https://example.com/",
      expectedType: MCPTransportType.STREAMABLE_HTTP,
    },
  ];

  for (const { name, url, expectedType } of testCases) {
    it(`对于 ${name}，两个组件应该推断出相同的类型: ${expectedType}`, () => {
      // ConfigAdapter 推断
      const legacyConfig = { url };
      const configAdapterResult = convertLegacyToNew(
        "test-service",
        legacyConfig
      );

      // MCPService 推断
      const mcpServiceConfig = { name: "test-service", url };
      const mcpService = new MCPService(mcpServiceConfig);
      const mcpServiceResult = mcpService.getConfig();

      // 验证两个组件的推断结果一致
      expect(configAdapterResult.type).toBe(expectedType);
      expect(mcpServiceResult.type).toBe(expectedType);
      expect(configAdapterResult.type).toBe(mcpServiceResult.type);
    });
  }

  it("应该正确处理无效 URL", () => {
    const invalidUrl = "not-a-valid-url";

    // ConfigAdapter 处理无效 URL
    const legacyConfig = { url: invalidUrl };
    const configAdapterResult = convertLegacyToNew(
      "invalid-service",
      legacyConfig
    );

    // MCPService 处理无效 URL
    const mcpServiceConfig = { name: "invalid-service", url: invalidUrl };
    const mcpService = new MCPService(mcpServiceConfig);
    const mcpServiceResult = mcpService.getConfig();

    // 两个组件都应该默认推断为 STREAMABLE_HTTP
    expect(configAdapterResult.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    expect(mcpServiceResult.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    expect(configAdapterResult.type).toBe(mcpServiceResult.type);
  });

  it("应该优先使用显式指定的类型", () => {
    const explicitConfig = {
      name: "explicit-service",
      url: "https://example.com/sse", // 这个 URL 应该推断为 SSE
      type: MCPTransportType.STREAMABLE_HTTP, // 但显式指定为 STREAMABLE_HTTP
    };

    // ConfigAdapter 处理显式类型
    const legacyConfig = {
      url: explicitConfig.url,
      type: "streamable-http" as const,
    };
    const configAdapterResult = convertLegacyToNew(
      "explicit-service",
      legacyConfig
    );

    // MCPService 处理显式类型
    const mcpService = new MCPService(explicitConfig);
    const mcpServiceResult = mcpService.getConfig();

    // 两个组件都应该使用显式指定的类型
    expect(configAdapterResult.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    expect(mcpServiceResult.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    expect(configAdapterResult.type).toBe(mcpServiceResult.type);
  });
});
