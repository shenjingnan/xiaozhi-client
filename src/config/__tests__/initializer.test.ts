/**
 * ConfigInitializer 配置初始化器单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigInitializer } from "../initializer";

// 使用 vi.hoisted 定义 mock 变量，确保在 vi.mock 提升之前可用
const {
  mockExistsSync,
  mockMkdirSync,
  mockReaddirSync,
  mockStatSync,
  mockCopyFileSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  copyFileSync: mockCopyFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
  default: {
    copyFileSync: mockCopyFileSync,
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
  },
}));

describe("ConfigInitializer 配置初始化器", () => {
  const originalHome = process.env.HOME;
  const originalUserprofile = process.env.USERPROFILE;

  beforeEach(() => {
    vi.clearAllMocks();
    // 默认设置 HOME 环境变量
    process.env.HOME = "/tmp/test-home";
    process.env.USERPROFILE = undefined;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserprofile;
    vi.restoreAllMocks();
  });

  describe("initializeDefaultConfig 初始化默认配置", () => {
    it("当无法获取用户家目录时应抛出错误（覆盖 !homeDir 分支）", async () => {
      // 同时清除 HOME 和 USERPROFILE
      process.env.HOME = undefined as unknown as string | undefined;
      process.env.USERPROFILE = undefined as unknown as string | undefined;

      await expect(ConfigInitializer.initializeDefaultConfig()).rejects.toThrow(
        "无法获取用户家目录"
      );
    });

    it("当 HOME 为空字符串时应抛出错误", async () => {
      process.env.HOME = "";
      process.env.USERPROFILE = undefined as unknown as string | undefined;

      await expect(ConfigInitializer.initializeDefaultConfig()).rejects.toThrow(
        "无法获取用户家目录"
      );
    });

    it("当 USERPROFILE 存在但为空时也应抛出错误", async () => {
      process.env.HOME = undefined as unknown as string | undefined;
      process.env.USERPROFILE = "";

      await expect(ConfigInitializer.initializeDefaultConfig()).rejects.toThrow(
        "无法获取用户家目录"
      );
    });

    it("当配置目录已存在时应直接返回路径（跳过复制）", async () => {
      process.env.HOME = "/tmp/existing-home";

      // existsSync: .xiaozhi-client 目录已存在
      mockExistsSync.mockImplementation((path: string) =>
        path.includes(".xiaozhi-client")
      );

      const result = await ConfigInitializer.initializeDefaultConfig();

      expect(result).toContain(".xiaozhi-client");
      // 不应调用 mkdirSync（因为目录已存在）
      expect(mockMkdirSync).not.toHaveBeenCalled();
      // 不应调用 copyFileSync
      expect(mockCopyFileSync).not.toHaveBeenCalled();
    });

    it("当模板目录不存在时应抛出错误", async () => {
      process.env.HOME = "/tmp/new-home";

      // 所有路径都不存在 → 需要创建目录，但模板也不存在
      let callCount = 0;
      mockExistsSync.mockImplementation(() => {
        callCount++;
        // 第一次调用检查 .xiaozhi-client 目录（不存在）
        // 后续可能检查模板目录（也不存在）
        return false;
      });

      await expect(ConfigInitializer.initializeDefaultConfig()).rejects.toThrow(
        "默认配置模板不存在"
      );
    });

    it("当模板目录存在时应递归复制文件", async () => {
      process.env.HOME = "/tmp/fresh-home";

      let existsCallCount = 0;
      mockExistsSync.mockImplementation((path: string) => {
        existsCallCount++;
        if (path.includes(".xiaozhi-client")) return false; // 目标目录不存在
        if (path.includes("template")) return true; // 模板目录存在
        return false;
      });

      // readdirSync 返回模板内容
      mockReaddirSync.mockReturnValue(["config.json", "prompts"]);
      // statSync: config.json 是文件，prompts 是目录
      let statCallCount = 0;
      mockStatSync.mockImplementation(() => {
        statCallCount++;
        return { isDirectory: () => statCallCount === 2 };
      });

      const result = await ConfigInitializer.initializeDefaultConfig();

      expect(result).toContain(".xiaozhi-client");
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockCopyFileSync).toHaveBeenCalled();
    });
  });
});
