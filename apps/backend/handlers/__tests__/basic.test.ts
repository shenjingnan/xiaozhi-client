import { describe, expect, it, vi } from "vitest";

// Mock dependencies to avoid triggering real config loading
vi.mock("@/root/Logger.js", () => ({
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

describe("Handlers Basic Tests", () => {
  it("should be able to import handler modules", async () => {
    // Test that all handler modules can be imported without errors
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

  it("should have proper class constructors", async () => {
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
