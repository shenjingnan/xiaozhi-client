import { describe, expect, it, vi } from "vitest";

// 模拟依赖以避免触发真实的配置加载
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getConfig: vi.fn(() => ({
      mcpEndpoint: [],
      mcpServers: {},
      connection: {},
    })),
    getMcpServers: vi.fn(() => ({})),
    getMcpEndpoints: vi.fn(() => []),
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    setToolEnabled: vi.fn(),
    updatePlatformConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getConnectionConfig: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    configExists: vi.fn(() => true),
    validateConfig: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("@/services/EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
  }),
}));

vi.mock("@/services/StatusService.js", () => ({
  StatusService: vi.fn().mockImplementation(() => ({
    updateRestartStatus: vi.fn(),
  })),
}));

describe("处理器基础测试", () => {
  it("应该能够导入处理器模块", async () => {
    // 测试所有处理器模块都可以无错误导入
    const modules = [
      () => import("../config.handler.js"),
      () => import("../heartbeat.handler.js"),
      () => import("../realtime-notification.handler.js"),
      () => import("../service.handler.js"),
      () => import("../static-file.handler.js"),
      () => import("../status.handler.js"),
    ];

    for (const importModule of modules) {
      await expect(importModule()).resolves.toBeDefined();
    }
  });

  it("应该具有正确的类构造函数", async () => {
    const { ConfigApiHandler } = await import("../config.handler.js");
    const { StaticFileHandler } = await import("../static-file.handler.js");
    const { ServiceApiHandler } = await import("../service.handler.js");
    const { StatusApiHandler } = await import("../status.handler.js");
    const { StatusService } = await import("@/services/status.service.js");

    const mockStatusService = new StatusService();

    expect(() => new ConfigApiHandler()).not.toThrow();
    expect(() => new StaticFileHandler()).not.toThrow();
    expect(() => new ServiceApiHandler(mockStatusService)).not.toThrow();
    expect(() => new StatusApiHandler(mockStatusService)).not.toThrow();
  });
});
