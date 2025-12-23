import type { PathLike } from "node:fs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as commentJson from "comment-json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppConfig,
  ConnectionConfig,
  MCPServerConfig,
  ModelScopeConfig,
  WebUIConfig,
} from "./manager";
import { ConfigManager } from "./manager";

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

describe("ConfigManager JSONC Comment Preservation", () => {
  let configManager: ConfigManager;
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockResolve = vi.mocked(resolve);

  // JSONC 测试配置内容，包含丰富的注释
  const jsoncConfigContent = `{
  // 小智 AI 客户端配置文件 (JSONC 格式)
  // JSONC 格式支持注释和尾随逗号，更易于理解和维护

  // MCP 接入点地址
  // 请访问 xiaozhi.me 获取你的专属接入点地址
  "mcpEndpoint": "https://example.com/mcp",

  // MCP 服务配置
  "mcpServers": {
    // 计算器服务
    "calculator": {
      "command": "node",
      "args": ["./mcpServers/calculator.js"]
    },

    // 日期时间服务
    "datetime": {
      "command": "node",
      "args": ["./mcpServers/datetime.js"]
    }
  },

  // 连接配置
  "connection": {
    // 心跳检测间隔（毫秒）
    "heartbeatInterval": 30000,

    // 心跳超时时间（毫秒）
    "heartbeatTimeout": 10000,

    // 重连间隔（毫秒）
    "reconnectInterval": 5000
  },

  // ModelScope 配置
  "modelscope": {
    // API 密钥
    "apiKey": "test-api-key"
  },

  // Web UI 配置
  "webUI": {
    // Web UI 端口号
    "port": 9999
  }
}`;

  // 解析后的配置对象
  const parsedConfig = commentJson.parse(
    jsoncConfigContent
  ) as unknown as AppConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // 重置 ConfigManager 单例
    (ConfigManager as any).instance = undefined;
    configManager = ConfigManager.getInstance();

    // 设置默认 mock 行为
    mockResolve.mockImplementation((dir: string, file: string) => {
      if (file === "xiaozhi.config.jsonc") {
        return "/test/cwd/xiaozhi.config.jsonc";
      }
      return `/test/${file}`;
    });

    // Mock 配置文件存在且为 JSONC 格式
    mockExistsSync.mockImplementation((path: PathLike) => {
      return path.toString().includes("xiaozhi.config.jsonc");
    });

    // Mock 读取 JSONC 配置文件
    mockReadFileSync.mockReturnValue(jsoncConfigContent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("JSONC 解析和基础功能", () => {
    it("应该正确解析包含注释的 JSONC 配置文件", () => {
      const config = configManager.getConfig();

      expect(config.mcpEndpoint).toBe("https://example.com/mcp");
      expect(config.mcpServers.calculator).toEqual({
        command: "node",
        args: ["./mcpServers/calculator.js"],
      });
      expect(config.connection?.heartbeatInterval).toBe(30000);
      expect(config.webUI?.port).toBe(9999);
    });

    it("应该识别配置文件格式为 JSONC", () => {
      // 触发配置加载
      configManager.getConfig();

      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.jsonc",
        "utf8"
      );
    });
  });

  // 辅助函数：计算字符串中的注释行数
  const countComments = (content: string): number => {
    return content.split("\n").filter((line) => line.trim().startsWith("//"))
      .length;
  };

  // 辅助函数：检查特定注释是否存在
  const hasComment = (content: string, comment: string): boolean => {
    return content.includes(comment);
  };

  describe("注释保留功能测试", () => {
    it("应该在更新 MCP 服务时保留所有注释", () => {
      const newServerConfig: MCPServerConfig = {
        command: "python",
        args: ["./test-server.py"],
        env: { PYTHON_ENV: "test" },
      };

      configManager.updateMcpServer("test-server", newServerConfig);

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证注释数量保持不变（原始配置有15行注释）
      expect(countComments(savedContent)).toBe(15);

      // 验证关键注释仍然存在
      expect(hasComment(savedContent, "小智 AI 客户端配置文件")).toBe(true);
      expect(hasComment(savedContent, "MCP 服务配置")).toBe(true);
      expect(hasComment(savedContent, "计算器服务")).toBe(true);
      expect(hasComment(savedContent, "连接配置")).toBe(true);
      expect(hasComment(savedContent, "Web UI 配置")).toBe(true);

      // 验证新服务已添加
      const parsedSaved = commentJson.parse(
        savedContent
      ) as unknown as AppConfig;
      expect(parsedSaved.mcpServers["test-server"]).toEqual(newServerConfig);
    });

    it("应该在更新连接配置时保留嵌套对象的注释", () => {
      const newConnectionConfig: Partial<ConnectionConfig> = {
        heartbeatInterval: 45000,
        heartbeatTimeout: 15000,
      };

      configManager.updateConnectionConfig(newConnectionConfig);

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证注释数量保持不变
      expect(countComments(savedContent)).toBe(15);

      // 验证连接配置相关的注释仍然存在
      expect(hasComment(savedContent, "连接配置")).toBe(true);
      expect(hasComment(savedContent, "心跳检测间隔（毫秒）")).toBe(true);
      expect(hasComment(savedContent, "心跳超时时间（毫秒）")).toBe(true);
      expect(hasComment(savedContent, "重连间隔（毫秒）")).toBe(true);

      // 验证配置值已更新
      const parsedSaved = commentJson.parse(
        savedContent
      ) as unknown as AppConfig;
      expect(parsedSaved.connection?.heartbeatInterval).toBe(45000);
      expect(parsedSaved.connection?.heartbeatTimeout).toBe(15000);
      expect(parsedSaved.connection?.reconnectInterval).toBe(5000); // 保持原值
    });

    it("应该在更新 Web UI 配置时保留注释", () => {
      const newWebUIConfig: Partial<WebUIConfig> = {
        port: 8888,
      };

      configManager.updateWebUIConfig(newWebUIConfig);

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证注释数量保持不变
      expect(countComments(savedContent)).toBe(15);

      // 验证 Web UI 相关注释仍然存在
      expect(hasComment(savedContent, "Web UI 配置")).toBe(true);
      expect(hasComment(savedContent, "Web UI 端口号")).toBe(true);

      // 验证配置值已更新
      const parsedSaved = commentJson.parse(
        savedContent
      ) as unknown as AppConfig;
      expect(parsedSaved.webUI?.port).toBe(8888);
    });

    it("应该在更新 ModelScope 配置时保留注释", () => {
      const newModelScopeConfig: Partial<ModelScopeConfig> = {
        apiKey: "new-api-key",
      };

      configManager.updateModelScopeConfig(newModelScopeConfig);

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证注释数量保持不变
      expect(countComments(savedContent)).toBe(15);

      // 验证 ModelScope 相关注释仍然存在
      expect(hasComment(savedContent, "ModelScope 配置")).toBe(true);
      expect(hasComment(savedContent, "API 密钥")).toBe(true);

      // 验证配置值已更新
      const parsedSaved = commentJson.parse(
        savedContent
      ) as unknown as AppConfig;
      expect(parsedSaved.modelscope?.apiKey).toBe("new-api-key");
    });
  });

  describe("工具配置和复杂场景测试", () => {
    it("应该在设置工具启用状态时保留注释", () => {
      configManager.setToolEnabled(
        "calculator",
        "test-tool",
        true,
        "测试工具描述"
      );

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证注释数量保持不变
      expect(countComments(savedContent)).toBe(15);

      // 验证所有主要注释仍然存在
      expect(hasComment(savedContent, "小智 AI 客户端配置文件")).toBe(true);
      expect(hasComment(savedContent, "MCP 服务配置")).toBe(true);
      expect(hasComment(savedContent, "连接配置")).toBe(true);

      // 验证工具配置已添加
      const parsedSaved = commentJson.parse(
        savedContent
      ) as unknown as AppConfig;
      expect(
        parsedSaved.mcpServerConfig?.calculator?.tools?.["test-tool"]
      ).toEqual({
        enable: true,
        description: "测试工具描述",
      });
    });

    it("应该在多次配置更新后仍保留注释", () => {
      // 第一次更新：添加 MCP 服务
      configManager.updateMcpServer("new-service", {
        command: "node",
        args: ["./new-service.js"],
      });

      // 第二次更新：修改连接配置
      configManager.updateConnectionConfig({
        heartbeatInterval: 60000,
      });

      // 第三次更新：修改 Web UI 配置
      configManager.updateWebUIConfig({
        port: 3000,
      });

      // 验证最后一次保存仍保留所有注释
      expect(mockWriteFileSync).toHaveBeenCalledTimes(3);
      const finalSavedContent = mockWriteFileSync.mock.calls[2][1] as string;

      // 验证注释数量保持不变
      expect(countComments(finalSavedContent)).toBe(15);

      // 验证所有关键注释仍然存在
      expect(hasComment(finalSavedContent, "小智 AI 客户端配置文件")).toBe(
        true
      );
      expect(hasComment(finalSavedContent, "MCP 服务配置")).toBe(true);
      expect(hasComment(finalSavedContent, "连接配置")).toBe(true);
      expect(hasComment(finalSavedContent, "心跳检测间隔（毫秒）")).toBe(true);
      expect(hasComment(finalSavedContent, "Web UI 配置")).toBe(true);
      expect(hasComment(finalSavedContent, "Web UI 端口号")).toBe(true);

      // 验证所有配置更新都生效
      const parsedFinal = commentJson.parse(
        finalSavedContent
      ) as unknown as AppConfig;
      expect(parsedFinal.mcpServers["new-service"]).toBeDefined();
      expect(parsedFinal.connection?.heartbeatInterval).toBe(60000);
      expect(parsedFinal.webUI?.port).toBe(3000);
    });

    it("应该在更新服务器工具配置时保留注释", () => {
      const toolsConfig = {
        tool1: { enable: true, description: "工具1" },
        tool2: { enable: false, description: "工具2" },
      };

      configManager.updateServerToolsConfig("calculator", toolsConfig);

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证注释数量保持不变
      expect(countComments(savedContent)).toBe(15);

      // 验证配置已更新
      const parsedSaved = commentJson.parse(
        savedContent
      ) as unknown as AppConfig;
      expect(parsedSaved.mcpServerConfig?.calculator?.tools).toEqual(
        toolsConfig
      );
    });
  });

  describe("错误处理和回退机制", () => {
    it("应该正确处理无效的 JSONC 内容", () => {
      // 创建一个包含语法错误的 JSONC 内容
      const invalidJsoncContent = `{
        // 这是一个有语法错误的 JSONC 文件
        "mcpEndpoint": "https://example.com/mcp",
        "mcpServers": {
          "test": {
            "command": "node"
            // 缺少逗号，这会导致解析错误
            "args": ["test.js"]
          }
        }
      }`;

      mockReadFileSync.mockReturnValue(invalidJsoncContent);

      // 重新获取配置管理器实例
      (ConfigManager as any).instance = undefined;

      // 尝试加载配置应该抛出错误
      expect(() => {
        ConfigManager.getInstance().getConfig();
      }).toThrow();
    });

    it("应该正确处理不存在的嵌套配置对象", () => {
      // 创建一个没有 connection 配置的 JSONC 内容
      const configWithoutConnection = `{
        // 基础配置
        "mcpEndpoint": "https://example.com/mcp",
        "mcpServers": {
          "test": {
            "command": "node",
            "args": ["test.js"]
          }
        }
      }`;

      mockReadFileSync.mockReturnValue(configWithoutConnection);

      // 重新获取配置管理器实例以重新加载配置
      (ConfigManager as any).instance = undefined;
      configManager = ConfigManager.getInstance();

      // 更新连接配置（应该创建新的 connection 对象）
      configManager.updateConnectionConfig({
        heartbeatInterval: 45000,
      });

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证配置已正确添加
      const parsedSaved = commentJson.parse(
        savedContent
      ) as unknown as AppConfig;
      expect(parsedSaved.connection?.heartbeatInterval).toBe(45000);

      // 验证原有注释仍然存在
      expect(hasComment(savedContent, "基础配置")).toBe(true);
    });
  });

  describe("配置文件格式验证", () => {
    it("保存的内容应该是有效的 JSONC 格式", () => {
      configManager.updateMcpServer("test-server", {
        command: "node",
        args: ["./test.js"],
      });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证可以被 comment-json 正确解析
      expect(() => commentJson.parse(savedContent)).not.toThrow();

      // 验证包含注释
      expect(savedContent.includes("//")).toBe(true);

      // 验证 JSON 结构正确
      const parsed = commentJson.parse(savedContent) as unknown as AppConfig;
      expect(parsed.mcpEndpoint).toBeDefined();
      expect(parsed.mcpServers).toBeDefined();
    });

    it("应该保持正确的缩进格式", () => {
      configManager.updateWebUIConfig({ port: 8080 });

      const savedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // 验证使用 2 空格缩进
      const lines = savedContent.split("\n");
      const indentedLines = lines.filter(
        (line) => line.startsWith("  ") && !line.startsWith("    ")
      );
      expect(indentedLines.length).toBeGreaterThan(0);

      // 验证嵌套对象使用 4 空格缩进
      const deepIndentedLines = lines.filter((line) => line.startsWith("    "));
      expect(deepIndentedLines.length).toBeGreaterThan(0);
    });
  });
});
