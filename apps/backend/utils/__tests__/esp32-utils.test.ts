/**
 * ESP32 设备信息提取工具测试
 */

import type { ESP32DeviceReport } from "@/types/esp32.js";
import { describe, expect, it, vi } from "vitest";
import {
  type DeviceInfoFromHeaders,
  extractDeviceInfo,
} from "../esp32-utils.js";

// Mock logger
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("extractDeviceInfo", () => {
  describe("从请求头提取设备信息", () => {
    it("应该优先从请求头获取设备型号和版本", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.0.0",
          board: { type: "ESP32-S3-BOX" },
        },
        board: { type: "ESP32-S3-BOX" },
      };
      const headerInfo: DeviceInfoFromHeaders = {
        deviceModel: "ESP32-S3-BOX-Custom",
        deviceVersion: "2.0.0",
      };

      const result = extractDeviceInfo(report, headerInfo);

      expect(result.boardType).toBe("ESP32-S3-BOX-Custom");
      expect(result.appVersion).toBe("2.0.0");
    });

    it("应该只从请求头获取设备型号，版本从 body 获取", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.5.0",
          board: { type: "ESP32-S3-BOX" },
        },
        board: { type: "ESP32-S3-BOX" },
      };
      const headerInfo: DeviceInfoFromHeaders = {
        deviceModel: "ESP32-S3-BOX-Custom",
      };

      const result = extractDeviceInfo(report, headerInfo);

      expect(result.boardType).toBe("ESP32-S3-BOX-Custom");
      expect(result.appVersion).toBe("1.5.0");
    });

    it("应该只从请求头获取版本，设备型号从 body 获取", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.5.0",
        },
        board: { type: "ESP32-S3-BOX" },
      };
      const headerInfo: DeviceInfoFromHeaders = {
        deviceVersion: "2.0.0",
      };

      const result = extractDeviceInfo(report, headerInfo);

      expect(result.boardType).toBe("ESP32-S3-BOX");
      expect(result.appVersion).toBe("2.0.0");
    });
  });

  describe("从新格式提取设备信息", () => {
    it("应该从 board.type 提取设备型号", () => {
      const report: ESP32DeviceReport = {
        application: { version: "1.0.0" },
        board: { type: "bread-compact-wifi" },
      };

      const result = extractDeviceInfo(report);

      expect(result.boardType).toBe("bread-compact-wifi");
      expect(result.appVersion).toBe("1.0.0");
    });

    it("应该支持完整的 board 信息", () => {
      const report: ESP32DeviceReport = {
        application: { version: "2.2.2" },
        board: {
          type: "bread-compact-wifi",
          name: "bread-compact-wifi",
          ssid: "XMO",
          rssi: -26,
          channel: 1,
          ip: "192.168.31.47",
          mac: "10:51:db:84:2a:b0",
        },
      };

      const result = extractDeviceInfo(report);

      expect(result.boardType).toBe("bread-compact-wifi");
      expect(result.appVersion).toBe("2.2.2");
    });
  });

  describe("从旧格式提取设备信息", () => {
    it("应该从 application.board.type 提取设备型号", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.0.0",
          board: { type: "ESP32-S3-Legacy" },
        },
      };

      const result = extractDeviceInfo(report);

      expect(result.boardType).toBe("ESP32-S3-Legacy");
      expect(result.appVersion).toBe("1.0.0");
    });

    it("当同时存在新旧格式时，应该优先使用新格式", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.0.0",
          board: { type: "ESP32-S3-Legacy" },
        },
        board: { type: "ESP32-S3-New" },
      };

      const result = extractDeviceInfo(report);

      expect(result.boardType).toBe("ESP32-S3-New");
    });
  });

  describe("错误处理", () => {
    it("当无法获取设备型号时应该抛出错误", () => {
      const report: ESP32DeviceReport = {
        application: { version: "1.0.0" },
      };

      expect(() => extractDeviceInfo(report)).toThrow("无法获取设备型号");
    });

    it("当无法获取固件版本时应该抛出错误", () => {
      const report: ESP32DeviceReport = {
        application: {} as any,
        board: { type: "ESP32-S3" },
      };

      expect(() => extractDeviceInfo(report)).toThrow("无法获取固件版本");
    });

    it("当请求体为空时应该抛出错误", () => {
      const report: ESP32DeviceReport = {
        application: {} as any,
      };

      expect(() => extractDeviceInfo(report)).toThrow("无法获取设备型号");
    });
  });

  describe("优先级顺序验证", () => {
    it("应该正确遵循优先级：请求头 > 新格式 > 旧格式", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.0.0",
          board: { type: "Legacy-Format" },
        },
        board: { type: "New-Format" },
      };
      const headerInfo: DeviceInfoFromHeaders = {
        deviceModel: "Header-Format",
      };

      const result = extractDeviceInfo(report, headerInfo);

      expect(result.boardType).toBe("Header-Format");
    });

    it("新格式应该优先于旧格式（无请求头）", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.0.0",
          board: { type: "Legacy-Format" },
        },
        board: { type: "New-Format" },
      };

      const result = extractDeviceInfo(report);

      expect(result.boardType).toBe("New-Format");
    });

    it("版本也应该遵循请求头优先原则", () => {
      const report: ESP32DeviceReport = {
        application: {
          version: "1.0.0",
        },
        board: { type: "ESP32-S3" },
      };
      const headerInfo: DeviceInfoFromHeaders = {
        deviceVersion: "2.0.0",
      };

      const result = extractDeviceInfo(report, headerInfo);

      expect(result.appVersion).toBe("2.0.0");
    });
  });

  describe("实际硬件数据格式测试", () => {
    it("应该正确处理小智硬件实际发送的数据格式", () => {
      const report: ESP32DeviceReport = {
        application: {
          name: "xiaozhi",
          version: "2.2.2",
          compile_time: "Feb  7 2026T18:10:44Z",
          idf_version: "v5.5.2",
          elf_sha256: "169d29f...",
        },
        board: {
          type: "bread-compact-wifi",
          name: "bread-compact-wifi",
          ssid: "XMO",
          rssi: -26,
          channel: 1,
          ip: "192.168.31.47",
          mac: "10:51:db:84:2a:b0",
        },
        chip_model_name: "esp32s3",
        ota: {
          label: "ota_0",
        },
      };

      const result = extractDeviceInfo(report);

      expect(result.boardType).toBe("bread-compact-wifi");
      expect(result.appVersion).toBe("2.2.2");
    });
  });

  describe("边界情况", () => {
    it("应该处理空字符串请求头", () => {
      const report: ESP32DeviceReport = {
        application: { version: "1.0.0" },
        board: { type: "ESP32-S3" },
      };
      const headerInfo: DeviceInfoFromHeaders = {
        deviceModel: "",
        deviceVersion: "",
      };

      const result = extractDeviceInfo(report, headerInfo);

      expect(result.boardType).toBe("ESP32-S3");
      expect(result.appVersion).toBe("1.0.0");
    });

    it("应该处理 undefined 请求头", () => {
      const report: ESP32DeviceReport = {
        application: { version: "1.0.0" },
        board: { type: "ESP32-S3" },
      };
      const headerInfo: DeviceInfoFromHeaders = {
        deviceModel: undefined,
        deviceVersion: undefined,
      };

      const result = extractDeviceInfo(report, headerInfo);

      expect(result.boardType).toBe("ESP32-S3");
      expect(result.appVersion).toBe("1.0.0");
    });
  });
});
