/**
 * 设备注册服务单元测试
 * 测试 DeviceRegistryService 的 CRUD 操作
 */

import { beforeEach, describe, expect, it } from "vitest";
import { DeviceRegistryService } from "../device-registry.js";

describe("DeviceRegistryService", () => {
  let registry: DeviceRegistryService;

  beforeEach(() => {
    registry = new DeviceRegistryService();
  });

  describe("createDevice", () => {
    it("创建设备自动激活（状态=active）", () => {
      const device = registry.createDevice(
        "AA:BB:CC:DD:EE:FF",
        "esp32-s3",
        "1.0.0"
      );
      expect(device.status).toBe("active");
      expect(device.deviceId).toBe("AA:BB:CC:DD:EE:FF");
      expect(device.board).toBe("esp32-s3");
      expect(device.appVersion).toBe("1.0.0");
    });

    it("设置 createdAt 和 lastSeenAt", () => {
      const before = new Date();
      const device = registry.createDevice("device-1", "board-x", "2.0.0");
      const after = new Date();

      expect(device.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(device.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(device.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(device.lastSeenAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("重复设备ID覆盖", () => {
      const device1 = registry.createDevice("device-1", "board-a", "1.0.0");
      void device1;
      const device2 = registry.createDevice("device-1", "board-b", "2.0.0");

      // 应该返回新创建的设备
      expect(device2.board).toBe("board-b");
      expect(device2.appVersion).toBe("2.0.0");

      // 获取时应该是最新的
      const fetched = registry.getDevice("device-1");
      expect(fetched).toBe(device2);
      expect(fetched!.board).toBe("board-b");
    });
  });

  describe("getDevice", () => {
    it("已注册设备可获取", () => {
      registry.createDevice("device-1", "board-a", "1.0.0");
      const device = registry.getDevice("device-1");

      expect(device).not.toBeNull();
      expect(device!.deviceId).toBe("device-1");
    });

    it("未注册返回 null", () => {
      expect(registry.getDevice("non-existent")).toBeNull();
    });
  });

  describe("updateDeviceStatus", () => {
    it("更新已存在设备状态", () => {
      registry.createDevice("device-1", "board-a", "1.0.0");
      registry.updateDeviceStatus("device-1", "offline");

      const device = registry.getDevice("device-1")!;
      expect(device.status).toBe("offline");
    });

    it("更新不存在设备静默忽略", () => {
      // 不应抛出异常
      expect(() =>
        registry.updateDeviceStatus("non-existent", "offline")
      ).not.toThrow();
    });
  });

  describe("updateLastSeen", () => {
    it("更新后时间晚于创建时间", async () => {
      registry.createDevice("device-1", "board-a", "1.0.0");
      const createdAt = registry.getDevice("device-1")!.lastSeenAt;

      // 等待一小段时间确保时间差
      await new Promise((resolve) => setTimeout(resolve, 10));

      registry.updateLastSeen("device-1");
      const updatedAt = registry.getDevice("device-1")!.lastSeenAt;

      expect(updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
    });

    it("更新不存在设备静默忽略", () => {
      expect(() => registry.updateLastSeen("non-existent")).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("销毁后所有设备清除", () => {
      registry.createDevice("device-1", "a", "1.0");
      registry.createDevice("device-2", "b", "2.0");
      registry.createDevice("device-3", "c", "3.0");

      registry.destroy();

      expect(registry.getDevice("device-1")).toBeNull();
      expect(registry.getDevice("device-2")).toBeNull();
      expect(registry.getDevice("device-3")).toBeNull();
    });
  });
});
