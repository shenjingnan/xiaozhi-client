import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import {
  type ConfigChangeEvent,
  ConfigChangeType,
  ConfigWatcher,
  ConfigWatcherClass,
  type ConfigWatcherOptions,
} from "../ConfigWatcher.js";
import type { MCPServiceConfig } from "../MCPService.js";

// Mock dependencies
vi.mock("../../Logger.js");
vi.mock("../ErrorHandler.js", () => ({
  categorizeError: vi.fn().mockReturnValue({
    category: "configuration",
    code: "CONFIG_ERROR",
    message: "Test error",
    serviceName: "ConfigWatcher",
    timestamp: new Date(),
    recoverable: false,
    recoveryStrategy: "manual_intervention",
  }),
  shouldAlert: vi.fn().mockReturnValue(false),
}));

describe("ConfigWatcher", () => {
  let configWatcher: ConfigWatcherClass;
  let mockLogger: any;
  let testConfigPath: string;
  let testConfigs: MCPServiceConfig[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
    vi.mocked(Logger).mockImplementation(() => mockLogger);

    // Create test configuration
    testConfigs = [
      {
        name: "test-service-1",
        type: "stdio",
        command: "test-command",
        args: ["--test"],
      },
      {
        name: "test-service-2",
        type: "sse",
        url: "http://localhost:3000/sse",
      },
    ];

    // Create temporary config file
    testConfigPath = join(tmpdir(), `test-config-${Date.now()}.json`);
    writeFileSync(
      testConfigPath,
      JSON.stringify({ mcpServices: testConfigs }, null, 2)
    );

    // Create a new instance for testing
    configWatcher = new ConfigWatcherClass();
  });

  afterEach(() => {
    vi.clearAllMocks();
    configWatcher.stopWatching();

    // Clean up test file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe("configuration validation", () => {
    it("should validate correct configuration", () => {
      const result = configWatcher.validateConfig(testConfigs);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should detect missing name field", () => {
      const invalidConfigs = [
        {
          type: "stdio",
          command: "test-command",
        } as MCPServiceConfig,
      ];

      const result = configWatcher.validateConfig(invalidConfigs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("服务配置缺少 name 字段");
    });

    it("should detect missing type field", () => {
      const invalidConfigs = [
        {
          name: "test-service",
          command: "test-command",
        } as MCPServiceConfig,
      ];

      const result = configWatcher.validateConfig(invalidConfigs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("服务 test-service 缺少 type 字段");
    });

    it("should detect duplicate service names", () => {
      const invalidConfigs = [
        {
          name: "duplicate-service",
          type: "stdio",
          command: "test-command-1",
        },
        {
          name: "duplicate-service",
          type: "stdio",
          command: "test-command-2",
        },
      ];

      const result = configWatcher.validateConfig(invalidConfigs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("重复的服务名: duplicate-service");
    });

    it("should detect missing command for stdio service", () => {
      const invalidConfigs = [
        {
          name: "stdio-service",
          type: "stdio",
        } as MCPServiceConfig,
      ];

      const result = configWatcher.validateConfig(invalidConfigs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "stdio 服务 stdio-service 缺少 command 字段"
      );
    });

    it("should detect missing url for sse service", () => {
      const invalidConfigs = [
        {
          name: "sse-service",
          type: "sse",
        } as MCPServiceConfig,
      ];

      const result = configWatcher.validateConfig(invalidConfigs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("sse 服务 sse-service 缺少 url 字段");
    });

    it("should detect warnings for invalid timeout", () => {
      const configsWithWarnings = [
        {
          name: "test-service",
          type: "stdio",
          command: "test-command",
          timeout: -1,
        },
      ];

      const result = configWatcher.validateConfig(configsWithWarnings);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "服务 test-service 的 timeout 值应该大于 0"
      );
    });
  });

  describe("file watching", () => {
    it("should start watching configuration file", () => {
      configWatcher.startWatching(testConfigPath);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("开始监听配置文件")
      );
      expect(mockLogger.info).toHaveBeenCalledWith("已加载 2 个服务配置");
    });

    it("should throw error for non-existent file", () => {
      const nonExistentPath = "/path/to/non-existent/config.json";

      expect(() => configWatcher.startWatching(nonExistentPath)).toThrow(
        `配置文件不存在: ${nonExistentPath}`
      );
    });

    it("should stop watching", () => {
      configWatcher.startWatching(testConfigPath);
      configWatcher.stopWatching();

      expect(mockLogger.info).toHaveBeenCalledWith("已停止配置文件监听");
    });

    it("should handle invalid JSON format", () => {
      const invalidConfigPath = join(
        tmpdir(),
        `invalid-config-${Date.now()}.json`
      );
      writeFileSync(invalidConfigPath, "invalid json content");

      expect(() => configWatcher.startWatching(invalidConfigPath)).toThrow();

      // Clean up
      unlinkSync(invalidConfigPath);
    });

    it("should handle invalid config structure", () => {
      const invalidConfigPath = join(
        tmpdir(),
        `invalid-structure-${Date.now()}.json`
      );
      writeFileSync(
        invalidConfigPath,
        JSON.stringify({ invalidField: "value" })
      );

      expect(() => configWatcher.startWatching(invalidConfigPath)).toThrow(
        "配置文件格式不正确，应包含 mcpServices 数组"
      );

      // Clean up
      unlinkSync(invalidConfigPath);
    });
  });

  describe("configuration callbacks", () => {
    it("should add and remove callbacks", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      configWatcher.onConfigChange(callback1);
      configWatcher.onConfigChange(callback2);

      expect(mockLogger.debug).toHaveBeenCalledWith("已添加配置变更回调");

      configWatcher.removeConfigChangeCallback(callback1);

      expect(mockLogger.debug).toHaveBeenCalledWith("已移除配置变更回调");
    });
  });

  describe("configuration management", () => {
    it("should get current configurations", () => {
      configWatcher.startWatching(testConfigPath);

      const currentConfigs = configWatcher.getCurrentConfigs();

      expect(currentConfigs).toHaveLength(2);
      expect(currentConfigs[0].name).toBe("test-service-1");
      expect(currentConfigs[1].name).toBe("test-service-2");
    });

    it("should backup and restore configurations", () => {
      configWatcher.startWatching(testConfigPath);

      const backupConfigs = configWatcher.getBackupConfigs();
      expect(backupConfigs).toHaveLength(2);

      const restoredConfigs = configWatcher.restoreFromBackup();
      expect(restoredConfigs).toEqual(backupConfigs);
    });

    it("should throw error when no backup available", () => {
      expect(() => configWatcher.restoreFromBackup()).toThrow(
        "没有可用的备份配置"
      );
    });
  });

  describe("options management", () => {
    it("should update and get options", () => {
      const newOptions: Partial<ConfigWatcherOptions> = {
        debounceMs: 2000,
        validateOnChange: false,
      };

      configWatcher.updateOptions(newOptions);
      const options = configWatcher.getOptions();

      expect(options.debounceMs).toBe(2000);
      expect(options.validateOnChange).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith("配置监听器选项已更新");
    });

    it("should get current options", () => {
      const options = configWatcher.getOptions();

      expect(options.debounceMs).toBeDefined();
      expect(options.validateOnChange).toBeDefined();
      expect(options.backupOnChange).toBeDefined();
      expect(options.autoReload).toBeDefined();
      expect(options.ignoreInitial).toBeDefined();
    });
  });

  describe("manual reload", () => {
    it("should manually reload configuration", async () => {
      configWatcher.startWatching(testConfigPath);

      // Modify the config file
      const modifiedConfigs = [
        ...testConfigs,
        {
          name: "test-service-3",
          type: "streamable-http",
          url: "http://localhost:3000/api",
        },
      ];
      writeFileSync(
        testConfigPath,
        JSON.stringify({ mcpServices: modifiedConfigs }, null, 2)
      );

      await configWatcher.reloadConfig();

      expect(mockLogger.info).toHaveBeenCalledWith("手动重新加载配置");
    });

    it("should throw error when no watched path", async () => {
      await expect(configWatcher.reloadConfig()).rejects.toThrow(
        "未设置监听路径，无法重新加载配置"
      );
    });
  });

  describe("singleton instance", () => {
    it("should provide singleton instance", () => {
      expect(ConfigWatcher).toBeDefined();
      expect(ConfigWatcher).toBeInstanceOf(ConfigWatcherClass);
    });
  });
});
