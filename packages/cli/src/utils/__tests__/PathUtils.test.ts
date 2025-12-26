import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PathUtils } from "@cli/utils/PathUtils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@cli/utils/FileUtils.js", () => ({
  FileUtils: {
    exists: vi.fn(),
  },
}));

vi.mock("node:os", () => ({
  tmpdir: vi.fn(),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

vi.mock("node:fs", () => ({
  realpathSync: vi.fn(),
}));

// Mock process.argv and environment variables
const originalArgv = process.argv;
const originalEnv = process.env;

describe("PathUtils 路径工具", () => {
  let mockFileExists: any;
  let mockTmpdir: any;
  let mockFileURLToPath: any;
  let mockRealpathSync: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    const { FileUtils } = await import("@cli/utils/FileUtils.js");
    mockFileExists = vi.mocked(FileUtils.exists);
    mockTmpdir = vi.mocked(tmpdir);
    mockFileURLToPath = vi.mocked(fileURLToPath);
    mockRealpathSync = vi.mocked(realpathSync);

    // Default mock implementations
    mockFileExists.mockReturnValue(true);
    mockTmpdir.mockReturnValue("/tmp");
    mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");
    mockRealpathSync.mockImplementation((path: string) => path); // 默认返回原路径

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

  describe("getPidFile 获取 PID 文件路径", () => {
    it("应该使用环境变量中的配置目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/custom/config";

      const result = PathUtils.getPidFile();
      const expected = path.join("/custom/config", ".xiaozhi-mcp-service.pid");

      expect(result).toBe(expected);
    });

    it("应该在没有环境变量时使用当前工作目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = undefined;
      const originalCwd = process.cwd();

      const result = PathUtils.getPidFile();
      const expected = path.join(originalCwd, ".xiaozhi-mcp-service.pid");

      expect(result).toBe(expected);
    });

    it("应该处理空的环境变量", () => {
      process.env.XIAOZHI_CONFIG_DIR = "";
      const originalCwd = process.cwd();

      const result = PathUtils.getPidFile();
      const expected = path.join(originalCwd, ".xiaozhi-mcp-service.pid");

      expect(result).toBe(expected);
    });
  });

  describe("getLogFile 获取日志文件路径", () => {
    it("应该使用提供的项目目录", () => {
      const projectDir = "/custom/project";

      const result = PathUtils.getLogFile(projectDir);
      const expected = path.join(projectDir, "xiaozhi.log");

      expect(result).toBe(expected);
    });

    it("应该在没有项目目录时使用当前工作目录", () => {
      const originalCwd = process.cwd();

      const result = PathUtils.getLogFile();
      const expected = path.join(originalCwd, "xiaozhi.log");

      expect(result).toBe(expected);
    });

    it("应该处理空字符串项目目录", () => {
      const originalCwd = process.cwd();

      const result = PathUtils.getLogFile("");
      const expected = path.join(originalCwd, "xiaozhi.log");

      expect(result).toBe(expected);
    });
  });

  describe("getConfigDir 获取配置目录路径", () => {
    it("应该返回环境变量中的配置目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/env/config";

      const result = PathUtils.getConfigDir();

      expect(result).toBe("/env/config");
    });

    it("应该在没有环境变量时返回当前工作目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = undefined;
      const originalCwd = process.cwd();

      const result = PathUtils.getConfigDir();

      expect(result).toBe(originalCwd);
    });
  });

  describe("getWorkDir 获取工作目录路径", () => {
    it("应该基于配置目录返回工作目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/custom/config";

      const result = PathUtils.getWorkDir();
      const expected = path.join("/custom/config", ".xiaozhi");

      expect(result).toBe(expected);
    });

    it("应该在没有配置目录时基于当前工作目录", () => {
      process.env.XIAOZHI_CONFIG_DIR = undefined;
      const originalCwd = process.cwd();

      const result = PathUtils.getWorkDir();
      const expected = path.join(originalCwd, ".xiaozhi");

      expect(result).toBe(expected);
    });
  });

  describe("getTemplatesDir 获取模板目录路径", () => {
    it("应该返回所有可能的模板目录路径", () => {
      mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

      const result = PathUtils.getTemplatesDir();

      expect(result).toHaveLength(3);
      expect(result[0]).toContain("templates");
      expect(result[1]).toContain("templates");
      expect(result[2]).toContain("templates");
    });

    it("应该处理不同的脚本位置", () => {
      mockFileURLToPath.mockReturnValue(
        "/different/path/cli/utils/PathUtils.js"
      );

      const result = PathUtils.getTemplatesDir();

      expect(result).toHaveLength(3);
      expect(result[0]).toBe(
        path.join("/different/path/cli/utils", "templates")
      );
    });
  });

  describe("findTemplatesDir 查找模板目录", () => {
    it("应该返回第一个存在的模板目录", () => {
      mockFileExists
        .mockReturnValueOnce(false) // 第一个不存在
        .mockReturnValueOnce(true); // 第二个存在

      const result = PathUtils.findTemplatesDir();

      expect(result).not.toBeNull();
      expect(mockFileExists).toHaveBeenCalledTimes(2);
    });

    it("应该在没有找到模板目录时返回 null", () => {
      mockFileExists.mockReturnValue(false);

      const result = PathUtils.findTemplatesDir();

      expect(result).toBeNull();
      expect(mockFileExists).toHaveBeenCalledTimes(3);
    });

    it("应该返回第一个匹配的目录", () => {
      mockFileExists.mockReturnValue(true);

      const result = PathUtils.findTemplatesDir();

      expect(result).not.toBeNull();
      expect(mockFileExists).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTemplatePath 获取模板路径", () => {
    it("应该返回存在的模板路径", () => {
      const templateName = "test-template";
      mockFileExists
        .mockReturnValueOnce(true) // findTemplatesDir 找到目录
        .mockReturnValueOnce(true); // 模板文件存在

      const result = PathUtils.getTemplatePath(templateName);

      expect(result).not.toBeNull();
      expect(result).toContain(templateName);
    });

    it("应该在模板目录不存在时返回 null", () => {
      mockFileExists.mockReturnValue(false);

      const result = PathUtils.getTemplatePath("test-template");

      expect(result).toBeNull();
    });

    it("应该在模板文件不存在时返回 null", () => {
      mockFileExists
        .mockReturnValueOnce(true) // findTemplatesDir 找到目录
        .mockReturnValueOnce(false); // 模板文件不存在

      const result = PathUtils.getTemplatePath("non-existent-template");

      expect(result).toBeNull();
    });
  });

  describe("getScriptDir 获取脚本目录路径", () => {
    it("应该返回脚本所在目录", () => {
      mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

      const result = PathUtils.getScriptDir();

      expect(result).toBe("/test/src/cli/utils");
      expect(mockFileURLToPath).toHaveBeenCalledWith(expect.any(String));
    });

    it("应该处理不同的脚本路径", () => {
      mockFileURLToPath.mockReturnValue("/different/path/script.js");

      const result = PathUtils.getScriptDir();

      expect(result).toBe("/different/path");
    });
  });

  describe("getProjectRoot 获取项目根目录路径", () => {
    it("应该从脚本目录计算项目根目录", () => {
      mockFileURLToPath.mockReturnValue("/project/src/cli/utils/PathUtils.js");

      const result = PathUtils.getProjectRoot();
      // 使用跨平台的路径比较
      const expected = path.normalize("/project");

      expect(result).toBe(expected);
    });

    it("应该处理不同深度的脚本路径", () => {
      mockFileURLToPath.mockReturnValue(
        "/deep/nested/src/cli/utils/PathUtils.js"
      );

      const result = PathUtils.getProjectRoot();
      // 使用跨平台的路径比较
      const expected = path.normalize("/deep/nested");

      expect(result).toBe(expected);
    });
  });

  describe("getDistDir 获取构建输出目录路径", () => {
    it("应该返回项目根目录下的 dist 目录", () => {
      mockFileURLToPath.mockReturnValue("/project/src/cli/utils/PathUtils.js");

      const result = PathUtils.getDistDir();
      const expected = path.join("/project", "dist");

      expect(result).toBe(expected);
    });
  });

  describe("getRelativePath 获取相对路径", () => {
    it("应该返回相对于项目根目录的路径", () => {
      mockFileURLToPath.mockReturnValue("/project/src/cli/utils/PathUtils.js");
      const filePath = "/project/src/test/file.js";

      const result = PathUtils.getRelativePath(filePath);
      const expected = path.relative("/project", filePath);

      expect(result).toBe(expected);
    });

    it("应该处理项目外的文件路径", () => {
      mockFileURLToPath.mockReturnValue("/project/src/cli/utils/PathUtils.js");
      const filePath = "/outside/project/file.js";

      const result = PathUtils.getRelativePath(filePath);

      expect(result).toContain("..");
    });
  });

  describe("resolveConfigPath 解析配置文件路径", () => {
    it("应该返回指定格式的配置文件路径", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/config";

      const result = PathUtils.resolveConfigPath("json5");
      const expected = path.join("/config", "xiaozhi.config.json5");

      expect(result).toBe(expected);
    });

    it("应该按优先级查找存在的配置文件", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/config";
      mockFileExists
        .mockReturnValueOnce(false) // json5 不存在
        .mockReturnValueOnce(true); // jsonc 存在

      const result = PathUtils.resolveConfigPath();
      const expected = path.join("/config", "xiaozhi.config.jsonc");

      expect(result).toBe(expected);
    });

    it("应该在没有找到配置文件时返回默认路径", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/config";
      mockFileExists.mockReturnValue(false);

      const result = PathUtils.resolveConfigPath();
      const expected = path.join("/config", "xiaozhi.config.json");

      expect(result).toBe(expected);
    });

    it("应该处理所有支持的配置文件格式", () => {
      process.env.XIAOZHI_CONFIG_DIR = "/config";

      const formats = ["json", "json5", "jsonc"] as const;

      for (const format of formats) {
        const result = PathUtils.resolveConfigPath(format);
        const expected = path.join("/config", `xiaozhi.config.${format}`);
        expect(result).toBe(expected);
      }
    });
  });

  describe("getDefaultConfigPath 获取默认配置文件路径", () => {
    it("应该返回项目根目录下的默认配置文件路径", () => {
      mockFileURLToPath.mockReturnValue("/project/src/cli/utils/PathUtils.js");

      const result = PathUtils.getDefaultConfigPath();
      const expected = path.join("/project", "xiaozhi.config.default.json");

      expect(result).toBe(expected);
    });
  });

  describe("validatePath 验证路径安全性", () => {
    it("应该验证安全的路径", () => {
      const safePaths = [
        "normal/path/file.txt",
        "./relative/path",
        "file.txt",
        "dir/subdir/file.ext",
      ];

      for (const safePath of safePaths) {
        const result = PathUtils.validatePath(safePath);
        expect(result).toBe(true);
      }
    });

    it("应该拒绝包含路径遍历的路径", () => {
      const unsafePaths = [
        "../../../etc/passwd",
        "dir/../../../secret",
        "normal/../../../file",
        "..\\..\\windows\\system32",
      ];

      for (const unsafePath of unsafePaths) {
        const result = PathUtils.validatePath(unsafePath);
        expect(result).toBe(false);
      }
    });

    it("应该处理复杂的路径遍历尝试", () => {
      const complexUnsafePaths = [
        "dir/./../../file",
        "normal/path/../../../../../../etc/passwd",
        "./../config",
      ];

      for (const unsafePath of complexUnsafePaths) {
        const result = PathUtils.validatePath(unsafePath);
        expect(result).toBe(false);
      }
    });
  });

  describe("ensurePathWithin 确保路径在指定目录内", () => {
    it("应该返回在基础目录内的安全路径", () => {
      const baseDir = "/safe/base";
      const inputPath = "subdir/file.txt";

      const result = PathUtils.ensurePathWithin(inputPath, baseDir);
      const expected = path.resolve(baseDir, inputPath);

      expect(result).toBe(expected);
      expect(result.startsWith(path.resolve(baseDir))).toBe(true);
    });

    it("应该拒绝超出基础目录的路径", () => {
      const baseDir = "/safe/base";
      const inputPath = "../../../etc/passwd";

      expect(() => {
        PathUtils.ensurePathWithin(inputPath, baseDir);
      }).toThrow("路径 ../../../etc/passwd 超出了允许的范围");
    });

    it("应该处理绝对路径", () => {
      const baseDir = "/safe/base";
      const inputPath = "/safe/base/subdir/file.txt";

      const result = PathUtils.ensurePathWithin(inputPath, baseDir);

      expect(result).toBe(path.resolve(inputPath));
    });

    it("应该拒绝指向基础目录外的绝对路径", () => {
      const baseDir = "/safe/base";
      const inputPath = "/dangerous/path/file.txt";

      expect(() => {
        PathUtils.ensurePathWithin(inputPath, baseDir);
      }).toThrow("路径 /dangerous/path/file.txt 超出了允许的范围");
    });
  });

  describe("createSafePath 创建安全的文件路径", () => {
    it("应该创建安全的路径", () => {
      const segments = ["dir", "subdir", "file.txt"];

      const result = PathUtils.createSafePath(...segments);
      const expected = path.normalize(path.join(...segments));

      expect(result).toBe(expected);
    });

    it("应该拒绝包含危险字符的路径", () => {
      // 测试会导致规范化后包含 ".." 的路径
      const dangerousSegments = [
        ["dir", "..", "file.txt"], // 规范化后: dir/../file.txt -> file.txt (不包含 "..")
        ["~", "file.txt"], // 规范化后: ~/file.txt (包含 "~")
        ["dir", "subdir", "../../../etc/passwd"], // 规范化后: ../etc/passwd (包含 "..")
      ];

      // 只有包含 "~" 或规范化后仍包含 ".." 的路径会抛出错误
      expect(() => {
        PathUtils.createSafePath("~", "file.txt");
      }).toThrow();

      expect(() => {
        PathUtils.createSafePath("dir", "subdir", "../../../etc/passwd");
      }).toThrow();

      // 这个不会抛出错误，因为规范化后是 "file.txt"
      expect(() => {
        PathUtils.createSafePath("dir", "..", "file.txt");
      }).not.toThrow();
    });

    it("应该处理空的路径段", () => {
      const result = PathUtils.createSafePath("dir", "", "file.txt");
      const expected = path.normalize(path.join("dir", "", "file.txt"));

      expect(result).toBe(expected);
    });

    it("应该处理单个路径段", () => {
      const result = PathUtils.createSafePath("file.txt");

      expect(result).toBe("file.txt");
    });
  });

  describe("getTempDir 获取临时目录路径", () => {
    it("应该返回系统临时目录", () => {
      process.env.TMPDIR = undefined;
      process.env.TEMP = undefined;
      mockTmpdir.mockReturnValue("/system/tmp");

      const result = PathUtils.getTempDir();

      expect(result).toBe("/system/tmp");
      expect(mockTmpdir).toHaveBeenCalled();
    });

    it("应该优先使用 TMPDIR 环境变量", () => {
      process.env.TMPDIR = "/custom/tmp";

      const result = PathUtils.getTempDir();

      expect(result).toBe("/custom/tmp");
    });

    it("应该使用 TEMP 环境变量作为备选", () => {
      process.env.TMPDIR = undefined;
      process.env.TEMP = "/windows/temp";

      const result = PathUtils.getTempDir();

      expect(result).toBe("/windows/temp");
    });

    it("应该在没有环境变量时使用系统默认", () => {
      process.env.TMPDIR = undefined;
      process.env.TEMP = undefined;
      mockTmpdir.mockReturnValue("/default/tmp");

      const result = PathUtils.getTempDir();

      expect(result).toBe("/default/tmp");
    });
  });

  describe("getHomeDir 获取用户主目录路径", () => {
    it("应该返回 HOME 环境变量", () => {
      process.env.HOME = "/home/user";
      process.env.USERPROFILE = undefined;

      const result = PathUtils.getHomeDir();

      expect(result).toBe("/home/user");
    });

    it("应该使用 USERPROFILE 作为备选", () => {
      process.env.HOME = undefined;
      process.env.USERPROFILE = "C:\\Users\\user";

      const result = PathUtils.getHomeDir();

      expect(result).toBe("C:\\Users\\user");
    });

    it("应该在没有环境变量时返回空字符串", () => {
      process.env.HOME = undefined;
      process.env.USERPROFILE = undefined;

      const result = PathUtils.getHomeDir();

      expect(result).toBe("");
    });

    it("应该优先使用 HOME 而不是 USERPROFILE", () => {
      process.env.HOME = "/home/user";
      process.env.USERPROFILE = "C:\\Users\\user";

      const result = PathUtils.getHomeDir();

      expect(result).toBe("/home/user");
    });
  });

  describe("边界条件和特殊情况", () => {
    it("应该处理空字符串路径", () => {
      expect(() => PathUtils.createSafePath("")).not.toThrow();
      expect(PathUtils.validatePath("")).toBe(true);
    });

    it("应该处理非常长的路径", () => {
      const longPath = "a".repeat(1000);

      expect(PathUtils.validatePath(longPath)).toBe(true);
      expect(() => PathUtils.createSafePath(longPath)).not.toThrow();
    });

    it("应该处理包含特殊字符的路径", () => {
      const specialChars = [
        "file name with spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
      ];

      for (const fileName of specialChars) {
        expect(PathUtils.validatePath(fileName)).toBe(true);
        expect(() => PathUtils.createSafePath("dir", fileName)).not.toThrow();
      }
    });

    it("应该处理 Unicode 字符", () => {
      const unicodePaths = ["文件.txt", "file.txt", "ファイル.txt"];

      for (const unicodePath of unicodePaths) {
        expect(PathUtils.validatePath(unicodePath)).toBe(true);
        expect(() =>
          PathUtils.createSafePath("dir", unicodePath)
        ).not.toThrow();
      }
    });

    it("应该处理路径分隔符的不同组合", () => {
      const paths = [
        "dir/file.txt",
        "dir\\file.txt",
        "./dir/file.txt",
        ".\\dir\\file.txt",
      ];

      for (const testPath of paths) {
        if (!testPath.includes("..")) {
          expect(PathUtils.validatePath(testPath)).toBe(true);
        }
      }
    });
  });

  describe("跨平台兼容性", () => {
    it("应该处理 Windows 风格的路径", () => {
      const windowsPaths = [
        "C:\\Users\\user\\file.txt",
        "D:\\Projects\\app\\config.json",
        "\\\\server\\share\\file.txt",
      ];

      for (const windowsPath of windowsPaths) {
        expect(() =>
          PathUtils.ensurePathWithin("file.txt", windowsPath)
        ).not.toThrow();
      }
    });

    it("应该处理 Unix 风格的路径", () => {
      const unixPaths = [
        "/home/user/file.txt",
        "/var/log/app.log",
        "/tmp/temp-file.txt",
      ];

      for (const unixPath of unixPaths) {
        expect(() =>
          PathUtils.ensurePathWithin("file.txt", unixPath)
        ).not.toThrow();
      }
    });

    it("应该正确处理路径规范化", () => {
      const pathsToNormalize = [
        { path: "dir/./file.txt", shouldPass: true }, // 规范化后: dir/file.txt
        { path: "dir//file.txt", shouldPass: true }, // 规范化后: dir/file.txt
        { path: "dir/subdir/../file.txt", shouldPass: true }, // 规范化后: dir/file.txt (不包含 "..")
        { path: "../../../etc/passwd", shouldPass: false }, // 规范化后: ../../../etc/passwd (包含 "..")
      ];

      for (const { path: pathToNormalize, shouldPass } of pathsToNormalize) {
        const result = PathUtils.validatePath(pathToNormalize);
        expect(result).toBe(shouldPass);
      }
    });
  });

  describe("错误处理", () => {
    it("应该在 fileURLToPath 失败时处理错误", () => {
      mockFileURLToPath.mockImplementation(() => {
        throw new Error("Invalid URL");
      });

      expect(() => PathUtils.getScriptDir()).toThrow("Invalid URL");
    });

    it("应该处理无效的环境变量值", () => {
      process.env.XIAOZHI_CONFIG_DIR = null as any;

      const result = PathUtils.getConfigDir();

      expect(result).toBe(process.cwd());
    });

    it("应该处理 tmpdir 函数失败", () => {
      mockTmpdir.mockImplementation(() => {
        throw new Error("Cannot access temp directory");
      });
      process.env.TMPDIR = undefined;
      process.env.TEMP = undefined;

      expect(() => PathUtils.getTempDir()).toThrow(
        "Cannot access temp directory"
      );
    });
  });

  describe("性能和内存测试", () => {
    it("应该高效处理大量路径操作", () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        PathUtils.validatePath(`path/to/file${i}.txt`);
        PathUtils.createSafePath("dir", `file${i}.txt`);
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // 应该在 100ms 内完成
    });

    it("应该正确处理重复的路径操作", () => {
      const samePath = "test/path/file.txt";

      for (let i = 0; i < 100; i++) {
        const result1 = PathUtils.validatePath(samePath);
        const result2 = PathUtils.createSafePath("test", "path", "file.txt");

        expect(result1).toBe(true);
        expect(result2).toContain("file.txt");
      }
    });
  });

  describe("集成测试", () => {
    it("应该在完整的工作流程中正确工作", () => {
      // 设置环境
      process.env.XIAOZHI_CONFIG_DIR = "/test/config";
      mockFileExists.mockReturnValue(true);
      mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

      // 测试完整的路径解析流程
      const configDir = PathUtils.getConfigDir();
      const workDir = PathUtils.getWorkDir();
      const configPath = PathUtils.resolveConfigPath("json");
      const pidFile = PathUtils.getPidFile();

      expect(configDir).toBe("/test/config");
      expect(workDir).toBe(path.join("/test/config", ".xiaozhi"));
      expect(configPath).toBe(path.join("/test/config", "xiaozhi.config.json"));
      expect(pidFile).toBe(
        path.join("/test/config", ".xiaozhi-mcp-service.pid")
      );
    });

    it("应该在没有配置的情况下使用合理的默认值", () => {
      // 清除所有环境变量
      process.env.XIAOZHI_CONFIG_DIR = undefined;
      process.env.TMPDIR = undefined;
      process.env.TEMP = undefined;
      process.env.HOME = undefined;
      process.env.USERPROFILE = undefined;

      mockFileExists.mockReturnValue(false);
      mockTmpdir.mockReturnValue("/system/tmp");

      const configDir = PathUtils.getConfigDir();
      const tempDir = PathUtils.getTempDir();
      const homeDir = PathUtils.getHomeDir();

      expect(configDir).toBe(process.cwd());
      expect(tempDir).toBe("/system/tmp");
      expect(homeDir).toBe("");
    });
  });
});
