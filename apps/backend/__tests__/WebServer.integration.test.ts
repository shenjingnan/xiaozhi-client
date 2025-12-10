import { IndependentXiaozhiConnectionManager } from "@/lib/endpoint/index.js";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { configManager } from "../configManager.js";

// Mock CLI to prevent process.exit
vi.mock("@cli.js", () => ({}));

// 动态导入 WebServer 以避免 CLI 模块的副作用
let WebServer: any;

// Mock dependencies
vi.mock("../configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getMcpEndpoint: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    getServerConfigs: vi.fn(),
    getPort: vi.fn(),
    getWebUIPort: vi.fn(),
    configExists: vi.fn(),
    cleanupInvalidServerToolsConfig: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../ProxyMCPServer.js", () => ({
  ProxyMCPServer: vi.fn().mockImplementation((endpoint: string) => ({
    endpoint,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setServiceManager: vi.fn(),
  })),
}));

vi.mock("@services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({
      startAllServices: vi.fn().mockResolvedValue(undefined),
      getAllTools: vi.fn().mockReturnValue([]),
      cleanup: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/lib/endpoint/index.js", () => ({
  IndependentXiaozhiConnectionManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    setServiceManager: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("WebServer Integration Tests", () => {
  let webServer: any;
  const testPort = 3001;

  beforeAll(async () => {
    // 动态导入 WebServer
    const webServerModule = await import("../WebServer.js");
    WebServer = webServerModule.WebServer;
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // 设置默认的 mock 返回值
    vi.mocked(configManager.getConfig).mockReturnValue({
      mcpEndpoint: [],
      mcpServers: {},
      webUI: {
        port: testPort,
      },
    });

    vi.mocked(configManager.getMcpEndpoints).mockReturnValue([]);
    vi.mocked(configManager.getMcpEndpoint).mockReturnValue("");
    vi.mocked(configManager.getWebUIPort).mockReturnValue(testPort);
    vi.mocked(configManager.configExists).mockReturnValue(true);
    // 移除不存在的方法 mock

    webServer = new WebServer(testPort);
  });

  afterEach(async () => {
    if (webServer?.stop) {
      try {
        await webServer.stop();
      } catch (error) {
        // 忽略停止错误
      }
    }
  });

  afterAll(async () => {
    // 清理全局状态
    vi.restoreAllMocks();
  });

  describe("服务器启动和停止", () => {
    it("应该能够启动和停止服务器", async () => {
      expect(webServer).toBeDefined();

      // 启动服务器
      await expect(webServer.start()).resolves.not.toThrow();

      // 验证服务器已启动
      expect(webServer.httpServer).toBeDefined();
      expect(webServer.wss).toBeDefined();

      // 停止服务器
      await expect(webServer.stop()).resolves.not.toThrow();
    });

    it("应该在没有端点配置时正常启动", async () => {
      // 设置空端点配置
      vi.mocked(configManager.getMcpEndpoints).mockReturnValue([]);
      vi.mocked(configManager.getMcpEndpoint).mockReturnValue("");

      const newWebServer = new WebServer(testPort + 1);

      await expect(newWebServer.start()).resolves.not.toThrow();

      // 验证连接管理器已初始化
      expect(newWebServer.getXiaozhiConnectionManager()).toBeDefined();

      await newWebServer.stop();
    });
  });

  describe("连接管理器集成", () => {
    it("应该正确创建和管理连接管理器", async () => {
      // 启动服务器
      await webServer.start();

      // 获取连接管理器
      const connectionManager = webServer.getXiaozhiConnectionManager();
      expect(connectionManager).toBeDefined();
      expect(connectionManager).toBeInstanceOf(
        IndependentXiaozhiConnectionManager
      );

      // 获取连接状态
      const status = webServer.getXiaozhiConnectionStatus();
      expect(status).toBeDefined();
      expect(status.type).toBe("multi-endpoint");
    });

    it("应该支持依赖注入的连接管理器", async () => {
      const mockManager = {
        initialize: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        setServiceManager: vi.fn(),
        getConnectionStatus: vi
          .fn()
          .mockReturnValue([
            { endpoint: "wss://mock.example.com", connected: true },
          ]),
        on: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      } as any;

      // 注入 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockManager);

      // 启动服务器
      await webServer.start();

      // 验证使用的是注入的管理器
      const connectionManager = webServer.getXiaozhiConnectionManager();
      expect(connectionManager).toBe(mockManager);

      // 验证连接状态
      const status = webServer.getXiaozhiConnectionStatus();
      expect(status.manager.connectedConnections).toBe(1);
    });

    it("应该在有端点配置时初始化连接", async () => {
      // 设置端点配置
      vi.mocked(configManager.getMcpEndpoints).mockReturnValue([
        "wss://test1.example.com",
        "wss://test2.example.com",
      ]);
      vi.mocked(configManager.getMcpEndpoint).mockReturnValue(
        "wss://test1.example.com"
      );

      const newWebServer = new WebServer(testPort + 2);
      await newWebServer.start();

      // 获取连接管理器
      const connectionManager = newWebServer.getXiaozhiConnectionManager();
      expect(connectionManager).toBeDefined();

      // 验证初始化被调用
      expect(IndependentXiaozhiConnectionManager).toHaveBeenCalled();

      await newWebServer.stop();
    });
  });

  describe("错误处理", () => {
    it("应该处理连接管理器初始化失败", async () => {
      // Mock 初始化失败
      vi.mocked(IndependentXiaozhiConnectionManager).mockImplementation(() => {
        throw new Error("初始化失败");
      });

      const newWebServer = new WebServer(testPort + 3);

      // 启动应该不会抛出错误（有错误处理）
      await expect(newWebServer.start()).resolves.not.toThrow();

      await newWebServer.stop();
    });

    it("应该处理端口占用情况", async () => {
      // 启动第一个服务器
      await webServer.start();

      // 尝试在同一端口启动第二个服务器
      const duplicateWebServer = new WebServer(testPort);

      // 应该抛出错误（端口已被占用）
      await expect(duplicateWebServer.start()).rejects.toThrow();

      // 清理
      await webServer.stop();
    });
  });

  describe("清理功能", () => {
    it("应该在停止时清理所有资源", async () => {
      // 启动服务器
      await webServer.start();

      // 获取连接管理器
      const connectionManager = webServer.getXiaozhiConnectionManager();
      expect(connectionManager).toBeDefined();

      // 停止服务器
      await webServer.stop();

      // 验证清理被调用
      const mockImplementation = (IndependentXiaozhiConnectionManager as any)
        .mock.results[0].value;
      if (mockImplementation?.cleanup) {
        expect(mockImplementation.cleanup).toHaveBeenCalled();
      }
    });

    it("不应该清理 mock 连接管理器", async () => {
      const mockManager = {
        cleanup: vi.fn().mockResolvedValue(undefined),
      } as any;

      // 注入 mock 连接管理器
      webServer.setXiaozhiConnectionManager(mockManager);

      // 启动服务器
      await webServer.start();

      // 停止服务器
      await webServer.stop();

      // 验证 mock 管理器的 cleanup 未被调用
      expect(mockManager.cleanup).not.toHaveBeenCalled();
    });
  });
});
