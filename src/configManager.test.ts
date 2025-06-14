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

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("configExists", () => {
    it("should return true when config file exists", () => {
      mockExistsSync.mockReturnValue(true);
      expect(configManager.configExists()).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json"
      );
    });

    it("should return false when config file does not exist", () => {
      mockExistsSync.mockReturnValue(false);
      expect(configManager.configExists()).toBe(false);
    });

    it("should use XIAOZHI_CONFIG_DIR when set", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/custom/config/dir";
      mockExistsSync.mockReturnValue(true);

      configManager.configExists();
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/custom/config/dir/xiaozhi.config.json"
      );
    });
  });

  describe("initConfig", () => {
    it("should initialize config successfully", () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes("default")) return true;
        return false; // config file doesn't exist
      });

      configManager.initConfig();

      expect(mockCopyFileSync).toHaveBeenCalledWith(
        expect.stringContaining("xiaozhi.config.default.json"),
        "/test/cwd/xiaozhi.config.json"
      );
    });

    it("should throw error when default config does not exist", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => configManager.initConfig()).toThrow(
        "默认配置文件 xiaozhi.config.default.json 不存在"
      );
    });

    it("should throw error when config already exists", () => {
      mockExistsSync.mockReturnValue(true);

      expect(() => configManager.initConfig()).toThrow(
        "配置文件 xiaozhi.config.json 已存在，无需重复初始化"
      );
    });
  });

  describe("getConfig", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should load and return config", () => {
      const config = configManager.getConfig();
      expect(config).toEqual(mockConfig);
      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json",
        "utf8"
      );
    });

    it("should return deep copy of config", () => {
      const config = configManager.getConfig();
      config.mcpEndpoint = "modified";

      const config2 = configManager.getConfig();
      expect(config2.mcpEndpoint).toBe(mockConfig.mcpEndpoint);
    });

    it("should cache config after first load", () => {
      configManager.getConfig();
      configManager.getConfig();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it("should throw error when config file does not exist", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => configManager.getConfig()).toThrow(
        "配置文件 xiaozhi.config.json 不存在，请先运行 xiaozhi init 初始化配置"
      );
    });

    it("should throw error for invalid JSON", () => {
      mockReadFileSync.mockReturnValue("invalid json");

      expect(() => configManager.getConfig()).toThrow("配置文件格式错误");
    });
  });

  describe("getMcpEndpoint", () => {
    it("should return MCP endpoint", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const endpoint = configManager.getMcpEndpoint();
      expect(endpoint).toBe(mockConfig.mcpEndpoint);
    });
  });

  describe("getMcpServers", () => {
    it("should return MCP servers config", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const servers = configManager.getMcpServers();
      expect(servers).toEqual(mockConfig.mcpServers);
    });
  });

  describe("getMcpServerConfig", () => {
    it("should return MCP server tools config", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const serverConfig = configManager.getMcpServerConfig();
      expect(serverConfig).toEqual(mockConfig.mcpServerConfig);
    });

    it("should return empty object when mcpServerConfig is undefined", () => {
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

  describe("getServerToolsConfig", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should return tools config for existing server", () => {
      const toolsConfig = configManager.getServerToolsConfig("test-server");
      expect(toolsConfig).toEqual(
        mockConfig.mcpServerConfig!["test-server"].tools
      );
    });

    it("should return empty object for non-existent server", () => {
      const toolsConfig = configManager.getServerToolsConfig("non-existent");
      expect(toolsConfig).toEqual({});
    });
  });

  describe("isToolEnabled", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should return true for enabled tool", () => {
      const isEnabled = configManager.isToolEnabled("test-server", "test-tool");
      expect(isEnabled).toBe(true);
    });

    it("should return false for disabled tool", () => {
      const isEnabled = configManager.isToolEnabled(
        "test-server",
        "disabled-tool"
      );
      expect(isEnabled).toBe(false);
    });

    it("should return true for non-existent tool (default enabled)", () => {
      const isEnabled = configManager.isToolEnabled(
        "test-server",
        "non-existent-tool"
      );
      expect(isEnabled).toBe(true);
    });

    it("should return true for non-existent server (default enabled)", () => {
      const isEnabled = configManager.isToolEnabled(
        "non-existent-server",
        "any-tool"
      );
      expect(isEnabled).toBe(true);
    });
  });

  describe("updateMcpEndpoint", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should update MCP endpoint", () => {
      const newEndpoint = "wss://new.example.com/mcp";
      configManager.updateMcpEndpoint(newEndpoint);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/test/cwd/xiaozhi.config.json",
        expect.stringContaining(newEndpoint),
        "utf8"
      );
    });

    it("should throw error for empty endpoint", () => {
      expect(() => configManager.updateMcpEndpoint("")).toThrow(
        "MCP 端点必须是非空字符串"
      );
    });

    it("should throw error for non-string endpoint", () => {
      expect(() => configManager.updateMcpEndpoint(null as any)).toThrow(
        "MCP 端点必须是非空字符串"
      );
    });
  });

  describe("updateMcpServer", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should update MCP server config", () => {
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

    it("should throw error for empty server name", () => {
      const serverConfig: MCPServerConfig = {
        command: "node",
        args: ["test.js"],
      };

      expect(() => configManager.updateMcpServer("", serverConfig)).toThrow(
        "服务名称必须是非空字符串"
      );
    });

    it("should throw error for invalid command", () => {
      const serverConfig = {
        command: "",
        args: ["test.js"],
      } as MCPServerConfig;

      expect(() => configManager.updateMcpServer("test", serverConfig)).toThrow(
        "服务配置的 command 字段必须是非空字符串"
      );
    });

    it("should throw error for invalid args", () => {
      const serverConfig = {
        command: "node",
        args: "not-array",
      } as any;

      expect(() => configManager.updateMcpServer("test", serverConfig)).toThrow(
        "服务配置的 args 字段必须是数组"
      );
    });

    it("should throw error for invalid env", () => {
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

  describe("updateServerToolsConfig", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should update server tools config", () => {
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

    it("should create mcpServerConfig if it doesn't exist", () => {
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

  describe("setToolEnabled", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should enable tool with description", () => {
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

    it("should disable tool without description", () => {
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

    it("should create server config if it doesn't exist", () => {
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

    it("should create mcpServerConfig if it doesn't exist", () => {
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

  describe("removeMcpServer", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should remove MCP server", () => {
      configManager.removeMcpServer("test-server");

      const savedConfig = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string
      );
      expect(savedConfig.mcpServers).not.toHaveProperty("test-server");
    });

    it("should throw error for empty server name", () => {
      expect(() => configManager.removeMcpServer("")).toThrow(
        "服务名称必须是非空字符串"
      );
    });

    it("should throw error for non-existent server", () => {
      expect(() => configManager.removeMcpServer("non-existent")).toThrow(
        "服务 non-existent 不存在"
      );
    });
  });

  describe("reloadConfig", () => {
    it("should clear cached config", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Load config first time
      configManager.getConfig();
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Reload and get config again
      configManager.reloadConfig();
      configManager.getConfig();
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("getConfigPath", () => {
    it("should return config file path", () => {
      const path = configManager.getConfigPath();
      expect(path).toBe("/test/cwd/xiaozhi.config.json");
    });
  });

  describe("getDefaultConfigPath", () => {
    it("should return default config file path", () => {
      const path = configManager.getDefaultConfigPath();
      expect(path).toContain("xiaozhi.config.default.json");
    });
  });

  describe("validateConfig", () => {
    it("should validate valid config", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      expect(() => configManager.getConfig()).not.toThrow();
    });

    it("should throw error for invalid root object", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("null");

      expect(() => configManager.getConfig()).toThrow(
        "配置文件格式错误：根对象无效"
      );
    });

    it("should throw error for missing mcpEndpoint", () => {
      const invalidConfig = { mcpServers: {} };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => configManager.getConfig()).toThrow(
        "配置文件格式错误：mcpEndpoint 字段无效"
      );
    });

    it("should throw error for missing mcpServers", () => {
      const invalidConfig = { mcpEndpoint: "wss://test.com" };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => configManager.getConfig()).toThrow(
        "配置文件格式错误：mcpServers 字段无效"
      );
    });

    it("should throw error for invalid server config", () => {
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
