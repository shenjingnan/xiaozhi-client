import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathUtils } from "../PathUtils.js";

// Mock dependencies - 需要使用与源文件相同的导入方式
vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

vi.mock("node:fs", () => ({
  realpathSync: vi.fn(),
}));

// Mock process.argv and environment variables
const originalArgv = process.argv;
const originalEnv = process.env;

describe("PathUtils - 可执行文件路径", () => {
  let mockRealpathSync: any;
  let mockFileURLToPath: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    mockRealpathSync = vi.mocked(realpathSync);
    mockFileURLToPath = vi.mocked(fileURLToPath);

    // Default mock implementations
    mockRealpathSync.mockImplementation((path: string) => path); // 默认返回原路径
    mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe("getExecutablePath 获取可执行文件路径", () => {
    describe("基本路径解析", () => {
      it("应该基于当前 CLI 脚本位置返回正确路径", () => {
        // Mock process.argv[1] to simulate CLI script path
        process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];
        mockRealpathSync.mockReturnValue(
          "/Users/test/xiaozhi-client/dist/cli.js"
        );

        const result = PathUtils.getExecutablePath("WebServerLauncher");
        const expected = path.join(
          "/Users/test/xiaozhi-client/dist",
          "WebServerLauncher.js"
        );

        expect(result).toBe(expected);
        expect(mockRealpathSync).toHaveBeenCalledWith(
          "/Users/test/xiaozhi-client/dist/cli.js"
        );
      });

      it("应该处理不同的 CLI 脚本位置", () => {
        process.argv = ["node", "/opt/xiaozhi/dist/cli.js"];
        mockRealpathSync.mockReturnValue("/opt/xiaozhi/dist/cli.js");

        const result = PathUtils.getExecutablePath("WebServerLauncher");
        const expected = path.join("/opt/xiaozhi/dist", "WebServerLauncher.js");

        expect(result).toBe(expected);
      });

      it("应该支持相对路径", () => {
        process.argv = ["node", "./dist/cli.js"];
        mockRealpathSync.mockReturnValue("./dist/cli.js");

        const result = PathUtils.getExecutablePath("test");
        const expected = path.join("./dist", "test.js");

        expect(result).toBe(expected);
      });
    });

    describe("符号链接解析测试", () => {
      it("应该正确解析符号链接到真实路径", () => {
        // 模拟 npm 全局安装的符号链接场景
        const symlinkPath =
          "/Users/nemo/.nvm/versions/node/v20.19.2/bin/xiaozhi";
        const realPath =
          "/Users/nemo/.nvm/versions/node/v20.19.2/lib/node_modules/xiaozhi-client/dist/cli.js";

        process.argv = ["node", symlinkPath];
        mockRealpathSync.mockReturnValue(realPath);

        const result = PathUtils.getExecutablePath("WebServerLauncher");
        const expected = path.join(
          "/Users/nemo/.nvm/versions/node/v20.19.2/lib/node_modules/xiaozhi-client/dist",
          "WebServerLauncher.js"
        );

        expect(result).toBe(expected);
        expect(mockRealpathSync).toHaveBeenCalledWith(symlinkPath);
      });

      it("应该处理多层符号链接", () => {
        const symlinkPath = "/usr/local/bin/xiaozhi";
        const realPath = "/opt/xiaozhi-client/dist/cli.js";

        process.argv = ["node", symlinkPath];
        mockRealpathSync.mockReturnValue(realPath);

        const result = PathUtils.getExecutablePath("WebServerLauncher");
        const expected = path.join(
          "/opt/xiaozhi-client/dist",
          "WebServerLauncher.js"
        );

        expect(result).toBe(expected);
      });

      it("应该在符号链接解析失败时回退到原路径", () => {
        const symlinkPath = "/broken/symlink/xiaozhi";

        process.argv = ["node", symlinkPath];
        mockRealpathSync.mockImplementation(() => {
          throw new Error("ENOENT: no such file or directory");
        });

        const result = PathUtils.getExecutablePath("WebServerLauncher");
        const expected = path.join("/broken/symlink", "WebServerLauncher.js");

        expect(result).toBe(expected);
        expect(mockRealpathSync).toHaveBeenCalledWith(symlinkPath);
      });

      it("应该处理权限错误导致的符号链接解析失败", () => {
        const symlinkPath = "/restricted/xiaozhi";

        process.argv = ["node", symlinkPath];
        mockRealpathSync.mockImplementation(() => {
          throw new Error("EACCES: permission denied");
        });

        const result = PathUtils.getExecutablePath("test");
        const expected = path.join("/restricted", "test.js");

        expect(result).toBe(expected);
      });
    });

    describe("路径构建测试", () => {
      it("应该正确构建不同可执行文件名称的路径", () => {
        process.argv = ["node", "/test/dist/cli.js"];
        mockRealpathSync.mockReturnValue("/test/dist/cli.js");

        const testCases = [
          { name: "WebServerLauncher", expected: "WebServerLauncher.js" },
          { name: "customScript", expected: "customScript.js" },
          { name: "app", expected: "app.js" },
        ];

        for (const { name, expected } of testCases) {
          const result = PathUtils.getExecutablePath(name);
          expect(result).toBe(path.join("/test/dist", expected));
        }
      });

      it("应该确保返回的路径以 .js 结尾", () => {
        process.argv = ["node", "/test/dist/cli.js"];
        mockRealpathSync.mockReturnValue("/test/dist/cli.js");

        const testNames = ["script", "app.exe", "tool.bin", "service"];

        for (const name of testNames) {
          const result = PathUtils.getExecutablePath(name);
          expect(result).toMatch(/\.js$/);
          expect(result).toContain(name);
        }
      });
    });

    describe("边界情况测试", () => {
      it("应该处理空的可执行文件名", () => {
        process.argv = ["node", "/test/dist/cli.js"];
        mockRealpathSync.mockReturnValue("/test/dist/cli.js");

        const result = PathUtils.getExecutablePath("");
        const expected = path.join("/test/dist", ".js");

        expect(result).toBe(expected);
      });

      it("应该处理 process.argv[1] 为 undefined 的情况", () => {
        process.argv = ["node"]; // 没有第二个参数

        const result = PathUtils.getExecutablePath("test");
        const expected = path.join(process.cwd(), "test.js");

        expect(result).toBe(expected);
      });

      it("应该处理非常长的路径", () => {
        const longPath = `/very/long/path/${"a".repeat(200)}/dist/cli.js`;
        process.argv = ["node", longPath];
        mockRealpathSync.mockReturnValue(longPath);

        const result = PathUtils.getExecutablePath("test");

        expect(result).toContain("test.js");
        expect(result.length).toBeGreaterThan(200);
      });

      it("应该处理包含特殊字符的路径", () => {
        const specialPath = "/path with spaces/special-chars_123/dist/cli.js";
        process.argv = ["node", specialPath];
        mockRealpathSync.mockReturnValue(specialPath);

        const result = PathUtils.getExecutablePath("test");
        const expected = path.join(
          "/path with spaces/special-chars_123/dist",
          "test.js"
        );

        expect(result).toBe(expected);
      });
    });

    describe("集成测试", () => {
      it("应该模拟真实的 npm 全局安装环境", () => {
        // 模拟真实的 npm 全局安装路径结构
        const npmBinPath =
          "/Users/user/.nvm/versions/node/v18.17.0/bin/xiaozhi";
        const npmRealPath =
          "/Users/user/.nvm/versions/node/v18.17.0/lib/node_modules/xiaozhi-client/dist/cli.js";

        process.argv = ["node", npmBinPath];
        mockRealpathSync.mockReturnValue(npmRealPath);

        const webServerPath = PathUtils.getExecutablePath("WebServerLauncher");

        const expectedDir =
          "/Users/user/.nvm/versions/node/v18.17.0/lib/node_modules/xiaozhi-client/dist";

        expect(webServerPath).toBe(
          path.join(expectedDir, "WebServerLauncher.js")
        );
      });

      it("应该在 Unix 系统路径格式下正确工作", () => {
        const symlinkPath = "/usr/local/bin/xiaozhi";
        const realPath = "/opt/xiaozhi-client/dist/cli.js";
        const expectedDir = "/opt/xiaozhi-client/dist";

        process.argv = ["node", symlinkPath];
        mockRealpathSync.mockReturnValue(realPath);

        const result = PathUtils.getExecutablePath("test");
        const expected = path.join(expectedDir, "test.js");

        expect(result).toBe(expected);
        expect(mockRealpathSync).toHaveBeenCalledWith(symlinkPath);
      });

      it("应该处理跨平台路径格式", () => {
        // 测试不同平台的路径格式都能正确处理
        const testCases = [
          {
            name: "Unix 风格路径",
            symlinkPath: "/usr/local/bin/xiaozhi",
            realPath: "/opt/xiaozhi-client/dist/cli.js",
          },
          {
            name: "Windows 风格路径（使用正斜杠）",
            symlinkPath: "C:/npm/xiaozhi",
            realPath: "C:/npm/node_modules/xiaozhi-client/dist/cli.js",
          },
        ];

        for (const { name, symlinkPath, realPath } of testCases) {
          process.argv = ["node", symlinkPath];
          mockRealpathSync.mockReturnValue(realPath);

          const result = PathUtils.getExecutablePath("test");
          const expectedDir = path.dirname(realPath);
          const expected = path.join(expectedDir, "test.js");

          expect(result).toBe(expected);
          expect(mockRealpathSync).toHaveBeenCalledWith(symlinkPath);

          // 重置 mock 为下一次测试
          mockRealpathSync.mockReset();
        }
      });

      it("应该确保路径解析的一致性", () => {
        const symlinkPath = "/usr/bin/xiaozhi";
        const realPath = "/home/user/xiaozhi-client/dist/cli.js";

        process.argv = ["node", symlinkPath];
        mockRealpathSync.mockReturnValue(realPath);

        // 多次调用应该返回一致的结果
        const results = [];
        for (let i = 0; i < 5; i++) {
          results.push(PathUtils.getExecutablePath("WebServerLauncher"));
        }

        const firstResult = results[0];
        for (const result of results) {
          expect(result).toBe(firstResult);
        }

        expect(mockRealpathSync).toHaveBeenCalledTimes(5);
      });
    });

    describe("错误恢复测试", () => {
      it("应该处理各种文件系统错误", () => {
        const errorCases = [
          new Error("ENOENT: no such file or directory"),
          new Error("EACCES: permission denied"),
          new Error("ELOOP: too many symbolic links encountered"),
          new Error("ENAMETOOLONG: name too long"),
          new Error("ENOTDIR: not a directory"),
        ];

        for (const error of errorCases) {
          process.argv = ["node", "/test/path/cli.js"];
          mockRealpathSync.mockImplementation(() => {
            throw error;
          });

          const result = PathUtils.getExecutablePath("test");
          const expected = path.join("/test/path", "test.js");

          expect(result).toBe(expected);
        }
      });

      it("应该在符号链接循环时回退到原路径", () => {
        process.argv = ["node", "/circular/symlink/xiaozhi"];
        mockRealpathSync.mockImplementation(() => {
          throw new Error("ELOOP: too many symbolic links encountered");
        });

        const result = PathUtils.getExecutablePath("WebServerLauncher");
        const expected = path.join("/circular/symlink", "WebServerLauncher.js");

        expect(result).toBe(expected);
      });
    });
  });

  describe("getWebServerLauncherPath 获取 WebServer 启动器路径", () => {
    it("应该返回正确的 WebServerLauncher 路径", () => {
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getWebServerLauncherPath();
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "WebServerLauncher.js"
      );

      expect(result).toBe(expected);
    });
  });

  describe("路径解析一致性", () => {
    it("应该在不同方法间保持一致的路径解析", () => {
      // 使用跨平台的路径格式
      const testCliPath = path.join("/test", "dist", "cli.js");
      process.argv = ["node", testCliPath];

      const webServerPath = PathUtils.getWebServerLauncherPath();
      const customPath = PathUtils.getExecutablePath("custom");

      // All paths should be in the same directory
      const webServerDir = path.dirname(webServerPath);
      const customDir = path.dirname(customPath);

      expect(webServerDir).toBe(customDir);
      // 使用跨平台的期望路径
      const expectedDir = path.join("/test", "dist");
      expect(customDir).toBe(expectedDir);
    });
  });

  describe("边界情况", () => {
    it("应该处理空的可执行文件名", () => {
      process.argv = ["node", "/test/dist/cli.js"];

      const result = PathUtils.getExecutablePath("");
      const expected = path.join("/test/dist", ".js");

      expect(result).toBe(expected);
    });

    it("应该处理带扩展名的可执行文件名", () => {
      process.argv = ["node", "/test/dist/cli.js"];

      const result = PathUtils.getExecutablePath("test.exe");
      const expected = path.join("/test/dist", "test.exe.js");

      expect(result).toBe(expected);
    });

    it("应该处理复杂的目录结构", () => {
      process.argv = [
        "node",
        "/very/deep/nested/directory/structure/dist/cli.js",
      ];

      const result = PathUtils.getExecutablePath("app");
      const expected = path.join(
        "/very/deep/nested/directory/structure/dist",
        "app.js"
      );

      expect(result).toBe(expected);
    });
  });
});
