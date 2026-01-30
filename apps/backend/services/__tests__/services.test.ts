import { describe, expect, it, vi } from "vitest";

// Mock Logger 模块（在所有导入之前）
vi.mock("@/root/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
  },
}));

describe("Services Basic Tests", () => {
  it("should be able to import service modules", async () => {
    // Test that all service modules can be imported without errors
    const modules = [
      () => import("../event-bus.service.js"),
      () => import("../notification.service.js"),
      () => import("../status.service.js"),
    ];

    for (const importModule of modules) {
      await expect(importModule()).resolves.toBeDefined();
    }
  });

  it("should have proper class constructors", async () => {
    const { EventBus } = await import("../event-bus.service.js");
    const { NotificationService } = await import("../notification.service.js");
    const { StatusService } = await import("../status.service.js");

    expect(() => new EventBus()).not.toThrow();
    expect(() => new NotificationService()).not.toThrow();
    expect(() => new StatusService()).not.toThrow();
  });
});
