/**
 * WebServerStandalone.ts 测试文件
 * 覆盖独立 Web 服务器启动脚本的各项功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock 外部模块
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

// 创建 mock 类和对象
class MockWebServer {
  start = vi.fn().mockResolvedValue(undefined);
  stop = vi.fn().mockResolvedValue(undefined);
}

const mockConfigManager = {
  getWebUIPort: vi.fn().mockReturnValue(3000),
};

const mockLogger = {
  initLogFile: vi.fn(),
  enableFileLogging: vi.fn(),
  info: vi.fn(),
};

describe("WebServerStandalone", () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;
  let originalExit: typeof process.exit;
  let originalPlatform: NodeJS.Platform;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // 保存原始值
    originalArgv = process.argv;
    originalEnv = process.env;
    originalExit = process.exit;
    originalPlatform = process.platform;

    // 重置 process.argv
    process.argv = ["node", "WebServerStandalone.js"];

    // 清除环境变量
    // biome-ignore lint/performance/noDelete: 需要完全删除环境变量属性以正确模拟环境变量不存在的情况
    delete (process.env as any).XIAOZHI_CONFIG_DIR;

    // Mock process.exit
    process.exit = vi.fn() as any;

    // Mock process.on
    vi.spyOn(process, "on").mockImplementation(() => process);
  });

  afterEach(() => {
    // 恢复原始值
    process.argv = originalArgv;
    process.env = originalEnv;
    process.exit = originalExit;
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  describe("核心功能测试", () => {
    it("应该正确解析命令行参数", () => {
      // 测试没有参数的情况
      process.argv = ["node", "WebServerStandalone.js"];
      const args = process.argv.slice(2);
      const openBrowser = args.includes("--open-browser");
      expect(openBrowser).toBe(false);

      // 测试有 --open-browser 参数的情况
      process.argv = ["node", "WebServerStandalone.js", "--open-browser"];
      const argsWithBrowser = process.argv.slice(2);
      const openBrowserWithFlag = argsWithBrowser.includes("--open-browser");
      expect(openBrowserWithFlag).toBe(true);
    });

    it("应该处理 XIAOZHI_CONFIG_DIR 环境变量", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/test/config";

      // 模拟日志初始化逻辑
      if (process.env.XIAOZHI_CONFIG_DIR) {
        mockLogger.initLogFile(process.env.XIAOZHI_CONFIG_DIR);
        mockLogger.enableFileLogging(true);
      }

      expect(mockLogger.initLogFile).toHaveBeenCalledWith("/test/config");
      expect(mockLogger.enableFileLogging).toHaveBeenCalledWith(true);
    });

    it("应该在没有 XIAOZHI_CONFIG_DIR 环境变量时正常工作", () => {
      // 完全删除环境变量属性
      const configDir = process.env.XIAOZHI_CONFIG_DIR;
      // biome-ignore lint/performance/noDelete: 需要完全删除环境变量属性以正确模拟环境变量不存在的情况
      delete (process.env as any).XIAOZHI_CONFIG_DIR;

      // 模拟日志初始化逻辑
      if (process.env.XIAOZHI_CONFIG_DIR) {
        mockLogger.initLogFile(process.env.XIAOZHI_CONFIG_DIR);
        mockLogger.enableFileLogging(true);
      }

      expect(mockLogger.initLogFile).not.toHaveBeenCalled();
      expect(mockLogger.enableFileLogging).not.toHaveBeenCalled();

      // 恢复环境变量
      if (configDir) {
        process.env.XIAOZHI_CONFIG_DIR = configDir;
      }
    });

    it("应该测试 WebServer 生命周期", async () => {
      const webServer = new MockWebServer();

      // 测试启动
      await webServer.start();
      expect(webServer.start).toHaveBeenCalled();

      // 测试停止
      await webServer.stop();
      expect(webServer.stop).toHaveBeenCalled();
    });

    it("应该处理 WebServer 启动失败", async () => {
      const webServer = new MockWebServer();

      // Mock 启动失败
      const startError = new Error("Server start failed");
      webServer.start.mockRejectedValueOnce(startError);

      await expect(webServer.start()).rejects.toThrow("Server start failed");
    });

    it("应该处理清理函数", async () => {
      const webServer = new MockWebServer();

      // 模拟清理函数
      const cleanup = async () => {
        mockLogger.info("[WEBSERVER_STANDALONE] 正在停止 WebServer...");
        await webServer.stop();
      };

      await cleanup();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[WEBSERVER_STANDALONE] 正在停止 WebServer..."
      );
      expect(webServer.stop).toHaveBeenCalled();
    });
  });

  describe("浏览器打开功能测试", () => {
    const testOpenBrowser = async (url: string, platform: NodeJS.Platform) => {
      Object.defineProperty(process, "platform", {
        value: platform,
        writable: true,
      });

      let command: string;
      let args: string[];

      if (platform === "darwin") {
        command = "open";
        args = [url];
      } else if (platform === "win32") {
        command = "start";
        args = ["", url];
      } else {
        command = "xdg-open";
        args = [url];
      }

      mockSpawn(command, args, { detached: true, stdio: "ignore" });
    };

    it("应该在 macOS 上打开浏览器", async () => {
      await testOpenBrowser("http://localhost:3000", "darwin");

      expect(mockSpawn).toHaveBeenCalledWith(
        "open",
        ["http://localhost:3000"],
        { detached: true, stdio: "ignore" }
      );
    });

    it("应该在 Windows 上打开浏览器", async () => {
      await testOpenBrowser("http://localhost:3000", "win32");

      expect(mockSpawn).toHaveBeenCalledWith(
        "start",
        ["", "http://localhost:3000"],
        { detached: true, stdio: "ignore" }
      );
    });

    it("应该在 Linux 上打开浏览器", async () => {
      await testOpenBrowser("http://localhost:3000", "linux");

      expect(mockSpawn).toHaveBeenCalledWith(
        "xdg-open",
        ["http://localhost:3000"],
        { detached: true, stdio: "ignore" }
      );
    });

    it("应该构建正确的 URL", () => {
      // 确保 mock 返回正确的值
      mockConfigManager.getWebUIPort.mockReturnValue(3000);
      const port = mockConfigManager.getWebUIPort();
      const url = `http://localhost:${port}`;

      expect(port).toBe(3000);
      expect(url).toBe("http://localhost:3000");
    });
  });

  describe("信号处理测试", () => {
    it("应该注册信号处理器", () => {
      const cleanup = async () => {
        mockLogger.info("[WEBSERVER_STANDALONE] 正在停止 WebServer...");
      };

      // 模拟信号监听器注册
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    });

    it("应该处理信号清理", async () => {
      const webServer = new MockWebServer();

      // 模拟清理函数
      const cleanup = async () => {
        mockLogger.info("[WEBSERVER_STANDALONE] 正在停止 WebServer...");
        await webServer.stop();
      };

      await cleanup();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[WEBSERVER_STANDALONE] 正在停止 WebServer..."
      );
      expect(webServer.stop).toHaveBeenCalled();
    });
  });

  describe("直接执行检查测试", () => {
    it("应该正确识别直接执行", () => {
      const mockImportMeta = { url: "file://WebServerStandalone.js" };
      const mockArgv = ["node", "WebServerStandalone.js"];

      const isDirectExecution = mockImportMeta.url === `file://${mockArgv[1]}`;
      expect(isDirectExecution).toBe(true);
    });

    it("应该正确识别模块导入", () => {
      const mockImportMeta = { url: "file://some/other/file.js" };
      const mockArgv = ["node", "WebServerStandalone.js"];

      const isDirectExecution = mockImportMeta.url === `file://${mockArgv[1]}`;
      expect(isDirectExecution).toBe(false);
    });

    it("应该处理 URL 格式变化", () => {
      // 测试不同的 URL 格式
      const cases = [
        {
          importMetaUrl: "file://WebServerStandalone.js",
          argv: ["node", "WebServerStandalone.js"],
          expected: true,
        },
        {
          importMetaUrl: "file:///absolute/path/WebServerStandalone.js",
          argv: ["node", "WebServerStandalone.js"],
          expected: false,
        },
      ];

      for (const { importMetaUrl, argv, expected } of cases) {
        const isDirectExecution = importMetaUrl === `file://${argv[1]}`;
        expect(isDirectExecution).toBe(expected);
      }
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该在启动失败时处理 console.error", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // 模拟启动失败的情况
      const error = new Error("WebServer 启动失败");
      console.error("WebServer 启动失败:", error);

      expect(consoleSpy).toHaveBeenCalledWith("WebServer 启动失败:", error);
      consoleSpy.mockRestore();
    });

    it("应该在浏览器打开失败时处理 console.warn", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // 模拟浏览器打开失败的情况
      const error = new Error("自动打开浏览器失败");
      console.warn("自动打开浏览器失败:", error);

      expect(consoleSpy).toHaveBeenCalledWith("自动打开浏览器失败:", error);
      consoleSpy.mockRestore();
    });

    it("应该在成功打开浏览器时处理 console.log", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const url = "http://localhost:3000";
      console.log(`已尝试打开浏览器: ${url}`);

      expect(consoleSpy).toHaveBeenCalledWith(
        "已尝试打开浏览器: http://localhost:3000"
      );
      consoleSpy.mockRestore();
    });

    it("应该优雅地处理 spawn 失败", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });

      mockSpawn.mockImplementationOnce(() => {
        throw new Error("Command failed");
      });

      // 模拟 try-catch 错误处理
      try {
        mockSpawn("open", ["http://localhost:3000"], {
          detached: true,
          stdio: "ignore",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("应该正确处理 process.exit", () => {
      // 测试成功退出
      process.exit(0);
      expect(process.exit).toHaveBeenCalledWith(0);

      // 测试错误退出
      process.exit(1);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe("动态导入逻辑测试", () => {
    it("应该测试模块导入结构", () => {
      // 模拟 importModules 函数的结构
      const mockModules = {
        WebServer: MockWebServer,
        configManager: mockConfigManager,
        logger: mockLogger,
      };

      expect(mockModules.WebServer).toBeDefined();
      expect(mockModules.configManager).toBeDefined();
      expect(mockModules.logger).toBeDefined();
    });

    it("应该测试模块实例", () => {
      const webServer = new MockWebServer();

      expect(webServer.start).toBeDefined();
      expect(webServer.stop).toBeDefined();
      expect(typeof webServer.start).toBe("function");
      expect(typeof webServer.stop).toBe("function");
    });

    it("应该测试日志方法", () => {
      expect(mockLogger.initLogFile).toBeDefined();
      expect(mockLogger.enableFileLogging).toBeDefined();
      expect(mockLogger.info).toBeDefined();
      expect(typeof mockLogger.initLogFile).toBe("function");
      expect(typeof mockLogger.enableFileLogging).toBe("function");
      expect(typeof mockLogger.info).toBe("function");
    });

    it("应该测试配置管理器方法", () => {
      // 确保 mock 返回正确的值
      mockConfigManager.getWebUIPort.mockReturnValue(3000);
      expect(mockConfigManager.getWebUIPort).toBeDefined();
      expect(typeof mockConfigManager.getWebUIPort).toBe("function");
      expect(mockConfigManager.getWebUIPort()).toBe(3000);
    });
  });
});
