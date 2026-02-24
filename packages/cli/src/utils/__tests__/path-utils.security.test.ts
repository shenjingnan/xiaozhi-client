import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathUtils } from "../PathUtils.js";

// Mock dependencies
vi.mock("node:os", () => ({
  tmpdir: vi.fn(),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

// Mock environment variables
const originalEnv = process.env;

describe("PathUtils - 路径安全性", () => {
  let mockTmpdir: any;
  let mockFileURLToPath: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    mockTmpdir = vi.mocked(tmpdir);
    mockFileURLToPath = vi.mocked(fileURLToPath);

    // Default mock implementations
    mockTmpdir.mockReturnValue("/tmp");
    mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
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

      // 测试完整的路径解析流程
      const configDir = PathUtils.getConfigDir();
      const workDir = PathUtils.getWorkDir();

      expect(configDir).toBe("/test/config");
      expect(workDir).toBe(path.join("/test/config", ".xiaozhi"));
    });

    it("应该在没有配置的情况下使用合理的默认值", () => {
      // 清除所有环境变量
      process.env.XIAOZHI_CONFIG_DIR = undefined;
      process.env.TMPDIR = undefined;
      process.env.TEMP = undefined;
      process.env.HOME = undefined;
      process.env.USERPROFILE = undefined;

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
