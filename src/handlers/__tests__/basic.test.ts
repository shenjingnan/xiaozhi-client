import { describe, expect, it } from "vitest";

describe("Handlers Basic Tests", () => {
  it("should be able to import handler modules", async () => {
    // Test that all handler modules can be imported without errors
    const modules = [
      () => import("../ConfigApiHandler.js"),
      () => import("../HeartbeatHandler.js"),
      () => import("../RealtimeNotificationHandler.js"),
      () => import("../ServiceApiHandler.js"),
      () => import("../StaticFileHandler.js"),
      () => import("../StatusApiHandler.js"),
    ];

    for (const importModule of modules) {
      await expect(importModule()).resolves.toBeDefined();
    }
  });

  it("should have proper class constructors", async () => {
    const { ConfigApiHandler } = await import("../ConfigApiHandler.js");
    const { StaticFileHandler } = await import("../StaticFileHandler.js");
    const { ServiceApiHandler } = await import("../ServiceApiHandler.js");
    const { StatusApiHandler } = await import("../StatusApiHandler.js");
    const { StatusService } = await import("../../services/StatusService.js");

    const mockStatusService = new StatusService();

    expect(() => new ConfigApiHandler()).not.toThrow();
    expect(() => new StaticFileHandler()).not.toThrow();
    expect(() => new ServiceApiHandler(mockStatusService)).not.toThrow();
    expect(() => new StatusApiHandler(mockStatusService)).not.toThrow();
  });
});
