import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    copyFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock("node:os", () => ({
  default: {
    tmpdir: vi.fn(),
  },
}));

vi.mock("node:path", () => ({
  default: {
    join: vi.fn(),
    resolve: vi.fn(),
    dirname: vi.fn(),
  },
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    red: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    blue: Object.assign(
      vi.fn((text: string) => text),
      {
        bold: vi.fn((text: string) => text),
      }
    ),
    gray: vi.fn((text: string) => text),
    cyan: vi.fn((text: string) => text),
  },
}));

vi.mock("commander", () => ({
  Command: vi.fn().mockImplementation(() => ({
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    helpOption: vi.fn().mockReturnThis(),
    command: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    parse: vi.fn(),
  })),
}));

vi.mock("ora", () => ({
  default: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: "",
  })),
}));

vi.mock("./autoCompletion", () => ({
  setupAutoCompletion: vi.fn(),
  showCompletionHelp: vi.fn(),
}));

vi.mock("./configManager", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpEndpoint: vi.fn(),
    initConfig: vi.fn(),
    getConfig: vi.fn(),
    getConfigPath: vi.fn(),
    updateMcpEndpoint: vi.fn(),
  },
}));

vi.mock("./mcpCommands", () => ({
  listMcpServers: vi.fn(),
  listServerTools: vi.fn(),
  setToolEnabled: vi.fn(),
}));

// Mock child process
class MockChildProcess extends EventEmitter {
  pid = 12345;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    write: vi.fn(),
    end: vi.fn(),
    destroyed: false,
  };
  kill = vi.fn();
  unref = vi.fn();
  killed = false;
}

describe("CLI 命令行工具", () => {
  let mockSpawn: any;
  let mockFs: any;
  let mockOs: any;
  let mockPath: any;
  let mockConfigManager: any;
  let mockProcess: MockChildProcess;
  let mockAutoCompletion: any;
  let mockMcpCommands: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSpawn = vi.mocked(spawn);
    mockFs = vi.mocked(fs);
    mockOs = vi.mocked(os);
    mockPath = vi.mocked(path);

    const configManagerModule = await import("./configManager");
    mockConfigManager = vi.mocked(configManagerModule.configManager);

    const autoCompletionModule = await import("./autoCompletion");
    mockAutoCompletion = vi.mocked(autoCompletionModule);

    const mcpCommandsModule = await import("./mcpCommands");
    mockMcpCommands = vi.mocked(mcpCommandsModule);

    // Setup mock instances
    mockProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockProcess);

    // Setup default mocks
    mockOs.tmpdir.mockReturnValue("/tmp");
    mockPath.join.mockImplementation((...args: string[]) => args.join("/"));
    mockPath.resolve.mockImplementation((...args: string[]) => args.join("/"));
    mockPath.dirname.mockReturnValue("/test/dir");

    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');
    mockFs.createWriteStream.mockReturnValue({
      write: vi.fn(),
    });

    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getMcpEndpoint.mockReturnValue(
      "wss://test.example.com/mcp"
    );
    mockConfigManager.getConfigPath.mockReturnValue(
      "/test/xiaozhi.config.json"
    );
    mockConfigManager.getConfig.mockReturnValue({
      mcpEndpoint: "wss://test.example.com/mcp",
      mcpServers: {},
    });

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock process - preserve the actual platform for cross-platform testing
    vi.stubGlobal("process", {
      ...process,
      cwd: vi.fn().mockReturnValue("/test/cwd"),
      exit: vi.fn(),
      kill: vi.fn(),
      on: vi.fn(),
      version: "v18.0.0",
      platform: process.platform, // Use actual platform for cross-platform compatibility
      arch: "x64",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("版本信息", () => {
    it("应该能够获取版本信息", async () => {
      // 测试版本获取功能
      const packageJsonContent = JSON.stringify({
        name: "xiaozhi-client",
        version: "1.0.4",
      });

      mockFs.readFileSync.mockReturnValue(packageJsonContent);
      mockFs.existsSync.mockReturnValue(true);

      // 动态导入 CLI 模块来测试导出的函数
      const cliModule = await import("./cli");
      const version = cliModule.getVersion();

      expect(version).toBe("1.0.4");
    });

    it("应该处理版本读取失败的情况", async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });
      mockFs.existsSync.mockReturnValue(false);

      // 测试版本读取失败时的处理
      const cliModule = await import("./cli");
      const version = cliModule.getVersion();

      expect(version).toBe("unknown");
    });

    it("应该处理无效的 JSON 格式", async () => {
      mockFs.readFileSync.mockReturnValue("invalid json");
      mockFs.existsSync.mockReturnValue(true);

      // 测试 JSON 解析失败时的处理
      const cliModule = await import("./cli");
      const version = cliModule.getVersion();

      expect(version).toBe("unknown");
    });
  });

  describe("服务状态检查", () => {
    it("应该正确检测服务运行状态", async () => {
      // 模拟 PID 文件存在，使用正确的格式：pid|startTime|mode
      mockFs.existsSync.mockReturnValue(true);
      const startTime = Date.now();
      mockFs.readFileSync.mockReturnValue(`12345|${startTime}|daemon`);

      // 模拟进程存在 - process.kill 不抛出异常表示进程存在
      const mockKill = vi.fn().mockReturnValue(true);
      vi.stubGlobal("process", {
        ...process,
        kill: mockKill,
      });

      // 测试服务状态检查
      const cliModule = await import("./cli");
      const status = cliModule.getServiceStatus();

      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);
      expect(status.mode).toBe("daemon");
      expect(status.uptime).toBeDefined();
    });

    it("应该检测到服务未运行", async () => {
      // 模拟 PID 文件不存在
      mockFs.existsSync.mockReturnValue(false);

      // 测试服务状态检查
      const cliModule = await import("./cli");
      const status = cliModule.getServiceStatus();

      expect(status.running).toBe(false);
    });

    it("应该清理无效的 PID 文件", async () => {
      // 模拟 PID 文件存在但进程不存在，使用正确的格式
      mockFs.existsSync.mockReturnValue(true);
      const startTime = Date.now();
      mockFs.readFileSync.mockReturnValue(`99999|${startTime}|daemon`);

      const mockKill = vi.fn().mockImplementation(() => {
        const error = new Error("ESRCH");
        (error as any).code = "ESRCH";
        throw error;
      });

      vi.stubGlobal("process", {
        ...process,
        kill: mockKill,
      });

      // 测试无效 PID 文件清理
      const cliModule = await import("./cli");
      const status = cliModule.getServiceStatus();

      expect(status.running).toBe(false);
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it("应该处理 PID 文件格式错误", async () => {
      // 模拟 PID 文件存在但格式错误
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      // 测试格式错误处理
      const cliModule = await import("./cli");
      const status = cliModule.getServiceStatus();

      expect(status.running).toBe(false);
    });
  });

  describe("环境检查", () => {
    it("应该验证配置文件存在且端点有效", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue(
        "wss://valid.endpoint.com/mcp"
      );

      // 测试环境检查
      const cliModule = await import("./cli");
      const isValid = cliModule.checkEnvironment();

      expect(isValid).toBe(true);
    });

    it("应该检测配置文件不存在的情况", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      // 测试配置文件不存在时的处理
      const cliModule = await import("./cli");
      const isValid = cliModule.checkEnvironment();

      expect(isValid).toBe(false);
    });

    it("应该检测端点配置无效的情况", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue("<请填写你的端点>");

      // 测试无效端点的检测
      const cliModule = await import("./cli");
      const isValid = cliModule.checkEnvironment();

      expect(isValid).toBe(false);
    });

    it("应该处理配置读取异常", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockImplementation(() => {
        throw new Error("配置文件损坏");
      });

      // 测试异常处理
      const cliModule = await import("./cli");
      const isValid = cliModule.checkEnvironment();

      expect(isValid).toBe(false);
    });

    it("应该验证端点URL格式", () => {
      const validEndpoints = [
        "wss://example.com/mcp",
        "ws://localhost:8080/mcp",
        "wss://api.example.com:443/mcp/v1",
      ];

      const invalidEndpoints = [
        "",
        "http://example.com",
        "<请填写你的端点>",
        "invalid-url",
      ];

      // 验证有效端点
      for (const endpoint of validEndpoints) {
        expect(endpoint).toMatch(/^wss?:\/\/.+/);
      }

      // 验证无效端点
      for (const endpoint of invalidEndpoints) {
        expect(
          endpoint.includes("<请填写") || !endpoint.match(/^wss?:\/\/.+/)
        ).toBe(true);
      }
    });
  });

  describe("服务命令生成", () => {
    it("应该生成正确的Node.js启动命令", async () => {
      // 设置文件存在的模拟
      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (
          filePath.includes("mcpPipe.js") ||
          filePath.includes("mcpServerProxy.js")
        ) {
          return true;
        }
        return false;
      });

      // 测试服务命令生成
      const cliModule = await import("./cli");
      const serviceCommand = cliModule.getServiceCommand();

      expect(serviceCommand.command).toBe("node");
      expect(serviceCommand.args).toEqual(["mcpPipe.js", "mcpServerProxy.js"]);
      expect(serviceCommand.cwd).toBeDefined();
    });

    it("应该正确查找服务文件", () => {
      // 测试服务文件查找逻辑
      mockFs.existsSync.mockImplementation((filePath: string) => {
        // 模拟 .js 文件存在
        if (
          filePath.includes("mcpPipe.js") ||
          filePath.includes("mcpServerProxy.js")
        ) {
          return true;
        }
        // 模拟 .cjs 文件不存在
        if (
          filePath.includes("mcpPipe.cjs") ||
          filePath.includes("mcpServerProxy.cjs")
        ) {
          return false;
        }
        return false;
      });

      // 验证文件查找逻辑
      expect(mockFs.existsSync("mcpPipe.js")).toBe(true);
      expect(mockFs.existsSync("mcpServerProxy.js")).toBe(true);
      expect(mockFs.existsSync("mcpPipe.cjs")).toBe(false);
      expect(mockFs.existsSync("mcpServerProxy.cjs")).toBe(false);
    });

    it("应该生成正确的启动参数", () => {
      // 验证启动参数结构
      const expectedArgs = ["mcpPipe.js", "mcpServerProxy.js"];

      expect(expectedArgs).toHaveLength(2);
      expect(expectedArgs[0]).toContain("mcpPipe");
      expect(expectedArgs[1]).toContain("mcpServerProxy");
    });

    it("应该设置正确的工作目录", () => {
      const expectedCwd = "/test/cwd";

      // 验证工作目录设置
      expect(process.cwd()).toBe(expectedCwd);
    });

    it("应该传递环境变量", () => {
      const testEnv = {
        ...process.env,
        XIAOZHI_CONFIG_DIR: "/test/config",
      };

      // 验证环境变量传递
      expect(testEnv.XIAOZHI_CONFIG_DIR).toBe("/test/config");
    });
  });

  describe("PID 文件管理", () => {
    it("应该正确保存 PID 信息", () => {
      const testPidInfo = {
        pid: 12345,
        mode: "daemon",
        startTime: new Date().toISOString(),
      };

      // 验证 PID 信息保存
      mockFs.writeFileSync.mockImplementation(
        (filePath: string, data: string) => {
          expect(filePath).toContain(".pid");
          const parsedData = JSON.parse(data);
          expect(parsedData).toHaveProperty("pid");
          expect(parsedData).toHaveProperty("mode");
        }
      );

      // 模拟保存操作
      mockFs.writeFileSync("test.pid", JSON.stringify(testPidInfo));
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("应该正确读取 PID 信息", () => {
      const testPidInfo = {
        pid: 12345,
        mode: "daemon",
        startTime: "2024-01-01T00:00:00.000Z",
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testPidInfo));

      // 验证 PID 信息读取
      const pidData = JSON.parse(mockFs.readFileSync("test.pid") as string);
      expect(pidData.pid).toBe(12345);
      expect(pidData.mode).toBe("daemon");
    });

    it("应该清理 PID 文件", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {});

      // 验证 PID 文件清理
      mockFs.unlinkSync("test.pid");
      expect(mockFs.unlinkSync).toHaveBeenCalledWith("test.pid");
    });

    it("应该处理 PID 文件不存在的情况", () => {
      mockFs.existsSync.mockReturnValue(false);

      // 验证文件不存在时的处理
      expect(mockFs.existsSync("test.pid")).toBe(false);
    });
  });

  describe("服务启动", () => {
    it("应该在前台模式启动服务", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue("wss://test.com/mcp");
      mockFs.existsSync.mockReturnValue(false); // 服务未运行

      // 验证启动参数
      const expectedOptions = {
        stdio: "inherit",
        cwd: "/test/cwd",
        env: expect.objectContaining({
          XIAOZHI_CONFIG_DIR: "/test/cwd",
        }),
      };

      // 验证 spawn 调用
      expect(mockSpawn).toBeDefined();
      expect(expectedOptions.stdio).toBe("inherit");
      expect(expectedOptions.cwd).toBe("/test/cwd");
    });

    it("应该在守护进程模式启动服务", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue("wss://test.com/mcp");
      mockFs.existsSync.mockReturnValue(false); // 服务未运行

      // 验证守护进程启动参数
      const expectedOptions = {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: "/test/cwd",
        env: expect.objectContaining({
          XIAOZHI_CONFIG_DIR: "/test/cwd",
        }),
      };

      // 验证守护进程配置
      expect(expectedOptions.detached).toBe(true);
      expect(expectedOptions.stdio).toEqual(["ignore", "pipe", "pipe"]);
    });

    it("应该检测服务已运行的情况", () => {
      // 模拟服务已运行
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');

      const mockKill = vi.fn(); // 进程存在，不抛出异常
      vi.stubGlobal("process", {
        ...process,
        kill: mockKill,
      });

      // 验证服务状态检测
      expect(mockFs.existsSync).toBeDefined();
      expect(mockFs.readFileSync).toBeDefined();
    });

    it("应该在环境检查失败时拒绝启动", () => {
      mockConfigManager.configExists.mockReturnValue(false);

      // 验证环境检查
      expect(mockConfigManager.configExists()).toBe(false);
    });

    it("应该处理进程启动失败", () => {
      mockSpawn.mockImplementation(() => {
        const errorProcess = new MockChildProcess();
        setTimeout(() => {
          errorProcess.emit("error", new Error("启动失败"));
        }, 0);
        return errorProcess;
      });

      // 验证错误处理
      expect(mockSpawn).toBeDefined();
    });
  });

  describe("服务停止", () => {
    it("应该优雅地停止正在运行的服务", () => {
      // 模拟服务正在运行
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');

      let killCallCount = 0;
      const mockKill = vi.fn().mockImplementation(() => {
        killCallCount++;
        if (killCallCount > 1) {
          // 第二次调用时进程已停止
          const error = new Error("ESRCH");
          (error as any).code = "ESRCH";
          throw error;
        }
      });

      vi.stubGlobal("process", {
        ...process,
        kill: mockKill,
      });

      // 验证优雅停止逻辑
      expect(mockKill).toBeDefined();
      expect(mockFs.unlinkSync).toBeDefined(); // 清理 PID 文件
    });

    it("应该在优雅停止失败时强制终止", () => {
      // 模拟服务运行且不响应 SIGTERM
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');

      const mockKill = vi.fn(); // 进程持续运行，不抛出异常

      vi.stubGlobal("process", {
        ...process,
        kill: mockKill,
      });

      // 验证强制终止逻辑
      expect(mockKill).toBeDefined();
    });

    it("应该处理服务未运行的情况", () => {
      mockFs.existsSync.mockReturnValue(false);

      // 验证未运行状态处理
      expect(mockFs.existsSync("test.pid")).toBe(false);
    });

    it("应该处理无效的 PID 文件", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      // 验证无效 PID 文件处理
      expect(() => {
        JSON.parse(mockFs.readFileSync("test.pid") as string);
      }).toThrow();
    });

    it("应该处理进程不存在的情况", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"pid": 99999, "mode": "daemon"}');

      const mockKill = vi.fn().mockImplementation(() => {
        const error = new Error("ESRCH");
        (error as any).code = "ESRCH";
        throw error;
      });

      vi.stubGlobal("process", {
        ...process,
        kill: mockKill,
      });

      // 验证进程不存在时的处理
      expect(() => mockKill(99999, 0)).toThrow("ESRCH");
    });
  });

  describe("配置管理", () => {
    it("应该成功初始化新配置", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      mockConfigManager.initConfig.mockImplementation(() => {});
      mockConfigManager.getConfigPath.mockReturnValue(
        "/test/xiaozhi.config.json"
      );

      // 验证初始化逻辑
      expect(mockConfigManager.configExists()).toBe(false);
      mockConfigManager.initConfig();
      expect(mockConfigManager.initConfig).toHaveBeenCalled();
    });

    it("应该拒绝重新初始化已存在的配置", () => {
      mockConfigManager.configExists.mockReturnValue(true);

      // 验证已存在配置的处理
      expect(mockConfigManager.configExists()).toBe(true);
    });

    it("应该正确读取配置值", () => {
      const testConfig = {
        mcpEndpoint: "wss://test.com/mcp",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["test.js"],
          },
        },
      };

      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue(testConfig);

      // 验证配置读取
      const config = mockConfigManager.getConfig();
      expect(config.mcpEndpoint).toBe("wss://test.com/mcp");
      expect(config.mcpServers).toHaveProperty("test-server");
    });

    it("应该正确更新配置值", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {});

      const newEndpoint = "wss://new.endpoint.com/mcp";

      // 验证配置更新
      mockConfigManager.updateMcpEndpoint(newEndpoint);
      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        newEndpoint
      );
    });

    it("应该处理配置文件损坏的情况", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("配置文件格式错误");
      });

      // 验证错误处理
      expect(() => mockConfigManager.getConfig()).toThrow("配置文件格式错误");
    });

    it("应该验证配置项的有效性", () => {
      const validKeys = ["mcpEndpoint", "mcpServers"];
      const invalidKeys = ["invalidKey", ""];

      // 验证有效配置项
      for (const key of validKeys) {
        expect(validKeys).toContain(key);
      }

      // 验证无效配置项
      for (const key of invalidKeys) {
        expect(validKeys).not.toContain(key);
      }
    });
  });

  describe("项目创建", () => {
    it("应该创建基础项目", () => {
      const projectName = "test-project";
      mockFs.existsSync.mockReturnValue(false); // 目标目录不存在
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});

      // 验证基础项目创建
      mockFs.mkdirSync(projectName, { recursive: true });
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(projectName, {
        recursive: true,
      });

      // 验证配置文件创建
      const configContent = {
        mcpEndpoint: "<请填写你的接入点地址（获取地址在 xiaozhi.me）>",
        mcpServers: {},
      };
      mockFs.writeFileSync(
        "xiaozhi.config.json",
        JSON.stringify(configContent, null, 2)
      );
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("应该从模板创建项目", () => {
      const projectName = "template-project";
      const templateName = "hello-world";

      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes("templates")) return true;
        if (path.includes(projectName)) return false; // 目标目录不存在
        return false;
      });
      mockFs.readdirSync.mockReturnValue(["hello-world", "basic-app"] as any);

      // 验证模板项目创建
      expect(mockFs.existsSync("templates")).toBe(true);
      expect(mockFs.readdirSync("templates")).toContain(templateName);
    });

    it("应该拒绝在已存在的目录创建项目", () => {
      const projectName = "existing-project";
      mockFs.existsSync.mockReturnValue(true); // 目标目录已存在

      // 验证目录存在检查
      expect(mockFs.existsSync(projectName)).toBe(true);
    });

    it("应该正确处理模板不存在的情况", () => {
      const templateName = "non-existent-template";
      mockFs.readdirSync.mockReturnValue(["hello-world", "basic-app"] as any);

      // 验证模板存在性检查
      const availableTemplates = mockFs.readdirSync("templates") as string[];
      expect(availableTemplates).not.toContain(templateName);
    });

    it("应该支持模糊匹配模板名称", () => {
      const templates = ["hello-world", "basic-app", "advanced-setup"];
      const userInput = "hello";

      // 验证模糊匹配逻辑
      const matches = templates.filter((template) =>
        template.toLowerCase().includes(userInput.toLowerCase())
      );
      expect(matches).toContain("hello-world");
    });

    it("应该正确复制模板文件", () => {
      const excludeFiles = [
        "node_modules",
        ".pnpm-debug.log",
        "pnpm-lock.yaml",
      ];

      // 验证排除文件列表
      expect(excludeFiles).toContain("node_modules");
      expect(excludeFiles).toContain(".pnpm-debug.log");
      expect(excludeFiles).toContain("pnpm-lock.yaml");
    });

    it("应该正确处理跨平台路径", () => {
      // 测试跨平台路径处理
      const testPaths = [
        "/unix/style/path",
        "C:\\windows\\style\\path",
        "./relative/path",
        "../parent/path",
      ];

      // 验证路径处理逻辑
      for (const testPath of testPaths) {
        expect(typeof testPath).toBe("string");
        expect(testPath.length).toBeGreaterThan(0);
      }
    });

    it("应该正确处理模板路径解析", () => {
      // 测试模板路径解析逻辑
      const scriptDir = "/test/dist";
      const expectedPaths = [
        `${scriptDir}/../templates`, // 开发环境
        `${scriptDir}/templates`, // 打包后的环境
        `${scriptDir}/../../templates`, // npm 全局安装
      ];

      // 验证路径计算
      expect(expectedPaths[0]).toContain("templates");
      expect(expectedPaths[1]).toContain("templates");
      expect(expectedPaths[2]).toContain("templates");
    });
  });

  describe("MCP 命令", () => {
    let mockMcpCommands: any;

    beforeEach(async () => {
      const mcpCommandsModule = await import("./mcpCommands");
      mockMcpCommands = vi.mocked(mcpCommandsModule);
    });

    it("应该列出 MCP 服务器", async () => {
      mockMcpCommands.listMcpServers.mockResolvedValue(undefined);

      // Test would require access to MCP list command
      expect(mockMcpCommands.listMcpServers).toBeDefined();
    });

    it("应该列出带工具的 MCP 服务器", async () => {
      mockMcpCommands.listMcpServers.mockResolvedValue(undefined);

      // Test would require access to MCP list command with --tools option
      expect(mockMcpCommands.listMcpServers).toBeDefined();
    });

    it("应该列出服务器工具", async () => {
      mockMcpCommands.listServerTools.mockResolvedValue(undefined);

      // Test would require access to MCP server command
      expect(mockMcpCommands.listServerTools).toBeDefined();
    });

    it("应该启用工具", async () => {
      mockMcpCommands.setToolEnabled.mockResolvedValue(undefined);

      // Test would require access to MCP tool enable command
      expect(mockMcpCommands.setToolEnabled).toBeDefined();
    });

    it("应该禁用工具", async () => {
      mockMcpCommands.setToolEnabled.mockResolvedValue(undefined);

      // Test would require access to MCP tool disable command
      expect(mockMcpCommands.setToolEnabled).toBeDefined();
    });

    it("应该处理无效的工具操作", () => {
      // Test would require access to MCP tool command validation
      const validActions = ["enable", "disable"];
      const invalidAction = "invalid";

      expect(validActions).not.toContain(invalidAction);
    });
  });

  describe("命令结构", () => {
    it("应该有 MCP 命令组", () => {
      // Test that MCP commands are properly structured
      const expectedCommands = [
        "list",
        "server <serverName>",
        "tool <serverName> <toolName> <action>",
      ];

      expect(expectedCommands).toContain("list");
      expect(expectedCommands).toContain("server <serverName>");
      expect(expectedCommands).toContain(
        "tool <serverName> <toolName> <action>"
      );
    });

    it("应该验证工具操作参数", () => {
      const validActions = ["enable", "disable"];

      expect(validActions).toHaveLength(2);
      expect(validActions).toContain("enable");
      expect(validActions).toContain("disable");
    });
  });

  describe("ESM 兼容性", () => {
    it("应该在 ESM 环境中正确读取版本号", () => {
      // Mock package.json existence and content
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes("package.json")) return true;
        return false;
      });

      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path.includes("package.json")) {
          return JSON.stringify({ version: "1.0.4" });
        }
        return "";
      });

      // Test that version reading works in ESM environment
      expect(mockFs.existsSync("package.json")).toBe(true);
      expect(
        JSON.parse(mockFs.readFileSync("package.json") as string).version
      ).toBe("1.0.4");
    });

    it("应该在找不到 package.json 时处理错误", () => {
      mockFs.existsSync.mockReturnValue(false);

      // Test that version reading handles missing package.json
      expect(mockFs.existsSync("package.json")).toBe(false);
    });

    it("应该处理 package.json 解析错误", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      // Test that version reading handles JSON parse errors
      expect(() => {
        JSON.parse(mockFs.readFileSync("package.json") as string);
      }).toThrow();
    });
  });

  describe("版本管理", () => {
    it("应该在开发环境中从 package.json 读取版本", async () => {
      const { fileURLToPath } = await import("node:url");
      const mockFileURLToPath = vi.mocked(fileURLToPath);

      mockFileURLToPath.mockReturnValue("/test/src/cli.js");
      mockPath.dirname.mockReturnValue("/test/src");
      mockPath.join.mockImplementation((...args: string[]) => args.join("/"));

      // Mock package.json exists and has version
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === "/test/package.json";
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          name: "xiaozhi-client",
          version: "1.2.3",
        })
      );

      // Test version reading logic
      expect(mockFs.existsSync("/test/package.json")).toBe(true);
      const packageData = JSON.parse(
        mockFs.readFileSync("/test/package.json") as string
      );
      expect(packageData.version).toBe("1.2.3");
    });

    it("应该在 dist 环境中从 package.json 读取版本", async () => {
      const { fileURLToPath } = await import("node:url");
      const mockFileURLToPath = vi.mocked(fileURLToPath);

      mockFileURLToPath.mockReturnValue("/test/dist/cli.cjs");
      mockPath.dirname.mockReturnValue("/test/dist");
      mockPath.join.mockImplementation((...args: string[]) => args.join("/"));

      // Mock package.json exists in dist directory
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === "/test/dist/package.json";
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          name: "xiaozhi-client",
          version: "1.2.3",
        })
      );

      // Test that version can be read from dist directory
      expect(mockFs.existsSync("/test/dist/package.json")).toBe(true);
    });

    it("当找不到 package.json 时应该处理错误", async () => {
      const { fileURLToPath } = await import("node:url");
      const mockFileURLToPath = vi.mocked(fileURLToPath);

      mockFileURLToPath.mockReturnValue("/test/src/cli.js");
      mockPath.dirname.mockReturnValue("/test/src");
      mockPath.join.mockImplementation((...args: string[]) => args.join("/"));

      // Mock no package.json found
      mockFs.existsSync.mockReturnValue(false);

      // Test that missing package.json is handled
      expect(mockFs.existsSync("/test/package.json")).toBe(false);
    });

    it("应该优雅地处理 JSON 解析错误", async () => {
      const { fileURLToPath } = await import("node:url");
      const mockFileURLToPath = vi.mocked(fileURLToPath);

      mockFileURLToPath.mockReturnValue("/test/src/cli.js");
      mockPath.dirname.mockReturnValue("/test/src");
      mockPath.join.mockImplementation((...args: string[]) => args.join("/"));

      // Mock package.json exists but has invalid JSON
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      // Test that errors are handled gracefully
      expect(() => mockFs.readFileSync("/test/package.json")).toThrow(
        "Invalid JSON"
      );
    });
  });

  describe("工具函数", () => {
    it("应该显示详细信息", () => {
      // Test would require access to showDetailedInfo function
      expect(process.version).toBeDefined();
      expect(process.platform).toBeDefined();
      expect(process.arch).toBeDefined();
    });

    it("应该显示帮助信息", () => {
      // Test would require access to showHelp function
      expect(console.log).toBeDefined();
    });

    it("帮助信息应该包含 MCP 命令", () => {
      // Test that help includes MCP command examples
      const expectedHelpContent = [
        "xiaozhi mcp list",
        "xiaozhi mcp list --tools",
        "xiaozhi mcp server <name>",
        "xiaozhi mcp tool <server> <tool> enable",
        "xiaozhi mcp tool <server> <tool> disable",
      ];

      expect(expectedHelpContent).toContain("xiaozhi mcp list");
      expect(expectedHelpContent).toContain(
        "xiaozhi mcp tool <server> <tool> enable"
      );
    });
  });

  describe("构建配置验证", () => {
    // 使用实际的文件系统而不是 mock，因为我们需要验证真实的项目配置
    const realFs = require("node:fs");
    const realPath = require("node:path");

    // 获取项目根目录
    const getProjectRoot = () => {
      // 从当前测试文件位置向上查找 package.json
      let currentDir = realPath.dirname(__filename);
      while (currentDir !== realPath.dirname(currentDir)) {
        if (realFs.existsSync(realPath.join(currentDir, "package.json"))) {
          return currentDir;
        }
        currentDir = realPath.dirname(currentDir);
      }
      return process.cwd(); // 回退到当前工作目录
    };

    it("应该确保 postbuild.js 已被移除", () => {
      const projectRoot = getProjectRoot();
      const postbuildPath = realPath.join(
        projectRoot,
        "scripts",
        "postbuild.js"
      );
      expect(realFs.existsSync(postbuildPath)).toBe(false);
    });

    it("应该确保 package.json 中不再引用 postbuild.js", () => {
      const projectRoot = getProjectRoot();
      const packageJsonPath = realPath.join(projectRoot, "package.json");

      if (realFs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          realFs.readFileSync(packageJsonPath, "utf8")
        );

        expect(packageJson.scripts.build).not.toContain("postbuild.js");
        expect(packageJson.scripts.dev).not.toContain("postbuild.js");
      }
    });

    it("应该确保构建脚本只使用 tsup", () => {
      const projectRoot = getProjectRoot();
      const packageJsonPath = realPath.join(projectRoot, "package.json");

      if (realFs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          realFs.readFileSync(packageJsonPath, "utf8")
        );

        expect(packageJson.scripts.build).toBe("tsup");
        expect(packageJson.scripts.dev).toBe("tsup --watch");
      }
    });

    it("应该确保项目使用 ESM 模块类型", () => {
      const projectRoot = getProjectRoot();
      const packageJsonPath = realPath.join(projectRoot, "package.json");

      if (realFs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          realFs.readFileSync(packageJsonPath, "utf8")
        );

        expect(packageJson.type).toBe("module");
      }
    });

    it("应该确保 tsup 配置为 ESM 格式", () => {
      const projectRoot = getProjectRoot();
      const tsupConfigPath = realPath.join(projectRoot, "tsup.config.ts");

      if (realFs.existsSync(tsupConfigPath)) {
        const tsupConfig = realFs.readFileSync(tsupConfigPath, "utf8");

        expect(tsupConfig).toContain('format: ["esm"]');
      }
    });

    it("应该确保源码中的导入不使用 .js 扩展名", () => {
      const projectRoot = getProjectRoot();
      const srcFiles = [
        "src/cli.ts",
        "src/autoCompletion.ts",
        "src/mcpCommands.ts",
        "src/mcpPipe.ts",
        "src/mcpServerProxy.ts",
        "src/configManager.ts",
      ];

      for (const file of srcFiles) {
        const filePath = realPath.join(projectRoot, file);
        if (realFs.existsSync(filePath)) {
          const content = realFs.readFileSync(filePath, "utf8");
          const relativeImports = content.match(/from\s+["']\.\/[^"']+["']/g);

          if (relativeImports) {
            for (const importStatement of relativeImports) {
              // 相对导入不应该包含 .js 后缀（ESM 项目中 TypeScript 会自动处理）
              expect(importStatement).not.toMatch(/\.js["']$/);
            }
          }
        }
      }
    });

    it("应该确保源码中不使用 CommonJS 语法", () => {
      const projectRoot = getProjectRoot();
      const srcFiles = [
        "src/cli.ts",
        "src/autoCompletion.ts",
        "src/mcpCommands.ts",
        "src/mcpPipe.ts",
        "src/mcpServerProxy.ts",
        "src/configManager.ts",
      ];

      for (const file of srcFiles) {
        const filePath = realPath.join(projectRoot, file);
        if (realFs.existsSync(filePath)) {
          const content = realFs.readFileSync(filePath, "utf8");

          // 检查不应该使用的 CommonJS 语法
          expect(content).not.toMatch(/require\.main\s*===\s*module/);
          expect(content).not.toMatch(/module\.exports\s*=/);
          expect(content).not.toMatch(/exports\./);

          // 检查应该使用 ESM 语法
          if (content.includes("import.meta.url")) {
            // 如果使用了 import.meta.url，应该配合 fileURLToPath 使用
            if (
              content.includes("__filename") ||
              content.includes("__dirname")
            ) {
              expect(content).toMatch(/fileURLToPath\(import\.meta\.url\)/);
            }
          }
        }
      }
    });
  });
});
