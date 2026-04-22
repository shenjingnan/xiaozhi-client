/**
 * DIContainer 依赖注入容器单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIContainer, createContainer } from "../Container";

// Mock @/mcp-core 以断开 config 模块的深层依赖链
vi.mock("@/mcp-core", () => ({
  MCPTransportType: { STDIO: "stdio", SSE: "sse", HTTP: "http" },
  inferTransportTypeFromUrl: vi.fn().mockReturnValue("http"),
}));

// Mock 所有 Container.ts 的依赖模块
vi.mock("../config", () => ({
  configManager: {
    configExists: vi.fn().mockReturnValue(true),
    getConfig: vi.fn().mockReturnValue({}),
    reloadConfig: vi.fn(),
  },
}));

vi.mock("../../utils/version", () => ({
  VersionUtils: { getVersion: vi.fn().mockReturnValue("2.3.0-test") },
}));

vi.mock("./utils/PlatformUtils", () => ({ PlatformUtils: {} }));
vi.mock("./utils/FormatUtils", () => ({ FormatUtils: {} }));
vi.mock("./utils/FileUtils", () => ({ FileUtils: {} }));
vi.mock("./utils/PathUtils", () => ({ PathUtils: {} }));
vi.mock("./utils/Validation", () => ({ Validation: {} }));

vi.mock("./errors/ErrorHandlers", () => ({
  ErrorHandler: {
    handle: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock 三个服务模块（对应 static create() 中的 require() 调用）
const mockProcessManagerInstance = {
  getServiceStatus: vi.fn(),
  killProcess: vi.fn(),
  cleanupPidFile: vi.fn(),
  isXiaozhiProcess: vi.fn(),
  savePidInfo: vi.fn(),
  gracefulKillProcess: vi.fn(),
  processExists: vi.fn(),
  cleanupContainerState: vi.fn(),
  getProcessInfo: vi.fn(),
  validatePidFile: vi.fn(),
};

const mockDaemonManagerInstance = {
  startDaemon: vi.fn(),
  stopDaemon: vi.fn(),
  restartDaemon: vi.fn(),
  getDaemonStatus: vi.fn(),
  attachToLogs: vi.fn(),
  checkHealth: vi.fn(),
  getCurrentDaemon: vi.fn(),
  cleanup: vi.fn(),
};

const mockServiceManagerInstance = {
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  getStatus: vi.fn(),
};

vi.mock("./services/ProcessManager.js", () => ({
  ProcessManagerImpl: vi
    .fn()
    .mockImplementation(() => mockProcessManagerInstance),
}));

vi.mock("./services/DaemonManager.js", () => ({
  DaemonManagerImpl: vi
    .fn()
    .mockImplementation((_pm: unknown) => mockDaemonManagerInstance),
}));

vi.mock("./services/ServiceManager.js", () => ({
  ServiceManagerImpl: vi
    .fn()
    .mockImplementation(
      (_pm: unknown, _cm: unknown) => mockServiceManagerInstance
    ),
}));

describe("DIContainer 依赖注入容器", () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  afterEach(() => {
    container.clear();
    vi.restoreAllMocks();
  });

  describe("register 注册服务工厂", () => {
    it("应正确注册非单例服务工厂", () => {
      const factory = () => ({ value: 42 });
      container.register("testService", factory);

      expect(container.has("testService")).toBe(true);
      expect(container.getRegisteredKeys()).toContain("testService");
    });

    it("应正确注册单例服务工厂 (singleton=true)", () => {
      const factory = () => ({ value: 42 });
      container.register("singletonService", factory, true);

      expect(container.has("singletonService")).toBe(true);
    });

    it("应允许覆盖已注册的服务", () => {
      const factory1 = () => ({ v: 1 });
      const factory2 = () => ({ v: 2 });

      container.register("service", factory1);
      container.register("service", factory2);

      const instance = container.get("service");
      expect(instance).toEqual({ v: 2 });
    });

    it("应支持注册多个不同服务", () => {
      container.register("svc1", () => 1);
      container.register("svc2", () => "two");
      container.register("svc3", () => true);

      expect(container.getRegisteredKeys()).toHaveLength(3);
      expect(container.has("svc1")).toBe(true);
      expect(container.has("svc2")).toBe(true);
      expect(container.has("svc3")).toBe(true);
    });
  });

  describe("registerSingleton 注册单例服务", () => {
    it("应将服务标记为单例，工厂只调用一次", () => {
      let callCount = 0;
      container.registerSingleton("counter", () => {
        callCount++;
        return { count: callCount };
      });

      const first = container.get("counter");
      const second = container.get("counter");

      expect(first).toBe(second); // 同一引用
      expect(callCount).toBe(1); // 工厂只调用一次
    });

    it("registerSingleton 应等价于 register(key, factory, true)", () => {
      let singletonCallCount = 0;
      let registerCallCount = 0;

      container.registerSingleton("s", () => {
        singletonCallCount++;
        return { id: singletonCallCount };
      });

      container.register(
        "r",
        () => {
          registerCallCount++;
          return { id: registerCallCount };
        },
        true
      );

      const s1 = container.get("s");
      const s2 = container.get("s");
      const r1 = container.get("r");
      const r2 = container.get("r");

      expect(s1).toBe(s2);
      expect(r1).toBe(r2);
      expect(singletonCallCount).toBe(1);
      expect(registerCallCount).toBe(1);
    });
  });

  describe("registerInstance 注册实例", () => {
    it("应直接注册预创建的实例", () => {
      const instance = { name: "pre-created" };
      container.registerInstance("fixed", instance);

      const retrieved = container.get("fixed");
      expect(retrieved).toBe(instance); // 同一引用
    });

    it("注册的实例应被视为单例，多次获取返回同一对象", () => {
      const instance = { data: [1, 2, 3] };
      container.registerInstance("arr", instance);

      expect(container.get("arr")).toBe(instance);
      expect(container.get("arr")).toBe(instance);
    });

    it("注册实例后 has 应返回 true", () => {
      container.registerInstance("inst", { x: 1 });
      expect(container.has("inst")).toBe(true);
    });
  });

  describe("get 获取服务实例", () => {
    it("应通过工厂函数创建并返回实例", () => {
      container.register("calc", () => ({
        add: (a: number, b: number) => a + b,
      }));

      const svc = container.get("calc");
      expect(svc.add(1, 2)).toBe(3);
    });

    it("单例模式应缓存实例（多次 get 返回同一对象）", () => {
      let invocationCount = 0;
      container.registerSingleton("expensive", () => {
        invocationCount++;
        return { id: invocationCount };
      });

      const a = container.get("expensive");
      const b = container.get("expensive");
      const c = container.get("expensive");

      expect(a).toBe(b);
      expect(b).toBe(c);
      expect(invocationCount).toBe(1);
    });

    it("非单例模式每次 get 应创建新实例", () => {
      let invocationCount = 0;
      container.register("fresh", () => {
        invocationCount++;
        return { seq: invocationCount };
      });

      const a = container.get("fresh");
      const b = container.get("fresh");

      expect(a.seq).not.toEqual(b.seq);
      expect(invocationCount).toBe(2);
    });

    it("获取未注册的服务应抛出错误", () => {
      expect(() => container.get("nonexistent")).toThrow(
        "Service nonexistent not registered"
      );
    });

    it("错误信息应包含服务键名", () => {
      try {
        container.get("my-missing-service");
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).toContain("my-missing-service");
      }
    });

    it("registerInstance 注册后 get 应直接返回不调用工厂", () => {
      const instance = { ready: true, called: false };
      container.registerInstance("readySvc", instance);

      const result = container.get("readySvc");
      expect(result).toBe(instance);
      expect(result.called).toBe(false);
    });
  });

  describe("has 检查服务是否已注册", () => {
    it("已通过 register 注册的服务应返回 true", () => {
      container.register("a", () => 1);
      expect(container.has("a")).toBe(true);
    });

    it("已通过 registerInstance 注册的服务应返回 true", () => {
      container.registerInstance("b", {});
      expect(container.has("b")).toBe(true);
    });

    it("已通过 registerSingleton 注册的服务应返回 true", () => {
      container.registerSingleton("c", () => 1);
      expect(container.has("c")).toBe(true);
    });

    it("未注册的服务应返回 false", () => {
      expect(container.has("missing")).toBe(false);
    });

    it("clear 之后 has 应返回 false", () => {
      container.register("x", () => 1);
      container.clear();
      expect(container.has("x")).toBe(false);
    });
  });

  describe("clear 清除所有注册", () => {
    it("应清除所有工厂、实例和单例标记", () => {
      container.register("f1", () => 1);
      container.register("f2", () => 2, true);
      container.registerInstance("i1", {});

      container.clear();

      expect(container.getRegisteredKeys()).toHaveLength(0);
      expect(container.has("f1")).toBe(false);
      expect(container.has("f2")).toBe(false);
      expect(container.has("i1")).toBe(false);
    });

    it("clear 后重新注册应正常工作", () => {
      container.register("old", () => "old");
      container.clear();
      container.register("new", () => "new");

      expect(container.get("new")).toBe("new");
    });

    it("重复 clear 不应报错", () => {
      container.register("a", () => 1);
      container.clear();
      container.clear();

      expect(container.getRegisteredKeys()).toHaveLength(0);
    });

    it("空容器 clear 不应报错", () => {
      expect(() => container.clear()).not.toThrow();
    });
  });

  describe("getRegisteredKeys 获取所有已注册键", () => {
    it("应返回所有已注册服务的键", () => {
      container.register("k1", () => 1);
      container.register("k2", () => 2);
      container.registerInstance("k3", {});

      const keys = container.getRegisteredKeys();
      expect(keys).toContain("k1");
      expect(keys).toContain("k2");
      expect(keys).toContain("k3");
      expect(keys).toHaveLength(3);
    });

    it("空容器应返回空数组", () => {
      expect(container.getRegisteredKeys()).toEqual([]);
    });

    it("同键 register 和 registerInstance 不应重复", () => {
      container.register("dup", () => 1);
      container.registerInstance("dup", {});

      const keys = container.getRegisteredKeys();
      expect(keys.filter((k) => k === "dup")).toHaveLength(1);
    });

    it("只注册工厂时不应包含实例键", () => {
      container.register("factoryOnly", () => 1);

      const keys = container.getRegisteredKeys();
      expect(keys).toEqual(["factoryOnly"]);
    });

    it("只注册实例时不应包含工厂键", () => {
      container.registerInstance("instanceOnly", {});

      const keys = container.getRegisteredKeys();
      expect(keys).toEqual(["instanceOnly"]);
    });
  });

  describe("static create 创建默认容器", () => {
    /** 拦截 require() 调用，使 static create() 中的动态导入在测试环境中工作 */
    function mockRequireForCreate() {
      const originalRequire = require;
      // @ts-expect-error — 故意覆盖全局 require 用于测试
      // biome-ignore lint/suspicious/noGlobalAssign: 测试中故意覆盖全局 require
      require = vi.fn().mockImplementation((modulePath: string) => {
        if (modulePath.includes("ProcessManager")) {
          return {
            ProcessManagerImpl: vi
              .fn()
              .mockImplementation(() => mockProcessManagerInstance),
          };
        }
        if (modulePath.includes("DaemonManager")) {
          return {
            DaemonManagerImpl: vi
              .fn()
              .mockImplementation((_pm: unknown) => mockDaemonManagerInstance),
          };
        }
        if (modulePath.includes("ServiceManager")) {
          return {
            ServiceManagerImpl: vi
              .fn()
              .mockImplementation(
                (_pm: unknown, _cm: unknown) => mockServiceManagerInstance
              ),
          };
        }
        return originalRequire(modulePath);
      });
    }

    function restoreRequire() {
      // @ts-expect-error — 恢复原始 require
      // biome-ignore lint/suspicious/noGlobalAssign: 恢复原始 require
      require = require.originalRequire || module.require;
    }

    afterEach(() => {
      restoreRequire();
    });

    it("应创建包含所有默认服务的容器", () => {
      mockRequireForCreate();
      const defaultContainer = DIContainer.create();

      const keys = defaultContainer.getRegisteredKeys();
      expect(keys).toContain("versionUtils");
      expect(keys).toContain("platformUtils");
      expect(keys).toContain("formatUtils");
      expect(keys).toContain("fileUtils");
      expect(keys).toContain("pathUtils");
      expect(keys).toContain("validation");
      expect(keys).toContain("configManager");
      expect(keys).toContain("errorHandler");
      expect(keys).toContain("processManager");
      expect(keys).toContain("daemonManager");
      expect(keys).toContain("serviceManager");
      expect(keys).toHaveLength(11);
    });

    it("每个非 require 型默认服务都应能成功获取且不抛出异常", () => {
      mockRequireForCreate();
      const defaultContainer = DIContainer.create();

      // 工具类和配置类服务（不依赖 require()）都应可正常获取
      expect(() => defaultContainer.get("versionUtils")).not.toThrow();
      expect(() => defaultContainer.get("platformUtils")).not.toThrow();
      expect(() => defaultContainer.get("formatUtils")).not.toThrow();
      expect(() => defaultContainer.get("fileUtils")).not.toThrow();
      expect(() => defaultContainer.get("pathUtils")).not.toThrow();
      expect(() => defaultContainer.get("validation")).not.toThrow();
      expect(() => defaultContainer.get("configManager")).not.toThrow();
      expect(() => defaultContainer.get("errorHandler")).not.toThrow();

      // 以下服务依赖运行时 require()，在纯 ESM 测试环境中需要集成测试验证
      // processManager, daemonManager, serviceManager
    });

    it("工具类服务应为单例（多次获取返回同一引用）", () => {
      mockRequireForCreate();
      const defaultContainer = DIContainer.create();

      const vu1 = defaultContainer.get("versionUtils");
      const vu2 = defaultContainer.get("versionUtils");
      expect(vu1).toBe(vu2);

      const pu1 = defaultContainer.get("platformUtils");
      const pu2 = defaultContainer.get("platformUtils");
      expect(pu1).toBe(pu2);
    });

    it("static create 应按正确顺序注册服务（依赖顺序：工具类 → 配置 → 服务层）", () => {
      mockRequireForCreate();
      const defaultContainer = DIContainer.create();

      const keys = defaultContainer.getRegisteredKeys();

      // 验证注册顺序：工具类在前，配置在中，服务层在后
      const utilsIdx = keys.findIndex((k) => k === "versionUtils");
      const configIdx = keys.findIndex((k) => k === "configManager");
      const svcIdx = keys.findIndex((k) => k === "serviceManager");

      expect(utilsIdx).toBeLessThan(configIdx);
      expect(configIdx).toBeLessThan(svcIdx);
    });

    it("多次调用 create 应返回独立的容器实例", () => {
      mockRequireForCreate();
      const c1 = DIContainer.create();
      restoreRequire();
      mockRequireForCreate();
      const c2 = DIContainer.create();

      expect(c1).not.toBe(c2);
      // 但每个容器内部的服务应该是独立的单例
      expect(c1.get("versionUtils")).toBe(c1.get("versionUtils"));
      expect(c2.get("versionUtils")).toBe(c2.get("versionUtils"));
    });
  });

  describe("createContainer 异步工厂函数", () => {
    /** 拦截 require() 调用 */
    function mockRequireForCreate() {
      const originalRequire = require;
      // @ts-expect-error — 故意覆盖全局 require 用于测试
      // biome-ignore lint/suspicious/noGlobalAssign: 测试中故意覆盖全局 require
      require = vi.fn().mockImplementation((modulePath: string) => {
        if (modulePath.includes("ProcessManager")) {
          return {
            ProcessManagerImpl: vi
              .fn()
              .mockImplementation(() => mockProcessManagerInstance),
          };
        }
        if (modulePath.includes("DaemonManager")) {
          return {
            DaemonManagerImpl: vi
              .fn()
              .mockImplementation((_pm: unknown) => mockDaemonManagerInstance),
          };
        }
        if (modulePath.includes("ServiceManager")) {
          return {
            ServiceManagerImpl: vi
              .fn()
              .mockImplementation(
                (_pm: unknown, _cm: unknown) => mockServiceManagerInstance
              ),
          };
        }
        return originalRequire(modulePath);
      });
    }

    afterEach(() => {
      // @ts-expect-error — 恢复原始 require
      // biome-ignore lint/suspicious/noGlobalAssign: 恢复原始 require
      require = require.originalRequire || module.require;
    });

    it("应返回一个有效的 DIContainer 实例", async () => {
      mockRequireForCreate();
      const container = await createContainer();

      expect(container).toBeDefined();
      expect(container.getRegisteredKeys().length).toBeGreaterThan(0);
    });

    it("应与 DIContainer.create() 返回相同结构的容器", async () => {
      mockRequireForCreate();
      const syncContainer = DIContainer.create();
      const asyncContainer = await createContainer();

      expect(asyncContainer.getRegisteredKeys()).toEqual(
        syncContainer.getRegisteredKeys()
      );
    });

    it("异步容器也应支持获取非 require 型默认服务", async () => {
      mockRequireForCreate();
      const container = await createContainer();

      expect(() => container.get("versionUtils")).not.toThrow();
      expect(() => container.get("configManager")).not.toThrow();
    });
  });
});
