import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ESP32Device, ESP32DeviceStatus } from "@/types/esp32.js";
import { DeviceRegistryService } from "../device-registry.service.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock timers
vi.useFakeTimers();

describe("DeviceRegistryService", () => {
  let service: DeviceRegistryService;
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // Reset system time
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));

    service = new DeviceRegistryService();
  });

  describe("constructor", () => {
    it("应该初始化空的设备映射", () => {
      const newService = new DeviceRegistryService();
      expect(newService).toBeInstanceOf(DeviceRegistryService);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("createDevice", () => {
    it("应该成功创建新设备并自动激活", () => {
      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );

      expect(device).toEqual({
        deviceId: "AA:BB:CC:DD:EE:FF",
        macAddress: "AA:BB:CC:DD:EE:FF",
        board: "ESP32-S3",
        appVersion: "1.0.0",
        status: "active",
        createdAt: expect.any(Date),
        lastSeenAt: expect.any(Date),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        "自动激活新设备: deviceId=AA:BB:CC:DD:EE:FF, board=ESP32-S3, appVersion=1.0.0"
      );
    });

    it("应该设置 createdAt 和 lastSeenAt 为当前时间", () => {
      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );

      const expectedTime = new Date("2024-01-01T12:00:00Z");
      expect(device.createdAt).toEqual(expectedTime);
      expect(device.lastSeenAt).toEqual(expectedTime);
    });

    it("应该覆盖已存在的设备", () => {
      const device1 = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );

      // 改变系统时间
      vi.setSystemTime(new Date("2024-01-02T12:00:00Z"));

      const device2 = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-C3",
        "2.0.0"
      );

      expect(device2.board).toBe("ESP32-C3");
      expect(device2.appVersion).toBe("2.0.0");
      expect(device2.createdAt).toEqual(new Date("2024-01-02T12:00:00Z"));
      expect(device2.lastSeenAt).toEqual(new Date("2024-01-02T12:00:00Z"));

      // 验证返回的是新设备
      expect(device1).not.toBe(device2);
    });

    it("应该为不同的设备 ID 创建不同的设备", () => {
      const device1 = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );
      const device2 = service.createDevice(
        "11:22:33:44:55:66",
        "ESP32-C3",
        "2.0.0"
      );

      expect(device1.deviceId).toBe("AA:BB:CC:DD:EE:FF");
      expect(device2.deviceId).toBe("11:22:33:44:55:66");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toEqual(device1);
      expect(service.getDevice("11:22:33:44:55:66")).toEqual(device2);
    });

    it("应该处理空字符串设备 ID", () => {
      const device = service.createDevice("", "ESP32-S3", "1.0.0");

      expect(device.deviceId).toBe("");
      expect(device.macAddress).toBe("");
    });

    it("应该处理特殊字符在设备信息中", () => {
      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3-特殊版本",
        "1.0.0-beta+测试"
      );

      expect(device.board).toBe("ESP32-S3-特殊版本");
      expect(device.appVersion).toBe("1.0.0-beta+测试");
    });
  });

  describe("getDevice", () => {
    it("应该返回已存在的设备", () => {
      const created = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );
      const found = service.getDevice("AA:BB:CC:DD:EE:FF");

      expect(found).toEqual(created);
      expect(found?.deviceId).toBe("AA:BB:CC:DD:EE:FF");
    });

    it("应该对不存在的设备返回 null", () => {
      const found = service.getDevice("NONEXISTENT");
      expect(found).toBeNull();
    });

    it("应该返回相同的设备对象引用", () => {
      const created = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );
      const found = service.getDevice("AA:BB:CC:DD:EE:FF");

      // 验证返回的是同一个对象引用
      expect(found).toBe(created);

      // 修改返回的对象会影响存储的设备
      if (found) {
        found.board = "MODIFIED";
      }

      // 再次获取应该返回修改后的值
      const foundAgain = service.getDevice("AA:BB:CC:DD:EE:FF");
      expect(foundAgain?.board).toBe("MODIFIED");
    });

    it("应该处理空字符串设备 ID", () => {
      const found = service.getDevice("");
      expect(found).toBeNull();
    });

    it("应该在创建设备后立即获取", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");
      const found = service.getDevice("AA:BB:CC:DD:EE:FF");

      expect(found).toBeDefined();
      expect(found?.status).toBe("active");
    });
  });

  describe("updateDeviceStatus", () => {
    it("应该成功更新已存在设备的状态为 offline", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");
      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "offline");

      const device = service.getDevice("AA:BB:CC:DD:EE:FF");
      expect(device?.status).toBe("offline");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "设备状态已更新: deviceId=AA:BB:CC:DD:EE:FF, status=offline"
      );
    });

    it("应该成功更新已存在设备的状态为 activating", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");
      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "activating");

      const device = service.getDevice("AA:BB:CC:DD:EE:FF");
      expect(device?.status).toBe("activating");
    });

    it("应该允许状态从 active 更新到 offline", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("active");

      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "offline");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("offline");
    });

    it("应该在设备不存在时记录警告", () => {
      service.updateDeviceStatus("NONEXISTENT", "offline");

      const device = service.getDevice("NONEXISTENT");
      expect(device).toBeNull();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "设备不存在，无法更新状态: NONEXISTENT"
      );
    });

    it("应该在设备不存在时不创建新设备", () => {
      service.updateDeviceStatus("NONEXISTENT", "active");
      expect(service.getDevice("NONEXISTENT")).toBeNull();
    });

    it("应该处理所有有效的设备状态值", () => {
      const statuses: ESP32DeviceStatus[] = ["activating", "active", "offline"];

      statuses.forEach((status) => {
        service.createDevice(`DEVICE-${status}`, "ESP32-S3", "1.0.0");
        service.updateDeviceStatus(`DEVICE-${status}`, status);

        const device = service.getDevice(`DEVICE-${status}`);
        expect(device?.status).toBe(status);
      });
    });

    it("应该支持多次状态更新", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");

      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "offline");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("offline");

      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "activating");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("activating");

      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "active");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("active");
    });
  });

  describe("updateLastSeen", () => {
    it("应该成功更新已存在设备的最后活跃时间", () => {
      const originalTime = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(originalTime);

      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");
      const originalLastSeen = service.getDevice("AA:BB:CC:DD:EE:FF")?.lastSeenAt;

      const updatedTime = new Date("2024-01-02T12:00:00Z");
      vi.setSystemTime(updatedTime);

      service.updateLastSeen("AA:BB:CC:DD:EE:FF");

      const updatedDevice = service.getDevice("AA:BB:CC:DD:EE:FF");
      expect(updatedDevice?.lastSeenAt).toEqual(updatedTime);
      // 检查时间已经改变（使用时间戳比较）
      expect(originalLastSeen?.getTime()).toBe(originalTime.getTime());
      expect(updatedDevice?.lastSeenAt.getTime()).toBe(updatedTime.getTime());
      expect(originalLastSeen?.getTime()).not.toBe(
        updatedDevice?.lastSeenAt.getTime()
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "设备最后活跃时间已更新: deviceId=AA:BB:CC:DD:EE:FF"
      );
    });

    it("应该在设备不存在时记录警告", () => {
      service.updateLastSeen("NONEXISTENT");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "设备不存在，无法更新最后活跃时间: NONEXISTENT"
      );
    });

    it("应该在设备不存在时不创建新设备", () => {
      service.updateLastSeen("NONEXISTENT");
      expect(service.getDevice("NONEXISTENT")).toBeNull();
    });

    it("应该支持多次更新最后活跃时间", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");

      const time1 = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(time1);
      service.updateLastSeen("AA:BB:CC:DD:EE:FF");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.lastSeenAt).toEqual(
        time1
      );

      const time2 = new Date("2024-01-02T12:00:00Z");
      vi.setSystemTime(time2);
      service.updateLastSeen("AA:BB:CC:DD:EE:FF");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.lastSeenAt).toEqual(
        time2
      );
    });

    it("应该只更新 lastSeenAt 而不影响其他字段", () => {
      const originalTime = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(originalTime);

      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");

      const updatedTime = new Date("2024-01-02T12:00:00Z");
      vi.setSystemTime(updatedTime);

      service.updateLastSeen("AA:BB:CC:DD:EE:FF");

      const device = service.getDevice("AA:BB:CC:DD:EE:FF");
      expect(device?.deviceId).toBe("AA:BB:CC:DD:EE:FF");
      expect(device?.macAddress).toBe("AA:BB:CC:DD:EE:FF");
      expect(device?.board).toBe("ESP32-S3");
      expect(device?.appVersion).toBe("1.0.0");
      expect(device?.status).toBe("active");
      expect(device?.createdAt).toEqual(originalTime); // createdAt 不变
      expect(device?.lastSeenAt).toEqual(updatedTime); // lastSeenAt 更新
    });
  });

  describe("destroy", () => {
    it("应该清空所有已激活设备", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");
      service.createDevice("11:22:33:44:55:66", "ESP32-C3", "2.0.0");

      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toBeDefined();
      expect(service.getDevice("11:22:33:44:55:66")).toBeDefined();

      service.destroy();

      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toBeNull();
      expect(service.getDevice("11:22:33:44:55:66")).toBeNull();

      expect(mockLogger.debug).toHaveBeenCalledWith("设备注册服务已销毁");
    });

    it("应该允许多次调用 destroy 而不报错", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");

      service.destroy();
      service.destroy();
      service.destroy();

      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledTimes(3);
    });

    it("应该在空服务上调用 destroy 不报错", () => {
      expect(() => service.destroy()).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith("设备注册服务已销毁");
    });

    it("应该销毁后允许重新创建设备", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");
      service.destroy();

      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-C3",
        "2.0.0"
      );

      expect(device.board).toBe("ESP32-C3");
      expect(device.appVersion).toBe("2.0.0");
    });
  });

  describe("integration scenarios", () => {
    it("应该处理完整的设备生命周期", () => {
      // 1. 创建设备
      const createTime = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(createTime);

      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );
      expect(device.status).toBe("active");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toEqual(device);

      // 2. 更新最后活跃时间
      const activeTime1 = new Date("2024-01-02T12:00:00Z");
      vi.setSystemTime(activeTime1);

      service.updateLastSeen("AA:BB:CC:DD:EE:FF");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.lastSeenAt).toEqual(
        activeTime1
      );

      // 3. 更新设备状态为 offline
      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "offline");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("offline");

      // 4. 重新激活设备
      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "active");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("active");

      // 5. 再次更新活跃时间
      const activeTime2 = new Date("2024-01-03T12:00:00Z");
      vi.setSystemTime(activeTime2);

      service.updateLastSeen("AA:BB:CC:DD:EE:FF");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.lastSeenAt).toEqual(
        activeTime2
      );

      // 6. 销毁服务
      service.destroy();
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toBeNull();
    });

    it("应该管理多个设备的状态", () => {
      // 创建多个设备
      const device1 = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );
      const device2 = service.createDevice(
        "11:22:33:44:55:66",
        "ESP32-C3",
        "2.0.0"
      );
      const device3 = service.createDevice(
        "77:88:99:AA:BB:CC",
        "ESP32-S2",
        "1.5.0"
      );

      // 验证所有设备都已创建
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toEqual(device1);
      expect(service.getDevice("11:22:33:44:55:66")).toEqual(device2);
      expect(service.getDevice("77:88:99:AA:BB:CC")).toEqual(device3);

      // 更新不同设备的状态
      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "offline");
      service.updateDeviceStatus("11:22:33:44:55:66", "activating");

      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("offline");
      expect(service.getDevice("11:22:33:44:55:66")?.status).toBe(
        "activating"
      );
      expect(service.getDevice("77:88:99:AA:BB:CC")?.status).toBe("active");

      // 更新不同设备的活跃时间
      const time1 = new Date("2024-01-02T12:00:00Z");
      const time2 = new Date("2024-01-03T12:00:00Z");

      vi.setSystemTime(time1);
      service.updateLastSeen("AA:BB:CC:DD:EE:FF");

      vi.setSystemTime(time2);
      service.updateLastSeen("11:22:33:44:55:66");

      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.lastSeenAt).toEqual(
        time1
      );
      expect(service.getDevice("11:22:33:44:55:66")?.lastSeenAt).toEqual(
        time2
      );
      expect(service.getDevice("77:88:99:AA:BB:CC")?.lastSeenAt).toEqual(
        device3.lastSeenAt
      );
    });

    it("应该处理设备重新注册场景", () => {
      // 创建设备
      const device1 = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.appVersion).toBe("1.0.0");

      // 模拟设备离线
      service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", "offline");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("offline");

      // 设备重新连接并注册（升级固件）
      vi.setSystemTime(new Date("2024-01-02T12:00:00Z"));
      const device2 = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "2.0.0"
      );
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.appVersion).toBe("2.0.0");
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe("active");

      // 验证设备信息已更新
      expect(device2.createdAt).not.toEqual(device1.createdAt);
    });

    it("应该处理设备状态频繁变化", () => {
      service.createDevice("AA:BB:CC:DD:EE:FF", "ESP32-S3", "1.0.0");

      // 模拟设备频繁状态变化
      const statuses: ESP32DeviceStatus[] = [
        "active",
        "offline",
        "active",
        "activating",
        "active",
      ];

      statuses.forEach((status) => {
        service.updateDeviceStatus("AA:BB:CC:DD:EE:FF", status);
        expect(service.getDevice("AA:BB:CC:DD:EE:FF")?.status).toBe(status);
      });
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("应该处理大写和小写 MAC 地址", () => {
      const device1 = service.createDevice(
        "aa:bb:cc:dd:ee:ff",
        "ESP32-S3",
        "1.0.0"
      );
      const device2 = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );

      expect(service.getDevice("aa:bb:cc:dd:ee:ff")).toEqual(device1);
      expect(service.getDevice("AA:BB:CC:DD:EE:FF")).toEqual(device2);
    });

    it("应该处理非常长的设备 ID", () => {
      const longDeviceId = "A".repeat(1000);
      const device = service.createDevice(longDeviceId, "ESP32-S3", "1.0.0");

      expect(device.deviceId).toBe(longDeviceId);
      expect(service.getDevice(longDeviceId)).toEqual(device);
    });

    it("应该处理特殊字符在设备 ID 中", () => {
      const specialDeviceId = "设备-ID-123!@#$%";
      const device = service.createDevice(specialDeviceId, "ESP32-S3", "1.0.0");

      expect(device.deviceId).toBe(specialDeviceId);
      expect(service.getDevice(specialDeviceId)).toEqual(device);
    });

    it("应该处理 Unicode 字符在设备信息中", () => {
      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3-中文测试",
        "版本-🎉-1.0.0"
      );

      expect(device.board).toBe("ESP32-S3-中文测试");
      expect(device.appVersion).toBe("版本-🎉-1.0.0");
    });

    it("应该处理并发设备创建", () => {
      const devices: ESP32Device[] = [];

      for (let i = 0; i < 100; i++) {
        const deviceId = `DEVICE-${i}`;
        const device = service.createDevice(
          deviceId,
          `ESP32-S3-${i}`,
          `1.0.${i}`
        );
        devices.push(device);
      }

      // 验证所有设备都已创建
      for (let i = 0; i < 100; i++) {
        const deviceId = `DEVICE-${i}`;
        const device = service.getDevice(deviceId);
        expect(device).toBeDefined();
        expect(device?.board).toBe(`ESP32-S3-${i}`);
        expect(device?.appVersion).toBe(`1.0.${i}`);
      }
    });

    it("应该处理零时间戳", () => {
      vi.setSystemTime(new Date(0));

      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );

      expect(device.createdAt.getTime()).toBe(0);
      expect(device.lastSeenAt.getTime()).toBe(0);
    });

    it("应该处理最大安全整数时间戳", () => {
      // Date 对象的最大安全时间戳约为 8640000000000000 毫秒
      // 使用一个合理的最大时间戳（公元 275760 年）
      const maxTimestamp = 8640000000000000;
      vi.setSystemTime(new Date(maxTimestamp));

      const device = service.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "ESP32-S3",
        "1.0.0"
      );

      expect(device.createdAt.getTime()).toBe(maxTimestamp);
      expect(device.lastSeenAt.getTime()).toBe(maxTimestamp);
    });
  });
});
