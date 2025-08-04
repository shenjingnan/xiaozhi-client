import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppConfig,
  ConfigManager,
  type ConnectionConfig,
  type MCPServerConfig,
  type MCPServerToolsConfig,
  type MCPToolConfig,
  type WebUIConfig,
} from "./configManager";

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  copyFileSync: vi.fn(),
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

describe("ConfigManager", () => {
  let configManager: ConfigManager;
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockCopyFileSync = vi.mocked(copyFileSync);
  const mockResolve = vi.mocked(resolve);

  const mockConfig: AppConfig = {
    mcpEndpoint: "https://example.com/mcp",
    mcpServers: {
      "test-server": {
        command: "node",
        args: ["test.js"],
        env: { TEST_VAR: "test_value" },
      },
      "modelscope-server": {
        type: "sse" as const,
        url: "https://mcp.api-inference.modelscope.net/test/sse",
      },
      "streamable-http-server": {
        type: "streamable-http" as const,
        url: "https://example.com/mcp/http",
      },
      "streamable-http-server-no-type": {
        url: "https://example.com/mcp/http2",
      },
    },
    mcpServerConfig: {
      "test-server": {
        tools: {
          "test-tool": {
            description: "Test tool description",
            enable: true,
          },
          "disabled-tool": {
            description: "Disabled tool",
            enable: false,
          },
        },
      },
    },
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectInterval: 5000,
    },
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset singleton instance
    // @ts-ignore - accessing private static property for testing
    ConfigManager.instance = undefined;

    // Setup default mock returns
    mockResolve.mockImplementation(
      (dir: string, file: string) => `${dir}/${file}`
    );

    // Mock process.cwd and process.env
    vi.stubGlobal("process", {
      ...process,
      cwd: vi.fn().mockReturnValue("/test/cwd"),
      env: { ...process.env },
    });

    configManager = ConfigManager.getInstance();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("获取实例", () => {
    it("应该返回单例实例", () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("配置文件存在性检查", () => {
    it("当配置文件存在时应该返回true", () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes("xiaozhi.config.json");
      });
      expect(configManager.configExists()).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json5"
      );
    });

    it("当配置文件不存在时应该返回false", () => {
      mockExistsSync.mockReturnValue(false);
      expect(configManager.configExists()).toBe(false);
    });

    it("当设置了XIAOZHI_CONFIG_DIR时应该使用自定义目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/custom/config/dir";
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes("/custom/config/dir/xiaozhi.config.json");
      });

      configManager.configExists();
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/custom/config/dir/xiaozhi.config.json5"
      );
    });
  });

  describe("初始化配置", () => {
    it("应该成功初始化配置", () => {
      mockExistsSync.mockImplementation((path: any) => {
        if (path.includes("default")) return true;
        return false; // config file doesn't exist
      });

      configManager.initConfig();

      expect(mockCopyFileSync).toHaveBeenCalledWith(
        expect.stringContaining("xiaozhi.config.default.json"),
        "/test/cwd/xiaozhi.config.json"
      );
    });

    it("应该成功初始化 JSON5 格式配置", () => {
      mockExistsSync.mockImplementation((path: any) => {
        if (path.includes("default")) return true;
        return false; // config file doesn't exist
      });

      configManager.initConfig("json5");

      expect(mockCopyFileSync).toHaveBeenCalledWith(
        expect.stringContaining("xiaozhi.config.default.json"),
        "/test/cwd/xiaozhi.config.json5"
      );
    });

    it("应该成功初始化 JSONC 格式配置", () => {
      mockExistsSync.mockImplementation((path: any) => {
        if (path.includes("default")) return true;
        return false; // config file doesn't exist
      });

      configManager.initConfig("jsonc");

      expect(mockCopyFileSync).toHaveBeenCalledWith(
        expect.stringContaining("xiaozhi.config.default.json"),
        "/test/cwd/xiaozhi.config.jsonc"
      );
    });

    it("当默认配置文件不存在时应该抛出错误", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => configManager.initConfig()).toThrow(
        "默认配置文件 xiaozhi.config.default.json 不存在"
      );
    });

    it("当配置文件已存在时应该抛出错误", () => {
      mockExistsSync.mockImplementation((path: string) => {
        // 模拟默认配置文件存在，但任何配置文件也存在
        if (path.includes("default")) return true;
        return path.includes("xiaozhi.config.json");
      });

      expect(() => configManager.initConfig()).toThrow(
        "配置文件已存在，无需重复初始化"
      );
    });
  });

  describe("获取配置", () => {
    beforeEach(() => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes("xiaozhi.config.json");
      });
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
      mockResolve.mockImplementation((dir: string, file: string) => {
        // 根据文件名返回对应的路径
        if (file.includes("json5")) return `${dir}/${file}`;
        if (file.includes("jsonc")) return `${dir}/${file}`;
        return `${dir}/xiaozhi.config.json`;
      });
    });

    it("应该加载并返回配置", () => {
      // 确保只存在 JSON 配置文件
      mockExistsSync.mockImplementation((path: string) => {
        return (
          path.includes("xiaozhi.config.json") &&
          !path.includes("json5") &&
          !path.includes("jsonc")
        );
      });

      const config = configManager.getConfig();
      expect(config).toEqual(mockConfig);
      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json",
        "utf8"
      );
    });

    it("应该返回配置的深拷贝", () => {
      const config = configManager.getConfig();
      config.mcpEndpoint = "modified";

      const config2 = configManager.getConfig();
      expect(config2.mcpEndpoint).toBe(mockConfig.mcpEndpoint);
    });

    it("应该在首次加载后缓存配置", () => {
      configManager.getConfig();
      configManager.getConfig();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it("当配置文件不存在时应该抛出错误", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => configManager.getConfig()).toThrow(
        "配置文件不存在，请先运行 xiaozhi init 初始化配置"
      );
    });

    it("当JSON格式无效时应该抛出错误", () => {
      mockReadFileSync.mockReturnValue("invalid json");

      expect(() => configManager.getConfig()).toThrow("配置文件格式错误");
    });

    it("应该正确加载 JSON5 格式配置文件", () => {
      // 模拟存在 JSON5 配置文件
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes("xiaozhi.config.json5");
      });

      mockResolve.mockImplementation(() => "/test/cwd/xiaozhi.config.json5");

      // 模拟 JSON5 格式的配置内容
      const json5Config = `{
        mcpEndpoint: "https://example.com/mcp",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["test.js"]
          }
        }
      }`;

      mockReadFileSync.mockReturnValue(json5Config);

      // 不应该抛出错误
      expect(() => configManager.getConfig()).not.toThrow();
    });

    it("应该正确加载 JSONC 格式配置文件", () => {
      // 模拟存在 JSONC 配置文件
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes("xiaozhi.config.jsonc");
      });

      mockResolve.mockImplementation(() => "/test/cwd/xiaozhi.config.jsonc");

      // 模拟 JSONC 格式的配置内容
      const jsoncConfig = `{
        // MCP 接入点
        "mcpEndpoint": "https://example.com/mcp",
        "mcpServers": {
          "test-server": {
            "command": "node",
            "args": ["test.js"]
          }
        }
      }`;

      mockReadFileSync.mockReturnValue(jsoncConfig);

      // 不应该抛出错误
      expect(() => configManager.getConfig()).not.toThrow();
    });
  });

  describe("获取MCP端点", () => {
    it("应该返回MCP端点", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const endpoint = configManager.getMcpEndpoint();
      expect(endpoint).toBe(mockConfig.mcpEndpoint);
    });
  });

  describe("获取MCP服务器配置", () => {
    it("应该返回MCP服务器配置", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const servers = configManager.getMcpServers();
      expect(servers).toEqual(mockConfig.mcpServers);
    });

    it("应该支持本地MCP服务器配置", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const servers = configManager.getMcpServers();
      const localServer = servers["test-server"];

      expect(localServer).toBeDefined();
      expect("command" in localServer).toBe(true);
      expect("args" in localServer).toBe(true);
      if ("command" in localServer) {
        expect(localServer.command).toBe("node");
        expect(localServer.args).toEqual(["test.js"]);
      }
    });

    it("应该支持ModelScope SSE MCP服务器配置", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const servers = configManager.getMcpServers();
      const sseServer = servers["modelscope-server"];

      expect(sseServer).toBeDefined();
      expect("type" in sseServer).toBe(true);
      expect("url" in sseServer).toBe(true);
      if ("type" in sseServer) {
        expect(sseServer.type).toBe("sse");
        expect(sseServer.url).toBe(
          "https://mcp.api-inference.modelscope.net/test/sse"
        );
      }
    });

    it("应该支持Streamable HTTP MCP服务器配置（带type字段）", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const servers = configManager.getMcpServers();
      const httpServer = servers["streamable-http-server"];

      expect(httpServer).toBeDefined();
      expect("type" in httpServer).toBe(true);
      expect("url" in httpServer).toBe(true);
      if ("type" in httpServer && httpServer.type === "streamable-http") {
        expect(httpServer.type).toBe("streamable-http");
        expect(httpServer.url).toBe("https://example.com/mcp/http");
      }
    });

    it("应该支持Streamable HTTP MCP服务器配置（不带type字段）", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const servers = configManager.getMcpServers();
      const httpServer = servers["streamable-http-server-no-type"];

      expect(httpServer).toBeDefined();
      expect("url" in httpServer).toBe(true);
      if ("url" in httpServer) {
        expect(httpServer.url).toBe("https://example.com/mcp/http2");
        // 不带 type 字段的情况
        expect("type" in httpServer).toBe(false);
      }
    });
  });

  describe("获取MCP服务器工具配置", () => {
    it("应该返回MCP服务器工具配置", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const serverConfig = configManager.getMcpServerConfig();
      expect(serverConfig).toEqual(mockConfig.mcpServerConfig);
    });

    it("当mcpServerConfig未定义时应该返回空对象", () => {
      const configWithoutServerConfig = {
        ...mockConfig,
        mcpServerConfig: undefined,
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify(configWithoutServerConfig)
      );

      const serverConfig = configManager.getMcpServerConfig();
      expect(serverConfig).toEqual({});
    });
  });

  describe("获取服务器工具配置", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该返回现有服务器的工具配置", () => {
      const toolsConfig = configManager.getServerToolsConfig("test-server");
      expect(toolsConfig).toEqual(
        mockConfig.mcpServerConfig!["test-server"].tools
      );
    });

    it("应该为不存在的服务器返回空对象", () => {
      const toolsConfig = configManager.getServerToolsConfig("non-existent");
      expect(toolsConfig).toEqual({});
    });
  });

  describe("工具启用状态检查", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该为已启用的工具返回true", () => {
      const isEnabled = configManager.isToolEnabled("test-server", "test-tool");
      expect(isEnabled).toBe(true);
    });

    it("应该为已禁用的工具返回false", () => {
      const isEnabled = configManager.isToolEnabled(
        "test-server",
        "disabled-tool"
      );
      expect(isEnabled).toBe(false);
    });

    it("应该为不存在的工具返回true（默认启用）", () => {
      const isEnabled = configManager.isToolEnabled(
        "test-server",
        "non-existent-tool"
      );
      expect(isEnabled).toBe(true);
    });

    it("应该为不存在的服务器返回true（默认启用）", () => {
      const isEnabled = configManager.isToolEnabled(
        "non-existent-server",
        "any-tool"
      );
      expect(isEnabled).toBe(true);
    });
  });

  describe("更新MCP端点", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该更新MCP端点", () => {
      const newEndpoint = "wss://new.example.com/mcp";
      configManager.updateMcpEndpoint(newEndpoint);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json",
        expect.stringContaining(newEndpoint),
        "utf8"
      );
    });

    it("应该为空端点抛出错误", () => {
      expect(() => configManager.updateMcpEndpoint("")).toThrow(
        "MCP 端点必须是非空字符串"
      );
    });

    it("应该为非字符串端点抛出错误", () => {
      expect(() => configManager.updateMcpEndpoint(null as any)).toThrow(
        "MCP 端点必须是非空字符串"
      );
    });
  });

  describe("更新MCP服务器配置", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该更新MCP服务器配置", () => {
      const serverConfig: MCPServerConfig = {
        command: "python",
        args: ["server.py"],
        env: { PYTHON_ENV: "production" },
      };

      configManager.updateMcpServer("new-server", serverConfig);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json",
        expect.stringContaining("new-server"),
        "utf8"
      );
    });

    it("应该为空服务器名称抛出错误", () => {
      const serverConfig: MCPServerConfig = {
        command: "node",
        args: ["test.js"],
      };

      expect(() => configManager.updateMcpServer("", serverConfig)).toThrow(
        "服务名称必须是非空字符串"
      );
    });

    it("应该为无效命令抛出错误", () => {
      const serverConfig = {
        command: "",
        args: ["test.js"],
      } as MCPServerConfig;

      expect(() => configManager.updateMcpServer("test", serverConfig)).toThrow(
        "缺少必需的 command 字段或字段类型不正确"
      );
    });

    it("应该为无效参数抛出错误", () => {
      const serverConfig = {
        command: "node",
        args: "not-array",
      } as any;

      expect(() => configManager.updateMcpServer("test", serverConfig)).toThrow(
        "args 字段必须是数组"
      );
    });

    it("应该为无效环境变量抛出错误", () => {
      const serverConfig = {
        command: "node",
        args: ["test.js"],
        env: "not-object",
      } as any;

      expect(() => configManager.updateMcpServer("test", serverConfig)).toThrow(
        "env 字段必须是对象"
      );
    });
  });

  describe("更新服务器工具配置", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该更新服务器工具配置", () => {
      const newToolsConfig: Record<string, MCPToolConfig> = {
        "new-tool": {
          description: "New tool",
          enable: true,
        },
        "another-tool": {
          description: "Another tool",
          enable: false,
        },
      };

      configManager.updateServerToolsConfig("test-server", newToolsConfig);

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(savedConfig.mcpServerConfig["test-server"].tools).toEqual(
        newToolsConfig
      );
    });

    it("如果mcpServerConfig不存在应该创建它", () => {
      const configWithoutServerConfig = {
        ...mockConfig,
        mcpServerConfig: undefined,
      };
      mockReadFileSync.mockReturnValue(
        JSON.stringify(configWithoutServerConfig)
      );

      const toolsConfig: Record<string, MCPToolConfig> = {
        tool1: { description: "Tool 1", enable: true },
      };

      configManager.updateServerToolsConfig("new-server", toolsConfig);

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(savedConfig.mcpServerConfig).toBeDefined();
      expect(savedConfig.mcpServerConfig["new-server"].tools).toEqual(
        toolsConfig
      );
    });
  });

  describe("配置验证", () => {
    it("应该接受有效的Streamable HTTP配置", () => {
      const validConfig = {
        mcpEndpoint: "https://example.com",
        mcpServers: {
          "http-server": {
            url: "https://example.com/mcp",
          },
          "http-server-with-type": {
            type: "streamable-http" as const,
            url: "https://example.com/mcp",
          },
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      // 不应该抛出错误
      expect(() => configManager.getConfig()).not.toThrow();
    });

    it("应该拒绝无效的type字段", () => {
      const invalidConfig = {
        mcpEndpoint: "https://example.com",
        mcpServers: {
          "invalid-server": {
            type: "invalid-type",
            url: "https://example.com/mcp",
          },
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => configManager.getConfig()).toThrow(
        'type 字段如果存在，必须是 "streamable-http"'
      );
    });

    it("应该验证无法识别的配置类型", () => {
      const invalidConfig = {
        mcpEndpoint: "https://example.com",
        mcpServers: {
          "no-url-server": {
            // 既没有 command 字段（stdio），也没有 url 字段（streamable-http），也没有 type: "sse"
            // 这会导致无法识别配置类型
          },
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      // 没有任何有效字段时，验证逻辑无法识别配置类型
      expect(() => configManager.getConfig()).toThrow(
        "无法识别的 MCP 服务配置类型"
      );
    });

    it("应该验证streamable-http类型服务必须有url字段", () => {
      const invalidConfig = {
        mcpEndpoint: "https://example.com",
        mcpServers: {
          "no-url-server": {
            type: "streamable-http" as const,
            // 缺少 url 字段
          },
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      // streamable-http 类型必须有 url 字段
      expect(() => configManager.getConfig()).toThrow("缺少必需的 url 字段");
    });
  });

  describe("设置工具启用状态", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该启用带描述的工具", () => {
      configManager.setToolEnabled(
        "test-server",
        "new-tool",
        true,
        "New tool description"
      );

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(
        savedConfig.mcpServerConfig["test-server"].tools["new-tool"]
      ).toEqual({
        enable: true,
        description: "New tool description",
      });
    });

    it("应该禁用不带描述的工具", () => {
      configManager.setToolEnabled("test-server", "test-tool", false);

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(
        savedConfig.mcpServerConfig["test-server"].tools["test-tool"]
      ).toEqual({
        enable: false,
        description: "Test tool description", // 保留原有描述
      });
    });

    it("如果服务器配置不存在应该创建它", () => {
      configManager.setToolEnabled(
        "new-server",
        "new-tool",
        true,
        "Description"
      );

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(savedConfig.mcpServerConfig["new-server"]).toBeDefined();
      expect(
        savedConfig.mcpServerConfig["new-server"].tools["new-tool"]
      ).toEqual({
        enable: true,
        description: "Description",
      });
    });

    it("如果mcpServerConfig不存在应该创建它", () => {
      const configWithoutServerConfig = {
        ...mockConfig,
        mcpServerConfig: undefined,
      };
      mockReadFileSync.mockReturnValue(
        JSON.stringify(configWithoutServerConfig)
      );

      configManager.setToolEnabled("test-server", "tool1", true);

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(savedConfig.mcpServerConfig).toBeDefined();
      expect(savedConfig.mcpServerConfig["test-server"].tools.tool1).toEqual({
        enable: true,
      });
    });
  });

  describe("移除MCP服务器", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该移除MCP服务器", () => {
      configManager.removeMcpServer("test-server");

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(savedConfig.mcpServers).not.toHaveProperty("test-server");
    });

    it("应该为空服务器名称抛出错误", () => {
      expect(() => configManager.removeMcpServer("")).toThrow(
        "服务名称必须是非空字符串"
      );
    });

    it("应该为不存在的服务器抛出错误", () => {
      expect(() => configManager.removeMcpServer("non-existent")).toThrow(
        "服务 non-existent 不存在"
      );
    });
  });

  describe("重新加载配置", () => {
    it("应该清除缓存的配置", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // 首次加载配置
      configManager.getConfig();
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // 重新加载并再次获取配置
      configManager.reloadConfig();
      configManager.getConfig();
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("获取配置文件路径", () => {
    it("应该返回配置文件路径", () => {
      // 模拟存在 JSON 配置文件
      mockExistsSync.mockImplementation((path: string) => {
        return (
          path.includes("xiaozhi.config.json") &&
          !path.includes("json5") &&
          !path.includes("jsonc")
        );
      });

      mockResolve.mockImplementation((dir: string, file: string) => {
        return `${dir}/${file}`;
      });

      const path = configManager.getConfigPath();
      expect(path).toBe("/test/cwd/xiaozhi.config.json");
    });

    it("应该优先返回 JSON5 配置文件路径", () => {
      // 模拟存在 JSON5 配置文件
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes("xiaozhi.config.json5")) return true;
        if (path.includes("xiaozhi.config.jsonc")) return true;
        if (path.includes("xiaozhi.config.json")) return true;
        return false;
      });

      mockResolve.mockImplementation((dir: string, file: string) => {
        return `${dir}/${file}`;
      });

      const path = configManager.getConfigPath();
      expect(path).toBe("/test/cwd/xiaozhi.config.json5");
    });

    it("应该在没有 JSON5 时返回 JSONC 配置文件路径", () => {
      // 模拟存在 JSONC 配置文件但没有 JSON5
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes("xiaozhi.config.json5")) return false;
        if (path.includes("xiaozhi.config.jsonc")) return true;
        if (path.includes("xiaozhi.config.json")) return true;
        return false;
      });

      mockResolve.mockImplementation((dir: string, file: string) => {
        return `${dir}/${file}`;
      });

      const path = configManager.getConfigPath();
      expect(path).toBe("/test/cwd/xiaozhi.config.jsonc");
    });
  });

  describe("获取默认配置文件路径", () => {
    it("应该返回默认配置文件路径", () => {
      const path = configManager.getDefaultConfigPath();
      expect(path).toContain("xiaozhi.config.default.json");
    });
  });

  describe("配置验证", () => {
    it("应该验证有效的配置", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      expect(() => configManager.getConfig()).not.toThrow();
    });

    it("应该为无效的根对象抛出错误", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("null");

      expect(() => configManager.getConfig()).toThrow(
        "配置文件格式错误：根对象无效"
      );
    });

    it("应该为缺少mcpEndpoint抛出错误", () => {
      const invalidConfig = { mcpServers: {} };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => configManager.getConfig()).toThrow(
        "配置文件格式错误：mcpEndpoint 字段无效"
      );
    });

    it("应该为缺少mcpServers抛出错误", () => {
      const invalidConfig = { mcpEndpoint: "wss://test.com" };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => configManager.getConfig()).toThrow(
        "配置文件格式错误：mcpServers 字段无效"
      );
    });

    it("应该为无效的服务器配置抛出错误", () => {
      const invalidConfig = {
        mcpEndpoint: "wss://test.com",
        mcpServers: {
          "invalid-server": {
            command: "",
            args: [],
          },
        },
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => configManager.getConfig()).toThrow(
        "缺少必需的 command 字段或字段类型不正确"
      );
    });
  });

  describe("连接配置管理", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    describe("getConnectionConfig", () => {
      it("应该返回完整的连接配置", () => {
        const config = configManager.getConnectionConfig();

        expect(config).toEqual({
          heartbeatInterval: 30000,
          heartbeatTimeout: 10000,
          reconnectInterval: 5000,
        });
      });

      it("应该为缺少连接配置的情况提供默认值", () => {
        const configWithoutConnection = {
          mcpEndpoint: "wss://api.example.com/mcp",
          mcpServers: mockConfig.mcpServers,
        };
        mockReadFileSync.mockReturnValue(
          JSON.stringify(configWithoutConnection)
        );

        const config = configManager.getConnectionConfig();

        expect(config).toEqual({
          heartbeatInterval: 30000,
          heartbeatTimeout: 10000,
          reconnectInterval: 5000,
        });
      });

      it("应该为部分连接配置提供默认值", () => {
        const configWithPartialConnection = {
          ...mockConfig,
          connection: {
            heartbeatInterval: 15000, // 只设置了一个值
          },
        };
        mockReadFileSync.mockReturnValue(
          JSON.stringify(configWithPartialConnection)
        );

        const config = configManager.getConnectionConfig();

        expect(config).toEqual({
          heartbeatInterval: 15000, // 用户设置的值
          heartbeatTimeout: 10000, // 默认值
          reconnectInterval: 5000, // 默认值
        });
      });
    });

    describe("获取单个连接配置项", () => {
      it("应该正确获取心跳检测间隔", () => {
        expect(configManager.getHeartbeatInterval()).toBe(30000);
      });

      it("应该正确获取心跳超时时间", () => {
        expect(configManager.getHeartbeatTimeout()).toBe(10000);
      });

      it("应该正确获取重连间隔", () => {
        expect(configManager.getReconnectInterval()).toBe(5000);
      });
    });

    describe("updateConnectionConfig", () => {
      it("应该正确更新连接配置", () => {
        const newConnectionConfig: Partial<ConnectionConfig> = {
          heartbeatInterval: 45000,
          reconnectInterval: 3000,
        };

        configManager.updateConnectionConfig(newConnectionConfig);

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          "/test/cwd/xiaozhi.config.json",
          expect.stringContaining('"heartbeatInterval": 45000'),
          "utf8"
        );
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          "/test/cwd/xiaozhi.config.json",
          expect.stringContaining('"reconnectInterval": 3000'),
          "utf8"
        );
      });

      it("应该保留现有连接配置的其他值", () => {
        configManager.updateConnectionConfig({ heartbeatInterval: 45000 });

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.connection).toEqual({
          heartbeatInterval: 45000, // 更新的值
          heartbeatTimeout: 10000, // 保留的值
          reconnectInterval: 5000, // 保留的值
        });
      });
    });

    describe("设置单个连接配置项", () => {
      it("应该正确设置心跳检测间隔", () => {
        configManager.setHeartbeatInterval(45000);

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          "/test/cwd/xiaozhi.config.json",
          expect.stringContaining('"heartbeatInterval": 45000'),
          "utf8"
        );
      });

      it("应该正确设置心跳超时时间", () => {
        configManager.setHeartbeatTimeout(15000);

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          "/test/cwd/xiaozhi.config.json",
          expect.stringContaining('"heartbeatTimeout": 15000'),
          "utf8"
        );
      });

      it("应该正确设置重连间隔", () => {
        configManager.setReconnectInterval(3000);

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          "/test/cwd/xiaozhi.config.json",
          expect.stringContaining('"reconnectInterval": 3000'),
          "utf8"
        );
      });

      it("应该为无效的心跳检测间隔抛出错误", () => {
        expect(() => configManager.setHeartbeatInterval(0)).toThrow(
          "心跳检测间隔必须大于0"
        );
        expect(() => configManager.setHeartbeatInterval(-1000)).toThrow(
          "心跳检测间隔必须大于0"
        );
      });

      it("应该为无效的心跳超时时间抛出错误", () => {
        expect(() => configManager.setHeartbeatTimeout(0)).toThrow(
          "心跳超时时间必须大于0"
        );
        expect(() => configManager.setHeartbeatTimeout(-500)).toThrow(
          "心跳超时时间必须大于0"
        );
      });

      it("应该为无效的重连间隔抛出错误", () => {
        expect(() => configManager.setReconnectInterval(0)).toThrow(
          "重连间隔必须大于0"
        );
        expect(() => configManager.setReconnectInterval(-2000)).toThrow(
          "重连间隔必须大于0"
        );
      });
    });

    describe("ModelScope 配置", () => {
      beforeEach(() => {
        const mockConfigWithModelScope: AppConfig = {
          ...mockConfig,
          modelscope: {
            apiKey: "test-api-key",
          },
        };
        mockReadFileSync.mockReturnValue(
          JSON.stringify(mockConfigWithModelScope)
        );
      });

      describe("getModelScopeConfig", () => {
        it("应该返回 ModelScope 配置", () => {
          const modelScopeConfig = configManager.getModelScopeConfig();
          expect(modelScopeConfig).toEqual({
            apiKey: "test-api-key",
          });
        });

        it("应该在没有配置时返回空对象", () => {
          mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
          configManager.reloadConfig();

          const modelScopeConfig = configManager.getModelScopeConfig();
          expect(modelScopeConfig).toEqual({});
        });
      });

      describe("getModelScopeApiKey", () => {
        it("应该从配置中返回 API Key", () => {
          const apiKey = configManager.getModelScopeApiKey();
          expect(apiKey).toBe("test-api-key");
        });

        it("应该在配置中没有时从环境变量获取", () => {
          mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
          configManager.reloadConfig();

          const originalEnv = process.env.MODELSCOPE_API_TOKEN;
          process.env.MODELSCOPE_API_TOKEN = "env-api-key";

          const apiKey = configManager.getModelScopeApiKey();
          expect(apiKey).toBe("env-api-key");

          // 恢复环境变量
          if (originalEnv === undefined) {
            process.env.MODELSCOPE_API_TOKEN = undefined as any;
          } else {
            process.env.MODELSCOPE_API_TOKEN = originalEnv;
          }
        });

        it("应该优先使用配置文件中的 API Key", () => {
          const originalEnv = process.env.MODELSCOPE_API_TOKEN;
          process.env.MODELSCOPE_API_TOKEN = "env-api-key";

          const apiKey = configManager.getModelScopeApiKey();
          expect(apiKey).toBe("test-api-key");

          // 恢复环境变量
          if (originalEnv === undefined) {
            process.env.MODELSCOPE_API_TOKEN = undefined as any;
          } else {
            process.env.MODELSCOPE_API_TOKEN = originalEnv;
          }
        });
      });

      describe("updateModelScopeConfig", () => {
        it("应该正确更新 ModelScope 配置", () => {
          configManager.updateModelScopeConfig({ apiKey: "new-api-key" });

          const writtenConfig = JSON.parse(
            (mockWriteFileSync.mock.calls[0] as any)[1]
          );

          expect(writtenConfig.modelscope).toEqual({
            apiKey: "new-api-key",
          });
        });
      });

      describe("setModelScopeApiKey", () => {
        it("应该正确设置 API Key", () => {
          configManager.setModelScopeApiKey("new-api-key");

          const writtenConfig = JSON.parse(
            (mockWriteFileSync.mock.calls[0] as any)[1]
          );

          expect(writtenConfig.modelscope.apiKey).toBe("new-api-key");
        });

        it("应该为空的 API Key 抛出错误", () => {
          expect(() => configManager.setModelScopeApiKey("")).toThrow(
            "API Key 必须是非空字符串"
          );
        });

        it("应该为非字符串 API Key 抛出错误", () => {
          expect(() => configManager.setModelScopeApiKey(null as any)).toThrow(
            "API Key 必须是非空字符串"
          );
        });
      });
    });
  });

  describe("Web UI 配置管理", () => {
    beforeEach(() => {
      const mockConfigWithWebUI: AppConfig = {
        ...mockConfig,
        webUI: {
          port: 8080,
        },
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfigWithWebUI));
    });

    describe("getWebUIConfig", () => {
      it("应该返回 Web UI 配置", () => {
        const webUIConfig = configManager.getWebUIConfig();
        expect(webUIConfig).toEqual({
          port: 8080,
        });
      });

      it("应该在没有配置时返回空对象", () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
        configManager.reloadConfig();

        const webUIConfig = configManager.getWebUIConfig();
        expect(webUIConfig).toEqual({});
      });
    });

    describe("getWebUIPort", () => {
      it("应该从配置中返回端口号", () => {
        const port = configManager.getWebUIPort();
        expect(port).toBe(8080);
      });

      it("应该在没有配置时返回默认端口 9999", () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
        configManager.reloadConfig();

        const port = configManager.getWebUIPort();
        expect(port).toBe(9999);
      });

      it("应该在端口未定义时返回默认端口 9999", () => {
        const configWithEmptyWebUI: AppConfig = {
          ...mockConfig,
          webUI: {},
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(configWithEmptyWebUI));
        configManager.reloadConfig();

        const port = configManager.getWebUIPort();
        expect(port).toBe(9999);
      });
    });

    describe("updateWebUIConfig", () => {
      it("应该正确更新 Web UI 配置", () => {
        configManager.updateWebUIConfig({ port: 3000 });

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.webUI).toEqual({
          port: 3000,
        });
      });

      it("应该在没有现有配置时创建新配置", () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
        configManager.reloadConfig();

        configManager.updateWebUIConfig({ port: 3000 });

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.webUI).toEqual({
          port: 3000,
        });
      });

      it("应该保留现有配置的其他值", () => {
        const configWithFullWebUI: AppConfig = {
          ...mockConfig,
          webUI: {
            port: 8080,
          },
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(configWithFullWebUI));
        configManager.reloadConfig();

        configManager.updateWebUIConfig({ port: 3000 });

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.webUI).toEqual({
          port: 3000,
        });
      });
    });

    describe("setWebUIPort", () => {
      it("应该正确设置端口号", () => {
        configManager.setWebUIPort(3000);

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.webUI.port).toBe(3000);
      });

      it("应该为无效端口号抛出错误", () => {
        expect(() => configManager.setWebUIPort(0)).toThrow(
          "端口号必须是 1-65535 之间的整数"
        );
        expect(() => configManager.setWebUIPort(-1)).toThrow(
          "端口号必须是 1-65535 之间的整数"
        );
        expect(() => configManager.setWebUIPort(65536)).toThrow(
          "端口号必须是 1-65535 之间的整数"
        );
        expect(() => configManager.setWebUIPort(1.5)).toThrow(
          "端口号必须是 1-65535 之间的整数"
        );
      });

      it("应该接受有效端口号范围", () => {
        expect(() => configManager.setWebUIPort(1)).not.toThrow();
        expect(() => configManager.setWebUIPort(80)).not.toThrow();
        expect(() => configManager.setWebUIPort(8080)).not.toThrow();
        expect(() => configManager.setWebUIPort(65535)).not.toThrow();
      });
    });
  });

  describe("多端点配置管理", () => {
    beforeEach(() => {
      // 重置配置管理器实例，确保每个测试开始时都是干净的状态
      configManager.reloadConfig();
      // 默认设置 mock 配置
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    describe("配置验证", () => {
      it("应该接受字符串类型的 mcpEndpoint", () => {
        const validConfig = {
          mcpEndpoint: "https://example.com/mcp",
          mcpServers: {},
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

        expect(() => configManager.getConfig()).not.toThrow();
      });

      it("应该接受数组类型的 mcpEndpoint", () => {
        const validConfig = {
          mcpEndpoint: [
            "https://endpoint1.com/mcp",
            "https://endpoint2.com/mcp",
          ],
          mcpServers: {},
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

        expect(() => configManager.getConfig()).not.toThrow();
      });

      it("应该拒绝空的 mcpEndpoint 数组", () => {
        const invalidConfig = {
          mcpEndpoint: [],
          mcpServers: {},
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

        expect(() => configManager.getConfig()).toThrow(
          "配置文件格式错误：mcpEndpoint 数组不能为空"
        );
      });

      it("应该拒绝包含空字符串的 mcpEndpoint 数组", () => {
        const invalidConfig = {
          mcpEndpoint: [
            "https://endpoint1.com/mcp",
            "",
            "https://endpoint2.com/mcp",
          ],
          mcpServers: {},
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

        expect(() => configManager.getConfig()).toThrow(
          "配置文件格式错误：mcpEndpoint 数组中的每个元素必须是非空字符串"
        );
      });

      it("应该拒绝其他类型的 mcpEndpoint", () => {
        const invalidConfig = {
          mcpEndpoint: 123,
          mcpServers: {},
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

        expect(() => configManager.getConfig()).toThrow(
          "配置文件格式错误：mcpEndpoint 必须是字符串或字符串数组"
        );
      });
    });

    describe("getMcpEndpoints", () => {
      it("应该返回单个端点作为数组", () => {
        const endpoints = configManager.getMcpEndpoints();
        expect(endpoints).toEqual(["https://example.com/mcp"]);
      });

      it("应该返回多个端点数组", () => {
        const mockConfigWithMultipleEndpoints: AppConfig = {
          ...mockConfig,
          mcpEndpoint: [
            "https://endpoint1.com/mcp",
            "https://endpoint2.com/mcp",
            "https://endpoint3.com/mcp",
          ],
        };
        mockReadFileSync.mockReturnValue(
          JSON.stringify(mockConfigWithMultipleEndpoints)
        );
        configManager.reloadConfig();

        const endpoints = configManager.getMcpEndpoints();
        expect(endpoints).toEqual([
          "https://endpoint1.com/mcp",
          "https://endpoint2.com/mcp",
          "https://endpoint3.com/mcp",
        ]);
      });

      it("应该在端点为空字符串时返回空数组", () => {
        const mockConfigWithEmptyEndpoint: AppConfig = {
          ...mockConfig,
          mcpEndpoint: "",
        };
        mockReadFileSync.mockReturnValue(
          JSON.stringify(mockConfigWithEmptyEndpoint)
        );
        configManager.reloadConfig();

        const endpoints = configManager.getMcpEndpoints();
        expect(endpoints).toEqual([]);
      });
    });

    describe("getMcpEndpoint (向后兼容)", () => {
      it("应该返回单个端点字符串", () => {
        const endpoint = configManager.getMcpEndpoint();
        expect(endpoint).toBe("https://example.com/mcp");
      });

      it("应该返回数组的第一个端点", () => {
        const mockConfigWithMultipleEndpoints: AppConfig = {
          ...mockConfig,
          mcpEndpoint: [
            "https://endpoint1.com/mcp",
            "https://endpoint2.com/mcp",
          ],
        };
        mockReadFileSync.mockReturnValue(
          JSON.stringify(mockConfigWithMultipleEndpoints)
        );
        configManager.reloadConfig();

        const endpoint = configManager.getMcpEndpoint();
        expect(endpoint).toBe("https://endpoint1.com/mcp");
      });
    });

    describe("updateMcpEndpoint", () => {
      it("应该接受字符串端点", () => {
        configManager.updateMcpEndpoint("https://new-endpoint.com/mcp");

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.mcpEndpoint).toBe("https://new-endpoint.com/mcp");
      });

      it("应该接受端点数组", () => {
        const newEndpoints = [
          "https://endpoint1.com/mcp",
          "https://endpoint2.com/mcp",
        ];
        configManager.updateMcpEndpoint(newEndpoints);

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.mcpEndpoint).toEqual(newEndpoints);
      });

      it("应该拒绝空数组", () => {
        expect(() => configManager.updateMcpEndpoint([])).toThrow(
          "MCP 端点数组不能为空"
        );
      });

      it("应该拒绝数组中的无效元素", () => {
        expect(() =>
          configManager.updateMcpEndpoint(["valid", "", "another"])
        ).toThrow("MCP 端点数组中的每个元素必须是非空字符串");
      });
    });

    describe("addMcpEndpoint", () => {
      it("应该添加新端点到现有列表", () => {
        configManager.addMcpEndpoint("https://new-endpoint.com/mcp");

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.mcpEndpoint).toEqual([
          "https://example.com/mcp",
          "https://new-endpoint.com/mcp",
        ]);
      });

      it("应该拒绝重复的端点", () => {
        expect(() =>
          configManager.addMcpEndpoint("https://example.com/mcp")
        ).toThrow("MCP 端点 https://example.com/mcp 已存在");
      });

      it("应该拒绝空端点", () => {
        expect(() => configManager.addMcpEndpoint("")).toThrow(
          "MCP 端点必须是非空字符串"
        );
      });
    });

    describe("removeMcpEndpoint", () => {
      beforeEach(() => {
        const mockConfigWithMultipleEndpoints: AppConfig = {
          ...mockConfig,
          mcpEndpoint: [
            "https://endpoint1.com/mcp",
            "https://endpoint2.com/mcp",
            "https://endpoint3.com/mcp",
          ],
        };
        mockReadFileSync.mockReturnValue(
          JSON.stringify(mockConfigWithMultipleEndpoints)
        );
        configManager.reloadConfig();
      });

      it("应该移除指定的端点", () => {
        configManager.removeMcpEndpoint("https://endpoint2.com/mcp");

        const writtenConfig = JSON.parse(
          (mockWriteFileSync.mock.calls[0] as any)[1]
        );

        expect(writtenConfig.mcpEndpoint).toEqual([
          "https://endpoint1.com/mcp",
          "https://endpoint3.com/mcp",
        ]);
      });

      it("应该拒绝移除不存在的端点", () => {
        expect(() =>
          configManager.removeMcpEndpoint("https://nonexistent.com/mcp")
        ).toThrow("MCP 端点 https://nonexistent.com/mcp 不存在");
      });

      it("应该拒绝移除最后一个端点", () => {
        // 先移除两个端点
        configManager.removeMcpEndpoint("https://endpoint2.com/mcp");
        configManager.removeMcpEndpoint("https://endpoint3.com/mcp");

        // 尝试移除最后一个应该失败
        expect(() =>
          configManager.removeMcpEndpoint("https://endpoint1.com/mcp")
        ).toThrow("不能删除最后一个 MCP 端点");
      });

      it("应该拒绝空端点", () => {
        expect(() => configManager.removeMcpEndpoint("")).toThrow(
          "MCP 端点必须是非空字符串"
        );
      });
    });
  });
});
