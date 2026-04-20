import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getVersionDefine } from "../version";

// Mock node:fs 的 readFileSync
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

describe("getVersionDefine 获取版本注入配置", () => {
  let mockReadFileSync: ReturnType<typeof vi.mocked>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFileSync = vi.mocked(readFileSync);

    // 默认返回模拟的 package.json 内容
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "xiaozhi-client",
        version: "2.3.0",
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("基本功能", () => {
    it("应该返回包含 __VERSION__ 和 __APP_NAME__ 的对象", () => {
      const result = getVersionDefine("/fake/project/src/build");

      expect(result).toHaveProperty("__VERSION__");
      expect(result).toHaveProperty("__APP_NAME__");
      expect(Object.keys(result)).toHaveLength(2);
    });

    it("应该将版本号作为 JSON 字符串返回", () => {
      const result = getVersionDefine("/fake/project/src/build");

      // JSON.stringify 会给字符串值加引号
      expect(result.__VERSION__).toBe('"2.3.0"');
    });

    it("应该将包名作为 JSON 字符串返回", () => {
      const result = getVersionDefine("/fake/project/src/build");

      expect(result.__APP_NAME__).toBe('"xiaozhi-client"');
    });
  });

  describe("fromDir 参数", () => {
    it("应该使用传入的 fromDir 定位 package.json", () => {
      getVersionDefine("/custom/base/dir");

      // 应该从 fromDir 向上两级查找 package.json
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      const calledPath = mockReadFileSync.mock.calls[0][0] as string;
      expect(calledPath).toContain("package.json");
    });

    it("不传 fromDir 时应使用默认路径（基于 __dirname）", () => {
      // 不传参数，使用默认行为
      getVersionDefine();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      // 验证调用了 readFileSync
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        "utf-8"
      );
    });
  });

  describe("package.json 内容解析", () => {
    it("应该正确读取实际的版本号", () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          name: "test-pkg",
          version: "1.2.3-beta.1",
        })
      );

      const result = getVersionDefine("/fake/path");

      expect(result.__VERSION__).toBe('"1.2.3-beta.1"');
      expect(result.__APP_NAME__).toBe('"test-pkg"');
    });

    it("应该处理包含 scope 的包名", () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          name: "@scope/my-package",
          version: "3.0.0",
        })
      );

      const result = getVersionDefine("/fake/path");

      expect(result.__APP_NAME__).toBe('"@scope/my-package"');
      expect(result.__VERSION__).toBe('"3.0.0"');
    });
  });

  describe("边界场景", () => {
    it("应该始终使用 utf-8 编码读取文件", () => {
      getVersionDefine("/fake/path");

      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.any(String),
        "utf-8"
      );
    });

    it("应该只调用一次 readFileSync", () => {
      getVersionDefine("/fake/path");

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });
  });
});
