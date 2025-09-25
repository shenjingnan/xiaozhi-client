import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { IndependentXiaozhiConnectionManager } from "../IndependentXiaozhiConnectionManager.js";
import { XiaozhiConnectionManagerSingleton } from "../XiaozhiConnectionManagerSingleton.js";

describe("XiaozhiConnectionManagerSingleton", () => {
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleLog: typeof console.log;
  let warnMessages: string[] = [];
  let logMessages: string[] = [];

  beforeEach(() => {
    // 保存原始console方法
    originalConsoleWarn = console.warn;
    originalConsoleLog = console.log;

    // Mock console方法
    warnMessages = [];
    logMessages = [];
    console.warn = (...args) => warnMessages.push(args.join(" "));
    console.log = (...args) => logMessages.push(args.join(" "));

    // 重置单例状态
    XiaozhiConnectionManagerSingleton.reset();
  });

  afterEach(() => {
    // 恢复原始console方法
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;

    // 清理单例
    XiaozhiConnectionManagerSingleton.reset();
  });

  test("应该创建 IndependentXiaozhiConnectionManager 实例", async () => {
    const instance = await XiaozhiConnectionManagerSingleton.getInstance();
    expect(instance).toBeDefined();
    // 验证实例类型
    expect(instance.constructor.name).toBe(
      "IndependentXiaozhiConnectionManager"
    );
  });

  test("应该保持单例特性", async () => {
    const instance1 = await XiaozhiConnectionManagerSingleton.getInstance();
    const instance2 = await XiaozhiConnectionManagerSingleton.getInstance();
    expect(instance1).toBe(instance2);
  });

  test("应该兼容旧配置选项", async () => {
    const options = {
      healthCheckInterval: 30000,
      reconnectInterval: 5000,
      // 废弃的配置项（应该被忽略）
      loadBalanceStrategy: "round-robin" as const,
    };

    const instance =
      await XiaozhiConnectionManagerSingleton.getInstance(options);
    expect(instance).toBeDefined();

    // 验证警告消息
    expect(warnMessages.some((msg) => msg.includes("废弃的配置选项"))).toBe(
      true
    );
    expect(
      warnMessages.some((msg) => msg.includes("loadBalanceStrategy"))
    ).toBe(true);
  });

  test("应该正确处理重复初始化", async () => {
    const instance1 = await XiaozhiConnectionManagerSingleton.getInstance();
    const instance2 = await XiaozhiConnectionManagerSingleton.getInstance();

    expect(instance1).toBe(instance2);
    expect(logMessages.some((msg) => msg.includes("单例初始化成功"))).toBe(
      true
    );
  });

  test("应该支持资源清理", async () => {
    const instance = await XiaozhiConnectionManagerSingleton.getInstance();
    expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(true);

    await XiaozhiConnectionManagerSingleton.cleanup();
    expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(false);
  });

  test("应该支持强制重新初始化", async () => {
    const instance1 = await XiaozhiConnectionManagerSingleton.getInstance();
    const instance2 =
      await XiaozhiConnectionManagerSingleton.forceReinitialize();

    expect(instance1).not.toBe(instance2);
    expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(true);
  });

  test("应该能获取当前实例", async () => {
    const instance = await XiaozhiConnectionManagerSingleton.getInstance();
    const currentInstance =
      XiaozhiConnectionManagerSingleton.getCurrentInstance();

    expect(currentInstance).toBe(instance);
  });

  test("应该能获取状态信息", async () => {
    await XiaozhiConnectionManagerSingleton.getInstance();
    const status = XiaozhiConnectionManagerSingleton.getStatus();

    expect(status.state).toBe("initialized");
    expect(status.instanceId).toBeDefined();
    expect(status.initializationTime).toBeDefined();
  });

  test("应该支持等待初始化", async () => {
    const promise = XiaozhiConnectionManagerSingleton.getInstance();
    const result =
      await XiaozhiConnectionManagerSingleton.waitForInitialization();

    expect(result).toBe(true);
    expect(XiaozhiConnectionManagerSingleton.isInitialized()).toBe(true);
  });

  test("应该正确处理错误状态", async () => {
    // 重置单例状态
    XiaozhiConnectionManagerSingleton.reset();

    // 验证初始状态
    const status = XiaozhiConnectionManagerSingleton.getStatus();
    expect(status.state).toBe("not_initialized");
  });

  test("应该能从失败状态恢复", async () => {
    // 测试强制重新初始化功能
    const instance1 = await XiaozhiConnectionManagerSingleton.getInstance();
    const instance2 =
      await XiaozhiConnectionManagerSingleton.forceReinitialize();

    expect(instance1).not.toBe(instance2);
    expect(XiaozhiConnectionManagerSingleton.getStatus().state).toBe(
      "initialized"
    );
  });
});
