import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "./configManager";
import { WebServer } from "./webServer";

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
    getConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpServers: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    getWebUIPort: vi.fn(),
    setToolEnabled: vi.fn(),
    removeServerToolsConfig: vi.fn(),
  },
}));

// Mock CLI
vi.mock("./cli", () => ({
  getServiceStatus: vi.fn(),
}));

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

describe("WebServer 配置清理功能", () => {
  let mockConfigManager: any;
  let webServer: WebServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager = vi.mocked(configManager);

    // 设置默认的 mock 返回值
    mockConfigManager.getConfig.mockReturnValue({
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        test: { command: "node", args: ["test.js"] },
      },
    });
    mockConfigManager.getMcpEndpoint.mockReturnValue("wss://test.endpoint");
    mockConfigManager.getMcpServers.mockReturnValue({
      test: { command: "node", args: ["test.js"] },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该在删除服务时同时清理工具配置", () => {
    const newConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {}, // 删除了所有服务
    };

    // @ts-ignore - 访问私有方法用于测试
    const webServerInstance = new WebServer(9999);

    // @ts-ignore - 调用私有方法用于测试
    webServerInstance.updateConfig(newConfig);

    // 验证删除服务的方法被调用
    expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith("test");

    // 验证清理工具配置的方法被调用
    expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith(
      "test"
    );
  });

  it("应该只清理被删除的服务配置", () => {
    // 模拟当前有两个服务
    mockConfigManager.getMcpServers.mockReturnValue({
      calculator: { command: "node", args: ["calculator.js"] },
      datetime: { command: "node", args: ["datetime.js"] },
    });

    const newConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {
        // 只保留 datetime 服务，删除 calculator 服务
        datetime: { command: "node", args: ["datetime.js"] },
      },
    };

    // @ts-ignore - 访问私有方法用于测试
    const webServerInstance = new WebServer(9999);

    // @ts-ignore - 调用私有方法用于测试
    webServerInstance.updateConfig(newConfig);

    // 验证只删除了 calculator 服务
    expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith(
      "calculator"
    );
    expect(mockConfigManager.removeMcpServer).toHaveBeenCalledTimes(1);

    // 验证只清理了 calculator 服务的工具配置
    expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith(
      "calculator"
    );
    expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledTimes(1);
  });
});
