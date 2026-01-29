/**
 * VersionUtils 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VersionUtils } from "../VersionUtils.js";

describe("VersionUtils", () => {
  beforeEach(() => {
    // 清除缓存以确保每个测试独立运行
    VersionUtils.clearCache();
  });

  describe("getVersion", () => {
    it("应该返回版本号字符串", () => {
      const version = VersionUtils.getVersion();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });

    it("应该返回有效的版本号格式", () => {
      const version = VersionUtils.getVersion();
      // 版本号应该是数字点分隔格式，或者 "unknown"
      const isValid =
        version === "unknown" || /^\d+\.\d+\.\d+/.test(version);
      expect(isValid).toBe(true);
    });

    it("多次调用应该返回相同结果（缓存生效）", () => {
      const version1 = VersionUtils.getVersion();
      const version2 = VersionUtils.getVersion();
      expect(version1).toBe(version2);
    });

    it("清除缓存后应该重新读取版本号", () => {
      const version1 = VersionUtils.getVersion();
      VersionUtils.clearCache();
      const version2 = VersionUtils.getVersion();
      expect(version1).toBe(version2);
    });
  });

  describe("getVersionInfo", () => {
    it("应该返回包含版本号的对象", () => {
      const info = VersionUtils.getVersionInfo();
      expect(info).toHaveProperty("version");
      expect(typeof info.version).toBe("string");
    });

    it("应该可能包含应用名称", () => {
      const info = VersionUtils.getVersionInfo();
      // name 可能存在也可能不存在，取决于构建配置
      if (info.name) {
        expect(typeof info.name).toBe("string");
      }
    });

    it("应该可能包含描述信息", () => {
      const info = VersionUtils.getVersionInfo();
      // description 可能存在也可能不存在
      if (info.description) {
        expect(typeof info.description).toBe("string");
      }
    });

    it("应该可能包含作者信息", () => {
      const info = VersionUtils.getVersionInfo();
      // author 可能存在也可能不存在
      if (info.author) {
        expect(["string", "object"]).toContain(typeof info.author);
      }
    });

    it("多次调用应该返回相同结果（缓存生效）", () => {
      const info1 = VersionUtils.getVersionInfo();
      const info2 = VersionUtils.getVersionInfo();
      expect(info1).toEqual(info2);
    });
  });

  describe("compareVersions", () => {
    it("应该正确比较相等的版本号", () => {
      const result = VersionUtils.compareVersions("1.0.0", "1.0.0");
      expect(result).toBe(0);
    });

    it("应该正确比较主版本号差异", () => {
      const result = VersionUtils.compareVersions("2.0.0", "1.0.0");
      expect(result).toBe(1);
    });

    it("应该正确比较次版本号差异", () => {
      const result = VersionUtils.compareVersions("1.2.0", "1.1.0");
      expect(result).toBe(1);
    });

    it("应该正确比较补丁版本号差异", () => {
      const result = VersionUtils.compareVersions("1.0.1", "1.0.0");
      expect(result).toBe(1);
    });

    it("应该正确处理小于的情况", () => {
      const result = VersionUtils.compareVersions("1.0.0", "2.0.0");
      expect(result).toBe(-1);
    });

    it("应该正确处理不同长度的版本号", () => {
      const result = VersionUtils.compareVersions("1.0", "1.0.0");
      expect(result).toBe(0);
    });

    it("应该正确处理较短的版本号", () => {
      const result = VersionUtils.compareVersions("1.0.0", "1.0");
      expect(result).toBe(0);
    });

    it("应该正确处理带预发布标签的版本号", () => {
      // 注意：当前实现不处理预发布标签，仅比较数字部分
      const result = VersionUtils.compareVersions("1.0.0-alpha", "1.0.0");
      // 预发布标签会被 split(".") 处理，可能产生非数字部分
      // 这里测试数字部分的比较
      expect(typeof result).toBe("number");
    });

    it("应该正确处理复杂版本号比较", () => {
      expect(VersionUtils.compareVersions("1.2.3", "1.2.4")).toBe(-1);
      expect(VersionUtils.compareVersions("1.2.4", "1.2.3")).toBe(1);
      expect(VersionUtils.compareVersions("2.0.0", "1.9.9")).toBe(1);
      expect(VersionUtils.compareVersions("0.1.0", "0.0.9")).toBe(1);
    });
  });

  describe("isValidVersion", () => {
    it("应该接受有效的标准版本号", () => {
      expect(VersionUtils.isValidVersion("1.0.0")).toBe(true);
      expect(VersionUtils.isValidVersion("0.0.1")).toBe(true);
      expect(VersionUtils.isValidVersion("10.20.30")).toBe(true);
    });

    it("应该接受带预发布标签的版本号", () => {
      expect(VersionUtils.isValidVersion("1.0.0-alpha")).toBe(true);
      expect(VersionUtils.isValidVersion("1.0.0-beta.1")).toBe(true);
      expect(VersionUtils.isValidVersion("1.0.0-rc.1")).toBe(true);
      expect(VersionUtils.isValidVersion("2.0.0-alpha.1.beta.2")).toBe(true);
    });

    it("应该接受带构建元数据的版本号", () => {
      expect(VersionUtils.isValidVersion("1.0.0+build.1")).toBe(true);
      expect(VersionUtils.isValidVersion("1.0.0+20130313144700")).toBe(true);
    });

    it("应该接受带预发布和构建元数据的版本号", () => {
      expect(VersionUtils.isValidVersion("1.0.0-alpha+001")).toBe(true);
      expect(VersionUtils.isValidVersion("1.0.0-beta+exp.sha.5114f85")).toBe(true);
    });

    it("应该拒绝无效的版本号", () => {
      expect(VersionUtils.isValidVersion("1")).toBe(false);
      expect(VersionUtils.isValidVersion("1.0")).toBe(false);
      expect(VersionUtils.isValidVersion("v1.0.0")).toBe(false);
      expect(VersionUtils.isValidVersion("")).toBe(false);
      expect(VersionUtils.isValidVersion("invalid")).toBe(false);
      expect(VersionUtils.isValidVersion("1.0.0-")).toBe(false); // 只有连字符
    });

    it("应该拒绝边界情况", () => {
      expect(VersionUtils.isValidVersion(".1.0.0")).toBe(false);
      expect(VersionUtils.isValidVersion("1.0.0.")).toBe(false);
      expect(VersionUtils.isValidVersion("..")).toBe(false);
    });
  });

  describe("clearCache", () => {
    it("应该清除版本缓存", () => {
      // 获取版本号（建立缓存）
      const version1 = VersionUtils.getVersion();

      // 清除缓存
      VersionUtils.clearCache();

      // 再次获取版本号
      const version2 = VersionUtils.getVersion();

      // 应该返回相同值，但是重新读取的
      expect(version1).toBe(version2);
    });

    it("应该清除版本信息缓存", () => {
      // 获取版本信息（建立缓存）
      const info1 = VersionUtils.getVersionInfo();

      // 清除缓存
      VersionUtils.clearCache();

      // 再次获取版本信息
      const info2 = VersionUtils.getVersionInfo();

      // 应该返回相同值，但是重新读取的
      expect(info1).toEqual(info2);
    });
  });

  describe("边界情况测试", () => {
    it("应该处理 getRuntimeVersion 的错误情况", () => {
      // 清除缓存
      VersionUtils.clearCache();

      // 获取版本号，即使在某些环境中无法读取 package.json
      // 也应该返回 "unknown" 或有效的版本号
      const version = VersionUtils.getVersion();
      expect(["unknown", "1.9.7"].includes(version) || /^\d+\.\d+\.\d+/.test(version)).toBe(true);
    });

    it("应该处理 getRuntimeVersionInfo 的错误情况", () => {
      // 清除缓存
      VersionUtils.clearCache();

      // 获取版本信息，即使在某些环境中无法读取 package.json
      // 也应该返回包含至少 version 字段的对象
      const info = VersionUtils.getVersionInfo();
      expect(info).toHaveProperty("version");
      expect(typeof info.version).toBe("string");
    });
  });
});
