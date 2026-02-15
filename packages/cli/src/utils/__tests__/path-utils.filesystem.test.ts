import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathUtils } from "../PathUtils.js";

// Mock dependencies
vi.mock("../FileUtils.js", () => ({
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

// Mock environment variables
const originalEnv = process.env;

describe("PathUtils - 文件系统路径", () => {
  let mockFileExists: any;
  let mockTmpdir: any;
  let mockFileURLToPath: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    const { FileUtils } = await import("../FileUtils.js");
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
    process.env = originalEnv;
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
});
