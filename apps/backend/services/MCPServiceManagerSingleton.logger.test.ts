/**
 * MCPServiceManagerSingleton Logger 注入功能测试
 * 测试新增的 logger 参数支持和 updateInstanceLogger 方法
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPServiceManagerSingleton } from "./MCPServiceManagerSingleton.js";

// Mock dependencies
vi.mock("../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

vi.mock("./MCPServiceManager.js", () => ({
  default: vi.fn().mockImplementation((configs, logger) => ({
    setLogger: vi.fn(),
    getLogger: vi.fn().mockReturnValue(logger || { info: vi.fn() }),
    hasInjectedLogger: vi.fn().mockReturnValue(!!logger),
    startAllServices: vi.fn(),
    stopAllServices: vi.fn(),
    getAllTools: vi.fn().mockReturnValue([]),
  })),
}));

describe("MCPServiceManagerSingleton - Logger 注入功能", () => {
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks first
    vi.clearAllMocks();

    // 创建 mock logger 实例
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };

    // 重置单例状态
    MCPServiceManagerSingleton.reset();
  });

  afterEach(async () => {
    // 清理单例状态
    await MCPServiceManagerSingleton.cleanup();
    vi.restoreAllMocks();
  });

  describe("基本功能测试", () => {
    it("应该支持带 logger 参数的 getInstance 调用", async () => {
      // Act & Assert - 不应该抛出异常
      await expect(
        MCPServiceManagerSingleton.getInstance(mockLogger)
      ).resolves.toBeDefined();
      expect(MCPServiceManagerSingleton.isInitialized()).toBe(true);
    });

    it("应该支持不带 logger 参数的 getInstance 调用", async () => {
      // Act & Assert - 不应该抛出异常
      await expect(
        MCPServiceManagerSingleton.getInstance()
      ).resolves.toBeDefined();
      expect(MCPServiceManagerSingleton.isInitialized()).toBe(true);
    });

    it("应该支持 updateInstanceLogger 方法", async () => {
      // Arrange
      await MCPServiceManagerSingleton.getInstance();

      // Act & Assert - 不应该抛出异常
      await expect(
        MCPServiceManagerSingleton.updateInstanceLogger(mockLogger)
      ).resolves.not.toThrow();
    });
  });

  describe("向后兼容性测试", () => {
    it("应该保持所有现有方法的正常工作", async () => {
      // Arrange
      await MCPServiceManagerSingleton.getInstance(mockLogger);

      // Act & Assert - 所有现有方法应该正常工作
      expect(() => {
        MCPServiceManagerSingleton.isInitialized();
        MCPServiceManagerSingleton.getStatus();
        MCPServiceManagerSingleton.getCurrentInstance();
      }).not.toThrow();
    });

    it("应该支持 forceReinitialize 方法", async () => {
      // Arrange
      await MCPServiceManagerSingleton.getInstance();
      expect(MCPServiceManagerSingleton.isInitialized()).toBe(true);

      // Act & Assert - 不应该抛出异常
      const newInstance = await MCPServiceManagerSingleton.forceReinitialize();
      expect(newInstance).toBeDefined();
      expect(MCPServiceManagerSingleton.isInitialized()).toBe(true);
    });
  });

  describe("状态管理测试", () => {
    it("应该在清理后正确重置状态", async () => {
      // Arrange
      await MCPServiceManagerSingleton.getInstance(mockLogger);
      expect(MCPServiceManagerSingleton.isInitialized()).toBe(true);

      // Act
      await MCPServiceManagerSingleton.cleanup();

      // Assert
      expect(MCPServiceManagerSingleton.isInitialized()).toBe(false);
    });

    it("应该在重置后允许重新初始化", async () => {
      // Arrange
      await MCPServiceManagerSingleton.getInstance(mockLogger);
      MCPServiceManagerSingleton.reset();

      // Act
      const newInstance =
        await MCPServiceManagerSingleton.getInstance(mockLogger);

      // Assert
      expect(newInstance).toBeDefined();
      expect(MCPServiceManagerSingleton.isInitialized()).toBe(true);
    });
  });
});
