/**
 * customMCP 端到端测试
 * 测试从 CLI 到后端的完整调用链路
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("customMCP 端到端测试", () => {
  const testConfigDir = path.join(__dirname, "../../test-configs");
  const testConfigFile = path.join(testConfigDir, "xiaozhi.config.json");

  beforeAll(async () => {
    // 创建测试配置目录
    await fs.mkdir(testConfigDir, { recursive: true });
  });

  afterAll(async () => {
    // 清理测试配置目录
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  beforeEach(async () => {
    // 创建测试配置文件
    const testConfig = {
      customMCP: {
        tools: [
          {
            name: "test_function_tool",
            description: "测试函数工具",
            inputSchema: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
              },
              required: ["x", "y"],
            },
            handler: {
              type: "function",
              config: {
                code: "function add(x, y) { return { result: x + y }; }",
                functionName: "add",
              },
            },
          },
          {
            name: "test_http_tool",
            description: "测试HTTP工具",
            inputSchema: {
              type: "object",
              properties: {
                message: { type: "string" },
              },
              required: ["message"],
            },
            handler: {
              type: "http",
              config: {
                url: "https://httpbin.org/post",
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              },
            },
          },
        ],
      },
      mcpServers: {
        calculator: {
          command: "node",
          args: ["./mcpServers/calculator.js"],
        },
      },
    };

    await fs.writeFile(testConfigFile, JSON.stringify(testConfig, null, 2));
  });

  afterEach(async () => {
    // 清理测试配置文件
    try {
      await fs.unlink(testConfigFile);
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe("CLI 工具列表命令", () => {
    it("应该正确显示 customMCP 工具在列表中", async () => {
      const result = await runCLICommand(["mcp", "list"], testConfigDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("customMCP");
      expect(result.stdout).toContain("自定义 MCP 工具");
      expect(result.stdout).toContain("2 启用 / 2 总计");
    });

    it("应该正确显示详细的工具列表", async () => {
      const result = await runCLICommand(
        ["mcp", "list", "--tools"],
        testConfigDir
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test_function_tool");
      expect(result.stdout).toContain("test_http_tool");
      expect(result.stdout).toContain("测试函数工具");
      expect(result.stdout).toContain("测试HTTP工具");
    });
  });

  describe("CLI 工具调用命令", () => {
    it("应该成功调用 function 类型的 customMCP 工具", async () => {
      // 先启动服务
      const startResult = await runCLICommand(["start", "-d"], testConfigDir);
      expect(startResult.exitCode).toBe(0);

      try {
        // 等待服务启动
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 调用工具
        const result = await runCLICommand(
          [
            "mcp",
            "call",
            "customMCP",
            "test_function_tool",
            "--args",
            '{"x": 10, "y": 5}',
          ],
          testConfigDir
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("result");
        expect(result.stdout).toContain("15");
      } finally {
        // 停止服务
        await runCLICommand(["stop"], testConfigDir);
      }
    });

    it("应该正确处理参数验证错误", async () => {
      // 先启动服务
      const startResult = await runCLICommand(["start", "-d"], testConfigDir);
      expect(startResult.exitCode).toBe(0);

      try {
        // 等待服务启动
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 调用工具时缺少必需参数
        const result = await runCLICommand(
          [
            "mcp",
            "call",
            "customMCP",
            "test_function_tool",
            "--args",
            '{"x": 10}',
          ],
          testConfigDir
        );

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("参数验证失败");
        expect(result.stderr).toContain("缺少必需参数: y");
      } finally {
        // 停止服务
        await runCLICommand(["stop"], testConfigDir);
      }
    });

    it("应该正确处理参数类型错误", async () => {
      // 先启动服务
      const startResult = await runCLICommand(["start", "-d"], testConfigDir);
      expect(startResult.exitCode).toBe(0);

      try {
        // 等待服务启动
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 调用工具时参数类型错误
        const result = await runCLICommand(
          [
            "mcp",
            "call",
            "customMCP",
            "test_function_tool",
            "--args",
            '{"x": "not_a_number", "y": 5}',
          ],
          testConfigDir
        );

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("参数验证失败");
        expect(result.stderr).toContain("类型错误");
        expect(result.stderr).toContain("期望: number");
      } finally {
        // 停止服务
        await runCLICommand(["stop"], testConfigDir);
      }
    });

    it("应该正确处理不存在的 customMCP 工具", async () => {
      // 先启动服务
      const startResult = await runCLICommand(["start", "-d"], testConfigDir);
      expect(startResult.exitCode).toBe(0);

      try {
        // 等待服务启动
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 调用不存在的工具
        const result = await runCLICommand(
          ["mcp", "call", "customMCP", "nonexistent_tool", "--args", "{}"],
          testConfigDir
        );

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
          "customMCP 工具 'nonexistent_tool' 不存在"
        );
        expect(result.stderr).toContain("可用的 customMCP 工具");
        expect(result.stderr).toContain("test_function_tool");
        expect(result.stderr).toContain("test_http_tool");
      } finally {
        // 停止服务
        await runCLICommand(["stop"], testConfigDir);
      }
    });
  });

  describe("与标准 MCP 工具的兼容性", () => {
    it("应该不影响标准 MCP 工具的调用", async () => {
      // 先启动服务
      const startResult = await runCLICommand(["start", "-d"], testConfigDir);
      expect(startResult.exitCode).toBe(0);

      try {
        // 等待服务启动
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 调用标准 MCP 工具
        const result = await runCLICommand(
          [
            "mcp",
            "call",
            "calculator",
            "calculator",
            "--args",
            '{"javascript_expression": "2 + 3"}',
          ],
          testConfigDir
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("5");
      } finally {
        // 停止服务
        await runCLICommand(["stop"], testConfigDir);
      }
    });

    it("应该在工具列表中同时显示 customMCP 和标准 MCP 工具", async () => {
      const result = await runCLICommand(
        ["mcp", "list", "--tools"],
        testConfigDir
      );

      expect(result.exitCode).toBe(0);
      // customMCP 工具
      expect(result.stdout).toContain("customMCP");
      expect(result.stdout).toContain("test_function_tool");
      // 标准 MCP 工具
      expect(result.stdout).toContain("calculator");
    });
  });
});

/**
 * 运行 CLI 命令的辅助函数
 */
async function runCLICommand(
  args: string[],
  cwd: string
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const cliPath = path.join(__dirname, "../../dist/cli.js");
    const child = spawn("node", [cliPath, ...args], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      });
    });

    // 设置超时
    setTimeout(() => {
      child.kill();
      resolve({
        exitCode: -1,
        stdout,
        stderr: `${stderr}\nTest timeout`,
      });
    }, 30000); // 30秒超时
  });
}
