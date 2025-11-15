/**
 * 配置同步集成测试
 * 验证 mcpServerConfig 与 mcpServers 的同步机制
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../configManager";
import { ConfigManager } from "../configManager";

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
vi.mock("../Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

describe("配置同步集成测试", () => {
  let configManager: ConfigManager;
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockResolve = vi.mocked(resolve);

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton instance
    // @ts-ignore - accessing private static property for testing
    ConfigManager.instance = undefined;

    configManager = ConfigManager.getInstance();

    // Setup default mocks
    mockResolve.mockImplementation(
      (dir: string, file: string) => `${dir}/${file}`
    );

    // Mock process.cwd and process.env
    vi.stubGlobal("process", {
      ...process,
      cwd: vi.fn().mockReturnValue("/test/cwd"),
      env: { ...process.env },
    });

    mockExistsSync.mockImplementation((path) => {
      if (path.toString().includes("xiaozhi.config.json5")) return false;
      if (path.toString().includes("xiaozhi.config.jsonc")) return false;
      if (path.toString().includes("xiaozhi.config.json")) return true;
      return false;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("应该在启动时清理无效的服务器工具配置", () => {
    // 模拟配置文件内容：mcpServers 中只有 calculator，但 mcpServerConfig 中有多个服务
    const configWithInvalidServers: AppConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        calculator: {
          command: "node",
          args: ["./mcpServers/calculator.js"],
        },
        // 注意：datetime 服务已被用户删除
      },
      mcpServerConfig: {
        calculator: {
          tools: {
            add: {
              description: "Add two numbers",
              enable: true,
            },
            subtract: {
              description: "Subtract two numbers",
              enable: true,
            },
          },
        },
        datetime: {
          // 这个配置应该被清理，因为 datetime 服务不在 mcpServers 中
          tools: {
            getCurrentTime: {
              description: "Get current time",
              enable: true,
            },
            formatDate: {
              description: "Format date",
              enable: false,
            },
          },
        },
        "removed-service": {
          // 这个配置也应该被清理
          tools: {
            someOldTool: {
              description: "Some old tool",
              enable: true,
            },
          },
        },
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(configWithInvalidServers));

    // 调用清理方法
    configManager.cleanupInvalidServerToolsConfig();

    // 验证 writeFileSync 被调用
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

    // 验证保存的配置只包含有效的服务器配置
    const savedConfig = JSON.parse(
      mockWriteFileSync.mock.calls[0][1] as string
    );

    expect(savedConfig.mcpServerConfig).toEqual({
      calculator: {
        tools: {
          add: {
            description: "Add two numbers",
            enable: true,
          },
          subtract: {
            description: "Subtract two numbers",
            enable: true,
          },
        },
      },
    });

    // 验证无效的服务器配置被删除
    expect(savedConfig.mcpServerConfig).not.toHaveProperty("datetime");
    expect(savedConfig.mcpServerConfig).not.toHaveProperty("removed-service");
  });

  it("应该在没有无效配置时不修改文件", () => {
    // 模拟配置文件内容：mcpServerConfig 与 mcpServers 完全匹配
    const validConfig: AppConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        calculator: {
          command: "node",
          args: ["./mcpServers/calculator.js"],
        },
        datetime: {
          command: "node",
          args: ["./mcpServers/datetime.js"],
        },
      },
      mcpServerConfig: {
        calculator: {
          tools: {
            add: {
              description: "Add two numbers",
              enable: true,
            },
          },
        },
        datetime: {
          tools: {
            getCurrentTime: {
              description: "Get current time",
              enable: true,
            },
          },
        },
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

    // 调用清理方法
    configManager.cleanupInvalidServerToolsConfig();

    // 验证 writeFileSync 没有被调用，因为没有需要清理的配置
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("应该处理完全清空的情况", () => {
    // 模拟配置文件内容：mcpServers 为空，但 mcpServerConfig 中有配置
    const configWithEmptyServers: AppConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {}, // 用户删除了所有服务
      mcpServerConfig: {
        calculator: {
          tools: {
            add: {
              description: "Add two numbers",
              enable: true,
            },
          },
        },
        datetime: {
          tools: {
            getCurrentTime: {
              description: "Get current time",
              enable: true,
            },
          },
        },
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(configWithEmptyServers));

    // 调用清理方法
    configManager.cleanupInvalidServerToolsConfig();

    // 验证 writeFileSync 被调用
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

    // 验证保存的配置中 mcpServerConfig 为空
    const savedConfig = JSON.parse(
      mockWriteFileSync.mock.calls[0][1] as string
    );

    expect(savedConfig.mcpServerConfig).toEqual({});
  });

  it("应该在 mcpServerConfig 不存在时不执行任何操作", () => {
    // 模拟配置文件内容：没有 mcpServerConfig 字段
    const configWithoutServerConfig: AppConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        calculator: {
          command: "node",
          args: ["./mcpServers/calculator.js"],
        },
      },
      // 没有 mcpServerConfig 字段
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(configWithoutServerConfig));

    // 调用清理方法
    configManager.cleanupInvalidServerToolsConfig();

    // 验证 writeFileSync 没有被调用
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});
