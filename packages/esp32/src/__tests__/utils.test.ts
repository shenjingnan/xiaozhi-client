/**
 * 工具函数单元测试
 * 测试 extractDeviceInfo 和 camelToSnakeCase
 */

import { describe, expect, it } from "vitest";
import type { ESP32DeviceReport } from "../types.js";
import { camelToSnakeCase, extractDeviceInfo } from "../utils.js";

describe("extractDeviceInfo", () => {
  /** 创建基础设备上报数据 */
  function createBaseReport(
    overrides?: Partial<ESP32DeviceReport>
  ): ESP32DeviceReport {
    return {
      application: {
        version: "1.0.0",
      },
      ...overrides,
    };
  }

  describe("型号提取", () => {
    it("优先从 headerInfo 获取型号", () => {
      const report = createBaseReport({
        board: { type: "board-from-body" },
        application: {
          ...createBaseReport().application,
          board: { type: "old-format" },
        },
      });
      const result = extractDeviceInfo(report, { deviceModel: "from-header" });
      expect(result.boardType).toBe("from-header");
    });

    it("从新格式 board.type 获取型号", () => {
      const report = createBaseReport({ board: { type: "esp32-s3" } });
      const result = extractDeviceInfo(report);
      expect(result.boardType).toBe("esp32-s3");
    });

    it("兼容旧格式 application.board.type", () => {
      const report = createBaseReport();
      (report.application as unknown as { board?: { type: string } }).board = {
        type: "esp32-wroom",
      };
      const result = extractDeviceInfo(report);
      expect(result.boardType).toBe("esp32-wroom");
    });

    it("多级回退顺序验证：headerInfo > 新格式 > 旧格式", () => {
      // 三级都有值时，优先取 headerInfo
      const report = createBaseReport({
        board: { type: "new-format" },
      });
      (report.application as unknown as { board?: { type: string } }).board = {
        type: "old-format",
      };
      const result = extractDeviceInfo(report, {
        deviceModel: "header-priority",
      });
      expect(result.boardType).toBe("header-priority");

      // 无 headerInfo 时取新格式
      const result2 = extractDeviceInfo(report);
      expect(result2.boardType).toBe("new-format");

      // 无新格式时取旧格式
      const report3 = createBaseReport();
      (report3.application as unknown as { board?: { type: string } }).board = {
        type: "only-old",
      };
      const result3 = extractDeviceInfo(report3);
      expect(result3.boardType).toBe("only-old");
    });

    it("缺少型号抛错 MISSING_DEVICE_MODEL", () => {
      const report = createBaseReport();
      expect(() => extractDeviceInfo(report)).toThrow(
        "无法获取设备型号，请确保请求头包含 device-model 或请求体包含 board.type"
      );
      try {
        extractDeviceInfo(report);
      } catch (error) {
        expect((error as Error).cause).toBe("MISSING_DEVICE_MODEL");
      }
    });
  });

  describe("版本提取", () => {
    it("优先从 headerInfo 获取版本", () => {
      const report = createBaseReport({ board: { type: "test" } });
      const result = extractDeviceInfo(report, {
        deviceModel: "test",
        deviceVersion: "2.0.0-header",
      });
      expect(result.appVersion).toBe("2.0.0-header");
    });

    it("从 application.version 获取版本", () => {
      const report = createBaseReport({ board: { type: "test" } });
      const result = extractDeviceInfo(report, { deviceModel: "test" });
      expect(result.appVersion).toBe("1.0.0");
    });

    it("缺少版本抛错 MISSING_APP_VERSION", () => {
      const report = {} as ESP32DeviceReport;
      report.board = { type: "test" };
      expect(() => extractDeviceInfo(report, { deviceModel: "test" })).toThrow(
        "无法获取固件版本，请确保请求体包含 application.version"
      );
      try {
        extractDeviceInfo(report, { deviceModel: "test" });
      } catch (error) {
        expect((error as Error).cause).toBe("MISSING_APP_VERSION");
      }
    });
  });

  describe("完整场景", () => {
    it("同时提取型号和版本", () => {
      const report = createBaseReport({
        board: { type: "esp32-s3-box" },
        application: { version: "2.1.0" },
      });
      const result = extractDeviceInfo(report, {
        deviceModel: "custom-model",
        deviceVersion: "3.0.0",
      });
      expect(result).toEqual({
        boardType: "custom-model",
        appVersion: "3.0.0",
      });
    });
  });
});

describe("camelToSnakeCase", () => {
  it("单层对象转换", () => {
    const input = { userName: "test", deviceId: "abc123" };
    const result = camelToSnakeCase(input) as Record<string, unknown>;
    expect(result).toEqual({ user_name: "test", device_id: "abc123" });
  });

  it("多个驼峰键转换", () => {
    const input = { firstName: "John", lastName: "Doe", age: 30 };
    const result = camelToSnakeCase(input) as Record<string, unknown>;
    expect(result).toEqual({ first_name: "John", last_name: "Doe", age: 30 });
  });

  it("递归嵌套对象转换", () => {
    const input = {
      userInfo: { firstName: "John", address: { city: "Beijing" } },
    };
    const result = camelToSnakeCase(input) as Record<string, unknown>;
    expect(result).toEqual({
      user_info: { first_name: "John", address: { city: "Beijing" } },
    });
  });

  it("数组中的对象转换", () => {
    const input = [{ itemId: 1 }, { itemName: "test" }];
    const result = camelToSnakeCase(input) as Array<Record<string, unknown>>;
    expect(result).toEqual([{ item_id: 1 }, { item_name: "test" }]);
  });

  it("基本类型值不变：string", () => {
    expect(camelToSnakeCase("hello")).toBe("hello");
  });

  it("基本类型值不变：number", () => {
    expect(camelToSnakeCase(42)).toBe(42);
  });

  it("基本类型值不变：boolean", () => {
    expect(camelToSnakeCase(true)).toBe(true);
  });

  it("基本类型值不变：null", () => {
    expect(camelToSnakeCase(null)).toBeNull();
  });

  it("基本类型值不变：undefined", () => {
    expect(camelToSnakeCase(undefined)).toBeUndefined();
  });

  it("循环引用检测不抛错", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    // 不应抛出异常或无限递归
    const result = camelToSnakeCase(obj) as Record<string, unknown>;
    expect(result.self).toBe(obj); // 循环引用返回原对象
  });

  it("空对象转换为空对象", () => {
    const result = camelToSnakeCase({});
    expect(result).toEqual({});
  });

  it("空数组转换为空数组", () => {
    const result = camelToSnakeCase([]);
    expect(result).toEqual([]);
  });

  it("已是 snake_case 的键保持不变（全小写）", () => {
    const input = { user_name: "test", device_id: "abc" };
    const result = camelToSnakeCase(input) as Record<string, unknown>;
    expect(result).toEqual({ user_name: "test", device_id: "abc" });
  });

  it("连续大写字母边界情况", () => {
    const input = { httpURL: "http://example.com", apiJSONResponse: {} };
    const result = camelToSnakeCase(input) as Record<string, unknown>;
    expect(result).toEqual({
      http_u_r_l: "http://example.com",
      api_j_s_o_n_response: {},
    });
  });

  it("首字母大写的键正确处理", () => {
    const input = { Name: "test", Age: 25 };
    const result = camelToSnakeCase(input) as Record<string, unknown>;
    // /([A-Z])/g 会将首字母大写也匹配，Name → _name, Age → _age
    expect(result).toEqual({ _name: "test", _age: 25 });
  });
});
