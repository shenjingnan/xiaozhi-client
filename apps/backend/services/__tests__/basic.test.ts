import { describe, expect, it } from "vitest";

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
