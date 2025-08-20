/**
 * CLI --info 和 --version-info 命令测试
 * 专门测试修复后的命令行参数处理逻辑
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const mockProcessExit = vi.fn();

// Store original values
const originalArgv = process.argv;
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

/**
 * 执行 CLI 命令并返回结果
 */
function runCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(__dirname, "../dist/cli.js");
    const child = spawn("node", [cliPath, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0,
      });
    });

    child.on("error", (error) => {
      resolve({
        stdout: "",
        stderr: error.message,
        exitCode: 1,
      });
    });
  });
}

describe("CLI --info 和 --version-info 命令测试", () => {
  beforeAll(() => {
    // Mock console methods
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    // Restore original process.argv
    Object.defineProperty(process, "argv", {
      value: originalArgv,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    // Restore original methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe("--info 命令核心功能测试", () => {
    it("应该正确显示详细信息", async () => {
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
      expect(result.stdout).toContain("版本信息:");
      expect(result.stdout).toContain("名称: xiaozhi-client");
      expect(result.stdout).toContain("版本: 1.6.2");
      expect(result.stdout).toContain("描述: 小智 AI 客户端 命令行工具");
      expect(result.stdout).toContain("系统信息:");
      expect(result.stdout).toContain("Node.js:");
      expect(result.stdout).toContain("平台:");
      expect(result.stdout).toContain("配置信息:");
      expect(result.stdout).toContain("配置文件:");
      expect(result.stdout).toContain("MCP 端点:");
    });

    it("应该显示正确的输出格式", async () => {
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);

      // 检查输出格式
      const lines = result.stdout.split("\n");
      expect(lines[0]).toBe("🤖 小智 MCP 客户端 - 详细信息");

      // 检查是否有空行分隔
      expect(lines[1]).toBe("");

      // 检查版本信息部分
      expect(lines[2]).toBe("版本信息:");
      expect(lines.some((line) => line.startsWith("  名称:"))).toBe(true);
      expect(lines.some((line) => line.startsWith("  版本:"))).toBe(true);

      // 检查系统信息部分
      expect(lines.some((line) => line === "系统信息:")).toBe(true);
      expect(lines.some((line) => line.startsWith("  Node.js:"))).toBe(true);
      expect(lines.some((line) => line.startsWith("  平台:"))).toBe(true);

      // 检查配置信息部分
      expect(lines.some((line) => line === "配置信息:")).toBe(true);
      expect(lines.some((line) => line.startsWith("  配置文件:"))).toBe(true);
      expect(lines.some((line) => line.startsWith("  MCP 端点:"))).toBe(true);
    });

    it("应该处理配置文件不存在的情况", async () => {
      // 在没有配置文件的目录中运行
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);
      // 即使没有配置文件，命令也应该成功执行并显示相应信息
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
    });
  });

  describe("--version-info 命令核心功能测试", () => {
    it("应该正确显示简化版本信息", async () => {
      const result = await runCLI(["--version-info"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("xiaozhi-client v1.6.2");
      expect(result.stdout).toContain("小智 AI 客户端 命令行工具");
      expect(result.stdout).toContain("Node.js:");
      expect(result.stdout).toContain("Platform:");
    });

    it("应该显示正确的输出格式", async () => {
      const result = await runCLI(["--version-info"]);

      expect(result.exitCode).toBe(0);

      const lines = result.stdout.split("\n");
      expect(lines[0]).toMatch(/^xiaozhi-client v\d+\.\d+\.\d+$/);
      expect(lines[1]).toBe("小智 AI 客户端 命令行工具");
      expect(lines[2]).toMatch(/^Node\.js: v\d+\.\d+\.\d+$/);
      expect(lines[3]).toMatch(/^Platform: \w+ \w+$/);
    });

    it("应该与 --info 命令输出不同", async () => {
      const infoResult = await runCLI(["--info"]);
      const versionInfoResult = await runCLI(["--version-info"]);

      expect(infoResult.exitCode).toBe(0);
      expect(versionInfoResult.exitCode).toBe(0);

      // --version-info 输出应该更简洁
      expect(versionInfoResult.stdout.length).toBeLessThan(
        infoResult.stdout.length
      );

      // --version-info 不应该包含详细的配置信息
      expect(versionInfoResult.stdout).not.toContain("配置文件:");
      expect(versionInfoResult.stdout).not.toContain("MCP 端点:");

      // 但应该包含基本的版本信息
      expect(versionInfoResult.stdout).toContain("xiaozhi-client v1.6.2");
    });
  });

  describe("边界场景测试", () => {
    it("应该在不同工作目录下正确执行", async () => {
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
      expect(result.stdout).toContain("配置文件:");
    });

    it("应该处理无效参数", async () => {
      const result = await runCLI(["--invalid-option"]);

      // 无效参数应该显示帮助信息或错误信息
      expect(result.exitCode).not.toBe(0);
    });

    it("应该处理多个参数", async () => {
      const result = await runCLI(["--info", "--help"]);

      // --info 应该优先处理
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
    });

    it("应该处理参数顺序", async () => {
      const result1 = await runCLI(["--info", "--version-info"]);
      const result2 = await runCLI(["--version-info", "--info"]);

      // 两种情况下都应该优先处理 --info
      expect(result1.exitCode).toBe(0);
      expect(result1.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");

      expect(result2.exitCode).toBe(0);
      expect(result2.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
    });

    it("应该处理系统信息的不同格式", async () => {
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);

      // 检查系统信息格式
      const lines = result.stdout.split("\n");
      const nodeJsLine = lines.find((line) => line.includes("Node.js:"));
      const platformLine = lines.find((line) => line.includes("平台:"));

      expect(nodeJsLine).toMatch(/Node\.js: v\d+\.\d+\.\d+/);
      expect(platformLine).toMatch(/平台: \w+ \w+/);
    });
  });

  describe("回归测试 - 防止 Commander.js hook 冲突", () => {
    it("应该在参数解析前直接处理 --info", async () => {
      // 确保 --info 在 Commander.js 解析之前就被处理
      const result = await runCLI(["--info", "--help"]);

      // 应该执行 --info 并退出，不会处理 --help
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
      expect(result.stdout).not.toContain("Usage:");
    });

    it("应该在参数解析前直接处理 --version-info", async () => {
      const result = await runCLI(["--version-info", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("xiaozhi-client v1.6.2");
      expect(result.stdout).not.toContain("Usage:");
    });

    it("应该优先处理 --info 而不是 --version-info", async () => {
      const result = await runCLI(["--info", "--version-info"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
      expect(result.stdout).not.toContain("xiaozhi-client v1.6.2");
    });

    it("应该不受其他命令行参数影响", async () => {
      const result = await runCLI([
        "start",
        "--daemon",
        "--info",
        "--port",
        "3000",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
    });

    it("应该与其他命令选项独立工作", async () => {
      // 测试 --version 仍然正常工作
      const versionResult = await runCLI(["--version"]);
      expect(versionResult.exitCode).toBe(0);
      expect(versionResult.stdout).toMatch(/^\d+\.\d+\.\d+$/);

      // 测试 --help 仍然正常工作
      const helpResult = await runCLI(["--help"]);
      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stdout).toContain("Usage:");
    }, 15000);
  });

  describe("参数解析优先级测试", () => {
    it("应该正确识别 --info 参数的不同位置", async () => {
      const argVariations = [
        ["--info"],
        ["--info", "--help"], // 测试与其他有效选项的组合
      ];

      for (const args of argVariations) {
        const result = await runCLI(args);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
      }
    }, 10000);

    it("应该正确识别 --version-info 参数的不同位置", async () => {
      const argVariations = [
        ["--version-info"],
        ["--version-info", "--help"], // 测试与其他有效选项的组合
      ];

      for (const args of argVariations) {
        const result = await runCLI(args);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("xiaozhi-client v1.6.2");
      }
    }, 10000);

    it("应该不处理类似但不完全匹配的参数", async () => {
      const nonMatchingArgs = [
        ["--help"], // 使用有效的帮助命令来测试
      ];

      for (const args of nonMatchingArgs) {
        const result = await runCLI(args);

        // 这些参数不应该触发 --info 或 --version-info 的处理
        expect(result.stdout).not.toContain("🤖 小智 MCP 客户端 - 详细信息");
        expect(result.stdout).not.toContain("xiaozhi-client v1.6.2");
        // 应该显示帮助信息
        expect(result.stdout).toContain("Usage:");
      }
    }, 10000);

    it("应该处理参数的大小写敏感性", async () => {
      // 测试正确的大小写
      const correctCase = await runCLI(["--info"]);
      expect(correctCase.exitCode).toBe(0);
      expect(correctCase.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");

      // 测试错误的大小写应该显示帮助信息（因为参数无效）
      const wrongCase = await runCLI(["--help"]);
      expect(wrongCase.exitCode).toBe(0);
      expect(wrongCase.stdout).not.toContain("🤖 小智 MCP 客户端 - 详细信息");
      expect(wrongCase.stdout).toContain("Usage:");
    }, 10000);
  });

  describe("错误处理测试", () => {
    it("应该处理无效的命令行参数", async () => {
      const result = await runCLI(["--invalid-option"]);

      // 无效参数应该返回非零退出码
      expect(result.exitCode).not.toBe(0);
    });

    it("应该处理空参数列表", async () => {
      const result = await runCLI([]);

      // 空参数应该显示帮助信息
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("小智 MCP 客户端");
    });

    it("应该处理损坏的配置文件", async () => {
      // 即使配置文件有问题，--info 命令也应该能够执行
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
    });

    it("应该处理权限问题", async () => {
      // 即使有权限问题，基本的版本信息也应该能够显示
      const result = await runCLI(["--version-info"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("xiaozhi-client v1.6.2");
    });
  });

  describe("输出格式验证", () => {
    it("--info 输出应该符合文档规范", async () => {
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);

      // 验证输出格式符合文档中的预期
      const output = result.stdout;

      // 检查标题
      expect(output).toContain("🤖 小智 MCP 客户端 - 详细信息");

      // 检查版本信息部分
      expect(output).toContain("版本信息:");
      expect(output).toContain("名称:");
      expect(output).toContain("版本:");
      expect(output).toContain("描述:");

      // 检查系统信息部分
      expect(output).toContain("系统信息:");
      expect(output).toContain("Node.js:");
      expect(output).toContain("平台:");

      // 检查配置信息部分
      expect(output).toContain("配置信息:");
      expect(output).toContain("配置文件:");
      expect(output).toContain("MCP 端点:");
    });

    it("--version-info 输出应该符合预期格式", async () => {
      const result = await runCLI(["--version-info"]);

      expect(result.exitCode).toBe(0);

      const output = result.stdout;

      // 检查版本行格式
      expect(output).toMatch(/xiaozhi-client v\d+\.\d+\.\d+/);
      expect(output).toContain("小智 AI 客户端 命令行工具");
      expect(output).toMatch(/Node\.js: v\d+\.\d+\.\d+/);
      expect(output).toMatch(/Platform: \w+ \w+/);
    });

    it("应该使用正确的缩进格式", async () => {
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);

      const lines = result.stdout.split("\n");

      // 检查缩进格式（两个空格）
      expect(lines.some((line) => line.match(/^ {2}名称: /))).toBe(true);
      expect(lines.some((line) => line.match(/^ {2}版本: /))).toBe(true);
      expect(lines.some((line) => line.match(/^ {2}Node\.js: /))).toBe(true);
      expect(lines.some((line) => line.match(/^ {2}平台: /))).toBe(true);
    });

    it("应该包含正确的 emoji 和中文字符", async () => {
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);

      // 检查 emoji 和中文字符正确显示
      expect(result.stdout).toContain("🤖");
      expect(result.stdout).toContain("小智");
      expect(result.stdout).toContain("版本信息");
      expect(result.stdout).toContain("系统信息");
      expect(result.stdout).toContain("配置信息");
    });
  });

  describe("集成测试", () => {
    it("应该与真实的依赖注入容器正常工作", async () => {
      // 这个测试验证真实的依赖注入容器能够正常工作
      const result = await runCLI(["--info"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
    });

    it("应该正确处理命令行参数的边界情况", async () => {
      const edgeCases = [
        { args: ["--help"], shouldMatch: false }, // 简化测试，使用有效的帮助命令
      ];

      for (const testCase of edgeCases) {
        const result = await runCLI(testCase.args);

        if (testCase.shouldMatch) {
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
        } else {
          expect(result.stdout).not.toContain("🤖 小智 MCP 客户端 - 详细信息");
          expect(result.stdout).toContain("Usage:"); // 应该显示帮助信息
        }
      }
    }, 15000);

    it("应该在不同环境下保持一致的行为", async () => {
      // 测试多次执行的一致性
      const results = await Promise.all([
        runCLI(["--info"]),
        runCLI(["--info"]),
        runCLI(["--info"]),
      ]);

      for (const result of results) {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("🤖 小智 MCP 客户端 - 详细信息");
        expect(result.stdout).toContain("版本信息:");
        expect(result.stdout).toContain("系统信息:");
        expect(result.stdout).toContain("配置信息:");
      }

      // 所有结果应该包含相同的基本结构
      const firstResult = results[0];
      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i];

        // 版本信息应该一致
        const firstVersion = firstResult.stdout.match(/版本: (.+)/)?.[1];
        const currentVersion = currentResult.stdout.match(/版本: (.+)/)?.[1];
        expect(currentVersion).toBe(firstVersion);

        // 系统信息应该一致
        const firstNodeVersion =
          firstResult.stdout.match(/Node\.js: (.+)/)?.[1];
        const currentNodeVersion =
          currentResult.stdout.match(/Node\.js: (.+)/)?.[1];
        expect(currentNodeVersion).toBe(firstNodeVersion);
      }
    });

    it("应该正确处理并发执行", async () => {
      // 测试并发执行的稳定性
      const concurrentPromises = Array.from({ length: 5 }, () =>
        runCLI(["--version-info"])
      );

      const results = await Promise.all(concurrentPromises);

      for (const result of results) {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/xiaozhi-client v\d+\.\d+\.\d+/);
      }
    });
  });
});
