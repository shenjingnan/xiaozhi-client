/**
 * 统一的测试配置Mock工具
 * 用于避免在各个测试文件中重复定义configManager和logger的mock配置
 */

import { vi } from "vitest";

/**
 * 默认的测试配置
 */
export const DEFAULT_TEST_CONFIG = {
  mcpEndpoint: "ws://localhost:8080",
  mcpServers: {
    "test-service": {
      command: "node",
      args: ["test-server.js"],
      env: {},
    },
  },
  modelscope: {
    apiKey: "test-api-key",
    baseUrl: "https://test.modelscope.com",
  },
  connection: {
    heartbeat: {
      enabled: true,
      interval: 1000,
      timeout: 5000,
    },
    retry: {
      maxAttempts: 3,
      delay: 1000,
    },
  },
  webUI: {
    enabled: true,
    port: 3000,
  },
};

/**
 * 创建configManager的mock对象
 */
export const createMockConfigManager = (overrides = {}) => {
  return {
    configExists: vi.fn().mockReturnValue(true),
    getConfig: vi.fn().mockReturnValue(DEFAULT_TEST_CONFIG),
    setConfig: vi.fn().mockResolvedValue(undefined),
    validateConfig: vi.fn().mockReturnValue({ valid: true }),
    getMcpEndpoints: vi.fn().mockReturnValue(["ws://localhost:8080"]),
    getServiceConfig: vi
      .fn()
      .mockReturnValue(DEFAULT_TEST_CONFIG.mcpServers["test-service"]),
    watchConfig: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    ...overrides,
  };
};

/**
 * 创建logger的mock对象
 */
export const createMockLogger = (overrides = {}) => {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    ...overrides,
  };
};

/**
 * 统一的configManager mock导出
 */
export const mockConfigManager = {
  configManager: createMockConfigManager(),
};

/**
 * 统一的logger mock导出
 */
export const mockLogger = {
  logger: createMockLogger(),
};

/**
 * 为测试文件设置configManager mock
 */
export const setupConfigManagerMock = (overrides = {}) => {
  const config = createMockConfigManager(overrides);
  vi.mock("../../configManager.js", () => ({
    configManager: config,
  }));
};

/**
 * 为测试文件设置logger mock
 */
export const setupLoggerMock = (overrides = {}) => {
  vi.mock("../../Logger.js", () => ({
    logger: createMockLogger({}),
  }));
};

/**
 * 为测试文件同时设置configManager和logger mock
 */
export const setupCommonMocks = (
  configOverrides = {},
  loggerOverrides = {}
) => {
  const config = createMockConfigManager(configOverrides);
  const logger = createMockLogger(loggerOverrides);

  vi.mock("../../configManager.js", () => ({
    configManager: config,
  }));

  vi.mock("../../Logger.js", () => ({
    logger: logger,
  }));
};
