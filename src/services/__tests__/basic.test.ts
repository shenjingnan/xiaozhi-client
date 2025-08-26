import { describe, expect, it } from "vitest";

describe("Services Basic Tests", () => {
  it("should be able to import service modules", async () => {
    // Test that all service modules can be imported without errors
    const modules = [
      () => import("../ConfigService.js"),
      () => import("../EventBus.js"),
      () => import("../NotificationService.js"),
      () => import("../StatusService.js"),
      () => import("../MCPServiceManagerSingleton.js"),
      () => import("../XiaozhiConnectionManagerSingleton.js"),
    ];

    for (const importModule of modules) {
      await expect(importModule()).resolves.toBeDefined();
    }
  });

  it("should have proper class constructors", async () => {
    const { ConfigService } = await import("../ConfigService.js");
    const { EventBus } = await import("../EventBus.js");
    const { NotificationService } = await import("../NotificationService.js");
    const { StatusService } = await import("../StatusService.js");

    expect(() => new ConfigService()).not.toThrow();
    expect(() => new EventBus()).not.toThrow();
    expect(() => new NotificationService()).not.toThrow();
    expect(() => new StatusService()).not.toThrow();
  });

  it("should have working singleton functions", async () => {
    const { getEventBus } = await import("../EventBus.js");
    const { MCPServiceManagerSingleton } = await import(
      "../MCPServiceManagerSingleton.js"
    );
    const { XiaozhiConnectionManagerSingleton } = await import(
      "../XiaozhiConnectionManagerSingleton.js"
    );

    expect(() => getEventBus()).not.toThrow();
    expect(() => MCPServiceManagerSingleton.getInstance()).not.toThrow();
    expect(() => XiaozhiConnectionManagerSingleton.getInstance()).not.toThrow();
  });
});
