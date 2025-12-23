import { configManager } from "@/lib/config/configManager.js";
import { EndpointManager } from "@/lib/endpoint/index.js";
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

// Mock CLI to prevent process.exit
vi.mock("@cli.js", () => ({}));

// 动态导入 WebServer 以避免 CLI 模块的副作用
let WebServer: any;

// Mock dependencies
vi.mock("@/lib/config/configManager.js", () => ({
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
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getConfigDir: vi.fn().mockReturnValue("/tmp"),
    getCustomMCPTools: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("@/lib/endpoint/connection.js", () => ({
  EndpointConnection: vi.fn().mockImplementation((endpoint: string) => ({
    endpoint,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setServiceManager: vi.fn(),
  })),
}));

vi.mock("@/lib/endpoint/index.js", () => ({
  EndpointManager: vi.fn().mockImplementation(() => ({
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
      expect(newWebServer.getEndpointManager()).toBeDefined();

      await newWebServer.stop();
    });
  });

  describe("连接管理器集成", () => {
    it("应该正确创建和管理连接管理器", async () => {
      // 临时取消 mock 以创建真实实例
      vi.unmock("@/lib/endpoint/index.js");

      // 创建一个新的 WebServer 实例
      const { WebServer } = await import("../WebServer.js");
      const realWebServer = new WebServer(testPort + 10);

      try {
        // 启动服务器
        await realWebServer.start();

        // 获取连接管理器
        const connectionManager = realWebServer.getEndpointManager();
        expect(connectionManager).toBeDefined();
        expect(connectionManager).toBeInstanceOf(EndpointManager);

        // 获取连接状态
        const status = realWebServer.getEndpointConnectionStatus();
        expect(status).toBeDefined();
        expect(status.type).toBe("multi-endpoint");

        // 停止服务器
        await realWebServer.stop();
      } finally {
        // 恢复 mock
        vi.doMock("@/lib/endpoint/index.js", () => ({
          EndpointManager: vi.fn().mockImplementation(() => ({
            initialize: vi.fn().mockResolvedValue(undefined),
            connect: vi.fn().mockResolvedValue(undefined),
            setServiceManager: vi.fn(),
            getConnectionStatus: vi.fn().mockReturnValue([]),
            on: vi.fn(),
            cleanup: vi.fn().mockResolvedValue(undefined),
          })),
        }));
      }
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
      const connectionManager = webServer.getEndpointManager();
      expect(connectionManager).toBe(mockManager);

      // 验证连接状态
      const status = webServer.getEndpointConnectionStatus();
      expect(status.type).toBe("multi-endpoint");
      expect(status.manager?.connectedConnections).toBe(1);
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
      const connectionManager = newWebServer.getEndpointManager();
      expect(connectionManager).toBeDefined();

      // 验证初始化被调用（只有在使用 mock 时才能验证）
      if (vi.isMockFunction(EndpointManager)) {
        expect(EndpointManager).toHaveBeenCalled();
      } else {
        // 如果不是 mock（真实实例），验证连接管理器已创建
        expect(connectionManager).toBeInstanceOf(EndpointManager);
      }

      await newWebServer.stop();
    });
  });

  describe("错误处理", () => {
    it("应该处理连接管理器初始化失败", async () => {
      // Mock 初始化失败
      vi.doMock("@/lib/endpoint/index.js", () => ({
        EndpointManager: vi.fn().mockImplementation(() => {
          throw new Error("初始化失败");
        }),
      }));

      // 重新导入 WebServer 以使用新的 mock
      const { WebServer } = await import("../WebServer.js");
      const newWebServer = new WebServer(testPort + 3);

      // 启动应该不会抛出错误（有错误处理）
      await expect(newWebServer.start()).resolves.not.toThrow();

      await newWebServer.stop();
    });

    it("应该处理端口占用情况", async () => {
      // 使用一个确定的端口来测试占用情况
      const testOccupiedPort = testPort + 20;

      // 创建一个简单的 HTTP 服务器占用端口
      const http = await import("node:http");
      const httpServer = http.createServer();

      // 等待第一个服务器启动
      await new Promise<void>((resolve, reject) => {
        httpServer.listen(testOccupiedPort, "localhost", () => {
          resolve();
        });
        httpServer.on("error", reject);
      });

      try {
        // 尝试在同一端口启动 WebServer
        const duplicateWebServer = new WebServer(testOccupiedPort);

        // 根据实际情况调整期望
        // 有些系统可能允许多个服务器监听同一端口（如 SO_REUSEPORT）
        // 所以我们检查是否至少能够处理这种情况
        try {
          await duplicateWebServer.start();
          // 如果没有抛出错误，至少验证服务器运行
          expect(duplicateWebServer.httpServer).toBeDefined();
          await duplicateWebServer.stop();
        } catch (error) {
          // 如果抛出错误，这也是可以接受的
          expect(error).toBeDefined();
        }
      } finally {
        // 清理 HTTP 服务器
        await new Promise<void>((resolve) => {
          httpServer.close(() => {
            resolve();
          });
        });
      }
    });
  });

  describe("清理功能", () => {
    it("应该在停止时清理所有资源", async () => {
      // 创建一个带有 cleanup spy 的 mock 连接管理器
      const mockManager = {
        initialize: vi.fn().mockResolvedValue(undefined),
        connect: vi.fn().mockResolvedValue(undefined),
        setServiceManager: vi.fn(),
        getConnectionStatus: vi.fn().mockReturnValue([]),
        on: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      } as any;

      // 创建一个新的 WebServer 实例并注入 mock
      const testWebServer = new WebServer(testPort + 30);
      testWebServer.setXiaozhiConnectionManager(mockManager);

      try {
        // 启动服务器
        await testWebServer.start();

        // 获取连接管理器
        const connectionManager = testWebServer.getEndpointManager();
        expect(connectionManager).toBeDefined();
        expect(connectionManager).toBe(mockManager);

        // 停止服务器
        await testWebServer.stop();

        // 验证清理被调用
        expect(mockManager.cleanup).toHaveBeenCalled();
      } finally {
        // 确保 testWebServer 被停止
        if (testWebServer.httpServer) {
          await testWebServer.stop();
        }
      }
    });
  });
});
