import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathUtils } from "./PathUtils.js";

// Mock dependencies
vi.mock("./FileUtils.js", () => ({
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

// Mock process.argv and environment variables
const originalArgv = process.argv;
const originalEnv = process.env;

describe("PathUtils 路径工具", () => {
  let mockFileExists: any;
  let mockTmpdir: any;
  let mockFileURLToPath: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    const { FileUtils } = await import("./FileUtils.js");
    mockFileExists = vi.mocked(FileUtils.exists);
    mockTmpdir = vi.mocked(tmpdir);
    mockFileURLToPath = vi.mocked(fileURLToPath);

    // Default mock implementations
    mockFileExists.mockReturnValue(true);
    mockTmpdir.mockReturnValue("/tmp");
    mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe("getExecutablePath 获取可执行文件路径", () => {
    it("应该基于当前 CLI 脚本位置返回正确路径", () => {
      // Mock process.argv[1] to simulate CLI script path
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getExecutablePath("WebServerStandalone");
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "WebServerStandalone.js"
      );

      expect(result).toBe(expected);
    });

    it("应该处理不同的 CLI 脚本位置", () => {
      process.argv = ["node", "/opt/xiaozhi/dist/cli.js"];

      const result = PathUtils.getExecutablePath("mcpServerProxy");
      const expected = path.join("/opt/xiaozhi/dist", "mcpServerProxy.js");

      expect(result).toBe(expected);
    });

    it("应该支持相对路径", () => {
      process.argv = ["node", "./dist/cli.js"];

      const result = PathUtils.getExecutablePath("test");
      const expected = path.join("./dist", "test.js");

      expect(result).toBe(expected);
    });
  });

  describe("getWebServerStandalonePath 获取 WebServer 独立启动路径", () => {
    it("应该返回正确的 WebServerStandalone 路径", () => {
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getWebServerStandalonePath();
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "WebServerStandalone.js"
      );

      expect(result).toBe(expected);
    });
  });

  describe("getMcpServerProxyPath 获取 MCP 服务器代理路径", () => {
    it("应该返回正确的 mcpServerProxy 路径", () => {
      process.argv = ["node", "/Users/test/xiaozhi-client/dist/cli.js"];

      const result = PathUtils.getMcpServerProxyPath();
      const expected = path.join(
        "/Users/test/xiaozhi-client/dist",
        "mcpServerProxy.js"
      );

      expect(result).toBe(expected);
    });
  });

  describe("路径解析一致性", () => {
    it("应该在不同方法间保持一致的路径解析", () => {
      // 使用跨平台的路径格式
      const testCliPath = path.join("/test", "dist", "cli.js");
      process.argv = ["node", testCliPath];

      const webServerPath = PathUtils.getWebServerStandalonePath();
      const mcpProxyPath = PathUtils.getMcpServerProxyPath();
      const customPath = PathUtils.getExecutablePath("custom");

      // All paths should be in the same directory
      const webServerDir = path.dirname(webServerPath);
      const mcpProxyDir = path.dirname(mcpProxyPath);
      const customDir = path.dirname(customPath);

      expect(webServerDir).toBe(mcpProxyDir);
      expect(mcpProxyDir).toBe(customDir);
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
