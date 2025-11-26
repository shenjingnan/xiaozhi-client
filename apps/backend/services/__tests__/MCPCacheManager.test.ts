import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MCPToolsCache } from "../MCPCacheManager.js";
import { MCPCacheManager } from "../MCPCacheManager.js";
import type { MCPServiceConfig } from "../MCPService.js";
import { MCPTransportType } from "../MCPService.js";

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe("MCPCacheManager", () => {
  let cacheManager: MCPCacheManager;
  let testCachePath: string;
  let originalEnv: string | undefined;

  // 测试数据
  const mockTools: Tool[] = [
    {
      name: "add",
      description: "Add two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
    {
      name: "subtract",
      description: "Subtract two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
  ];

  const mockConfig: MCPServiceConfig = {
    name: "calculator",
    type: MCPTransportType.STDIO,
    command: "node",
    args: ["./calculator.js"],
    env: { NODE_ENV: "test" },
  };

  beforeEach(() => {
    // 设置测试环境
    originalEnv = process.env.XIAOZHI_CONFIG_DIR;
    const testDir = "/tmp/xiaozhi-test";
    process.env.XIAOZHI_CONFIG_DIR = testDir;

    // 确保测试目录存在
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    cacheManager = new MCPCacheManager();
    testCachePath = resolve(testDir, "xiaozhi.cache.json");

    // 清理可能存在的测试文件
    if (existsSync(testCachePath)) {
      unlinkSync(testCachePath);
    }
  });

  afterEach(() => {
    // 恢复环境变量
    if (originalEnv !== undefined) {
      process.env.XIAOZHI_CONFIG_DIR = originalEnv;
    } else {
      process.env.XIAOZHI_CONFIG_DIR = undefined;
    }

    // 清理测试文件
    if (existsSync(testCachePath)) {
      unlinkSync(testCachePath);
    }
  });

  describe("ensureCacheFile", () => {
    it("应该创建缓存文件如果不存在", async () => {
      expect(existsSync(testCachePath)).toBe(false);

      await cacheManager.ensureCacheFile();

      expect(existsSync(testCachePath)).toBe(true);

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.version).toBe("1.0.0");
      expect(cache.mcpServers).toEqual({});
      expect(cache.metadata.totalWrites).toBe(0);
      expect(cache.metadata.createdAt).toBeDefined();
    });

    it("应该不覆盖已存在的缓存文件", async () => {
      // 创建一个现有的缓存文件
      const existingCache: MCPToolsCache = {
        version: "1.0.0",
        mcpServers: {
          test: {
            tools: [],
            lastUpdated: "2023-01-01 00:00:00",
            serverConfig: mockConfig,
            configHash: "test-hash",
            version: "1.0.0",
          },
        },
        metadata: {
          lastGlobalUpdate: "2023-01-01 00:00:00",
          totalWrites: 5,
          createdAt: "2023-01-01 00:00:00",
        },
      };

      writeFileSync(testCachePath, JSON.stringify(existingCache, null, 2));

      await cacheManager.ensureCacheFile();

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.metadata.totalWrites).toBe(5);
      expect(cache.mcpServers.test).toBeDefined();
    });
  });

  describe("writeCacheEntry", () => {
    it("应该成功写入缓存条目", async () => {
      await cacheManager.writeCacheEntry("calculator", mockTools, mockConfig);

      expect(existsSync(testCachePath)).toBe(true);

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.mcpServers.calculator).toBeDefined();
      expect(cache.mcpServers.calculator.tools).toHaveLength(2);
      expect(cache.mcpServers.calculator.tools[0].name).toBe("add");
      expect(cache.mcpServers.calculator.tools[1].name).toBe("subtract");
      expect(cache.mcpServers.calculator.configHash).toBeDefined();
      expect(cache.mcpServers.calculator.lastUpdated).toBeDefined();
      expect(cache.metadata.totalWrites).toBe(1);
    });

    it("应该更新现有的缓存条目", async () => {
      // 首次写入
      await cacheManager.writeCacheEntry("calculator", mockTools, mockConfig);

      // 更新工具列表
      const updatedTools: Tool[] = [
        {
          name: "multiply",
          description: "Multiply two numbers",
          inputSchema: { type: "object" },
        },
      ];

      await cacheManager.writeCacheEntry(
        "calculator",
        updatedTools,
        mockConfig
      );

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.mcpServers.calculator.tools).toHaveLength(1);
      expect(cache.mcpServers.calculator.tools[0].name).toBe("multiply");
      expect(cache.metadata.totalWrites).toBe(2);
    });

    it("应该处理空工具列表", async () => {
      await cacheManager.writeCacheEntry("empty-service", [], mockConfig);

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.mcpServers["empty-service"].tools).toHaveLength(0);
      expect(cache.metadata.totalWrites).toBe(1);
    });

    it("应该处理写入错误而不抛出异常", async () => {
      // 创建一个无效的缓存目录路径
      const invalidCacheManager = new MCPCacheManager();
      // 通过反射设置一个无效路径
      (invalidCacheManager as any).cachePath = "/invalid/path/cache.json";

      // 应该不抛出异常
      await expect(
        invalidCacheManager.writeCacheEntry("test", mockTools, mockConfig)
      ).resolves.not.toThrow();
    });
  });

  describe("getStats", () => {
    it("应该返回正确的缓存统计信息", async () => {
      await cacheManager.writeCacheEntry("calculator", mockTools, mockConfig);
      await cacheManager.writeCacheEntry("datetime", [], {
        ...mockConfig,
        name: "datetime",
      });

      const stats = await cacheManager.getStats();

      expect(stats).toBeDefined();
      expect(stats!.totalWrites).toBe(2);
      expect(stats!.serverCount).toBe(2);
      expect(stats!.cacheFileSize).toBeGreaterThan(0);
      expect(stats!.lastUpdate).toBeDefined();
    });

    it("应该处理不存在的缓存文件", async () => {
      const stats = await cacheManager.getStats();

      expect(stats).toBeDefined();
      expect(stats!.totalWrites).toBe(0);
      expect(stats!.serverCount).toBe(0);
    });
  });

  describe("配置哈希生成", () => {
    it("应该为相同配置生成相同哈希", async () => {
      const config1: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["test.js"],
      };

      const config2: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["test.js"],
      };

      await cacheManager.writeCacheEntry("test1", mockTools, config1);
      await cacheManager.writeCacheEntry("test2", mockTools, config2);

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.mcpServers.test1.configHash).toBe(
        cache.mcpServers.test2.configHash
      );
    });

    it("应该为不同配置生成不同哈希", async () => {
      const config1: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["test1.js"],
      };

      const config2: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["test2.js"],
      };

      await cacheManager.writeCacheEntry("test1", mockTools, config1);
      await cacheManager.writeCacheEntry("test2", mockTools, config2);

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.mcpServers.test1.configHash).not.toBe(
        cache.mcpServers.test2.configHash
      );
    });
  });

  describe("原子写入", () => {
    it("应该使用临时文件进行原子写入", async () => {
      const tempPath = `${testCachePath}.tmp`;

      // 确保临时文件不存在
      expect(existsSync(tempPath)).toBe(false);

      await cacheManager.writeCacheEntry("calculator", mockTools, mockConfig);

      // 写入完成后临时文件应该被清理
      expect(existsSync(tempPath)).toBe(false);
      expect(existsSync(testCachePath)).toBe(true);
    });
  });

  describe("缓存文件验证", () => {
    it("应该处理损坏的缓存文件", async () => {
      // 创建一个损坏的缓存文件
      writeFileSync(testCachePath, "invalid json content");

      // 应该能够处理并重新创建缓存
      await cacheManager.writeCacheEntry("calculator", mockTools, mockConfig);

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.version).toBe("1.0.0");
      expect(cache.mcpServers.calculator).toBeDefined();
    });

    it("应该处理结构无效的缓存文件", async () => {
      // 创建一个结构无效的缓存文件
      const invalidCache = {
        version: "1.0.0",
        // 缺少必要字段
      };

      writeFileSync(testCachePath, JSON.stringify(invalidCache));

      await cacheManager.writeCacheEntry("calculator", mockTools, mockConfig);

      const cacheContent = readFileSync(testCachePath, "utf8");
      const cache = JSON.parse(cacheContent) as MCPToolsCache;

      expect(cache.metadata).toBeDefined();
      expect(cache.mcpServers).toBeDefined();
    });
  });
});
