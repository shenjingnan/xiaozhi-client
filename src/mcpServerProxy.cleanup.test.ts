import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "./configManager";
import { MCPServerProxy } from "./mcpServerProxy";

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpServers: vi.fn(),
    getMcpServerConfig: vi.fn(),
    removeServerToolsConfig: vi.fn(),
  },
}));

describe("MCPServerProxy 清理功能", () => {
  let mockConfigManager: any;
  let proxy: MCPServerProxy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager = vi.mocked(configManager);
    proxy = new MCPServerProxy();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该清理已删除的服务对应的工具配置", async () => {
    // 模拟配置
    const currentConfig = {
      "calculator": {
        command: "node",
        args: ["calculator.js"]
      },
      "datetime": {
        command: "node",
        args: ["datetime.js"]
      }
    };

    const serverToolsConfig = {
      "calculator": {
        tools: {
          "add": { enable: true, description: "Add two numbers" }
        }
      },
      "datetime": {
        tools: {
          "get_current_time": { enable: true, description: "Get current time" }
        }
      },
      "weather": {  // 已删除的服务
        tools: {
          "get_weather": { enable: true, description: "Get weather information" }
        }
      }
    };

    mockConfigManager.getMcpServers.mockReturnValue(currentConfig);
    mockConfigManager.getMcpServerConfig.mockReturnValue(serverToolsConfig);

    // @ts-ignore - 访问私有属性用于测试
    proxy.config = currentConfig;

    // @ts-ignore - 调用私有方法用于测试
    await proxy.cleanupRemovedServers();

    // 验证是否调用了清理方法
    expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith("weather");
    expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledTimes(1);
  });

  it("当没有需要清理的服务时不应调用清理方法", async () => {
    const currentConfig = {
      "calculator": {
        command: "node",
        args: ["calculator.js"]
      },
      "datetime": {
        command: "node",
        args: ["datetime.js"]
      }
    };

    const serverToolsConfig = {
      "calculator": {
        tools: {
          "add": { enable: true, description: "Add two numbers" }
        }
      },
      "datetime": {
        tools: {
          "get_current_time": { enable: true, description: "Get current time" }
        }
      }
    };

    mockConfigManager.getMcpServers.mockReturnValue(currentConfig);
    mockConfigManager.getMcpServerConfig.mockReturnValue(serverToolsConfig);

    // @ts-ignore - 访问私有属性用于测试
    proxy.config = currentConfig;

    // @ts-ignore - 调用私有方法用于测试
    await proxy.cleanupRemovedServers();

    // 验证清理方法未被调用
    expect(mockConfigManager.removeServerToolsConfig).not.toHaveBeenCalled();
  });

  it("应该处理清理过程中的错误", async () => {
    const currentConfig = {
      "calculator": {
        command: "node",
        args: ["calculator.js"]
      }
    };

    const serverToolsConfig = {
      "calculator": {
        tools: {
          "add": { enable: true, description: "Add two numbers" }
        }
      },
      "weather": {  // 已删除的服务
        tools: {
          "get_weather": { enable: true, description: "Get weather information" }
        }
      }
    };

    mockConfigManager.getMcpServers.mockReturnValue(currentConfig);
    mockConfigManager.getMcpServerConfig.mockReturnValue(serverToolsConfig);
    mockConfigManager.removeServerToolsConfig.mockImplementation(() => {
      throw new Error("清理失败");
    });

    // @ts-ignore - 访问私有属性用于测试
    proxy.config = currentConfig;

    // @ts-ignore - 调用私有方法用于测试
    await proxy.cleanupRemovedServers();

    // 验证即使有错误，清理过程也不会中断
    expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith("weather");
  });
});