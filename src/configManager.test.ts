import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppConfig,
  ConfigManager,
  type MCPServerConfig,
  type MCPServerToolsConfig,
  type MCPToolConfig,
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
}));

describe("ConfigManager", () => {
  let configManager: ConfigManager;
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockCopyFileSync = vi.mocked(copyFileSync);
  const mockResolve = vi.mocked(resolve);

  const mockConfig: AppConfig = {
    mcpEndpoint: "wss://api.example.com/mcp",
    mcpServers: {
      "test-server": {
        command: "node",
        args: ["test.js"],
        env: { TEST_VAR: "test_value" },
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
      mockExistsSync.mockReturnValue(true);
      expect(configManager.configExists()).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json"
      );
    });

    it("当配置文件不存在时应该返回false", () => {
      mockExistsSync.mockReturnValue(false);
      expect(configManager.configExists()).toBe(false);
    });

    it("当设置了XIAOZHI_CONFIG_DIR时应该使用自定义目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/custom/config/dir";
      mockExistsSync.mockReturnValue(true);

      configManager.configExists();
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/custom/config/dir/xiaozhi.config.json"
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

    it("当默认配置文件不存在时应该抛出错误", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => configManager.initConfig()).toThrow(
        "默认配置文件 xiaozhi.config.default.json 不存在"
      );
    });

    it("当配置文件已存在时应该抛出错误", () => {
      mockExistsSync.mockReturnValue(true);

      expect(() => configManager.initConfig()).toThrow(
        "配置文件 xiaozhi.config.json 已存在，无需重复初始化"
      );
    });
  });

  describe("获取配置", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("应该加载并返回配置", () => {
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
        "配置文件 xiaozhi.config.json 不存在，请先运行 xiaozhi init 初始化配置"
      );
    });

    it("当JSON格式无效时应该抛出错误", () => {
      mockReadFileSync.mockReturnValue("invalid json");

      expect(() => configManager.getConfig()).toThrow("配置文件格式错误");
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
        "服务配置的 command 字段必须是非空字符串"
      );
    });

    it("应该为无效参数抛出错误", () => {
      const serverConfig = {
        command: "node",
        args: "not-array",
      } as any;

      expect(() => configManager.updateMcpServer("test", serverConfig)).toThrow(
        "服务配置的 args 字段必须是数组"
      );
    });

    it("应该为无效环境变量抛出错误", () => {
      const serverConfig = {
        command: "node",
        args: ["test.js"],
        env: "not-object",
      } as any;

      expect(() => configManager.updateMcpServer("test", serverConfig)).toThrow(
        "服务配置的 env 字段必须是对象"
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
      const path = configManager.getConfigPath();
      expect(path).toBe("/test/cwd/xiaozhi.config.json");
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
        "配置文件格式错误：mcpServers.invalid-server.command 无效"
      );
    });
  });
});
