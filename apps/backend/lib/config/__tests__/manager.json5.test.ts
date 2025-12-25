import type { PathLike } from "node:fs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as commentJson from "comment-json";
import JSON5 from "json5";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig, ConnectionConfig } from "../manager";
import { ConfigManager } from "../manager";

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock path module
vi.mock("node:path", () => ({
  resolve: vi.fn(),
  dirname: vi.fn(),
}));

// Mock url module
vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

describe("ConfigManager JSON5 Comment Preservation", () => {
  let configManager: ConfigManager;
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockResolve = vi.mocked(resolve);

  // JSON5 测试配置内容，包含丰富的注释
  const json5ConfigContent = `{
  // 小智 AI 客户端配置文件 (JSON5 格式)
  // JSON5 格式支持注释、尾随逗号等特性，更易于手写和维护

  // MCP 接入点地址
  // 请访问 xiaozhi.me 获取你的专属接入点地址
  "mcpEndpoint": "https://example.com/mcp",

  // MCP 服务配置
  "mcpServers": {
    // 计算器服务
    "calculator": {
      "command": "node",
      "args": ["./mcpServers/calculator.js"],
    },

    // 日期时间服务
    "datetime": {
      "command": "node",
      "args": ["./mcpServers/datetime.js"],
    },
  },

  // 连接配置
  "connection": {
    // 心跳检测间隔（毫秒）
    "heartbeatInterval": 30000,

    // 心跳超时时间（毫秒）
    "heartbeatTimeout": 10000,

    // 重连间隔（毫秒）
    "reconnectInterval": 5000,
  },

  // ModelScope 配置
  "modelscope": {
    // API 密钥
    "apiKey": "test-api-key",
  },

  // Web UI 配置
  "webUI": {
    // Web UI 端口号
    "port": 9999,
  },
}`;

  // 解析后的配置对象
  const parsedConfig = JSON5.parse(json5ConfigContent) as AppConfig;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // 模拟存在 JSON5 配置文件
    mockExistsSync.mockImplementation((path: PathLike) => {
      if (path.toString().includes("xiaozhi.config.json5")) return true;
      if (path.toString().includes("xiaozhi.config.jsonc")) return false;
      if (path.toString().includes("xiaozhi.config.json")) return false;
      if (path.toString().includes("default")) return true;
      return false;
    });

    // 模拟文件路径解析
    mockResolve.mockImplementation((dir: string, file: string) => {
      if (file === "xiaozhi.config.json5") {
        return "/test/cwd/xiaozhi.config.json5";
      }
      if (file.includes("default")) {
        return "/test/default/xiaozhi.config.default.json";
      }
      return `/test/cwd/${file}`;
    });

    // 模拟读取 JSON5 配置文件
    mockReadFileSync.mockReturnValue(json5ConfigContent);

    // 获取新的 ConfigManager 实例
    configManager = ConfigManager.getInstance();
    // 重新加载配置以清除缓存
    configManager.reloadConfig();
  });

  afterEach(() => {
    configManager.reloadConfig();
  });

  describe("JSON5 解析和基础功能", () => {
    it("应该正确解析包含注释的 JSON5 配置文件", () => {
      const config = configManager.getConfig();

      expect(config.mcpEndpoint).toBe("https://example.com/mcp");
      expect(config.mcpServers.calculator).toEqual({
        command: "node",
        args: ["./mcpServers/calculator.js"],
      });
      expect(config.connection?.heartbeatInterval).toBe(30000);
      expect(config.webUI?.port).toBe(9999);
    });

    it("应该识别配置文件格式为 JSON5", () => {
      // 触发配置加载
      configManager.getConfig();

      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json5",
        "utf8"
      );
    });
  });

  // 辅助函数：计算字符串中的注释行数
  const countComments = (content: string): number => {
    return content.split("\n").filter((line) => line.trim().startsWith("//"))
      .length;
  };

  describe("JSON5 注释保留功能", () => {
    it("更新 MCP 服务配置时应该正确保存", () => {
      // 先加载配置以初始化 json5Writer
      configManager.getConfig();

      // 更新 MCP 服务配置
      configManager.updateMcpServer("test-server", {
        command: "node",
        args: ["./test.js"],
      });

      // 验证 writeFileSync 被调用
      expect(mockWriteFileSync).toHaveBeenCalled();

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证保存的内容可以被 comment-json 正确解析
      expect(() => commentJson.parse(savedContent)).not.toThrow();

      // 验证新的服务配置被正确添加
      expect(savedContent.includes("test-server")).toBe(true);
    });

    it("更新连接配置时应该保留注释", () => {
      configManager.getConfig();

      const newConnectionConfig: ConnectionConfig = {
        heartbeatInterval: 25000,
        heartbeatTimeout: 8000,
        reconnectInterval: 3000,
      };

      configManager.updateConnectionConfig(newConnectionConfig);

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证保存的内容包含注释
      expect(savedContent.includes("//")).toBe(true);

      // 验证原始文件中的关键注释被保留
      expect(savedContent.includes("// 心跳检测间隔")).toBe(true);
      expect(savedContent.includes("// 心跳超时时间")).toBe(true);
      expect(savedContent.includes("// 重连间隔")).toBe(true);

      // 验证配置值被正确更新
      expect(savedContent.includes("25000")).toBe(true);
      expect(savedContent.includes("8000")).toBe(true);
      expect(savedContent.includes("3000")).toBe(true);
    });

    it("更新 ModelScope 配置时应该保留注释", () => {
      configManager.getConfig();

      configManager.updateModelScopeConfig({
        apiKey: "new-api-key",
      });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证保存的内容包含注释
      expect(savedContent.includes("//")).toBe(true);

      // 验证原始文件中的 ModelScope 注释被保留
      expect(savedContent.includes("// ModelScope 配置")).toBe(true);
      expect(savedContent.includes("// API 密钥")).toBe(true);

      // 验证新的 API Key 被正确设置
      expect(savedContent.includes("new-api-key")).toBe(true);
    });

    it("更新 Web UI 配置时应该保留注释", () => {
      configManager.getConfig();

      configManager.updateWebUIConfig({
        port: 8888,
      });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证保存的内容包含注释
      expect(savedContent.includes("//")).toBe(true);

      // 验证原始文件中的 Web UI 注释被保留
      expect(savedContent.includes("// Web UI 配置")).toBe(true);
      expect(savedContent.includes("// Web UI 端口号")).toBe(true);

      // 验证新的端口号被正确设置
      expect(savedContent.includes("8888")).toBe(true);
    });

    it("更新后应该保留原始文件中的大部分注释", () => {
      // 统计原始配置中的注释数量
      const originalCommentCount = countComments(json5ConfigContent);

      configManager.getConfig();

      // 更新一个配置项
      configManager.updateConnectionConfig({
        heartbeatInterval: 25000,
      });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;
      const savedCommentCount = countComments(savedContent);

      // comment-json 应该保留大部分注释（可能因为格式化略有差异）
      // 至少应该保留 50% 的原始注释
      expect(savedCommentCount).toBeGreaterThanOrEqual(
        Math.floor(originalCommentCount * 0.5)
      );
    });
  });

  describe("配置文件格式验证", () => {
    it("保存的内容应该是有效的 JSON5 格式", () => {
      configManager.updateMcpServer("test-server", {
        command: "node",
        args: ["./test.js"],
      });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证可以被 JSON5 正确解析
      expect(() => JSON5.parse(savedContent)).not.toThrow();

      // 验证包含注释
      expect(savedContent.includes("//")).toBe(true);

      // 验证 JSON5 结构正确
      const parsed = JSON5.parse(savedContent) as AppConfig;
      expect(parsed.mcpEndpoint).toBeDefined();
      expect(parsed.mcpServers).toBeDefined();
    });

    it("保存的内容应该可以被 JSON5 重新加载", () => {
      configManager.updateMcpServer("test-server", {
        command: "node",
        args: ["./test.js"],
      });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证可以被 JSON5 重新加载
      expect(() => JSON5.parse(savedContent)).not.toThrow();

      const parsed = JSON5.parse(savedContent) as AppConfig;
      expect(parsed).toBeDefined();
      expect(parsed.mcpServers).toBeDefined();
    });
  });

  describe("错误处理", () => {
    it("当没有 JSON5 适配器实例时应该回退到 comment-json 序列化", () => {
      // 先加载配置
      configManager.getConfig();

      // 手动清除 json5Writer 实例来模拟错误情况
      (configManager as unknown as { json5Writer: null }).json5Writer = null;

      configManager.updateMcpServer("test-server", {
        command: "node",
        args: ["./test.js"],
      });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证仍然可以被 comment-json 解析
      expect(() => commentJson.parse(savedContent)).not.toThrow();

      // 验证配置被正确保存
      const parsed = commentJson.parse(savedContent) as unknown as AppConfig;
      expect(parsed.mcpServers["test-server"]).toEqual({
        command: "node",
        args: ["./test.js"],
      });
    });
  });
});
