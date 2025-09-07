#!/usr/bin/env node

/**
 * CustomMCPHandler 脚本处理器测试
 * 测试脚本工具的各种场景
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScriptHandlerConfig } from "../../configManager.js";
import { CustomMCPHandler } from "../CustomMCPHandler.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
    isToolEnabled: vi.fn(),
    hasValidCustomMCPTools: vi.fn(),
    validateCustomMCPTools: vi.fn(),
    getConfig: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Node.js modules
const mockSpawn = vi.fn();
const mockFs = {
  mkdtemp: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
};
const mockPath = {
  join: vi.fn(),
};
const mockOs = {
  tmpdir: vi.fn(),
};

vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

vi.mock("node:fs/promises", () => mockFs);
vi.mock("node:path", () => mockPath);
vi.mock("node:os", () => mockOs);

// Import after mocking
const { configManager } = await import("../../configManager.js");

describe("CustomMCPHandler 脚本处理器测试", () => {
  let handler: CustomMCPHandler;

  const mockScriptTool = {
    name: "test_script",
    description: "测试脚本执行",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "脚本输入",
        },
      },
    },
    handler: {
      type: "script" as const,
      script: "console.log('Hello from script');",
      interpreter: "node" as const,
      timeout: 30000,
      env: {
        CUSTOM_VAR: "test-value",
      },
    } as ScriptHandlerConfig,
  };

  const mockFileScriptTool = {
    name: "test_file_script",
    description: "测试文件脚本",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "any",
          description: "数据输入",
        },
      },
    },
    handler: {
      type: "script" as const,
      script: "./scripts/test.py",
      interpreter: "python" as const,
      timeout: 10000,
    } as ScriptHandlerConfig,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getConfig to return Coze token
    vi.mocked(configManager.getConfig).mockReturnValue({
      platforms: {
        coze: {
          token: "mock-coze-token",
        },
      },
    } as any);

    handler = new CustomMCPHandler();

    // 设置默认的 mock 返回值
    mockOs.tmpdir.mockReturnValue("/tmp");
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockFs.mkdtemp.mockResolvedValue("/tmp/xiaozhi-script-abc123");
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.rmdir.mockResolvedValue(undefined);
  });

  describe("脚本内容执行", () => {
    it("应该成功执行 Node.js 脚本内容", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") {
              setTimeout(() => callback(Buffer.from("脚本执行成功\n")), 10);
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 20);
          }
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      const result = await handler.callTool("test_script", {
        input: "测试输入",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("脚本执行成功");

      // 验证临时文件被创建
      expect(mockFs.mkdtemp).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/tmp/xiaozhi-script-abc123/script.js",
        "console.log('Hello from script');",
        "utf8"
      );

      // 验证脚本被正确执行
      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["/tmp/xiaozhi-script-abc123/script.js"],
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: "test-value",
            XIAOZHI_ARGUMENTS: JSON.stringify({ input: "测试输入" }),
          }),
          stdio: ["pipe", "pipe", "pipe"],
        })
      );
    });

    it("应该支持 Python 脚本", async () => {
      const pythonTool = {
        ...mockScriptTool,
        handler: {
          ...mockScriptTool.handler,
          script: "print('Python script result')",
          interpreter: "python" as const,
        },
      };

      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data")
              callback(Buffer.from("Python script result\n"));
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([pythonTool]);

      const result = await handler.callTool("test_script", {
        input: "Python 测试",
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("Python script result");

      // 验证使用了正确的解释器和文件扩展名
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("script.py"),
        "print('Python script result')",
        "utf8"
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining([expect.stringContaining("script.py")]),
        expect.any(Object)
      );
    });

    it("应该支持 Bash 脚本", async () => {
      const bashTool = {
        ...mockScriptTool,
        handler: {
          ...mockScriptTool.handler,
          script: "echo 'Bash script result'",
          interpreter: "bash" as const,
        },
      };

      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("Bash script result\n"));
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([bashTool]);

      const result = await handler.callTool("test_script", {
        input: "Bash 测试",
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("Bash script result");

      // 验证使用了正确的解释器和文件扩展名
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("script.sh"),
        "echo 'Bash script result'",
        "utf8"
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        "bash",
        expect.arrayContaining([expect.stringContaining("script.sh")]),
        expect.any(Object)
      );
    });
  });

  describe("脚本文件执行", () => {
    it("应该成功执行脚本文件", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("文件脚本结果\n"));
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockFileScriptTool]);

      const result = await handler.callTool("test_file_script", {
        data: { key: "value" },
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("文件脚本结果");

      // 验证文件存在性检查
      expect(mockFs.access).toHaveBeenCalledWith("./scripts/test.py");

      // 验证没有创建临时文件
      expect(mockFs.mkdtemp).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();

      // 验证直接执行文件
      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        ["./scripts/test.py"],
        expect.any(Object)
      );
    });

    it("应该处理脚本文件不存在的情况", async () => {
      mockFs.access.mockRejectedValueOnce(new Error("文件不存在"));

      handler.initialize([mockFileScriptTool]);

      const result = await handler.callTool("test_file_script", {
        data: "测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("脚本文件不存在");
    });
  });

  describe("错误处理", () => {
    it("应该处理脚本执行失败", async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("脚本执行错误\n"));
          }),
        },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(1); // 非零退出码
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      const result = await handler.callTool("test_script", {
        input: "错误测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("脚本执行失败");
      expect(result.content[0].text).toContain("脚本执行错误");
    });

    it("应该处理脚本执行超时", async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn(), // 永远不调用 close 事件
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      const timeoutTool = {
        ...mockScriptTool,
        handler: {
          ...mockScriptTool.handler,
          timeout: 100, // 很短的超时时间
        },
      };

      handler.initialize([timeoutTool]);

      const result = await handler.callTool("test_script", {
        input: "超时测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("脚本执行超时");
      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("应该处理 spawn 错误", async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("spawn 失败")), 10);
          }
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      const result = await handler.callTool("test_script", {
        input: "spawn 错误测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("脚本执行错误: spawn 失败");
    });

    it("应该处理不支持的解释器", async () => {
      const unsupportedTool = {
        ...mockScriptTool,
        handler: {
          ...mockScriptTool.handler,
          interpreter: "unsupported" as any,
        },
      };

      handler.initialize([unsupportedTool]);

      const result = await handler.callTool("test_script", {
        input: "不支持的解释器测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("不支持的脚本解释器");
    });
  });

  describe("参数传递", () => {
    it("应该通过环境变量传递参数", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("参数传递成功\n"));
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      const complexArgs = {
        input: "复杂输入",
        metadata: { user: "test" },
        options: ["a", "b"],
      };

      await handler.callTool("test_script", complexArgs);

      // 验证参数通过环境变量传递
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            XIAOZHI_ARGUMENTS: JSON.stringify(complexArgs),
            CUSTOM_VAR: "test-value",
          }),
        })
      );
    });

    it("应该通过 stdin 传递参数", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("stdin 参数成功\n"));
          }),
        },
        stderr: { on: vi.fn() },
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      const args = { input: "stdin 测试" };

      await handler.callTool("test_script", args);

      // 验证参数通过 stdin 传递
      expect(mockChild.stdin.write).toHaveBeenCalledWith(JSON.stringify(args));
      expect(mockChild.stdin.end).toHaveBeenCalled();
    });

    it("应该处理空参数", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("空参数处理\n"));
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      await handler.callTool("test_script", {});

      // 验证环境变量仍然设置
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            XIAOZHI_ARGUMENTS: "{}",
          }),
        })
      );

      // 验证 stdin 仍然被写入
      expect(mockChild.stdin.write).toHaveBeenCalledWith("{}");
    });
  });

  describe("临时文件清理", () => {
    it("应该在执行完成后清理临时文件", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("清理测试\n"));
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(0);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      await handler.callTool("test_script", { input: "清理测试" });

      // 验证临时文件被清理
      expect(mockFs.unlink).toHaveBeenCalledWith(
        "/tmp/xiaozhi-script-abc123/script.js"
      );
      expect(mockFs.rmdir).toHaveBeenCalledWith("/tmp/xiaozhi-script-abc123");
    });

    it("应该在出错时也清理临时文件", async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === "data") callback(Buffer.from("错误\n"));
          }),
        },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") callback(1);
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      handler.initialize([mockScriptTool]);

      await handler.callTool("test_script", { input: "错误清理测试" });

      // 验证即使出错也清理了临时文件
      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockFs.rmdir).toHaveBeenCalled();
    });
  });
});
