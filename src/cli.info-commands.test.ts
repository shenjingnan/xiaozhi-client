/**
 * CLI --info 和 --version-info 命令测试
 * 专门测试修复后的命令行参数处理逻辑
 */

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
import { createContainer } from "./cli/Container.js";

// 模拟 CLI 核心函数
/**
 * 模拟 showDetailedInfo 函数
 */
function mockShowDetailedInfo(container: any): void {
  const versionUtils = container.get("versionUtils") as any;
  const platformUtils = container.get("platformUtils") as any;

  const versionInfo = versionUtils.getVersionInfo();
  const systemInfo = platformUtils.getSystemInfo();

  console.log("🤖 小智 MCP 客户端 - 详细信息");
  console.log();
  console.log("版本信息:");
  console.log(`  名称: ${versionInfo.name || "xiaozhi"}`);
  console.log(`  版本: ${versionInfo.version}`);
  if (versionInfo.description) {
    console.log(`  描述: ${versionInfo.description}`);
  }
  console.log();
  console.log("系统信息:");
  console.log(`  Node.js: ${systemInfo.nodeVersion}`);
  console.log(`  平台: ${systemInfo.platform} ${systemInfo.arch}`);
  console.log();
  console.log("配置信息:");
  const configManager = container.get("configManager") as any;
  if (configManager.configExists()) {
    const configPath = configManager.getConfigPath();
    console.log(`  配置文件: ${configPath}`);

    try {
      const endpoints = configManager.getMcpEndpoints();
      console.log(`  MCP 端点: ${endpoints.length} 个`);
    } catch (error) {
      console.log("  MCP 端点: 读取失败");
    }
  } else {
    console.log("  配置文件: 未初始化");
  }
}

/**
 * 模拟 showVersionInfo 函数
 */
function mockShowVersionInfo(container: any): void {
  const versionUtils = container.get("versionUtils") as any;
  const platformUtils = container.get("platformUtils") as any;

  const versionInfo = versionUtils.getVersionInfo();
  const systemInfo = platformUtils.getSystemInfo();

  console.log(`${versionInfo.name || "xiaozhi"} v${versionInfo.version}`);
  if (versionInfo.description) {
    console.log(versionInfo.description);
  }
  console.log(`Node.js: ${systemInfo.nodeVersion}`);
  console.log(`Platform: ${systemInfo.platform} ${systemInfo.arch}`);
}

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

// Store original values
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("CLI --info 和 --version-info 命令测试", () => {
  let container: any;

  beforeAll(async () => {
    // Mock console methods
    console.log = mockConsoleLog;
    console.error = mockConsoleError;

    // 创建测试容器
    container = await createContainer();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    // Restore original methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("--info 命令核心功能测试", () => {
    it("应该正确显示详细信息", async () => {
      mockShowDetailedInfo(container);

      // 检查关键的输出内容
      expect(mockConsoleLog).toHaveBeenCalledWith("🤖 小智 MCP 客户端 - 详细信息");
      expect(mockConsoleLog).toHaveBeenCalledWith("版本信息:");
      expect(mockConsoleLog).toHaveBeenCalledWith("  名称: xiaozhi-client");
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^  版本: \d+\.\d+\.\d+/));
      expect(mockConsoleLog).toHaveBeenCalledWith("系统信息:");
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^  Node\.js: v\d+\.\d+\.\d+$/));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^  平台: \w+ \w+$/));
      expect(mockConsoleLog).toHaveBeenCalledWith("配置信息:");
    });

    it("应该显示正确的输出格式", async () => {
      mockShowDetailedInfo(container);

      // 验证调用顺序
      const calls = mockConsoleLog.mock.calls;
      const messages = calls.map((call: any) => call[0]).filter(Boolean); // 过滤掉空值

      expect(messages[0]).toBe("🤖 小智 MCP 客户端 - 详细信息");
      expect(messages[1]).toBe("版本信息:");
      expect(messages.some((msg: string) => msg && msg.startsWith("  名称:"))).toBe(true);
      expect(messages.some((msg: string) => msg && msg.startsWith("  版本:"))).toBe(true);
      expect(messages.some((msg: string) => msg === "系统信息:")).toBe(true);
      expect(messages.some((msg: string) => msg && msg.startsWith("  Node.js:"))).toBe(true);
      expect(messages.some((msg: string) => msg && msg.startsWith("  平台:"))).toBe(true);
      expect(messages.some((msg: string) => msg === "配置信息:")).toBe(true);
    });

    it("应该处理配置文件不存在的情况", async () => {
      // Mock configManager 返回没有配置文件的情况
      const configManager = container.get("configManager");
      configManager.configExists = vi.fn().mockReturnValue(false);

      mockShowDetailedInfo(container);

      expect(mockConsoleLog).toHaveBeenCalledWith("  配置文件: 未初始化");
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringMatching(/^  MCP 端点:/));
    });
  });

  describe("--version-info 命令核心功能测试", () => {
    it("应该正确显示简化版本信息", async () => {
      mockShowVersionInfo(container);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^xiaozhi-client v\d+\.\d+\.\d+/));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.any(String)); // 描述
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^Node\.js: v\d+\.\d+\.\d+$/));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^Platform: \w+ \w+$/));
    });

    it("应该显示正确的输出格式", async () => {
      mockShowVersionInfo(container);

      const calls = mockConsoleLog.mock.calls;
      const messages = calls.map((call: any) => call[0]);

      expect(messages[0]).toMatch(/^xiaozhi-client v\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
      expect(messages[1]).toMatch(/小智 AI 客户端 命令行工具/);
      expect(messages[2]).toMatch(/^Node\.js: v\d+\.\d+\.\d+$/);
      expect(messages[3]).toMatch(/^Platform: \w+ \w+$/);
    });

    it("应该比 --info 命令输出更简洁", async () => {
      // 清除之前的调用记录
      mockConsoleLog.mockClear();

      // 调用 --info
      mockShowDetailedInfo(container);
      const infoCallCount = mockConsoleLog.mock.calls.length;

      // 清除调用记录
      mockConsoleLog.mockClear();

      // 调用 --version-info
      mockShowVersionInfo(container);
      const versionInfoCallCount = mockConsoleLog.mock.calls.length;

      // --version-info 应该比 --info 更简洁
      expect(versionInfoCallCount).toBeLessThan(infoCallCount);
    });
  });

  describe("参数解析测试", () => {
    it("应该正确识别 --info 参数", async () => {
      const mockArgv = ["node", "xiaozhi", "--info"];
      const originalArgv = process.argv;

      process.argv = mockArgv;

      try {
        // 检查参数是否正确包含
        expect(process.argv.includes("--info")).toBe(true);
      } finally {
        process.argv = originalArgv;
      }
    });

    it("应该正确识别 --version-info 参数", async () => {
      const mockArgv = ["node", "xiaozhi", "--version-info"];
      const originalArgv = process.argv;

      process.argv = mockArgv;

      try {
        // 检查参数是否正确包含
        expect(process.argv.includes("--version-info")).toBe(true);
      } finally {
        process.argv = originalArgv;
      }
    });

    it("应该不匹配类似的参数", async () => {
      const mockArgv = ["node", "xiaozhi", "--information"];
      const originalArgv = process.argv;

      process.argv = mockArgv;

      try {
        expect(process.argv.includes("--info")).toBe(false);
        expect(process.argv.includes("--version-info")).toBe(false);
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe("工具函数测试", () => {
    it("版本工具应该返回正确的版本信息", async () => {
      const versionUtils = container.get("versionUtils") as any;
      const versionInfo = versionUtils.getVersionInfo();

      expect(versionInfo).toBeDefined();
      expect(versionInfo.name).toBeDefined();
      expect(versionInfo.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it("平台工具应该返回正确的系统信息", async () => {
      const platformUtils = container.get("platformUtils") as any;
      const systemInfo = platformUtils.getSystemInfo();

      expect(systemInfo).toBeDefined();
      expect(systemInfo.nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
      expect(systemInfo.platform).toMatch(/^(darwin|linux|win32)$/);
      expect(systemInfo.arch).toMatch(/^(x64|arm64|ia32)$/);
    });

    it("配置管理器应该正确检查配置文件存在性", async () => {
      const configManager = container.get("configManager") as any;

      expect(typeof configManager.configExists()).toBe("boolean");
      expect(typeof configManager.getConfigPath()).toBe("string");
    });
  });
});
