import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathUtils } from "../PathUtils.js";

// Mock dependencies
vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

vi.mock("node:fs", () => ({
  realpathSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  tmpdir: vi.fn(),
}));

// Mock process.argv and environment variables
const originalArgv = process.argv;
const originalEnv = process.env;

describe("PathUtils - 可执行文件路径", () => {
  let mockRealpathSync: any;
  let mockFileURLToPath: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRealpathSync = vi.mocked(realpathSync);
    mockFileURLToPath = vi.mocked(fileURLToPath);

    // Default mock implementations
    mockRealpathSync.mockImplementation((p: string) => p);
    mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe("getExecutablePath 获取可执行文件路径", () => {
    describe("CLI 自身复用（name='cli'）", () => {
      it("应该返回当前 CLI 脚本的解析后路径", () => {
        const cliPath = "/Users/test/xiaozhi-client/dist/cli/index.js";
        process.argv = ["node", cliPath];
        mockRealpathSync.mockReturnValue(cliPath);

        const result = PathUtils.getExecutablePath("cli");

        expect(result).toBe(cliPath);
        expect(mockRealpathSync).toHaveBeenCalledWith(cliPath);
      });

      it("应该正确解析符号链接到真实路径", () => {
        const symlinkPath = "/usr/local/bin/xiaozhi";
        const realPath =
          "/Users/nemo/.nvm/versions/node/v20.19.2/lib/node_modules/xiaozhi-client/dist/cli/index.js";

        process.argv = ["node", symlinkPath];
        mockRealpathSync.mockReturnValue(realPath);

        const result = PathUtils.getExecutablePath("cli");

        expect(result).toBe(realPath);
        expect(mockRealpathSync).toHaveBeenCalledWith(symlinkPath);
      });

      it("应该在符号链接解析失败时回退到原路径", () => {
        const cliPath = "/broken/symlink/xiaozhi";
        process.argv = ["node", cliPath];
        mockRealpathSync.mockImplementation(() => {
          throw new Error("ENOENT: no such file or directory");
        });

        // 解析失败时回退到原始路径
        const result = PathUtils.getExecutablePath("cli");
        expect(result).toBe(cliPath);
      });

      it("应该在 process.argv[1] 不存在时抛出错误", () => {
        process.argv = ["node"];

        expect(() => PathUtils.getExecutablePath("cli")).toThrow(
          "无法确定 CLI 脚本路径"
        );
      });
    });

    describe("其他可执行文件（非 cli）", () => {
      it("应该从项目根目录的 dist 中查找可执行文件", () => {
        // mockFileURLToPath 决定项目根目录
        mockFileURLToPath.mockReturnValue(
          "/project/src/cli/utils/PathUtils.js"
        );

        const result = PathUtils.getExecutablePath("WebServerLauncher");
        // 项目根目录是 /project/src 向上 3 级 = /project
        // 路径应为 /project/dist/WebServerLauncher.js
        expect(result).toContain("dist");
        expect(result).toContain("WebServerLauncher.js");
      });

      it("应该正确构建不同名称的可执行文件路径", () => {
        mockFileURLToPath.mockReturnValue("/app/src/cli/utils/PathUtils.js");

        const testCases = ["customScript", "app", "tool"];

        for (const name of testCases) {
          const result = PathUtils.getExecutablePath(name);
          expect(result).toContain(`dist/${name}.js`);
        }
      });
    });
  });

  describe("getWebServerLauncherPath 获取 WebServer 启动器路径", () => {
    it("应该返回项目根目录 dist 下的 WebServerLauncher.js", () => {
      mockFileURLToPath.mockReturnValue(
        "/Users/test/xiaozhi-client/src/cli/utils/PathUtils.js"
      );

      const result = PathUtils.getWebServerLauncherPath();

      // 应该指向 <projectRoot>/dist/WebServerLauncher.js
      expect(result).toContain("dist");
      expect(result).toContain("WebServerLauncher.js");
      expect(result).toMatch(/WebServerLauncher\.js$/);
    });

    it("应该在不同项目位置下返回正确的相对路径", () => {
      const testCases = [
        {
          scriptDir: "/home/user/project/src/cli/utils/PathUtils.js",
          expectedPrefix: "/home/user/project",
        },
        {
          scriptDir: "/opt/app/src/cli/utils/PathUtils.js",
          expectedPrefix: "/opt/app",
        },
      ];

      for (const { scriptDir, expectedPrefix } of testCases) {
        mockFileURLToPath.mockReturnValue(scriptDir);

        const result = PathUtils.getWebServerLauncherPath();
        expect(result).toBe(
          path.join(expectedPrefix, "dist", "WebServerLauncher.js")
        );
      }
    });
  });

  describe("集成测试", () => {
    it("应该模拟真实的 npm 全局安装环境", () => {
      const npmBinPath = "/Users/user/.nvm/versions/node/v18.17.0/bin/xiaozhi";
      const npmRealPath =
        "/Users/user/.nvm/versions/node/v18.17.0/lib/node_modules/xiaozhi-client/dist/cli/index.js";

      process.argv = ["node", npmBinPath];
      mockRealpathSync.mockReturnValue(npmRealPath);

      // CLI 自身复用
      const cliPath = PathUtils.getExecutablePath("cli");
      expect(cliPath).toBe(npmRealPath);

      // WebServerLauncher 从项目根目录查找
      mockFileURLToPath.mockReturnValue(
        npmRealPath.replace("/dist/cli/index.js", "/src/cli/utils/PathUtils.js")
      );
      const webServerPath = PathUtils.getWebServerLauncherPath();
      expect(webServerPath).toContain("dist/WebServerLauncher.js");
    });

    it("应该确保多次调用结果一致", () => {
      process.argv = ["/usr/bin/node", "/app/dist/cli/index.js"];
      mockRealpathSync.mockReturnValue("/app/dist/cli/index.js");

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(PathUtils.getExecutablePath("cli"));
      }

      // 所有结果应该相同
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe("/app/dist/cli/index.js");
    });
  });

  describe("错误处理", () => {
    it("应该处理各种文件系统错误（CLI 模式）", () => {
      const errorCases = [
        new Error("ENOENT: no such file or directory"),
        new Error("EACCES: permission denied"),
        new Error("ELOOP: too many symbolic links encountered"),
      ];

      for (const error of errorCases) {
        process.argv = ["node", "/test/path/cli"];
        mockRealpathSync.mockImplementation(() => {
          throw error;
        });

        // 解析失败时回退到原始路径，不抛错
        const result = PathUtils.getExecutablePath("cli");
        expect(result).toBe("/test/path/cli");
      }
    });
  });
});
