import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigManager } from "../../configManager.js";
import type { MCPServerConfig } from "../../configManager.js";
import type { EventBus } from "../../services/EventBus.js";
import type { MCPServiceManager } from "../../services/MCPServiceManager.js";
import {
  MCPErrorCode,
  MCPServerApiHandler,
  MCPServerConfigValidator,
} from "../MCPServerApiHandler.js";

// 创建模拟对象
const createMockConfigManager = (): Partial<ConfigManager> => ({
  getConfig: vi.fn().mockReturnValue({
    mcpServers: {
      existingService: {
        command: "node",
        args: ["server.js"],
      },
    },
  }),
});

const createMockMCPServiceManager = (): Partial<MCPServiceManager> => ({
  // MCPServiceManager 的模拟方法将在后续里程碑中添加
});

const createMockEventBus = (): Partial<EventBus> => ({
  emitEvent: vi.fn(),
});

describe("MCPServerApiHandler", () => {
  let handler: MCPServerApiHandler;
  let mockConfigManager: Partial<ConfigManager>;
  let mockMCPServiceManager: Partial<MCPServiceManager>;
  let mockEventBus: Partial<EventBus>;

  beforeEach(() => {
    // 重置所有模拟对象
    vi.clearAllMocks();

    mockConfigManager = createMockConfigManager();
    mockMCPServiceManager = createMockMCPServiceManager();
    mockEventBus = createMockEventBus();

    // 创建处理器实例
    handler = new MCPServerApiHandler(
      mockMCPServiceManager as MCPServiceManager,
      mockConfigManager as ConfigManager
    );
  });

  describe("构造函数和依赖注入", () => {
    it("应该正确创建处理器实例", () => {
      expect(handler).toBeInstanceOf(MCPServerApiHandler);
      expect(handler).toBeDefined();
    });

    it("应该正确注入依赖", () => {
      // 通过测试处理器创建成功间接验证依赖注入成功
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(MCPServerApiHandler);
    });
  });

  describe("响应格式化方法", () => {
    // 注意：由于响应格式化方法是 protected 的，我们不直接测试它们
    // 它们会在实际的 API 方法中被间接测试
    it("应该定义所有必需的 API 方法", () => {
      expect(handler.addMCPServer).toBeDefined();
      expect(handler.removeMCPServer).toBeDefined();
      expect(handler.getMCPServerStatus).toBeDefined();
      expect(handler.listMCPServers).toBeDefined();
      
      // 验证这些方法都是函数
      expect(typeof handler.addMCPServer).toBe("function");
      expect(typeof handler.removeMCPServer).toBe("function");
      expect(typeof handler.getMCPServerStatus).toBe("function");
      expect(typeof handler.listMCPServers).toBe("function");
    });
  });

  describe("错误处理机制", () => {
    it("应该返回正确的错误代码格式", () => {
      expect(MCPErrorCode.SERVER_ALREADY_EXISTS).toBe("SERVER_ALREADY_EXISTS");
      expect(MCPErrorCode.SERVER_NOT_FOUND).toBe("SERVER_NOT_FOUND");
      expect(MCPErrorCode.INVALID_CONFIG).toBe("INVALID_CONFIG");
      expect(MCPErrorCode.CONNECTION_FAILED).toBe("CONNECTION_FAILED");
      expect(MCPErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    });

    it("应该包含所有必要的错误代码", () => {
      const expectedCodes = [
        "SERVER_ALREADY_EXISTS",
        "SERVER_NOT_FOUND",
        "INVALID_CONFIG",
        "INVALID_SERVICE_NAME",
        "CONNECTION_FAILED",
        "CONNECTION_TIMEOUT",
        "SERVICE_UNAVAILABLE",
        "OPERATION_FAILED",
        "REMOVE_FAILED",
        "SYNC_FAILED",
        "INTERNAL_ERROR",
        "CONFIG_UPDATE_FAILED",
      ];

      for (const code of expectedCodes) {
        expect(Object.values(MCPErrorCode)).toContain(code);
      }
    });
  });
});

describe("MCPServerConfigValidator", () => {
  describe("服务配置验证", () => {
    it("应该验证有效的本地服务配置", () => {
      const config: MCPServerConfig = {
        command: "node",
        args: ["server.js"],
        env: { NODE_ENV: "production" },
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝无效的配置对象", () => {
      const result = MCPServerConfigValidator.validateConfig(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("配置必须是一个对象");
    });

    it("应该验证本地服务配置的必填字段", () => {
      const config: MCPServerConfig = {
        command: "",
        args: ["server.js"],
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("本地服务必须提供有效的命令");
    });

    it("应该验证远程服务配置的 URL", () => {
      const config: MCPServerConfig = {
        url: "invalid-url",
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("URL 格式无效");
    });

    it("应该验证有效的远程服务配置", () => {
      const config: MCPServerConfig = {
        url: "https://example.com/mcp",
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝缺少必要字段的配置", () => {
      const config = {} as MCPServerConfig;

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("配置必须包含 command 或 url 字段");
    });
  });

  describe("服务名称验证", () => {
    it("应该验证有效的服务名称", () => {
      const result =
        MCPServerConfigValidator.validateServiceName("test-service");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝空的服务名称", () => {
      const result = MCPServerConfigValidator.validateServiceName("");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("服务名称必须是非空字符串");
    });

    it("应该拒绝过长的服务名称", () => {
      const longName = "a".repeat(51);
      const result = MCPServerConfigValidator.validateServiceName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("服务名称长度必须在 1-50 个字符之间");
    });

    it("应该拒绝包含非法字符的服务名称", () => {
      const result =
        MCPServerConfigValidator.validateServiceName("test@service");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "服务名称只能包含字母、数字、下划线和连字符"
      );
    });

    it("应该接受包含合法字符的服务名称", () => {
      const validNames = [
        "test_service",
        "test-service",
        "test123",
        "Test_Service",
      ];
      for (const name of validNames) {
        const result = MCPServerConfigValidator.validateServiceName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  describe("服务存在性检查", () => {
    let mockConfigManager: Partial<ConfigManager>;

    beforeEach(() => {
      mockConfigManager = createMockConfigManager();
    });

    it("应该正确检测存在的服务", () => {
      const exists = MCPServerConfigValidator.checkServiceExists(
        "existingService",
        mockConfigManager as ConfigManager
      );
      expect(exists).toBe(true);
    });

    it("应该正确检测不存在的服务", () => {
      const exists = MCPServerConfigValidator.checkServiceExists(
        "nonExistentService",
        mockConfigManager as ConfigManager
      );
      expect(exists).toBe(false);
    });
  });
});
