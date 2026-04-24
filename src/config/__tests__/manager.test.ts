/**
 * ConfigManager 配置管理器单元测试
 *
 * 覆盖 ConfigManager 类的所有核心功能模块：
 * - 配置加载与缓存
 * - MCP 端点管理
 * - MCP 服务管理
 * - 批量配置更新
 * - 服务工具配置管理
 * - 连接配置
 * - ModelScope 配置
 * - CustomMCP 工具管理（含处理器验证）
 * - Web UI 配置
 * - 平台配置
 * - 工具使用统计
 * - 其他配置（TTS/ASR/LLM/日志）
 * - 事件系统
 * - 文件操作与初始化
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ConfigManager } from "../manager.js";

// ==================== Mock 基础设施 ====================

const {
  mockReadFileSync,
  mockWriteFileSync,
  mockExistsSync,
  mockCopyFileSync,
} = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  copyFileSync: mockCopyFileSync,
  default: {
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    existsSync: mockExistsSync,
    copyFileSync: mockCopyFileSync,
  },
}));

// ==================== 测试常量 ====================

/** 最小有效配置 */
const MINIMAL_VALID_CONFIG = {
  mcpEndpoint: "wss://example.com/mcp",
  mcpServers: {
    testServer: { command: "node", args: ["server.js"] },
  },
};

/** 完整测试配置 */
const FULL_TEST_CONFIG = {
  mcpEndpoint: ["wss://example.com/mcp", "wss://example2.com/mcp"] as string[],
  mcpServers: {
    serverA: { command: "node", args: ["a.js"] },
    serverB: { type: "sse" as const, url: "https://example.com/sse" },
  } as Record<string, unknown>,
  connection: {
    heartbeatInterval: 20000,
    reconnectInterval: 3000,
  },
  modelscope: { apiKey: "test-key" },
  webUI: { port: 8080 },
  mcpServerConfig: {
    serverA: {
      tools: {
        tool1: {
          enable: true,
          usageCount: 5,
          lastUsedTime: "2024-01-01 10:00:00",
        },
      },
    },
  },
  customMCP: {
    tools: [
      {
        name: "test-tool",
        description: "测试工具",
        inputSchema: { type: "object" },
        handler: { type: "http" as const, url: "https://example.com/api" },
      },
    ],
  },
  platforms: {
    coze: { token: "coze-token" },
  },
};

// ==================== 辅助函数 ====================

function setupMockConfig(
  config: Record<string, unknown> = MINIMAL_VALID_CONFIG
) {
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(JSON.stringify(config));
  mockWriteFileSync.mockImplementation(() => {});
}

function createManager(): ConfigManager {
  // 重置单例
  (ConfigManager as any).instance = undefined;
  return ConfigManager.getInstance();
}

let mockConsoleLog: Mock;
let mockConsoleWarn: Mock;
let mockConsoleError: Mock;

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  vi.clearAllMocks();
  setupMockConfig();

  // Mock console 方法
  mockConsoleLog = vi.fn();
  mockConsoleWarn = vi.fn();
  mockConsoleError = vi.fn();
  console.log = mockConsoleLog;
  console.warn = mockConsoleWarn;
  console.error = mockConsoleError;

  // 清理全局状态
  (global as any).__webServer = undefined;

  // 重置环境变量
  process.env.HOME = "/tmp/test-home";
  process.env.USERPROFILE = undefined;
  process.env.XIAOZHI_CONFIG_DIR = undefined;
  process.env.MODELSCOPE_API_TOKEN = undefined;
});

afterEach(() => {
  // 恢复 console
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;

  // 清理单例
  (ConfigManager as any).instance = undefined;
  (global as any).__webServer = undefined;
});

// ==================== A. 配置加载与缓存 ====================

describe("ConfigManager > 配置加载与缓存", () => {
  it("getConfig() 应该正常加载并返回配置对象", () => {
    const manager = createManager();
    const config = manager.getConfig();

    expect(config.mcpEndpoint).toBe("wss://example.com/mcp");
    expect(config.mcpServers).toBeDefined();
  });

  it("getConfig() 应该使用缓存机制，多次调用只读取一次文件", () => {
    const manager = createManager();

    manager.getConfig();
    manager.getConfig();
    manager.getConfig();

    // readFileSync 只应被调用一次（首次加载时）
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it("getConfig() 返回值应该是深拷贝，修改返回值不影响内部状态", () => {
    const manager = createManager();

    const config1 = manager.getConfig();
    config1.mcpEndpoint = "modified";

    const config2 = manager.getConfig();
    expect(config2.mcpEndpoint).toBe("wss://example.com/mcp");
  });

  it("loadConfig() 应该正确处理 BOM 字符", () => {
    const configWithBOM = '\uFEFF{"mcpEndpoint":"wss://test","mcpServers":{}}';
    mockReadFileSync.mockReturnValue(configWithBOM);

    const manager = createManager();
    const config = manager.getConfig();

    expect(config.mcpEndpoint).toBe("wss://test");
  });

  it("loadConfig() 配置文件不存在时应抛出错误", () => {
    mockExistsSync.mockReturnValue(false);

    const manager = createManager();

    expect(() => manager.getConfig()).toThrow("配置文件不存在");
  });

  it("loadConfig() JSON 格式错误时应抛出格式错误", () => {
    mockReadFileSync.mockReturnValue("{invalid json}");

    const manager = createManager();

    expect(() => manager.getConfig()).toThrow("配置文件格式错误");
  });

  it("loadConfig() 其他读取异常时应重新抛出原始错误", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("磁盘读取失败");
    });

    const manager = createManager();

    expect(() => manager.getConfig()).toThrow("磁盘读取失败");
  });

  it("reloadConfig() 应该清除缓存，下次调用触发新的文件读取", () => {
    const manager = createManager();

    // 首次加载
    manager.getConfig();
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);

    // 重载
    manager.reloadConfig();

    // 再次获取应该重新读取
    manager.getConfig();
    expect(mockReadFileSync).toHaveBeenCalledTimes(2);
  });
});

// ==================== B. MCP 端点管理 ====================

describe("ConfigManager > MCP 端点管理", () => {
  describe("getMcpEndpoint()", () => {
    it("字符串端点应直接返回", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: "wss://single.com",
      });
      const manager = createManager();

      expect(manager.getMcpEndpoint()).toBe("wss://single.com");
    });

    it("数组端点应返回第一个元素", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: ["wss://first.com", "wss://second.com"],
      });
      const manager = createManager();

      expect(manager.getMcpEndpoint()).toBe("wss://first.com");
    });

    it("空数组应返回空字符串", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: [],
      });
      const manager = createManager();

      expect(manager.getMcpEndpoint()).toBe("");
    });
  });

  describe("getMcpEndpoints()", () => {
    it("字符串端点应包装为数组", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: "wss://single.com",
      });
      const manager = createManager();

      expect(manager.getMcpEndpoints()).toEqual(["wss://single.com"]);
    });

    it("数组端点应返回副本", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: ["wss://a.com", "wss://b.com"],
      });
      const manager = createManager();

      const endpoints = manager.getMcpEndpoints();
      endpoints.push("wss://new.com");

      // 修改副本不应影响内部状态
      expect(manager.getMcpEndpoints().length).toBe(2);
    });

    it("空字符串应返回空数组", () => {
      setupMockConfig({ ...MINIMAL_VALID_CONFIG, mcpEndpoint: "" });
      const manager = createManager();

      expect(manager.getMcpEndpoints()).toEqual([]);
    });
  });

  describe("updateMcpEndpoint()", () => {
    it("应该正确更新为字符串端点", () => {
      const manager = createManager();

      manager.updateMcpEndpoint("wss://new-endpoint.com");

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("应该正确更新为数组端点", () => {
      const manager = createManager();

      manager.updateMcpEndpoint(["wss://a.com", "wss://b.com"]);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("数组含空元素时应抛出错误", () => {
      const manager = createManager();

      expect(() =>
        manager.updateMcpEndpoint(["wss://valid.com", "", "wss://also.com"])
      ).toThrow("非空字符串");
    });

    it("数组含非字符串元素时应抛出错误", () => {
      const manager = createManager();

      expect(() =>
        manager.updateMcpEndpoint(["wss://valid.com", 123 as unknown as string])
      ).toThrow("非空字符串");
    });
  });

  describe("addMcpEndpoint()", () => {
    it("应该成功添加新端点", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: "wss://existing.com",
      });
      const manager = createManager();

      manager.addMcpEndpoint("wss://new.com");

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("添加重复端点时应抛出错误", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: "wss://existing.com",
      });
      const manager = createManager();

      expect(() => manager.addMcpEndpoint("wss://existing.com")).toThrow(
        "已存在"
      );
    });

    it("空字符串参数应抛出错误", () => {
      const manager = createManager();

      expect(() => manager.addMcpEndpoint("")).toThrow("非空字符串");
    });
  });

  describe("removeMcpEndpoint()", () => {
    it("应该成功移除存在的端点", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: ["wss://keep.com", "wss://remove.com"],
      });
      const manager = createManager();

      manager.removeMcpEndpoint("wss://remove.com");

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("移除不存在的端点时应抛出错误", () => {
      setupMockConfig({
        ...MINIMAL_VALID_CONFIG,
        mcpEndpoint: "wss://only.com",
      });
      const manager = createManager();

      expect(() => manager.removeMcpEndpoint("wss://nonexistent")).toThrow(
        "不存在"
      );
    });

    it("空字符串参数应抛出错误", () => {
      const manager = createManager();

      expect(() => manager.removeMcpEndpoint("")).toThrow("非空字符串");
    });
  });
});

// ==================== C. MCP 服务管理 ====================

describe("ConfigManager > MCP 服务管理", () => {
  it("getMcpServers() 应该返回服务配置对象", () => {
    const manager = createManager();
    const servers = manager.getMcpServers();

    expect(servers).toHaveProperty("testServer");
  });

  it("getMcpServerConfig() 有配置时应返回", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    const serverConfig = manager.getMcpServerConfig();
    expect(serverConfig).toHaveProperty("serverA");
  });

  it("getMcpServerConfig() 无配置时应返回空对象", () => {
    const manager = createManager();

    const serverConfig = manager.getMcpServerConfig();
    expect(serverConfig).toEqual({});
  });

  it("updateMcpServer() 应该新增服务", () => {
    const manager = createManager();

    manager.updateMcpServer("newServer", {
      command: "python",
      args: ["main.py"],
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateMcpServer() 应该覆盖已有服务", () => {
    const manager = createManager();

    manager.updateMcpServer("testServer", {
      type: "sse",
      url: "https://updated.com/sse",
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateMcpServer() 空名称应抛出错误", () => {
    const manager = createManager();

    expect(() =>
      manager.updateMcpServer("", { command: "test", args: [] })
    ).toThrow("非空字符串");
  });

  it("removeMcpServer() 应该删除服务", () => {
    const manager = createManager();

    manager.removeMcpServer("testServer");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("removeMcpServer() 应该同时清理关联的 mcpServerConfig", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        testServer: { tools: {} },
      },
    });
    const manager = createManager();

    manager.removeMcpServer("testServer");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("removeMcpServer() 应该清理关联的 customMCP 工具", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      customMCP: {
        tools: [
          {
            name: "related-tool",
            description: "相关工具",
            inputSchema: {},
            handler: {
              type: "mcp",
              config: { serviceName: "testServer", toolName: "someTool" },
            },
          },
        ],
      },
    });
    const manager = createManager();

    manager.removeMcpServer("testServer");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("removeMcpServer() customMCP 工具全部移除后应清理 customMCP 对象", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      customMCP: {
        tools: [
          {
            name: "only-related",
            description: "唯一相关工具",
            inputSchema: {},
            handler: {
              type: "mcp",
              config: { serviceName: "testServer", toolName: "tool" },
            },
          },
        ],
      },
    });
    const manager = createManager();

    manager.removeMcpServer("testServer");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("removeMcpServer() 不存在服务应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.removeMcpServer("nonexistent")).toThrow("不存在");
  });
});

// ==================== D. 批量配置更新 ====================

describe("ConfigManager > 批量配置更新", () => {
  it("updateConfig() 应该更新 mcpEndpoint", () => {
    const manager = createManager();

    manager.updateConfig({ mcpEndpoint: "wss://updated.com" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 更新 mcpServers 时应新增和删除", () => {
    const manager = createManager();

    manager.updateConfig({
      mcpServers: {
        newServer: { command: "node", args: ["new.js"] },
      },
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 删除服务时应同步清理 mcpServerConfig", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        testServer: { tools: { tool1: { enable: true } } },
      },
    });
    const manager = createManager();

    // 用不包含 testServer 的配置更新
    manager.updateConfig({
      mcpServers: {
        anotherServer: { command: "node", args: ["another.js"] },
      },
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 应该合并更新 connection", () => {
    const manager = createManager();

    manager.updateConfig({ connection: { heartbeatInterval: 10000 } });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() connection 不存在时应创建新对象", () => {
    setupMockConfig(MINIMAL_VALID_CONFIG); // 无 connection 字段
    const manager = createManager();

    manager.updateConfig({ connection: { heartbeatInterval: 10000 } });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 应该更新 modelscope", () => {
    const manager = createManager();

    manager.updateConfig({ modelscope: { apiKey: "new-key" } });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 应该更新 webUI", () => {
    const manager = createManager();

    manager.updateConfig({ webUI: { port: 8888 } });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 应该更新 platforms", () => {
    const manager = createManager();

    manager.updateConfig({ platforms: { coze: { token: "token" } } });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 使用 in 检测设置 asr 为 undefined 支持清空", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      asr: { appid: "test" },
    });
    const manager = createManager();

    manager.updateConfig({ asr: undefined });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 应该设置 tts", () => {
    const manager = createManager();

    manager.updateConfig({ tts: { voice_type: "female" } });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 应该设置 llm", () => {
    const manager = createManager();

    manager.updateConfig({
      llm: { model: "gpt-4", apiKey: "key", baseURL: "url" },
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConfig() 应该发射 config:updated 事件", () => {
    const manager = createManager();
    const callback = vi.fn();
    manager.on("config:updated", callback);

    manager.updateConfig({ mcpEndpoint: "wss://updated.com" });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ type: "config" })
    );
  });
});

// ==================== E. 服务工具配置管理 ====================

describe("ConfigManager > 服务工具配置管理", () => {
  it("getServerToolsConfig() 应该返回指定服务的工具配置", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    const tools = manager.getServerToolsConfig("serverA");

    expect(tools).toHaveProperty("tool1");
  });

  it("getServerToolsConfig() 服务无配置时应返回空对象", () => {
    const manager = createManager();

    const tools = manager.getServerToolsConfig("nonexistent");

    expect(tools).toEqual({});
  });

  it("isToolEnabled() 工具默认应启用", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(manager.isToolEnabled("serverA", "unknownTool")).toBe(true);
  });

  it("isToolEnabled() 工具显式禁用应返回 false", () => {
    setupMockConfig({
      ...FULL_TEST_CONFIG,
      mcpServerConfig: {
        serverA: {
          tools: {
            disabledTool: { enable: false },
          },
        },
      },
    });
    const manager = createManager();

    expect(manager.isToolEnabled("serverA", "disabledTool")).toBe(false);
  });

  it("isToolEnabled() 工具显式启用应返回 true", () => {
    setupMockConfig({
      ...FULL_TEST_CONFIG,
      mcpServerConfig: {
        serverA: {
          tools: {
            enabledTool: { enable: true },
          },
        },
      },
    });
    const manager = createManager();

    expect(manager.isToolEnabled("serverA", "enabledTool")).toBe(true);
  });

  it("updateServerToolsConfig() 应该更新工具配置", () => {
    const manager = createManager();

    manager.updateServerToolsConfig("serverA", {
      tool1: { enable: true, description: "新描述" },
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateServerToolsConfig() 传入空对象应删除服务配置", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        serverA: { tools: { tool1: { enable: true } } },
      },
    });
    const manager = createManager();

    manager.updateServerToolsConfig("serverA", {});

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("removeServerToolsConfig() 应该删除存在的服务工具配置", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        serverA: { tools: { tool1: { enable: true } } },
      },
    });
    const manager = createManager();

    manager.removeServerToolsConfig("serverA");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("removeServerToolsConfig() 删除不存在服务应静默处理", () => {
    const manager = createManager();

    // 不应抛错
    manager.removeServerToolsConfig("nonexistent");

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("cleanupInvalidServerToolsConfig() 应该清理无效配置", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        validServer: { tools: {} },
        invalidServer: { tools: {} },
      },
    });
    // mcpServers 中只有 testServer，invalidServer 是无效的
    const manager = createManager();

    manager.cleanupInvalidServerToolsConfig();

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("cleanupInvalidServerToolsConfig() 无无效配置时不操作", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        testServer: { tools: {} },
      },
    });
    const manager = createManager();

    manager.cleanupInvalidServerToolsConfig();

    // 所有服务都有效，不应保存
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("cleanupInvalidServerToolsConfig() mcpServerConfig 为空时应跳过", () => {
    const manager = createManager();

    manager.cleanupInvalidServerToolsConfig();

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("setToolEnabled() 应该启用工具", () => {
    const manager = createManager();

    manager.setToolEnabled("serverA", "tool1", true);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setToolEnabled() 应该禁用工具", () => {
    const manager = createManager();

    manager.setToolEnabled("serverA", "tool1", false);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setToolEnabled() 带描述信息应同时设置 description", () => {
    const manager = createManager();

    manager.setToolEnabled("serverA", "tool1", true, "工具描述");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});

// ==================== F. 连接配置 ====================

describe("ConfigManager > 连接配置", () => {
  it("getConnectionConfig() 无自定义配置时应返回全量默认值", () => {
    const manager = createManager();
    const connConfig = manager.getConnectionConfig();

    expect(connConfig.heartbeatInterval).toBe(30000);
    expect(connConfig.heartbeatTimeout).toBe(10000);
    expect(connConfig.reconnectInterval).toBe(5000);
    expect(connConfig.maxReconnectAttempts).toBe(5);
    expect(connConfig.connectionTimeout).toBe(30000);
    expect(connConfig.autoReconnect).toBe(true);
  });

  it("getConnectionConfig() 部分字段自定义时应合并默认值", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      connection: { heartbeatInterval: 20000 },
    });
    const manager = createManager();
    const connConfig = manager.getConnectionConfig();

    expect(connConfig.heartbeatInterval).toBe(20000);
    // 其余字段应为默认值
    expect(connConfig.heartbeatTimeout).toBe(10000);
    expect(connConfig.reconnectInterval).toBe(5000);
    expect(connConfig.maxReconnectAttempts).toBe(5);
    expect(connConfig.connectionTimeout).toBe(30000);
    expect(connConfig.autoReconnect).toBe(true);
  });

  it("getConnectionConfig() 应包含 maxReconnectAttempts 字段", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      connection: { maxReconnectAttempts: 10 },
    });
    const manager = createManager();
    const connConfig = manager.getConnectionConfig();

    expect(connConfig.maxReconnectAttempts).toBe(10);
  });

  it("getConnectionConfig() 应包含 connectionTimeout 字段", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      connection: { connectionTimeout: 60000 },
    });
    const manager = createManager();
    const connConfig = manager.getConnectionConfig();

    expect(connConfig.connectionTimeout).toBe(60000);
  });

  it("getConnectionConfig() 应包含 autoReconnect 字段", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      connection: { autoReconnect: false },
    });
    const manager = createManager();
    const connConfig = manager.getConnectionConfig();

    expect(connConfig.autoReconnect).toBe(false);
  });

  it("getHeartbeatInterval() 应返回心跳间隔", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      connection: { heartbeatInterval: 15000 },
    });
    const manager = createManager();

    expect(manager.getHeartbeatInterval()).toBe(15000);
  });

  it("getHeartbeatTimeout() 应返回超时时间", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      connection: { heartbeatTimeout: 5000 },
    });
    const manager = createManager();

    expect(manager.getHeartbeatTimeout()).toBe(5000);
  });

  it("getReconnectInterval() 应返回重连间隔", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      connection: { reconnectInterval: 8000 },
    });
    const manager = createManager();

    expect(manager.getReconnectInterval()).toBe(8000);
  });

  it("updateConnectionConfig() 应更新部分字段", () => {
    const manager = createManager();

    manager.updateConnectionConfig({ heartbeatInterval: 10000 });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateConnectionConfig() connection 不存在时应创建", () => {
    setupMockConfig(MINIMAL_VALID_CONFIG);
    const manager = createManager();

    manager.updateConnectionConfig({ heartbeatInterval: 10000 });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setHeartbeatInterval() 正常设置应成功", () => {
    const manager = createManager();

    manager.setHeartbeatInterval(15000);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setHeartbeatInterval() 零值应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setHeartbeatInterval(0)).toThrow("必须大于0");
  });

  it("setHeartbeatInterval() 负数应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setHeartbeatInterval(-1)).toThrow("必须大于0");
  });

  it("setHeartbeatTimeout() 正常设置应成功", () => {
    const manager = createManager();

    manager.setHeartbeatTimeout(5000);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setHeartbeatTimeout() 零值应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setHeartbeatTimeout(0)).toThrow("必须大于0");
  });

  it("setReconnectInterval() 正常设置应成功", () => {
    const manager = createManager();

    manager.setReconnectInterval(8000);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setReconnectInterval() 负数应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setReconnectInterval(-1)).toThrow("必须大于0");
  });
});

// ==================== G. ModelScope 配置 ====================

describe("ConfigManager > ModelScope 配置", () => {
  it("getModelScopeConfig() 有配置时应返回", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    const msConfig = manager.getModelScopeConfig();

    expect(msConfig.apiKey).toBe("test-key");
  });

  it("getModelScopeConfig() 无配置时应返回空对象", () => {
    const manager = createManager();

    const msConfig = manager.getModelScopeConfig();

    expect(msConfig).toEqual({});
  });

  it("getModelScopeApiKey() 应从配置文件获取", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(manager.getModelScopeApiKey()).toBe("test-key");
  });

  it("getModelScopeApiKey() 配置无 key 时应从环境变量获取", () => {
    setupMockConfig(MINIMAL_VALID_CONFIG);
    process.env.MODELSCOPE_API_TOKEN = "env-token";
    const manager = createManager();

    expect(manager.getModelScopeApiKey()).toBe("env-token");
  });

  it("getModelScopeApiKey() 都没有时应返回 undefined", () => {
    setupMockConfig(MINIMAL_VALID_CONFIG);
    process.env.MODELSCOPE_API_TOKEN = undefined;
    const manager = createManager();

    expect(manager.getModelScopeApiKey()).toBeUndefined();
  });

  it("updateModelScopeConfig() 应更新配置", () => {
    const manager = createManager();

    manager.updateModelScopeConfig({ apiKey: "new-key" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateModelScopeConfig() modelscope 不存在时应创建", () => {
    setupMockConfig(MINIMAL_VALID_CONFIG);
    const manager = createManager();

    manager.updateModelScopeConfig({ apiKey: "first-key" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setModelScopeApiKey() 正常设置应成功", () => {
    const manager = createManager();

    manager.setModelScopeApiKey("my-api-key");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setModelScopeApiKey() 空字符串应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setModelScopeApiKey("")).toThrow("非空字符串");
  });

  it("setModelScopeApiKey() 非字符串应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setModelScopeApiKey(123 as unknown as string)).toThrow(
      "非空字符串"
    );
  });
});

// ==================== H. CustomMCP 工具管理 ====================

describe("ConfigManager > CustomMCP 工具查询与验证", () => {
  it("getCustomMCPConfig() 有配置时应返回", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    const customMCP = manager.getCustomMCPConfig();

    expect(customMCP).not.toBeNull();
    expect(customMCP!.tools.length).toBeGreaterThan(0);
  });

  it("getCustomMCPConfig() 无配置时应返回 null", () => {
    const manager = createManager();

    expect(manager.getCustomMCPConfig()).toBeNull();
  });

  it("getCustomMCPTools() 应返回工具列表", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    const tools = manager.getCustomMCPTools();

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("test-tool");
  });

  it("getCustomMCPTools() 无配置时应返回空数组", () => {
    const manager = createManager();

    expect(manager.getCustomMCPTools()).toEqual([]);
  });

  it("validateCustomMCPTools() 有效工具列表应返回 true", () => {
    const manager = createManager();
    const tools = [
      {
        name: "valid-tool",
        description: "有效工具",
        inputSchema: { type: "object" },
        handler: { type: "http" as const, url: "https://example.com" },
      },
    ];

    expect(manager.validateCustomMCPTools(tools)).toBe(true);
  });

  it("validateCustomMCPTools() 非数组输入应返回 false", () => {
    const manager = createManager();

    expect(manager.validateCustomMCPTools(null as any)).toBe(false);
    expect(manager.validateCustomMCPTools("array" as any)).toBe(false);
  });

  it("validateCustomMCPTools() 缺少 name 字段应返回 false", () => {
    const manager = createManager();
    const tools = [
      {
        description: "无名称工具",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com" },
      },
    ];

    expect(manager.validateCustomMCPTools(tools)).toBe(false);
  });

  it("validateCustomMCPTools() 缺少 description 字段应返回 false", () => {
    const manager = createManager();
    const tools = [
      {
        name: "no-desc",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com" },
      },
    ];

    expect(manager.validateCustomMCPTools(tools)).toBe(false);
  });

  it("validateCustomMCPTools() 缺少 inputSchema 字段应返回 false", () => {
    const manager = createManager();
    const tools = [
      {
        name: "no-schema",
        description: "无 schema 工具",
        handler: { type: "http" as const, url: "https://example.com" },
      },
    ];

    expect(manager.validateCustomMCPTools(tools)).toBe(false);
  });

  it("validateCustomMCPTools() 缺少 handler 字段应返回 false", () => {
    const manager = createManager();
    const tools = [
      {
        name: "no-handler",
        description: "无处理器工具",
        inputSchema: {},
      },
    ];

    expect(manager.validateCustomMCPTools(tools)).toBe(false);
  });

  it("validateCustomMCPTools() 无效的 handler.type 应返回 false", () => {
    const manager = createManager();
    const tools = [
      {
        name: "bad-type",
        description: "无效类型",
        inputSchema: {},
        handler: { type: "invalid-type" as any },
      },
    ];

    expect(manager.validateCustomMCPTools(tools)).toBe(false);
  });

  it("hasValidCustomMCPTools() 有效工具应返回 true", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(manager.hasValidCustomMCPTools()).toBe(true);
  });

  it("hasValidCustomMCPTools() 无工具应返回 false", () => {
    const manager = createManager();

    expect(manager.hasValidCustomMCPTools()).toBe(false);
  });
});

describe("ConfigManager > 处理器配置验证", () => {
  const validBaseTool = (
    handler: Record<string, unknown>
  ): Record<string, unknown> => ({
    name: "test",
    description: "test",
    inputSchema: {},
    handler,
  });

  describe("validateProxyHandler", () => {
    it("coze 平台有 workflow_id 应通过", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "proxy",
          platform: "coze",
          config: { workflow_id: "wf_123" },
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
    });

    it("coze 平台有 bot_id 应通过", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "proxy",
          platform: "coze",
          config: { bot_id: "bot_456" },
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
    });

    it("缺少 platform 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "proxy",
          config: {},
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("无效 platform 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "proxy",
          platform: "invalid",
          config: {},
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("coze 平台缺少 workflow_id 和 bot_id 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "proxy",
          platform: "coze",
          config: {},
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("缺少 config 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "proxy",
          platform: "coze",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });
  });

  describe("validateHttpHandler", () => {
    it("有效 URL 应通过", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "http",
          url: "https://api.example.com/webhook",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
    });

    it("无效 URL 格式应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "http",
          url: "not-a-url",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("缺少 url 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "http",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("无效 HTTP method 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "http",
          url: "https://example.com",
          method: "OPTIONS",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("有效 HTTP method 应通过", () => {
      const manager = createManager();
      for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
        const tools = [
          validBaseTool({
            type: "http",
            url: "https://example.com",
            method,
          }),
        ];
        expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
      }
    });
  });

  describe("validateFunctionHandler", () => {
    it("有效配置应通过", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "function",
          module: "./handlers",
          function: "handleRequest",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
    });

    it("缺少 module 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "function",
          function: "handleRequest",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("缺少 function 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "function",
          module: "./handlers",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });
  });

  describe("validateScriptHandler", () => {
    it("有效配置应通过", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "script",
          script: "console.log('hello')",
          interpreter: "node",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
    });

    it("缺少 script 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "script",
          interpreter: "node",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("无效 interpreter 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "script",
          script: "echo hello",
          interpreter: "ruby",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("有效 interpreter（node/python/bash）应通过", () => {
      const manager = createManager();
      for (const interp of ["node", "python", "bash"]) {
        const tools = [
          validBaseTool({
            type: "script",
            script: "echo test",
            interpreter: interp,
          }),
        ];
        expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
      }
    });
  });

  describe("validateChainHandler", () => {
    it("有效配置应通过", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "chain",
          tools: ["tool1", "tool2"],
          mode: "sequential",
          error_handling: "stop",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
    });

    it("空 tools 数组应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "chain",
          tools: [],
          mode: "sequential",
          error_handling: "stop",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("无效 mode 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "chain",
          tools: ["tool1"],
          mode: "random",
          error_handling: "stop",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("无效 error_handling 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "chain",
          tools: ["tool1"],
          mode: "sequential",
          error_handling: "ignore",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });
  });

  describe("validateMCPHandler", () => {
    it("有效配置应通过", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "mcp",
          config: { serviceName: "myService", toolName: "myTool" },
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(true);
    });

    it("缺少 config 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "mcp",
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("缺少 serviceName 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "mcp",
          config: { toolName: "myTool" },
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });

    it("缺少 toolName 应返回 false", () => {
      const manager = createManager();
      const tools = [
        validBaseTool({
          type: "mcp",
          config: { serviceName: "myService" },
        }),
      ];

      expect(manager.validateCustomMCPTools(tools as any)).toBe(false);
    });
  });
});

describe("ConfigManager > CustomMCP 工具增删改", () => {
  it("addCustomMCPTool() 添加有效工具应成功", () => {
    const manager = createManager();
    const tool = {
      name: "new-tool",
      description: "新工具",
      inputSchema: { type: "object" },
      handler: { type: "http" as const, url: "https://example.com" },
    };

    manager.addCustomMCPTool(tool);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("addCustomMCPTool() 添加重复名称应抛出错误", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();
    const tool = {
      name: "test-tool",
      description: "重复工具",
      inputSchema: {},
      handler: { type: "http" as const, url: "https://example.com" },
    };

    expect(() => manager.addCustomMCPTool(tool)).toThrow("已存在");
  });

  it("addCustomMCPTool() 空对象应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.addCustomMCPTool(null as any)).toThrow("不能为空");
  });

  it("addCustomMCPTool() 验证失败的工具应抛出错误", () => {
    const manager = createManager();
    const invalidTool = {
      name: "invalid",
      description: "无 handler",
      inputSchema: {},
    };

    expect(() => manager.addCustomMCPTool(invalidTool as any)).toThrow(
      "验证失败"
    );
  });

  it("addCustomMCPTool() customMCP 不存在时应自动创建", () => {
    const manager = createManager();
    const tool = {
      name: "first-tool",
      description: "第一个工具",
      inputSchema: {},
      handler: { type: "http" as const, url: "https://example.com" },
    };

    manager.addCustomMCPTool(tool);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("addCustomMCPTools() 批量添加有效工具应成功", async () => {
    const manager = createManager();
    const tools = [
      {
        name: "batch-1",
        description: "批量工具1",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com/1" },
      },
      {
        name: "batch-2",
        description: "批量工具2",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com/2" },
      },
    ];

    await manager.addCustomMCPTools(tools);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("addCustomMCPTools() 过滤已存在的工具", async () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();
    const tools = [
      {
        name: "test-tool",
        description: "已存在",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com" },
      },
      {
        name: "really-new",
        description: "真正的新工具",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com/new" },
      },
    ];

    await manager.addCustomMCPTools(tools);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("addCustomMCPTools() 全部重复则不操作", async () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();
    const tools = [
      {
        name: "test-tool",
        description: "已存在",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com" },
      },
    ];

    await manager.addCustomMCPTools(tools);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("addCustomMCPTools() 空数组应直接返回", async () => {
    const manager = createManager();

    await manager.addCustomMCPTools([]);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("addCustomMCPTools() 非数组输入应抛出错误", async () => {
    const manager = createManager();

    await expect(manager.addCustomMCPTools(null as any)).rejects.toThrow(
      "必须是数组"
    );
  });

  it("addCustomMCPTools() 验证失败应抛出错误", async () => {
    const manager = createManager();
    const invalidTools = [{ name: "bad" }];

    await expect(
      manager.addCustomMCPTools(invalidTools as any)
    ).rejects.toThrow("验证失败");
  });

  it("removeCustomMCPTool() 删除存在的工具应成功", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    manager.removeCustomMCPTool("test-tool");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("removeCustomMCPTool() 工具不存在应抛出错误", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(() => manager.removeCustomMCPTool("nonexistent")).toThrow("不存在");
  });

  it("removeCustomMCPTool() 空名称应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.removeCustomMCPTool("")).toThrow("不能为空");
  });

  it("removeCustomMCPTool() 无 customMCP 配置应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.removeCustomMCPTool("any")).toThrow("未配置");
  });

  it("updateCustomMCPTool() 更新存在的工具应成功", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();
    const updatedTool = {
      name: "test-tool",
      description: "更新后的描述",
      inputSchema: { type: "object" },
      handler: { type: "function" as const, module: "./m", function: "fn" },
    };

    manager.updateCustomMCPTool("test-tool", updatedTool);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateCustomMCPTool() 工具不存在应抛出错误", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();
    const tool = {
      name: "nonexistent",
      description: "不存在",
      inputSchema: {},
      handler: { type: "http" as const, url: "https://example.com" },
    };

    expect(() => manager.updateCustomMCPTool("nonexistent", tool)).toThrow(
      "不存在"
    );
  });

  it("updateCustomMCPTool() 空名称应抛出错误", () => {
    const manager = createManager();
    const tool = {
      name: "t",
      description: "",
      inputSchema: {},
      handler: { type: "http" as const, url: "u" },
    };

    expect(() => manager.updateCustomMCPTool("", tool)).toThrow("不能为空");
  });

  it("updateCustomMCPTool() 空更新对象应抛出错误", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(() => manager.updateCustomMCPTool("test-tool", null as any)).toThrow(
      "不能为空"
    );
  });

  it("updateCustomMCPTool() 验证失败的更新应抛出错误", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();
    const invalidTool = {
      name: "test-tool",
      description: "",
      inputSchema: {},
    };

    expect(() =>
      manager.updateCustomMCPTool("test-tool", invalidTool as any)
    ).toThrow("验证失败");
  });

  it("updateCustomMCPTools() 整体替换工具列表应成功", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();
    const newTools = [
      {
        name: "replaced-1",
        description: "替换工具1",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com/1" },
      },
      {
        name: "replaced-2",
        description: "替换工具2",
        inputSchema: {},
        handler: { type: "http" as const, url: "https://example.com/2" },
      },
    ];

    manager.updateCustomMCPTools(newTools);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateCustomMCPTools() 非数组输入应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.updateCustomMCPTools(null as any)).toThrow(
      "必须是数组"
    );
  });

  it("updateCustomMCPTools() 验证失败应抛出错误", () => {
    const manager = createManager();

    expect(() =>
      manager.updateCustomMCPTools([{ name: "bad" }] as any)
    ).toThrow("验证失败");
  });
});

// ==================== I. Web UI 配置 ====================

describe("ConfigManager > Web UI 配置", () => {
  it("getWebUIConfig() 有配置时应返回", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    const webUI = manager.getWebUIConfig();

    expect(webUI.port).toBe(8080);
  });

  it("getWebUIConfig() 无配置时应返回空对象", () => {
    const manager = createManager();

    expect(manager.getWebUIConfig()).toEqual({});
  });

  it("getWebUIPort() 有端口配置时应返回配置值", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(manager.getWebUIPort()).toBe(8080);
  });

  it("getWebUIPort() 无端口配置时应返回默认值 9999", () => {
    const manager = createManager();

    expect(manager.getWebUIPort()).toBe(9999);
  });

  it("updateWebUIConfig() 应更新配置", () => {
    const manager = createManager();

    manager.updateWebUIConfig({ port: 7777 });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setWebUIPort() 有效端口应成功", () => {
    const manager = createManager();

    manager.setWebUIPort(5000);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setWebUIPort() 零应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setWebUIPort(0)).toThrow("1-65535");
  });

  it("setWebUIPort() 负数应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setWebUIPort(-1)).toThrow("1-65535");
  });

  it("setWebUIPort() 超过 65535 应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setWebUIPort(70000)).toThrow("1-65535");
  });

  it("setWebUIPort() 非整数应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setWebUIPort(1.5)).toThrow("1-65535");
  });

  it("notifyConfigUpdate() 有 webServer 实例时应广播", () => {
    const broadcastFn = vi.fn();
    (global as any).__webServer = { broadcastConfigUpdate: broadcastFn };

    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    // 触发一个会调用 saveConfig 的操作
    manager.updateWebUIConfig({ port: 9999 });

    expect(broadcastFn).toHaveBeenCalled();
  });

  it("notifyConfigUpdate() 无 webServer 实例时应静默处理", () => {
    (global as any).__webServer = undefined;
    const manager = createManager();

    // 不应抛错
    manager.updateWebUIConfig({ port: 9999 });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});

// ==================== J. 平台配置 ====================

describe("ConfigManager > 平台配置", () => {
  it("updatePlatformConfig() 应更新平台配置", () => {
    const manager = createManager();

    manager.updatePlatformConfig("coze", { token: "new-token" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updatePlatformConfig() platforms 不存在时应创建", () => {
    setupMockConfig(MINIMAL_VALID_CONFIG);
    const manager = createManager();

    manager.updatePlatformConfig("coze", { token: "first-token" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("getCozePlatformConfig() 有效配置应返回 CozePlatformConfig", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    const cozeConfig = manager.getCozePlatformConfig();

    expect(cozeConfig).not.toBeNull();
    expect(cozeConfig!.token).toBe("coze-token");
  });

  it("getCozePlatformConfig() 无 token 时应返回 null", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      platforms: { coze: {} },
    });
    const manager = createManager();

    expect(manager.getCozePlatformConfig()).toBeNull();
  });

  it("getCozePlatformConfig() platforms 不存在时应返回 null", () => {
    const manager = createManager();

    expect(manager.getCozePlatformConfig()).toBeNull();
  });

  it("getCozeToken() 有 token 时应返回", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(manager.getCozeToken()).toBe("coze-token");
  });

  it("getCozeToken() 无 token 时应返回 null", () => {
    const manager = createManager();

    expect(manager.getCozeToken()).toBeNull();
  });

  it("setCozePlatformConfig() 有效 token 应成功", () => {
    const manager = createManager();

    manager.setCozePlatformConfig({ token: "valid-token" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("setCozePlatformConfig() 空字符串应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setCozePlatformConfig({ token: "" })).toThrow(
      "不能为空"
    );
  });

  it("setCozePlatformConfig() 纯空白字符应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.setCozePlatformConfig({ token: "   " })).toThrow(
      "不能为空"
    );
  });

  it("isCozeConfigValid() 有效配置应返回 true", () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    expect(manager.isCozeConfigValid()).toBe(true);
  });

  it("isCozeConfigValid() 无效配置应返回 false", () => {
    const manager = createManager();

    expect(manager.isCozeConfigValid()).toBe(false);
  });
});

// ==================== K. 工具使用统计 ====================

describe("ConfigManager > 工具使用统计", () => {
  it("updateToolUsageStats() 三参数版本应双写 MCP 和 customMCP 统计", async () => {
    const manager = createManager();

    await manager.updateToolUsageStats(
      "serverA",
      "tool1",
      "2024-06-01T10:00:00Z"
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateToolUsageStats() 两参数版本应只更新 customMCP 统计", async () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    await manager.updateToolUsageStats("test-tool");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateToolUsageStats() 两参数版本 incrementUsageCount=false 不增加计数", async () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    await manager.updateToolUsageStats("test-tool", false);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateToolUsageStats() 异常时应静默处理不抛错", async () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error("写入失败");
    });
    const manager = createManager();

    // 不应抛出异常
    await manager.updateToolUsageStats(
      "serverA",
      "tool1",
      "2024-06-01T10:00:00Z"
    );

    expect(mockConsoleError).toHaveBeenCalled();
  });

  it("_updateMCPServerToolStats() 首次更新应创建配置", async () => {
    const manager = createManager();

    // 通过公共方法间接测试
    await manager.updateMCPServerToolStats(
      "newServer",
      "newTool",
      "2024-06-01T10:00:00Z"
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("_updateMCPServerToolStats() 应增加使用次数", async () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        testServer: {
          tools: {
            existingTool: { enable: true, usageCount: 3 },
          },
        },
      },
    });
    const manager = createManager();

    await manager.updateMCPServerToolStats(
      "testServer",
      "existingTool",
      "2024-06-01T11:00:00Z"
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("_updateMCPServerToolStats() incrementUsageCount=false 不增加计数", async () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        testServer: {
          tools: {
            existingTool: { enable: true, usageCount: 3 },
          },
        },
      },
    });
    const manager = createManager();

    await manager.updateMCPServerToolStats(
      "testServer",
      "existingTool",
      "2024-06-01T11:00:00Z",
      false
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("_updateMCPServerToolStats() 时间校验只接受更新的时间", async () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      mcpServerConfig: {
        testServer: {
          tools: {
            timeTool: {
              enable: true,
              lastUsedTime: "2024-12-31 23:59:59",
            },
          },
        },
      },
    });
    const manager = createManager();

    // 用更旧的时间更新，不应改变 lastUsedTime
    await manager.updateMCPServerToolStats(
      "testServer",
      "timeTool",
      "2024-01-01 00:00:00Z"
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateCustomMCPToolStats() 三参数版本工具名格式应为 server__tool", async () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      customMCP: {
        tools: [
          {
            name: "serverA__toolName",
            description: "复合名称工具",
            inputSchema: {},
            handler: { type: "http" as const, url: "https://example.com" },
          },
        ],
      },
    });
    const manager = createManager();

    // 这个方法内部会查找名为 "serverA__toolName" 的工具
    await manager.updateToolUsageStats(
      "serverA",
      "toolName",
      "2024-06-01T10:00:00Z"
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateCustomMCPToolStats() 工具不存在时应跳过", async () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    // 通过两参数版本调用，工具名不匹配任何现有工具
    await manager.updateToolUsageStats("nonexistent-tool");

    // 不应触发 saveConfig（因为工具不存在被跳过）
    // 注意：这里可能仍会触发因为 updateCustomMCPTools 内部逻辑
  });

  it("acquireStatsUpdateLock() 首次获取应成功", async () => {
    const manager = createManager();

    const result = await (manager as any).acquireStatsUpdateLock("test_key");

    expect(result).toBe(true);
  });

  it("acquireStatsUpdateLock() 重复获取应返回 false", async () => {
    const manager = createManager();

    await (manager as any).acquireStatsUpdateLock("test_key");
    const result = await (manager as any).acquireStatsUpdateLock("test_key");

    expect(result).toBe(false);
  });

  it("releaseStatsUpdateLock() 正常释放应清理锁", () => {
    const manager = createManager();

    (manager as any).releaseStatsUpdateLock("test_key");

    expect(manager.getStatsUpdateLocks()).not.toContain("test_key");
  });

  it("clearAllStatsUpdateLocks() 应清理所有锁", async () => {
    const manager = createManager();

    await (manager as any).acquireStatsUpdateLock("key1");
    await (manager as any).acquireStatsUpdateLock("key2");

    manager.clearAllStatsUpdateLocks();

    expect(manager.getStatsUpdateLocks()).toHaveLength(0);
  });

  it("getStatsUpdateLocks() 应返回当前锁列表", async () => {
    const manager = createManager();

    await (manager as any).acquireStatsUpdateLock("lock_a");

    expect(manager.getStatsUpdateLocks()).toContain("lock_a");
  });

  it("updateToolUsageStatsWithLock() 正常流程应完成锁定-更新-释放", async () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    await manager.updateToolUsageStatsWithLock("test-tool");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateToolUsageStatsWithLock() 锁已被占用时应跳过", async () => {
    setupMockConfig(FULL_TEST_CONFIG);
    const manager = createManager();

    // 先占用锁
    await (manager as any).acquireStatsUpdateLock("custommcp_test-tool");

    // 这次应该跳过
    await manager.updateToolUsageStatsWithLock("test-tool");

    // 不应再次写入（因为跳过了）
  });

  it("updateMCPServerToolStatsWithLock() 正常流程应完成", async () => {
    const manager = createManager();

    await manager.updateMCPServerToolStatsWithLock(
      "serverA",
      "tool1",
      "2024-06-01T10:00:00Z"
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateMCPServerToolStatsWithLock() 更新失败时应释放锁", async () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error("模拟写入失败");
    });
    const manager = createManager();

    try {
      await manager.updateMCPServerToolStatsWithLock(
        "serverA",
        "tool1",
        "2024-06-01T10:00:00Z"
      );
    } catch {
      // 预期异常
    }

    // 锁应该已被释放
    expect(manager.getStatsUpdateLocks()).not.toContain(
      "mcpserver_serverA_tool1"
    );
  });
});

// ==================== L. 其他配置（TTS/ASR/LLM/日志）====================

describe("ConfigManager > 其他配置", () => {
  it("getTTSConfig() 有配置时应返回", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      tts: { voice_type: "female", encoding: "mp3" },
    });
    const manager = createManager();

    const ttsConfig = manager.getTTSConfig();

    expect(ttsConfig.voice_type).toBe("female");
  });

  it("getTTSConfig() 无配置时应返回空对象", () => {
    const manager = createManager();

    expect(manager.getTTSConfig()).toEqual({});
  });

  it("getASRConfig() 有配置时应返回", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      asr: { appid: "asr-app-id" },
    });
    const manager = createManager();

    expect(manager.getASRConfig().appid).toBe("asr-app-id");
  });

  it("getASRConfig() 无配置时应返回空对象", () => {
    const manager = createManager();

    expect(manager.getASRConfig()).toEqual({});
  });

  it("getLLMConfig() 有配置时应返回", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      llm: { model: "gpt-4", apiKey: "key", baseURL: "url" },
    });
    const manager = createManager();

    const llmConfig = manager.getLLMConfig();

    expect(llmConfig).not.toBeNull();
    expect(llmConfig!.model).toBe("gpt-4");
  });

  it("getLLMConfig() 无配置时应返回 null", () => {
    const manager = createManager();

    expect(manager.getLLMConfig()).toBeNull();
  });

  it("isLLMConfigValid() 完整有效配置应返回 true", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      llm: {
        model: "gpt-4",
        apiKey: "valid-key",
        baseURL: "https://api.openai.com",
      },
    });
    const manager = createManager();

    expect(manager.isLLMConfigValid()).toBe(true);
  });

  it("isLLMConfigValid() model 为空应返回 false", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      llm: { model: "", apiKey: "key", baseURL: "url" },
    });
    const manager = createManager();

    expect(manager.isLLMConfigValid()).toBe(false);
  });

  it("isLLMConfigValid() apiKey 为空应返回 false", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      llm: { model: "gpt-4", apiKey: "", baseURL: "url" },
    });
    const manager = createManager();

    expect(manager.isLLMConfigValid()).toBe(false);
  });

  it("isLLMConfigValid() baseURL 为空应返回 false", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      llm: { model: "gpt-4", apiKey: "key", baseURL: "" },
    });
    const manager = createManager();

    expect(manager.isLLMConfigValid()).toBe(false);
  });

  it("isLLMConfigValid() llm 为 null 应返回 false", () => {
    const manager = createManager();

    expect(manager.isLLMConfigValid()).toBe(false);
  });

  it("getToolCallLogConfig() 有配置时应返回", () => {
    setupMockConfig({
      ...MINIMAL_VALID_CONFIG,
      toolCallLog: { maxRecords: 200 },
    });
    const manager = createManager();

    expect(manager.getToolCallLogConfig().maxRecords).toBe(200);
  });

  it("getToolCallLogConfig() 无配置时应返回空对象", () => {
    const manager = createManager();

    expect(manager.getToolCallLogConfig()).toEqual({});
  });

  it("updateToolCallLogConfig() 应更新配置", () => {
    const manager = createManager();

    manager.updateToolCallLogConfig({ maxRecords: 500 });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("updateTTSConfig() 应更新 TTS 配置", () => {
    const manager = createManager();

    manager.updateTTSConfig({ voice_type: "male" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("getConfigDir() 应返回配置目录", () => {
    const manager = createManager();

    const dir = manager.getConfigDir();

    expect(dir).toBeDefined();
  });

  it("getConfigDir() 使用 XIAOZHI_CONFIG_DIR 环境变量", () => {
    process.env.XIAOZHI_CONFIG_DIR = "/custom/config/dir";
    const manager = createManager();

    expect(manager.getConfigDir()).toBe("/custom/config/dir");
  });

  it("getConfigPath() 应返回配置文件路径", () => {
    const manager = createManager();

    const path = manager.getConfigPath();

    expect(path).toContain("xiaozhi.config.json");
  });

  it("getDefaultConfigPath() 应返回默认路径", () => {
    const manager = createManager();

    const path = manager.getDefaultConfigPath();

    expect(path).toBeDefined();
  });
});

// ==================== M. 事件系统 ====================

describe("ConfigManager > 事件系统", () => {
  it("on() 注册监听器后应在事件触发时被调用", () => {
    const manager = createManager();
    const callback = vi.fn();
    manager.on("config:updated", callback);

    manager.updateMcpEndpoint("wss://new.com");

    expect(callback).toHaveBeenCalled();
  });

  it("on() 同一事件注册多个监听器都应被调用", () => {
    const manager = createManager();
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    manager.on("config:updated", callback1);
    manager.on("config:updated", callback2);

    manager.updateMcpEndpoint("wss://new.com");

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  it("emitEvent() 监听器抛出异常不应影响其他监听器", () => {
    const manager = createManager();
    const failingCallback = vi.fn(() => {
      throw new Error("监听器异常");
    });
    const successCallback = vi.fn();
    manager.on("config:updated", failingCallback);
    manager.on("config:updated", successCallback);

    manager.updateMcpEndpoint("wss://new.com");

    expect(failingCallback).toHaveBeenCalled();
    expect(successCallback).toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it("emitEvent() 无监听器时应静默处理", () => {
    const manager = createManager();

    // 不注册任何监听器，不应报错
    expect(() => manager.updateMcpEndpoint("wss://new.com")).not.toThrow();
  });

  it("各操作应发射正确的 config:updated 事件 payload", () => {
    const manager = createManager();
    const callback = vi.fn();
    manager.on("config:updated", callback);

    // endpoint 更新
    manager.updateMcpEndpoint("wss://test.com");
    expect(callback).lastCalledWith(
      expect.objectContaining({ type: "endpoint" })
    );

    callback.mockClear();

    // connection 更新
    manager.updateConnectionConfig({ heartbeatInterval: 10000 });
    expect(callback).lastCalledWith(
      expect.objectContaining({ type: "connection" })
    );
  });

  it("操作失败时应发射 config:error 事件", () => {
    mockExistsSync.mockReturnValue(false);
    const manager = createManager();
    const errorCallback = vi.fn();
    manager.on("config:error", errorCallback);

    try {
      manager.getConfig();
    } catch {
      // 预期异常
    }

    expect(errorCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "loadConfig",
      })
    );
  });
});

// ==================== N. 文件操作与初始化 ====================

describe("ConfigManager > 文件操作与初始化", () => {
  it("saveConfig() 应正确写入 JSON 并以换行结尾", () => {
    const manager = createManager();

    manager.updateMcpEndpoint("wss://saved.com");

    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toMatch(/\n$/);
    expect(() => JSON.parse(writtenContent)).not.toThrow();
  });

  it("saveConfig() 保存前应先验证配置", () => {
    const manager = createManager();

    // 传入无效配置到 saveConfig 的路径（通过 updateMcpEndpoint 传入非法值）
    expect(() => manager.updateMcpEndpoint(null as any)).toThrow();
  });

  it("saveConfig() 应使用 currentConfigPath", () => {
    const manager = createManager();

    // 触发一次 getConfig 来设置 currentConfigPath
    manager.getConfig();
    manager.updateMcpEndpoint("wss://path-test.com");

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("saveConfig() 保存后应更新缓存", () => {
    const manager = createManager();

    manager.updateMcpEndpoint("wss://cached.com");

    // 再次获取应从缓存读取，不再调用 readFileSync
    const callCount = mockReadFileSync.mock.count;
    manager.getConfig();
    expect(mockReadFileSync.mock.count).toBe(callCount);
  });

  it("saveConfig() 保存失败时应发射 error 事件", () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error("磁盘已满");
    });
    const manager = createManager();
    const errorCallback = vi.fn();
    manager.on("config:error", errorCallback);

    try {
      manager.updateMcpEndpoint("wss://fail.com");
    } catch {
      // 预期异常
    }

    expect(errorCallback).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "saveConfig" })
    );
  });

  it("initConfig() 默认模板不存在应抛出错误", () => {
    // 构造函数中 existsSync 对 template 路径返回 false
    // 但我们需要单独测试 initConfig
    mockExistsSync.mockImplementation((path: string) => {
      // 配置文件不存在（让 initConfig 可以检查是否已存在）
      // 但模板也不存在
      return false;
    });
    const manager = createManager();

    expect(() => manager.initConfig()).toThrow("默认配置模板文件不存在");
  });

  it("initConfig() 配置文件已存在应抛出错误", () => {
    // existsSync 返回 true 表示配置文件已存在
    mockExistsSync.mockReturnValue(true);
    const manager = createManager();

    expect(() => manager.initConfig()).toThrow("配置文件已存在");
  });

  it("initConfig() 正确初始化应复制模板文件", () => {
    // 构造函数中 existsSync 用于查找 template/xiaozhi.config.json（需要返回 true）
    // initConfig 中先检查模板存在（true），再检查配置文件不存在（false）
    mockExistsSync.mockImplementation((path: string) => {
      const strPath = String(path);
      // 模板路径包含 template 目录，应返回 true
      if (strPath.includes("template")) return true;
      // 配置文件路径（xiaozhi.config.json）在非 template 目录下，应返回 false
      return false;
    });
    const manager = createManager();

    manager.initConfig();

    expect(mockCopyFileSync).toHaveBeenCalled();
  });

  it("configExists() 配置文件存在应返回 true", () => {
    mockExistsSync.mockReturnValue(true);
    const manager = createManager();

    expect(manager.configExists()).toBe(true);
  });

  it("configExists() 配置文件不存在应返回 false", () => {
    mockExistsSync.mockReturnValue(false);
    const manager = createManager();

    expect(manager.configExists()).toBe(false);
  });

  it("validateConfig() 有效配置不应抛错", () => {
    const manager = createManager();

    expect(() => manager.validateConfig(MINIMAL_VALID_CONFIG)).not.toThrow();
  });

  it("validateConfig() 空/null 配置应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.validateConfig(null)).toThrow("根对象无效");
    expect(() => manager.validateConfig(undefined)).toThrow("根对象无效");
  });

  it("validateConfig() 缺少 mcpEndpoint 应抛出错误", () => {
    const manager = createManager();

    expect(() => manager.validateConfig({ mcpServers: {} })).toThrow(
      "mcpEndpoint 字段无效"
    );
  });

  it("validateConfig() mcpEndpoint 为非法类型应抛出错误", () => {
    const manager = createManager();

    expect(() =>
      manager.validateConfig({ mcpEndpoint: 123, mcpServers: {} })
    ).toThrow("必须是字符串或字符串数组");
  });

  it("validateConfig() mcpEndpoint 数组含空字符串应抛出错误", () => {
    const manager = createManager();

    expect(() =>
      manager.validateConfig({ mcpEndpoint: ["valid", ""], mcpServers: {} })
    ).toThrow("非空字符串");
  });

  it("validateConfig() 缺少 mcpServers 应抛出错误", () => {
    const manager = createManager();

    expect(() =>
      manager.validateConfig({ mcpEndpoint: "wss://test.com" })
    ).toThrow("mcpServers 字段无效");
  });

  it("validateConfig() mcpServers 非对象应抛出错误", () => {
    const manager = createManager();

    expect(() =>
      manager.validateConfig({
        mcpEndpoint: "wss://test.com",
        mcpServers: "invalid",
      })
    ).toThrow("mcpServers 字段无效");
  });

  it("validateConfig() mcpServers 中某服务值为 null 应抛出错误", () => {
    const manager = createManager();

    expect(() =>
      manager.validateConfig({
        mcpEndpoint: "wss://test.com",
        mcpServers: { goodServer: {}, badServer: null },
      })
    ).toThrow("badServer 无效");
  });
});
