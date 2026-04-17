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

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

// Mock environment variables
const originalEnv = process.env;

describe("PathUtils - 配置路径", () => {
  let mockFileExists: any;
  let mockFileURLToPath: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    const { FileUtils } = await import("../FileUtils.js");
    mockFileExists = vi.mocked(FileUtils.exists);
    mockFileURLToPath = vi.mocked(fileURLToPath);

    // Default mock implementations
    mockFileExists.mockReturnValue(true);
    mockFileURLToPath.mockReturnValue("/test/src/cli/utils/PathUtils.js");

    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
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
});
