import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PinoConfigManager } from "../PinoConfig";

describe("PinoConfigManager", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };

    // 清理环境变量
    process.env.XIAOZHI_LOG_LEVEL = undefined;
    process.env.XIAOZHI_DAEMON = undefined;
    process.env.XIAOZHI_LOG_FILE = undefined;
    process.env.XIAOZHI_LOG_FILE_ENABLED = undefined;
    process.env.XIAOZHI_LOG_ASYNC = undefined;
    process.env.XIAOZHI_LOG_BUFFER_SIZE = undefined;
    process.env.XIAOZHI_LOG_FLUSH_INTERVAL = undefined;
    process.env.XIAOZHI_LOG_STRUCTURED = undefined;
    process.env.XIAOZHI_LOG_REDACT = undefined;
    process.env.XIAOZHI_LOG_SAMPLING_RATE = undefined;

    // 重置单例
    (PinoConfigManager as any).instance = null;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;

    // 重置单例
    (PinoConfigManager as any).instance = null;
  });

  describe("单例模式", () => {
    it("应该返回同一个实例", () => {
      const instance1 = PinoConfigManager.getInstance();
      const instance2 = PinoConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("默认配置", () => {
    it("应该使用正确的默认配置", () => {
      const manager = PinoConfigManager.getInstance();
      const config = manager.getConfig();

      expect(config.level).toBe("info");
      expect(config.isDaemonMode).toBe(false);
      expect(config.logFilePath).toBe("./xiaozhi.log");
      expect(config.enableFileLogging).toBe(true);
      expect(config.asyncLogging).toBe(true);
      expect(config.bufferSize).toBe(8192);
      expect(config.flushInterval).toBe(1000);
      expect(config.structuredLogging).toBe(true);
      expect(config.redactPaths).toEqual([]);
      expect(config.samplingRate).toBe(1.0);
    });

    it("应该根据NODE_ENV设置prettyPrint", () => {
      // 测试开发环境
      process.env.NODE_ENV = "development";
      (PinoConfigManager as any).instance = null;

      const devManager = PinoConfigManager.getInstance();
      expect(devManager.getConfig().prettyPrint).toBe(true);

      // 测试生产环境
      process.env.NODE_ENV = "production";
      (PinoConfigManager as any).instance = null;

      const prodManager = PinoConfigManager.getInstance();
      expect(prodManager.getConfig().prettyPrint).toBe(false);
    });
  });

  describe("环境变量配置", () => {
    it("应该从环境变量加载基础配置", () => {
      process.env.XIAOZHI_LOG_LEVEL = "debug";
      process.env.XIAOZHI_DAEMON = "true";
      process.env.XIAOZHI_LOG_FILE = "/custom/path.log";
      process.env.XIAOZHI_LOG_FILE_ENABLED = "false";

      const manager = PinoConfigManager.getInstance();
      const config = manager.getConfig();

      expect(config.level).toBe("debug");
      expect(config.isDaemonMode).toBe(true);
      expect(config.logFilePath).toBe("/custom/path.log");
      expect(config.enableFileLogging).toBe(false);
    });

    it("应该从环境变量加载性能配置", () => {
      process.env.XIAOZHI_LOG_ASYNC = "false";
      process.env.XIAOZHI_LOG_BUFFER_SIZE = "16384";
      process.env.XIAOZHI_LOG_FLUSH_INTERVAL = "2000";

      const manager = PinoConfigManager.getInstance();
      const config = manager.getConfig();

      expect(config.asyncLogging).toBe(false);
      expect(config.bufferSize).toBe(16384);
      expect(config.flushInterval).toBe(2000);
    });

    it("应该从环境变量加载高级配置", () => {
      process.env.XIAOZHI_LOG_STRUCTURED = "false";
      process.env.XIAOZHI_LOG_REDACT = "password,token,secret";
      process.env.XIAOZHI_LOG_SAMPLING_RATE = "0.5";

      const manager = PinoConfigManager.getInstance();
      const config = manager.getConfig();

      expect(config.structuredLogging).toBe(false);
      expect(config.redactPaths).toEqual(["password", "token", "secret"]);
      expect(config.samplingRate).toBe(0.5);
    });

    it("应该忽略无效的数值配置", () => {
      process.env.XIAOZHI_LOG_BUFFER_SIZE = "invalid";
      process.env.XIAOZHI_LOG_FLUSH_INTERVAL = "not-a-number";
      process.env.XIAOZHI_LOG_SAMPLING_RATE = "invalid-rate";

      const manager = PinoConfigManager.getInstance();
      const config = manager.getConfig();

      // 应该使用默认值
      expect(config.bufferSize).toBe(8192);
      expect(config.flushInterval).toBe(1000);
      expect(config.samplingRate).toBe(1.0);
    });

    it("应该处理空的redact配置", () => {
      process.env.XIAOZHI_LOG_REDACT = "";

      const manager = PinoConfigManager.getInstance();
      const config = manager.getConfig();

      expect(config.redactPaths).toEqual([]);
    });

    it("应该处理带空格的redact配置", () => {
      process.env.XIAOZHI_LOG_REDACT = " password , token , secret ";

      const manager = PinoConfigManager.getInstance();
      const config = manager.getConfig();

      expect(config.redactPaths).toEqual(["password", "token", "secret"]);
    });
  });

  describe("配置验证", () => {
    it("应该验证采样率范围", () => {
      expect(() => {
        const manager = PinoConfigManager.getInstance();
        manager.updateConfig({ samplingRate: -0.1 });
      }).toThrow("采样率必须在0-1之间");

      expect(() => {
        const manager = PinoConfigManager.getInstance();
        manager.updateConfig({ samplingRate: 1.1 });
      }).toThrow("采样率必须在0-1之间");
    });

    it("应该验证缓冲区大小", () => {
      expect(() => {
        const manager = PinoConfigManager.getInstance();
        manager.updateConfig({ bufferSize: 512 });
      }).toThrow("缓冲区大小不能小于1024字节");
    });

    it("应该验证刷新间隔", () => {
      expect(() => {
        const manager = PinoConfigManager.getInstance();
        manager.updateConfig({ flushInterval: 50 });
      }).toThrow("刷新间隔不能小于100毫秒");
    });

    it("应该验证日志级别", () => {
      expect(() => {
        const manager = PinoConfigManager.getInstance();
        manager.updateConfig({ level: "invalid" });
      }).toThrow("无效的日志级别: invalid");
    });

    it("应该接受有效的日志级别", () => {
      const manager = PinoConfigManager.getInstance();
      const validLevels = ["trace", "debug", "info", "warn", "error", "fatal"];

      for (const level of validLevels) {
        expect(() => {
          manager.updateConfig({ level });
        }).not.toThrow();
      }
    });
  });

  describe("配置更新", () => {
    it("应该正确更新配置", () => {
      const manager = PinoConfigManager.getInstance();

      manager.updateConfig({
        level: "debug",
        bufferSize: 16384,
        samplingRate: 0.8,
      });

      const config = manager.getConfig();
      expect(config.level).toBe("debug");
      expect(config.bufferSize).toBe(16384);
      expect(config.samplingRate).toBe(0.8);
    });

    it("应该在验证失败时回滚配置", () => {
      const manager = PinoConfigManager.getInstance();
      const originalConfig = manager.getConfig();

      expect(() => {
        manager.updateConfig({
          level: "debug",
          samplingRate: 2.0, // 无效值
        });
      }).toThrow();

      // 配置应该保持不变
      const currentConfig = manager.getConfig();
      expect(currentConfig).toEqual(originalConfig);
    });
  });

  describe("配置监听器", () => {
    it("应该在配置更新时通知监听器", () => {
      const manager = PinoConfigManager.getInstance();
      const listener = vi.fn();

      manager.onConfigChange(listener);
      manager.updateConfig({ level: "debug" });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ level: "debug" })
      );
    });

    it("应该能移除监听器", () => {
      const manager = PinoConfigManager.getInstance();
      const listener = vi.fn();

      manager.onConfigChange(listener);
      manager.removeConfigListener(listener);
      manager.updateConfig({ level: "debug" });

      expect(listener).not.toHaveBeenCalled();
    });

    it("应该处理监听器执行错误", () => {
      const manager = PinoConfigManager.getInstance();
      const errorListener = vi.fn(() => {
        throw new Error("监听器错误");
      });
      const normalListener = vi.fn();

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      manager.onConfigChange(errorListener);
      manager.onConfigChange(normalListener);
      manager.updateConfig({ level: "debug" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "配置变更监听器执行失败:",
        expect.any(Error)
      );
      expect(normalListener).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("便捷方法", () => {
    it("应该提供便捷的配置获取方法", () => {
      const manager = PinoConfigManager.getInstance();

      manager.updateConfig({
        level: "debug",
        isDaemonMode: true,
        asyncLogging: false,
        bufferSize: 16384,
        flushInterval: 2000,
        samplingRate: 0.8,
        structuredLogging: false,
        redactPaths: ["password"],
      });

      expect(manager.getLogLevel()).toBe("debug");
      expect(manager.isDaemon()).toBe(true);
      expect(manager.isAsyncLogging()).toBe(false);
      expect(manager.getBufferSize()).toBe(16384);
      expect(manager.getFlushInterval()).toBe(2000);
      expect(manager.getSamplingRate()).toBe(0.8);
      expect(manager.isStructuredLogging()).toBe(false);
      expect(manager.getRedactPaths()).toEqual(["password"]);
    });
  });

  describe("配置重载", () => {
    it("应该能从环境变量重新加载配置", () => {
      const manager = PinoConfigManager.getInstance();

      // 修改环境变量
      process.env.XIAOZHI_LOG_LEVEL = "error";
      process.env.XIAOZHI_LOG_BUFFER_SIZE = "32768";

      manager.reloadFromEnvironment();

      const config = manager.getConfig();
      expect(config.level).toBe("error");
      expect(config.bufferSize).toBe(32768);
    });
  });

  describe("配置重置", () => {
    it("应该能重置为默认配置", () => {
      const manager = PinoConfigManager.getInstance();

      // 修改配置
      manager.updateConfig({ level: "debug", bufferSize: 16384 });

      // 重置配置
      manager.reset();

      const config = manager.getConfig();
      expect(config.level).toBe("info");
      expect(config.bufferSize).toBe(8192);
    });
  });

  describe("配置摘要", () => {
    it("应该提供配置摘要", () => {
      const manager = PinoConfigManager.getInstance();
      const summary = manager.getConfigSummary();

      expect(summary).toContain("level");
      expect(summary).toContain("isDaemonMode");
      expect(summary).toContain("asyncLogging");
      expect(summary).toContain("bufferSize");
      expect(summary).toContain("flushInterval");
      expect(summary).toContain("samplingRate");
      expect(summary).toContain("structuredLogging");
      expect(summary).toContain("redactPathsCount");
    });
  });
});
