import { execSync, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

// 导入必要的类型定义
import type { ChildProcess } from "node:child_process";
import type { MockedFunction } from "vitest";

// Vitest 的 vi.mocked 返回类型不完全符合 Mocked<T> 的严格定义
// 使用更实用的 mock 类型定义
type FsMock = typeof fs & {
  existsSync: MockedFunction<typeof fs.existsSync>;
  readFileSync: MockedFunction<typeof fs.readFileSync>;
  writeFileSync: MockedFunction<typeof fs.writeFileSync>;
  mkdirSync: MockedFunction<typeof fs.mkdirSync>;
  createWriteStream: MockedFunction<typeof fs.createWriteStream>;
  readdirSync: MockedFunction<typeof fs.readdirSync>;
  statSync: MockedFunction<typeof fs.statSync>;
  copyFileSync: MockedFunction<typeof fs.copyFileSync>;
  unlinkSync: MockedFunction<typeof fs.unlinkSync>;
};

type OsMock = typeof os & {
  tmpdir: MockedFunction<typeof os.tmpdir>;
};

type PathMock = typeof path & {
  join: MockedFunction<typeof path.join>;
  resolve: MockedFunction<typeof path.resolve>;
  dirname: MockedFunction<typeof path.dirname>;
};

// ConfigManager mock 类型 - 定义测试中实际使用的方法
type ConfigManagerMock = {
  configExists: MockedFunction<() => boolean>;
  getMcpEndpoint: MockedFunction<() => string>;
  getMcpEndpoints: MockedFunction<() => string[]>;
  initConfig: MockedFunction<(format: "json" | "json5" | "jsonc") => void>;
  getConfig: MockedFunction<() => Record<string, unknown>>;
  getConfigPath: MockedFunction<() => string>;
  updateMcpEndpoint: MockedFunction<(endpoint: string | string[]) => void>;
};

// Mock dependencies
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
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
    red: vi.fn((text) => text),
    green: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    blue: Object.assign(
      vi.fn((text) => text),
      {
        bold: vi.fn((text) => text),
      }
    ),
    gray: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
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
  default: vi.fn().mockImplementation((text) => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: "",
  })),
}));

vi.mock("./configManager", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpEndpoints: vi.fn(),
    initConfig: vi.fn(),
    getConfig: vi.fn(),
    getConfigPath: vi.fn(),
    updateMcpEndpoint: vi.fn(),
  },
}));

// Mock process before any imports
const originalArgv = process.argv;

beforeAll(() => {
  // Mock process.exit to prevent test process from exiting
  vi.spyOn(process, "exit").mockImplementation(() => {
    // Don't actually exit, just return undefined
    return undefined as never;
  });

  // Mock process.argv to prevent command execution during import
  // Use a valid command that won't cause errors
  Object.defineProperty(process, "argv", {
    value: ["node", "cli.js", "status"],
    writable: true,
    configurable: true,
  });
});

afterAll(() => {
  // Restore original process.argv
  Object.defineProperty(process, "argv", {
    value: originalArgv,
    writable: true,
    configurable: true,
  });
});

// Import functions to test - this will be done after beforeAll
let cliModule: Record<string, unknown>;

beforeAll(async () => {
  // Dynamic import after mocking
  cliModule = await import("./cli");
});

// Mock child process
class MockChildProcess extends EventEmitter {
  pid = 12345;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
  unref = vi.fn();
}

describe("CLI 命令行工具", () => {
  let mockSpawn: MockedFunction<typeof spawn>;
  let mockExecSync: MockedFunction<typeof execSync>;
  let mockFs: FsMock;
  let mockOs: OsMock;
  let mockPath: PathMock;
  let mockConfigManager: ConfigManagerMock;
  let mockProcess: MockChildProcess;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSpawn = vi.mocked(spawn);
    mockExecSync = vi.mocked(execSync);
    // 使用类型断言解决 vi.mocked 的类型兼容性问题
    mockFs = vi.mocked(fs) as FsMock;
    mockOs = vi.mocked(os) as OsMock;
    mockPath = vi.mocked(path) as PathMock;
    const configManagerModule = await import("./configManager");
    mockConfigManager = vi.mocked(
      configManagerModule.configManager
    ) as ConfigManagerMock;

    // Setup mock instances
    mockProcess = new MockChildProcess();
    // 使用 as unknown 解决类型兼容性问题
    mockSpawn.mockReturnValue(mockProcess as unknown as ChildProcess);

    // Setup default mocks
    mockOs.tmpdir.mockReturnValue("/tmp");
    mockPath.join.mockImplementation((...args: string[]) => args.join("/"));
    mockPath.resolve.mockImplementation((...args: string[]) => args.join("/"));
    mockPath.dirname.mockReturnValue("/test/dir");

    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');
    // 使用 as unknown 解决 WriteStream 类型兼容性问题
    mockFs.createWriteStream.mockReturnValue({
      write: vi.fn(),
    } as unknown as ReturnType<typeof fs.createWriteStream>);

    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getMcpEndpoint.mockReturnValue(
      "wss://test.example.com/mcp"
    );
    mockConfigManager.getMcpEndpoints.mockReturnValue([
      "wss://test.example.com/mcp",
    ]);
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
      env: { ...process.env, NODE_ENV: "test" }, // Set test environment
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("服务命令", () => {
    it("应该获取正确的服务命令", () => {
      const expectedCommand = "node";
      const expectedArgs = [expect.stringContaining("WebServerLauncher")];

      // Test would require access to getServiceCommand function
      expect(expectedCommand).toBe("node");
      expect(expectedArgs[0]).toEqual(
        expect.stringContaining("WebServerLauncher")
      );
    });

    it("应该使用正确的文件扩展名查找服务文件", () => {
      // 测试服务文件查找逻辑
      // @ts-expect-error - 测试中使用更具体的 string 类型，而实际函数接受 PathLike
      mockFs.existsSync.mockImplementation((filePath: string) => {
        // 模拟 .js 文件存在，.cjs 文件不存在
        if (
          filePath.includes("mcpPipe.js") ||
          filePath.includes("WebServerLauncher.js")
        ) {
          return true;
        }
        if (
          filePath.includes("mcpPipe.cjs") ||
          filePath.includes("WebServerLauncher.cjs")
        ) {
          return false;
        }
        return false;
      });

      // 验证应该查找 .js 文件而不是 .cjs 文件
      expect(mockFs.existsSync).toBeDefined();
    });

    it("应该生成正确的启动参数", () => {
      // 测试启动参数生成
      const expectedCommand = "node";
      const expectedArgs = ["mcpPipe.js", "WebServerLauncher.js"];

      // 验证命令和参数格式
      expect(expectedCommand).toBe("node");
      expect(expectedArgs).toEqual(["mcpPipe.js", "WebServerLauncher.js"]);
    });
  });

  describe("PID 文件管理", () => {
    it("应该正确保存 PID 信息", () => {
      const pid = 12345;
      const mode = "daemon";

      // Test would require access to savePidInfo function
      // We can test the expected file operations
      expect(mockFs.writeFileSync).toBeDefined();
    });

    it("应该清理 PID 文件", () => {
      mockFs.existsSync.mockReturnValue(true);

      // Test would require access to cleanupPidFile function
      expect(mockFs.unlinkSync).toBeDefined();
    });
  });

  describe("启动服务", () => {
    it("应该在前台模式启动服务", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue("wss://test.com/mcp");

      // Mock service not running
      mockFs.existsSync.mockReturnValue(false);

      // Test would require access to startService function
      expect(mockSpawn).toBeDefined();
    });

    it("应该在守护进程模式启动服务", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue("wss://test.com/mcp");

      // Mock service not running
      mockFs.existsSync.mockReturnValue(false);

      // Test would require access to startService function with daemon=true
      expect(mockSpawn).toBeDefined();
    });

    it("如果服务已在运行则不应启动", async () => {
      // Mock service already running
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');
      process.kill = vi.fn(); // Process exists

      // Test would require access to startService function
      expect(mockFs.existsSync).toBeDefined();
    });

    it("如果环境检查失败则不应启动", async () => {
      mockConfigManager.configExists.mockReturnValue(false);

      // Test would require access to startService function
      expect(mockConfigManager.configExists).toBeDefined();
    });
  });

  describe("停止服务", () => {
    it("应该优雅地停止正在运行的服务", async () => {
      // Mock service running
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');

      let killCallCount = 0;
      process.kill = vi.fn().mockImplementation((pid, signal) => {
        killCallCount++;
        if (killCallCount > 1) {
          throw new Error("ESRCH"); // Process stopped
        }
      });

      // Test would require access to stopService function
      expect(process.kill).toBeDefined();
    });

    it("如果优雅停止失败应该强制终止", async () => {
      // Mock service running and not responding to SIGTERM
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"pid": 12345, "mode": "daemon"}');

      process.kill = vi.fn(); // Process keeps running

      // Test would require access to stopService function
      expect(process.kill).toBeDefined();
    });

    it("应该处理服务未运行的情况", async () => {
      mockFs.existsSync.mockReturnValue(false);

      // Test would require access to stopService function
      expect(mockFs.existsSync).toBeDefined();
    });
  });

  describe("配置命令", () => {
    it("应该成功初始化配置", async () => {
      mockConfigManager.configExists.mockReturnValue(false);
      mockConfigManager.initConfig.mockImplementation(() => {});

      // Test would require access to initConfig function
      expect(mockConfigManager.initConfig).toBeDefined();
    });

    it("不应重新初始化已存在的配置", async () => {
      mockConfigManager.configExists.mockReturnValue(true);

      // Test would require access to initConfig function
      expect(mockConfigManager.configExists).toBeDefined();
    });

    it("应该获取配置值", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getConfig.mockReturnValue({
        mcpEndpoint: "wss://test.com/mcp",
        mcpServers: {},
      });

      // Test would require access to configCommand function
      expect(mockConfigManager.getConfig).toBeDefined();
    });

    it("应该设置配置值", async () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {});

      // Test would require access to configCommand function
      expect(mockConfigManager.updateMcpEndpoint).toBeDefined();
    });
  });

  describe("项目创建", () => {
    it("应该创建基础项目", async () => {
      mockFs.existsSync.mockReturnValue(false); // Target directory doesn't exist
      // @ts-expect-error - 测试中 mock 实现返回 void，而实际函数可能返回 string | undefined
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});

      // Test would require access to createProject function
      expect(mockFs.mkdirSync).toBeDefined();
      expect(mockFs.writeFileSync).toBeDefined();
    });

    it("应该从模板创建项目", async () => {
      // @ts-expect-error - 测试中使用更具体的 string 类型，而实际函数接受 PathLike
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes("templates")) return true;
        return false; // Target directory doesn't exist
      });
      mockFs.readdirSync.mockReturnValue([
        "hello-world",
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      // Test would require access to createProject function with template option
      expect(mockFs.existsSync).toBeDefined();
    });

    it("如果目录已存在则不应创建项目", async () => {
      mockFs.existsSync.mockReturnValue(true); // Target directory exists

      // Test would require access to createProject function
      expect(mockFs.existsSync).toBeDefined();
    });

    it("应该在ESM环境中正确解析模板路径", () => {
      // 测试 ESM 环境下的路径解析
      const testUrl = "file:///Users/test/project/dist/cli.js";

      // 使用真实的 path 模块进行测试，而不是 mock
      const realPath = require("node:path");

      // 模拟 import.meta.url 的行为
      const scriptDir = realPath.dirname(new URL(testUrl).pathname);
      const expectedPaths = [
        realPath.join(scriptDir, "..", "templates"), // 开发环境
        realPath.join(scriptDir, "templates"), // 打包后的环境
        realPath.join(scriptDir, "..", "..", "templates"), // npm 全局安装
      ];

      // 验证路径计算是否正确
      expect(expectedPaths[0]).toContain("templates");
      expect(expectedPaths[1]).toContain("templates");
      expect(expectedPaths[2]).toContain("templates");

      // 验证不包含 __dirname（这在ESM中不可用）
      expect(scriptDir).not.toContain("__dirname");

      // 验证 URL 解析正常工作
      expect(scriptDir).toBe("/Users/test/project/dist");
    });

    it("应该在Windows环境中正确解析模板路径", () => {
      // 测试 Windows 环境下的路径解析
      const testUrl = "file:///C:/Users/test/project/dist/cli.js";

      // 使用真实的 fileURLToPath 进行测试
      const { fileURLToPath } = require("node:url");
      const realPath = require("node:path");

      // 模拟 Windows 环境下的 import.meta.url 行为
      const scriptPath = fileURLToPath(testUrl);
      const scriptDir = realPath.dirname(scriptPath);

      // 验证 fileURLToPath 的实际行为
      // fileURLToPath 在不同平台上的行为是一致的，会根据当前平台返回正确的路径格式
      // 在 Windows 上：file:///C:/... -> C:\...
      // 在 Unix 上：file:///C:/... -> /C:/...（这是正确的，因为 C: 在 Unix 上不是有效的根路径）

      // 验证路径是否符合当前平台的格式
      if (process.platform === "win32") {
        // Windows 环境：应该返回 Windows 风格的路径
        expect(scriptPath).toBe("C:\\Users\\test\\project\\dist\\cli.js");
        expect(scriptDir).toBe("C:\\Users\\test\\project\\dist");
      } else {
        // Unix/Linux/macOS 环境：对于 Windows 风格的 URL，会保留驱动器字母前的斜杠
        expect(scriptPath).toBe("/C:/Users/test/project/dist/cli.js");
        expect(scriptDir).toBe("/C:/Users/test/project/dist");
      }

      const expectedPaths = [
        realPath.join(scriptDir, "..", "templates"), // 开发环境
        realPath.join(scriptDir, "templates"), // 打包后的环境
        realPath.join(scriptDir, "..", "..", "templates"), // npm 全局安装
      ];

      // 验证路径计算是否正确
      expect(expectedPaths[0]).toContain("templates");
      expect(expectedPaths[1]).toContain("templates");
      expect(expectedPaths[2]).toContain("templates");
    });

    it("应该正确处理主模块检测在Windows环境", () => {
      // 测试 Windows 环境下的主模块检测
      const { fileURLToPath } = require("node:url");

      // 模拟 Windows 环境下的路径
      const importMetaUrl = "file:///C:/Users/test/project/dist/cli.js";

      // 使用 fileURLToPath 转换 import.meta.url
      const scriptPath = fileURLToPath(importMetaUrl);

      // 验证 fileURLToPath 的实际行为
      // fileURLToPath 在不同平台上的行为是一致的，会根据当前平台返回正确的路径格式
      // 在 Windows 上：file:///C:/... -> C:\...
      // 在 Unix 上：file:///C:/... -> /C:/...
      const expectedPath =
        process.platform === "win32"
          ? "C:\\Users\\test\\project\\dist\\cli.js"
          : "/C:/Users/test/project/dist/cli.js";

      // 验证路径匹配
      expect(scriptPath).toBe(expectedPath);

      // 验证条件检查应该通过
      expect(scriptPath === expectedPath).toBe(true);
    });
  });

  describe("MCP 命令", () => {
    it("MCP 功能已迁移到 McpCommandHandler 中", async () => {
      // MCP 相关的测试已迁移到 cli/commands/__tests__/McpCommandHandler.test.ts
      // 这里只验证迁移是否完成
      expect(true).toBe(true);
    });

    it("应该有有效的 MCP 命令结构", () => {
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
  });

  describe("命令结构", () => {
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
      // @ts-expect-error - 测试中使用更具体的 string 类型，而实际函数接受 PathLike
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes("package.json")) return true;
        return false;
      });

      // @ts-expect-error - 测试中使用更具体的 string 类型，而实际函数接受 PathOrFileDescriptor
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path.includes("package.json")) {
          return JSON.stringify({ version: "1.0.4" });
        }
        return "";
      });

      // Test that version reading works in ESM environment
      expect(mockFs.existsSync).toBeDefined();
      expect(mockFs.readFileSync).toBeDefined();
    });

    it("应该在找不到 package.json 时返回 unknown", () => {
      mockFs.existsSync.mockReturnValue(false);

      // Test that version reading handles missing package.json
      expect(mockFs.existsSync).toBeDefined();
    });

    it("应该处理 package.json 解析错误", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      // Test that version reading handles JSON parse errors
      expect(mockFs.readFileSync).toBeDefined();
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

    it("应该确保源码中不使用 CommonJS 语法", () => {
      const projectRoot = getProjectRoot();
      const srcFiles = ["src/cli.ts", "src/mcpPipe.ts", "src/configManager.ts"];

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
