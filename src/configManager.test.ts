import {
  type PathLike,
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dayjs from "dayjs";
import JSON5 from "json5";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppConfig,
  ConfigManager,
  type ConnectionConfig,
  type CustomMCPConfig,
  type CustomMCPTool,
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

// Mock logger
vi.mock("./Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ConfigManager", () => {
  let configManager: ConfigManager;
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockCopyFileSync = vi.mocked(copyFileSync);
  const mockResolve = vi.mocked(resolve);
  const mockDirname = vi.mocked(dirname);
  const mockFileURLToPath = vi.mocked(fileURLToPath);

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

    // Mock dirname and fileURLToPath for ES module support
    mockDirname.mockReturnValue("/test/src");
    mockFileURLToPath.mockReturnValue("/test/src/configManager.js");

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
      mockExistsSync.mockImplementation((path: PathLike) => {
        return path.toString().includes("xiaozhi.config.json");
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
      mockExistsSync.mockImplementation((path: PathLike) => {
        return path
          .toString()
          .includes("/custom/config/dir/xiaozhi.config.json");
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
        // 模拟默认配置模板文件存在
        if (
          path.toString().includes("templates") ||
          path.toString().includes("default")
        )
          return true;
        return false; // config file doesn't exist
      });

      configManager.initConfig();

      expect(mockCopyFileSync).toHaveBeenCalledTimes(1);
      // 验证复制操作被调用，不检查具体路径因为在测试环境中路径可能不同
      const copyCall = mockCopyFileSync.mock.calls[0];
      expect(copyCall[1]).toBe("/test/cwd/xiaozhi.config.json");
    });

    it("应该成功初始化 JSON5 格式配置", () => {
      mockExistsSync.mockImplementation((path: any) => {
        // 模拟默认配置模板文件存在
        if (
          path.toString().includes("templates") ||
          path.toString().includes("default")
        )
          return true;
        return false; // config file doesn't exist
      });

      configManager.initConfig("json5");

      expect(mockCopyFileSync).toHaveBeenCalledTimes(1);
      const copyCall = mockCopyFileSync.mock.calls[0];
      expect(copyCall[1]).toBe("/test/cwd/xiaozhi.config.json5");
    });

    it("应该成功初始化 JSONC 格式配置", () => {
      mockExistsSync.mockImplementation((path: any) => {
        // 模拟默认配置模板文件存在
        if (
          path.toString().includes("templates") ||
          path.toString().includes("default")
        )
          return true;
        return false; // config file doesn't exist
      });

      configManager.initConfig("jsonc");

      expect(mockCopyFileSync).toHaveBeenCalledTimes(1);
      const copyCall = mockCopyFileSync.mock.calls[0];
      expect(copyCall[1]).toBe("/test/cwd/xiaozhi.config.jsonc");
    });

    it("当默认配置文件不存在时应该抛出错误", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => configManager.initConfig()).toThrow(
        "默认配置模板文件不存在:"
      );
    });

    it("当配置文件已存在时应该抛出错误", () => {
      mockExistsSync.mockImplementation((path: PathLike) => {
        // 模拟默认配置文件存在，但任何配置文件也存在
        if (
          path.toString().includes("templates") ||
          path.toString().includes("default")
        )
          return true;
        return path.toString().includes("xiaozhi.config.json");
      });

      expect(() => configManager.initConfig()).toThrow(
        "配置文件已存在，无需重复初始化"
      );
    });
  });

  describe("获取配置", () => {
    beforeEach(() => {
      mockExistsSync.mockImplementation((path: PathLike) => {
        return path.toString().includes("xiaozhi.config.json");
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
      mockExistsSync.mockImplementation((path: PathLike) => {
        return (
          path.toString().includes("xiaozhi.config.json") &&
          !path.toString().includes("json5") &&
          !path.toString().includes("jsonc")
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
      (config as any).mcpEndpoint = "modified";

      const config2 = configManager.getConfig();
      expect(config2.mcpEndpoint).toBe(mockConfig.mcpEndpoint);
    });

    // TODO: 后续看一下如何处理
    // it("应该在首次加载后缓存配置", () => {
    //   configManager.getConfig();
    //   configManager.getConfig();

    //   expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    // });

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
      mockExistsSync.mockImplementation((path: PathLike) => {
        return path.toString().includes("xiaozhi.config.json5");
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
      mockExistsSync.mockImplementation((path: PathLike) => {
        return path.toString().includes("xiaozhi.config.jsonc");
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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

  describe("配置文件格式保持", () => {
    it("应该保存到原始的 JSONC 配置文件路径", () => {
      // 模拟存在 JSONC 配置文件
      mockExistsSync.mockImplementation((path: PathLike) => {
        return path.toString().includes("xiaozhi.config.jsonc");
      });

      mockResolve.mockImplementation((dir: string, file: string) => {
        if (file.includes("jsonc")) return `${dir}/xiaozhi.config.jsonc`;
        return `${dir}/${file}`;
      });

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

      // 加载配置
      configManager.getConfig();

      // 更新配置
      configManager.updateMcpEndpoint("https://new-endpoint.com/mcp");

      // 验证保存到了正确的 JSONC 文件路径
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.jsonc",
        expect.any(String),
        "utf8"
      );
    });

    it("应该保存到原始的 JSON5 配置文件路径", () => {
      // 模拟存在 JSON5 配置文件
      mockExistsSync.mockImplementation((path: PathLike) => {
        return path.toString().includes("xiaozhi.config.json5");
      });

      mockResolve.mockImplementation((dir: string, file: string) => {
        if (file.includes("json5")) return `${dir}/xiaozhi.config.json5`;
        return `${dir}/${file}`;
      });

      // 模拟 JSON5 格式的配置内容
      const json5Config = `{
        // MCP 接入点
        mcpEndpoint: "https://example.com/mcp",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["test.js"],
          }
        }
      }`;

      mockReadFileSync.mockReturnValue(json5Config);

      // 加载配置
      configManager.getConfig();

      // 更新配置
      configManager.updateMcpEndpoint("https://new-endpoint.com/mcp");

      // 验证保存到了正确的 JSON5 文件路径
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json5",
        expect.any(String),
        "utf8"
      );
    });

    it("应该在没有当前配置路径时使用 getConfigFilePath", () => {
      // 模拟存在标准 JSON 配置文件
      mockExistsSync.mockImplementation((path: PathLike) => {
        return (
          path.toString().includes("xiaozhi.config.json") &&
          !path.toString().includes("json5") &&
          !path.toString().includes("jsonc")
        );
      });

      mockResolve.mockImplementation((dir: string, file: string) => {
        return `${dir}/${file}`;
      });

      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // 直接更新配置而不先加载（模拟没有当前配置路径的情况）
      configManager.updateMcpEndpoint("https://new-endpoint.com/mcp");

      // 验证保存到了正确的 JSON 文件路径
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json",
        expect.any(String),
        "utf8"
      );
    });
  });

  describe("获取配置文件路径", () => {
    it("应该返回配置文件路径", () => {
      // 模拟存在 JSON 配置文件
      mockExistsSync.mockImplementation((path: PathLike) => {
        return (
          path.toString().includes("xiaozhi.config.json") &&
          !path.toString().includes("json5") &&
          !path.toString().includes("jsonc")
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
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return true;
        if (path.toString().includes("xiaozhi.config.jsonc")) return true;
        if (path.toString().includes("xiaozhi.config.json")) return true;
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
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return true;
        if (path.toString().includes("xiaozhi.config.json")) return true;
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
      // 在测试环境中，路径可能不同，只验证它是一个字符串
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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
      // 只让 JSON 文件存在，确保使用正确的文件格式
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (path.toString().includes("xiaozhi.config.json5")) return false;
        if (path.toString().includes("xiaozhi.config.jsonc")) return false;
        if (path.toString().includes("xiaozhi.config.json")) return true;
        return false;
      });
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

      // TODO: 后续看一下如何处理
      // it("应该拒绝移除最后一个端点", () => {
      //   // 先移除两个端点
      //   configManager.removeMcpEndpoint("https://endpoint2.com/mcp");
      //   configManager.removeMcpEndpoint("https://endpoint3.com/mcp");

      //   // 尝试移除最后一个应该失败
      //   expect(() =>
      //     configManager.removeMcpEndpoint("https://endpoint1.com/mcp")
      //   ).toThrow("不能删除最后一个 MCP 端点");
      // });

      it("应该拒绝空端点", () => {
        expect(() => configManager.removeMcpEndpoint("")).toThrow(
          "MCP 端点必须是非空字符串"
        );
      });
    });
  });

  describe("工具使用统计", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
      mockResolve.mockImplementation((...args) => args.join("/"));
    });

    describe("updateToolUsageStats", () => {
      it("应该为新工具初始化使用统计", async () => {
        const callTime = "2023-12-01T10:00:00.000Z";
        const expectedFormattedTime = dayjs(callTime).format(
          "YYYY-MM-DD HH:mm:ss"
        );

        await configManager.updateToolUsageStats(
          "test-server",
          "new-tool",
          callTime
        );

        expect(mockWriteFileSync).toHaveBeenCalled();
        const savedConfig = JSON5.parse(
          mockWriteFileSync.mock.calls[0][1] as string
        );

        expect(
          savedConfig.mcpServerConfig["test-server"].tools["new-tool"]
        ).toEqual({
          enable: true,
          usageCount: 1,
          lastUsedTime: expectedFormattedTime,
        });
      });

      it("应该增加现有工具的使用次数", async () => {
        const initialConfig = {
          ...mockConfig,
          mcpServerConfig: {
            "test-server": {
              tools: {
                "existing-tool": {
                  enable: true,
                  usageCount: 5,
                  lastUsedTime: "2023-11-01 10:00:00", // 使用新格式
                },
              },
            },
          },
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));

        const callTime = "2023-12-01T10:00:00.000Z";
        const expectedFormattedTime = dayjs(callTime).format(
          "YYYY-MM-DD HH:mm:ss"
        );

        await configManager.updateToolUsageStats(
          "test-server",
          "existing-tool",
          callTime
        );

        expect(mockWriteFileSync).toHaveBeenCalled();
        const savedConfig = JSON5.parse(
          mockWriteFileSync.mock.calls[0][1] as string
        );

        expect(
          savedConfig.mcpServerConfig["test-server"].tools["existing-tool"]
        ).toEqual({
          enable: true,
          usageCount: 6,
          lastUsedTime: expectedFormattedTime,
        });
      });

      it("应该在新时间早于现有时间时跳过 lastUsedTime 更新", async () => {
        const existingFormattedTime = "2023-12-01 10:00:00"; // 使用新格式
        const initialConfig = {
          ...mockConfig,
          mcpServerConfig: {
            "test-server": {
              tools: {
                "existing-tool": {
                  enable: true,
                  usageCount: 5,
                  lastUsedTime: existingFormattedTime,
                },
              },
            },
          },
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));

        const earlierTime = "2023-11-01T10:00:00.000Z";
        await configManager.updateToolUsageStats(
          "test-server",
          "existing-tool",
          earlierTime
        );

        expect(mockWriteFileSync).toHaveBeenCalled();
        const savedConfig = JSON5.parse(
          mockWriteFileSync.mock.calls[0][1] as string
        );

        expect(
          savedConfig.mcpServerConfig["test-server"].tools["existing-tool"]
        ).toEqual({
          enable: true,
          usageCount: 6,
          lastUsedTime: existingFormattedTime, // 应该保持原来的时间
        });
      });

      it("应该处理配置文件不存在的情况", async () => {
        mockExistsSync.mockReturnValue(false);

        const callTime = "2023-12-01T10:00:00.000Z";

        // 应该不抛出异常
        await expect(
          configManager.updateToolUsageStats(
            "test-server",
            "test-tool",
            callTime
          )
        ).resolves.not.toThrow();
      });
    });

    describe("清理无效的服务器工具配置", () => {
      beforeEach(() => {
        // 只让 JSON 文件存在，确保使用正确的文件格式
        mockExistsSync.mockImplementation((path: PathLike) => {
          if (path.toString().includes("xiaozhi.config.json5")) return false;
          if (path.toString().includes("xiaozhi.config.jsonc")) return false;
          if (path.toString().includes("xiaozhi.config.json")) return true;
          return false;
        });
      });

      it("应该清理不存在于mcpServers中的服务器工具配置", () => {
        const configWithInvalidServers: AppConfig = {
          ...mockConfig,
          mcpServers: {
            "test-server": {
              command: "node",
              args: ["test.js"],
            },
            // 注意：removed-server 不在 mcpServers 中
          },
          mcpServerConfig: {
            "test-server": {
              tools: {
                "test-tool": {
                  description: "Test tool",
                  enable: true,
                },
              },
            },
            "removed-server": {
              tools: {
                "removed-tool": {
                  description: "Removed tool",
                  enable: true,
                },
              },
            },
            "another-removed-server": {
              tools: {
                "another-tool": {
                  description: "Another removed tool",
                  enable: false,
                },
              },
            },
          },
        };

        mockReadFileSync.mockReturnValue(
          JSON.stringify(configWithInvalidServers)
        );

        configManager.cleanupInvalidServerToolsConfig();

        expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
        const savedConfig = JSON.parse(
          mockWriteFileSync.mock.calls[0][1] as string
        );

        // 验证只保留了有效的服务器配置
        expect(savedConfig.mcpServerConfig).toEqual({
          "test-server": {
            tools: {
              "test-tool": {
                description: "Test tool",
                enable: true,
              },
            },
          },
        });

        // 验证无效的服务器配置被删除
        expect(savedConfig.mcpServerConfig).not.toHaveProperty(
          "removed-server"
        );
        expect(savedConfig.mcpServerConfig).not.toHaveProperty(
          "another-removed-server"
        );
      });

      it("应该在没有无效配置时不修改文件", () => {
        const validConfig: AppConfig = {
          ...mockConfig,
          mcpServers: {
            "test-server": {
              command: "node",
              args: ["test.js"],
            },
            "valid-server": {
              command: "python",
              args: ["server.py"],
            },
          },
          mcpServerConfig: {
            "test-server": {
              tools: {
                "test-tool": {
                  description: "Test tool",
                  enable: true,
                },
              },
            },
            "valid-server": {
              tools: {
                "valid-tool": {
                  description: "Valid tool",
                  enable: true,
                },
              },
            },
          },
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

        configManager.cleanupInvalidServerToolsConfig();

        // 不应该调用 writeFileSync，因为没有需要清理的配置
        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });

      it("应该在mcpServerConfig不存在时不执行任何操作", () => {
        const configWithoutServerConfig: AppConfig = {
          ...mockConfig,
          mcpServerConfig: undefined,
        };

        mockReadFileSync.mockReturnValue(
          JSON.stringify(configWithoutServerConfig)
        );

        configManager.cleanupInvalidServerToolsConfig();

        // 不应该调用 writeFileSync
        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });

      it("应该在mcpServerConfig为空对象时不执行任何操作", () => {
        const configWithEmptyServerConfig: AppConfig = {
          ...mockConfig,
          mcpServerConfig: {},
        };

        mockReadFileSync.mockReturnValue(
          JSON.stringify(configWithEmptyServerConfig)
        );

        configManager.cleanupInvalidServerToolsConfig();

        // 不应该调用 writeFileSync
        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });

      it("应该处理mcpServers为空的情况", () => {
        const configWithEmptyServers: AppConfig = {
          ...mockConfig,
          mcpServers: {},
          mcpServerConfig: {
            "orphaned-server": {
              tools: {
                "orphaned-tool": {
                  description: "Orphaned tool",
                  enable: true,
                },
              },
            },
          },
        };

        mockReadFileSync.mockReturnValue(
          JSON.stringify(configWithEmptyServers)
        );

        configManager.cleanupInvalidServerToolsConfig();

        expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
        const savedConfig = JSON.parse(
          mockWriteFileSync.mock.calls[0][1] as string
        );

        // 所有服务器配置都应该被清理
        expect(savedConfig.mcpServerConfig).toEqual({});
      });
    });
  });

  describe("CustomMCP 配置管理", () => {
    const mockCustomMCPTool: CustomMCPTool = {
      name: "test_coze_workflow",
      description: "测试coze工作流是否正常可用",
      inputSchema: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "用户说话的内容",
          },
        },
        required: ["input"],
      },
      handler: {
        type: "proxy",
        platform: "coze",
        config: {
          workflow_id: "7513776469241741352",
        },
      },
    };

    const mockCustomMCPConfig: CustomMCPConfig = {
      tools: [mockCustomMCPTool],
    };

    const mockConfigWithCustomMCP: AppConfig = {
      ...mockConfig,
      customMCP: mockCustomMCPConfig,
    };

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfigWithCustomMCP));
    });

    describe("getCustomMCPConfig", () => {
      it("应该返回 customMCP 配置", () => {
        const customMCPConfig = configManager.getCustomMCPConfig();
        expect(customMCPConfig).toEqual(mockCustomMCPConfig);
      });

      it("当没有 customMCP 配置时应该返回 null", () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
        const customMCPConfig = configManager.getCustomMCPConfig();
        expect(customMCPConfig).toBeNull();
      });
    });

    describe("getCustomMCPTools", () => {
      it("应该返回 customMCP 工具数组", () => {
        const tools = configManager.getCustomMCPTools();
        expect(tools).toEqual([mockCustomMCPTool]);
      });

      it("应该严格处理数组格式的 tools 字段", () => {
        const configWithArrayTool: AppConfig = {
          ...mockConfig,
          customMCP: {
            tools: [mockCustomMCPTool], // 必须是数组格式
          },
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(configWithArrayTool));

        const tools = configManager.getCustomMCPTools();
        expect(tools).toEqual([mockCustomMCPTool]);
      });

      it("当没有 customMCP 配置时应该返回空数组", () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
        const tools = configManager.getCustomMCPTools();
        expect(tools).toEqual([]);
      });

      it("当 tools 字段不存在时应该返回空数组", () => {
        const configWithoutTools: AppConfig = {
          ...mockConfig,
          customMCP: {} as CustomMCPConfig,
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(configWithoutTools));

        const tools = configManager.getCustomMCPTools();
        expect(tools).toEqual([]);
      });
    });

    describe("validateCustomMCPTools", () => {
      it("应该验证有效的工具配置", () => {
        const isValid = configManager.validateCustomMCPTools([
          mockCustomMCPTool,
        ]);
        expect(isValid).toBe(true);
      });

      it("应该拒绝非数组输入", () => {
        const isValid = configManager.validateCustomMCPTools(
          mockCustomMCPTool as any
        );
        expect(isValid).toBe(false);
      });

      it("应该拒绝缺少 name 字段的工具", () => {
        const { name, ...invalidTool } = mockCustomMCPTool;

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝 name 字段不是字符串的工具", () => {
        const invalidTool = { ...mockCustomMCPTool, name: 123 };

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝缺少 description 字段的工具", () => {
        const { description, ...invalidTool } = mockCustomMCPTool;

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝 description 字段不是字符串的工具", () => {
        const invalidTool = { ...mockCustomMCPTool, description: 123 };

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝缺少 inputSchema 字段的工具", () => {
        const { inputSchema, ...invalidTool } = mockCustomMCPTool;

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝 inputSchema 字段不是对象的工具", () => {
        const invalidTool = { ...mockCustomMCPTool, inputSchema: "invalid" };

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝缺少 handler 字段的工具", () => {
        const { handler, ...invalidTool } = mockCustomMCPTool;

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝 handler 字段不是对象的工具", () => {
        const invalidTool = { ...mockCustomMCPTool, handler: "invalid" };

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该拒绝无效的 handler.type", () => {
        const invalidTool = {
          ...mockCustomMCPTool,
          handler: { ...mockCustomMCPTool.handler, type: "invalid" },
        };

        const isValid = configManager.validateCustomMCPTools([
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });

      it("应该接受有效的 handler.type", () => {
        const proxyTool = {
          ...mockCustomMCPTool,
          handler: {
            type: "proxy" as const,
            platform: "coze" as const,
            config: {
              workflow_id: "7513776469241741352",
            },
          },
        };
        const functionTool = {
          ...mockCustomMCPTool,
          name: "function_tool",
          handler: {
            type: "function" as const,
            module: "./test-module.js",
            function: "testFunction",
          },
        };
        const httpTool = {
          ...mockCustomMCPTool,
          name: "http_tool",
          handler: {
            type: "http" as const,
            url: "https://api.example.com/test",
            method: "GET" as const,
          },
        };
        const scriptTool = {
          ...mockCustomMCPTool,
          name: "script_tool",
          handler: {
            type: "script" as const,
            script: "console.log('test')",
            interpreter: "node" as const,
          },
        };
        const chainTool = {
          ...mockCustomMCPTool,
          name: "chain_tool",
          handler: {
            type: "chain" as const,
            tools: ["tool1", "tool2"],
            mode: "sequential" as const,
            error_handling: "stop" as const,
          },
        };

        expect(configManager.validateCustomMCPTools([proxyTool])).toBe(true);
        expect(configManager.validateCustomMCPTools([functionTool])).toBe(true);
        expect(configManager.validateCustomMCPTools([httpTool])).toBe(true);
        expect(configManager.validateCustomMCPTools([scriptTool])).toBe(true);
        expect(configManager.validateCustomMCPTools([chainTool])).toBe(true);
      });

      it("应该拒绝无效的工具名称格式", () => {
        const invalidNames = [
          "123invalid", // 不能以数字开头
          "invalid-name", // 不能包含连字符
          "invalid name", // 不能包含空格
          "invalid.name", // 不能包含点号
          "", // 不能为空
        ];

        for (const invalidName of invalidNames) {
          const invalidTool = { ...mockCustomMCPTool, name: invalidName };
          const isValid = configManager.validateCustomMCPTools([invalidTool]);
          expect(isValid).toBe(false);
        }
      });

      it("应该接受有效的工具名称格式", () => {
        const validNames = [
          "valid_name",
          "validName",
          "valid123",
          "a",
          "A",
          "tool_name_123",
        ];

        for (const validName of validNames) {
          const validTool = { ...mockCustomMCPTool, name: validName };
          const isValid = configManager.validateCustomMCPTools([validTool]);
          expect(isValid).toBe(true);
        }
      });

      it("应该验证多个工具", () => {
        const tool1 = { ...mockCustomMCPTool, name: "tool1" };
        const tool2 = { ...mockCustomMCPTool, name: "tool2" };

        const isValid = configManager.validateCustomMCPTools([tool1, tool2]);
        expect(isValid).toBe(true);
      });

      it("应该在任何一个工具无效时返回 false", () => {
        const validTool = { ...mockCustomMCPTool, name: "valid_tool" };
        const { name, ...invalidTool } = mockCustomMCPTool;

        const isValid = configManager.validateCustomMCPTools([
          validTool,
          invalidTool as any,
        ]);
        expect(isValid).toBe(false);
      });
    });

    describe("hasValidCustomMCPTools", () => {
      it("应该在有有效 customMCP 工具时返回 true", () => {
        const hasValid = configManager.hasValidCustomMCPTools();
        expect(hasValid).toBe(true);
      });

      it("应该在没有 customMCP 配置时返回 false", () => {
        mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
        const hasValid = configManager.hasValidCustomMCPTools();
        expect(hasValid).toBe(false);
      });

      it("应该在 customMCP 工具无效时返回 false", () => {
        const configWithInvalidTool: AppConfig = {
          ...mockConfig,
          customMCP: {
            tools: [{ ...mockCustomMCPTool, name: "" }], // 无效的名称
          },
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(configWithInvalidTool));

        const hasValid = configManager.hasValidCustomMCPTools();
        expect(hasValid).toBe(false);
      });

      it("应该在出现异常时返回 false", () => {
        // 模拟读取配置时出现异常
        mockReadFileSync.mockImplementation(() => {
          throw new Error("读取配置失败");
        });

        const hasValid = configManager.hasValidCustomMCPTools();
        expect(hasValid).toBe(false);
      });
    });
  });
});
