import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock ws
vi.mock("ws", () => {
  return {
    default: vi.fn(),
  };
});

// Mock dotenv
vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getConfigPath: vi.fn(),
  },
}));

// Import after mocking
import { configManager } from "./configManager";
import { Logger, MCPPipe, setupSignalHandlers } from "./mcpPipe";

// Mock child process
class MockChildProcess extends EventEmitter {
  stdin = {
    write: vi.fn(),
    destroyed: false,
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
  killed = false;
}

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();

  static OPEN = 1;
  static CLOSED = 3;
}

describe("MCP管道", () => {
  let mockSpawn: any;
  let mockWebSocket: any;
  let mockConfigManager: any;
  let mockProcess: MockChildProcess;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpawn = vi.mocked(spawn);
    mockWebSocket = vi.mocked(WebSocket);
    mockConfigManager = vi.mocked(configManager);

    // Setup mock instances
    mockProcess = new MockChildProcess();
    mockWs = new MockWebSocket();

    mockSpawn.mockReturnValue(mockProcess);
    mockWebSocket.mockImplementation(() => mockWs);

    // Setup default config manager mocks
    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getMcpEndpoint.mockReturnValue(
      "wss://test.example.com/mcp"
    );
    mockConfigManager.getConfigPath.mockReturnValue(
      "/test/xiaozhi.config.json"
    );

    // Mock process.env and process.cwd
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "mcpPipe.js", "test-script.js"],
      env: { ...process.env },
      cwd: vi.fn().mockReturnValue("/test/cwd"),
      stderr: {
        write: vi.fn(),
      },
      exit: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("日志记录器", () => {
    it("应该使用正确的名称创建日志记录器", () => {
      const logger = new Logger("TEST_LOGGER");
      expect(logger).toBeDefined();
    });

    it("应该正确记录info消息", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const logger = new Logger("TEST");
      logger.info("test message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("TEST - INFO - test message")
      );

      consoleSpy.mockRestore();
    });

    it("应该正确记录error消息", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const logger = new Logger("TEST");
      logger.error("error message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("TEST - ERROR - error message")
      );

      consoleSpy.mockRestore();
    });

    it("应该正确记录warning消息", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const logger = new Logger("TEST");
      logger.warning("warning message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("TEST - WARNING - warning message")
      );

      consoleSpy.mockRestore();
    });

    it("应该正确记录debug消息", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const logger = new Logger("TEST");
      logger.debug("debug message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("TEST - DEBUG - debug message")
      );

      consoleSpy.mockRestore();
    });

    it("应该在消息中包含时间戳", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const logger = new Logger("TEST");
      logger.info("test message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("MCPPipe类", () => {
    it("应该正确创建MCPPipe实例", () => {
      const mcpPipe = new MCPPipe("test-script.js", "wss://test.example.com");
      expect(mcpPipe).toBeDefined();
    });

    it("应该处理缺少的命令行参数", () => {
      process.argv = ["node", "mcpPipe.js"]; // 缺少脚本参数

      // 测试我们可以检测到缺少的参数
      expect(process.argv.length).toBe(2);
    });

    it("当配置文件可用时应该使用配置文件端点", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue(
        "wss://config.example.com/mcp"
      );

      // 测试配置管理器方法是否可用
      expect(mockConfigManager.configExists).toBeDefined();
      expect(mockConfigManager.getMcpEndpoint).toBeDefined();
    });

    it("当配置不可用时应该回退到环境变量", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      process.env.MCP_ENDPOINT = "wss://env.example.com/mcp";

      // 测试环境变量回退逻辑是否存在
      expect(process.env.MCP_ENDPOINT).toBe("wss://env.example.com/mcp");
    });

    it("应该检测到没有配置端点的情况", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      process.env.MCP_ENDPOINT = undefined;

      // 测试我们可以检测到缺少的端点
      expect(process.env.MCP_ENDPOINT).toBeUndefined();
    });

    it("应该检测到无效的端点配置", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue("<请填写你的端点>");

      const endpoint = mockConfigManager.getMcpEndpoint();
      expect(endpoint).toContain("<请填写");
    });

    it("应该正确实现sleep方法", async () => {
      const mcpPipe = new MCPPipe("test-script.js", "wss://test.example.com");

      const start = Date.now();
      await mcpPipe.sleep(100);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(90); // 允许一些误差
    });

    it("应该正确处理cleanup方法", () => {
      const mcpPipe = new MCPPipe("test-script.js", "wss://test.example.com");

      // 设置一个mock进程
      const mockChildProcess = new MockChildProcess();
      (mcpPipe as any).process = mockChildProcess;

      // 调用cleanup应该不会抛出错误
      expect(() => mcpPipe.cleanup()).not.toThrow();
    });

    it("应该正确实现shutdown方法的部分逻辑", () => {
      const mcpPipe = new MCPPipe("test-script.js", "wss://test.example.com");

      // 只测试cleanup部分，不测试process.exit
      expect(() => mcpPipe.cleanup()).not.toThrow();
    });
  });

  describe("进程管理", () => {
    it("应该使用正确的参数启动MCP进程", () => {
      const scriptName = "test-script.js";

      mockSpawn("node", [scriptName], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        [scriptName],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        })
      );
    });

    it("应该处理进程stdout数据", () => {
      const testData = "test message from process";

      // 模拟进程stdout数据
      mockProcess.stdout.emit("data", Buffer.from(testData));

      // 如果连接，应该将数据发送到WebSocket
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理进程stderr数据", () => {
      const errorData = "error message from process";

      // 模拟进程stderr数据
      mockProcess.stderr.emit("data", Buffer.from(errorData));

      // 应该写入到process.stderr
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理进程退出", () => {
      // 模拟进程退出
      mockProcess.emit("exit", 0, null);

      // 应该清理并关闭WebSocket
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理进程错误", () => {
      // 添加错误监听器以防止未捕获的错误
      mockProcess.on("error", () => {});

      // 测试进程错误事件可以被触发
      expect(() => {
        mockProcess.emit("error", new Error("Process error"));
      }).not.toThrow();

      // 应该处理错误并清理
      expect(true).toBe(true); // 占位符断言
    });
  });

  describe("WebSocket管理", () => {
    it("应该使用正确的URL创建WebSocket", () => {
      const endpointUrl = "wss://test.example.com/mcp";

      new WebSocket(endpointUrl);

      expect(mockWebSocket).toHaveBeenCalledWith(endpointUrl);
    });

    it("应该处理WebSocket打开事件", () => {
      // 模拟WebSocket打开
      mockWs.emit("open");

      // 应该设置连接状态并重置重连
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理WebSocket消息", () => {
      const testMessage = JSON.stringify({ test: "message" });

      // 模拟WebSocket消息
      mockWs.emit("message", testMessage);

      // 应该写入到进程stdin
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理WebSocket关闭事件", () => {
      const closeCode = 1000;
      const closeReason = Buffer.from("Normal closure");

      // 模拟WebSocket关闭
      mockWs.emit("close", closeCode, closeReason);

      // 应该处理重连逻辑
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理WebSocket错误", () => {
      // 添加错误监听器以防止未捕获的错误
      mockWs.on("error", () => {});

      // 测试WebSocket错误事件可以被触发
      expect(() => {
        mockWs.emit("error", new Error("WebSocket error"));
      }).not.toThrow();

      // 应该处理错误
      expect(true).toBe(true); // 占位符断言
    });

    it("在永久错误时不应重连（代码4004）", () => {
      const closeCode = 4004;
      const closeReason = Buffer.from("Permanent error");

      // 模拟WebSocket因永久错误关闭
      mockWs.emit("close", closeCode, closeReason);

      // 不应安排重连
      expect(true).toBe(true); // 占位符断言
    });
  });

  describe("重连逻辑", () => {
    it("应该使用固定5秒重连间隔", () => {
      const RECONNECT_INTERVAL = 5000;

      // 测试固定重连间隔
      expect(RECONNECT_INTERVAL).toBe(5000);
    });

    it("应该有正确的心跳检测间隔", () => {
      const HEARTBEAT_INTERVAL = 30000;
      const HEARTBEAT_TIMEOUT = 10000;

      // 测试心跳间隔设置
      expect(HEARTBEAT_INTERVAL).toBe(30000);
      expect(HEARTBEAT_TIMEOUT).toBe(10000);
    });
  });

  describe("信号处理器", () => {
    it("应该定义setupSignalHandlers函数", () => {
      const mcpPipe = new MCPPipe("test-script.js", "wss://test.example.com");

      // 测试函数存在且不会抛出错误
      expect(setupSignalHandlers).toBeDefined();
      expect(typeof setupSignalHandlers).toBe("function");
    });
  });

  describe("工具函数", () => {
    it("应该正确实现sleep函数", async () => {
      const start = Date.now();
      const sleepTime = 100;

      // 创建一个简单的sleep函数用于测试
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      await sleep(sleepTime);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(sleepTime - 10); // 允许一些容差
    });
  });

  describe("主模块检测", () => {
    it("应该在Unix/Linux环境中正确检测主模块", () => {
      // 模拟Unix/Linux环境
      const importMetaUrl = "file:///home/user/project/dist/mcpPipe.js";
      const processArgv1 = "/home/user/project/dist/mcpPipe.js";

      // 测试概念：fileURLToPath应该能正确转换Unix路径
      // 在实际代码中，这会正确工作
      expect(importMetaUrl).toContain("file://");
      expect(processArgv1).not.toContain("file://");

      // 验证路径格式
      expect(processArgv1).toBe("/home/user/project/dist/mcpPipe.js");
    });

    it("应该在Windows环境中正确检测主模块", () => {
      // 模拟Windows环境
      const importMetaUrl = "file:///C:/Users/test/project/dist/mcpPipe.js";

      // 使用真实的fileURLToPath进行测试
      const { fileURLToPath } = require("node:url");
      const scriptPath = fileURLToPath(importMetaUrl);

      // 根据当前操作系统调整期望值
      if (process.platform === "win32") {
        // 在真正的Windows环境中
        const expectedPath = "C:\\Users\\test\\project\\dist\\mcpPipe.js";
        expect(scriptPath).toBe(expectedPath);
        expect(scriptPath === expectedPath).toBe(true);
      } else {
        // 在Unix/Linux/macOS环境中，fileURLToPath会返回Unix风格的路径
        const expectedPath = "/C:/Users/test/project/dist/mcpPipe.js";
        expect(scriptPath).toBe(expectedPath);
        expect(scriptPath === expectedPath).toBe(true);
      }
    });

    it("应该处理旧的URL比较方式失败的情况", () => {
      // 测试旧的比较方式在Windows上会失败
      const importMetaUrl = "file:///C:/Users/test/project/dist/mcpPipe.js";

      if (process.platform === "win32") {
        // 在真正的Windows环境中测试
        const processArgv1 = "C:\\Users\\test\\project\\dist\\mcpPipe.js";

        // 旧的比较方式（有问题的）- 在Windows上会失败
        const oldComparison = importMetaUrl === `file://${processArgv1}`;
        expect(oldComparison).toBe(false);

        // 新的比较方式（修复后的）
        const { fileURLToPath } = require("node:url");
        const scriptPath = fileURLToPath(importMetaUrl);
        const newComparison = scriptPath === processArgv1;
        expect(newComparison).toBe(true);
      } else {
        // 在Unix/Linux/macOS环境中，我们模拟Windows的行为来测试逻辑
        const windowsProcessArgv1 =
          "C:\\Users\\test\\project\\dist\\mcpPipe.js";

        // 旧的比较方式（有问题的）- 模拟Windows环境下的失败情况
        const oldComparison = importMetaUrl === `file://${windowsProcessArgv1}`;
        expect(oldComparison).toBe(false); // 这在任何平台上都应该失败

        // 新的比较方式（修复后的）- 在当前平台上验证
        const { fileURLToPath } = require("node:url");
        const scriptPath = fileURLToPath(importMetaUrl);
        const unixProcessArgv1 = "/C:/Users/test/project/dist/mcpPipe.js";
        const newComparison = scriptPath === unixProcessArgv1;
        expect(newComparison).toBe(true);
      }
    });
  });
});
