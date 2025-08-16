import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PinoSampler } from "../PinoSampler";

describe("PinoSampler", () => {
  let sampler: PinoSampler;

  beforeEach(() => {
    // Mock Math.random for predictable testing
    vi.spyOn(Math, "random");
  });

  afterEach(() => {
    if (sampler) {
      sampler.destroy();
    }
    vi.restoreAllMocks();
  });

  describe("默认配置", () => {
    it("应该使用正确的默认配置", () => {
      sampler = new PinoSampler();
      const config = sampler.getConfig();

      expect(config.globalSamplingRate).toBe(1.0);
      expect(config.levelSamplingRates.trace).toBe(0.1);
      expect(config.levelSamplingRates.debug).toBe(0.5);
      expect(config.levelSamplingRates.info).toBe(1.0);
      expect(config.levelSamplingRates.warn).toBe(1.0);
      expect(config.levelSamplingRates.error).toBe(1.0);
      expect(config.levelSamplingRates.fatal).toBe(1.0);
      expect(config.duplicateSuppressionEnabled).toBe(true);
      expect(config.duplicateSuppressionWindow).toBe(60000);
      expect(config.duplicateSuppressionMaxCount).toBe(5);
      expect(config.alwaysLogErrors).toBe(true);
      expect(config.alwaysLogWarnings).toBe(true);
    });
  });

  describe("自定义配置", () => {
    it("应该接受自定义配置", () => {
      sampler = new PinoSampler({
        globalSamplingRate: 0.5,
        levelSamplingRates: {
          debug: 0.2,
          info: 0.8,
        },
        duplicateSuppressionEnabled: false,
        alwaysLogErrors: false,
      });

      const config = sampler.getConfig();
      expect(config.globalSamplingRate).toBe(0.5);
      expect(config.levelSamplingRates.debug).toBe(0.2);
      expect(config.levelSamplingRates.info).toBe(0.8);
      expect(config.duplicateSuppressionEnabled).toBe(false);
      expect(config.alwaysLogErrors).toBe(false);
    });
  });

  describe("采样决策", () => {
    it("应该根据采样率进行采样", () => {
      sampler = new PinoSampler({
        levelSamplingRates: { info: 0.5 },
      });

      // Mock random to return 0.3 (< 0.5, should sample)
      (Math.random as any).mockReturnValue(0.3);
      expect(sampler.shouldSample("info", "test message")).toBe(true);

      // Mock random to return 0.7 (> 0.5, should not sample)
      (Math.random as any).mockReturnValue(0.7);
      expect(sampler.shouldSample("info", "test message")).toBe(false);
    });

    it("应该始终记录错误日志", () => {
      sampler = new PinoSampler({
        alwaysLogErrors: true,
        levelSamplingRates: { error: 0.1 }, // 很低的采样率
      });

      // 即使随机数很大，错误日志也应该被记录
      (Math.random as any).mockReturnValue(0.9);
      expect(sampler.shouldSample("error", "error message")).toBe(true);
      expect(sampler.shouldSample("fatal", "fatal message")).toBe(true);
    });

    it("应该始终记录警告日志", () => {
      sampler = new PinoSampler({
        alwaysLogWarnings: true,
        levelSamplingRates: { warn: 0.1 }, // 很低的采样率
      });

      // 即使随机数很大，警告日志也应该被记录
      (Math.random as any).mockReturnValue(0.9);
      expect(sampler.shouldSample("warn", "warning message")).toBe(true);
    });

    it("应该使用全局采样率作为未配置级别的后备", () => {
      sampler = new PinoSampler({
        globalSamplingRate: 0.3,
        levelSamplingRates: {}, // 空配置
      });

      (Math.random as any).mockReturnValue(0.2);
      expect(sampler.shouldSample("custom", "custom message")).toBe(true);

      (Math.random as any).mockReturnValue(0.5);
      expect(sampler.shouldSample("custom", "custom message")).toBe(false);
    });
  });

  describe("重复日志抑制", () => {
    it("应该抑制重复的日志消息", () => {
      sampler = new PinoSampler({
        duplicateSuppressionEnabled: true,
        duplicateSuppressionMaxCount: 2,
        levelSamplingRates: { info: 1.0 }, // 确保采样率不影响测试
      });

      (Math.random as any).mockReturnValue(0.1); // 确保通过采样

      const message = "重复的消息";

      // 前两次应该通过
      expect(sampler.shouldSample("info", message)).toBe(true);
      expect(sampler.shouldSample("info", message)).toBe(true);

      // 第三次应该被抑制
      expect(sampler.shouldSample("info", message)).toBe(false);
      expect(sampler.shouldSample("info", message)).toBe(false);
    });

    it("应该区分不同级别的相同消息", () => {
      sampler = new PinoSampler({
        duplicateSuppressionEnabled: true,
        duplicateSuppressionMaxCount: 1,
        levelSamplingRates: { info: 1.0, warn: 1.0 },
      });

      (Math.random as any).mockReturnValue(0.1);

      const message = "相同的消息";

      // 不同级别应该分别计数
      expect(sampler.shouldSample("info", message)).toBe(true);
      expect(sampler.shouldSample("warn", message)).toBe(true);

      // 第二次相同级别的消息应该被抑制
      expect(sampler.shouldSample("info", message)).toBe(false);
      expect(sampler.shouldSample("warn", message)).toBe(false);
    });

    it("应该在禁用时不抑制重复消息", () => {
      sampler = new PinoSampler({
        duplicateSuppressionEnabled: false,
        levelSamplingRates: { info: 1.0 },
      });

      (Math.random as any).mockReturnValue(0.1);

      const message = "重复的消息";

      // 即使是重复消息也应该通过
      expect(sampler.shouldSample("info", message)).toBe(true);
      expect(sampler.shouldSample("info", message)).toBe(true);
      expect(sampler.shouldSample("info", message)).toBe(true);
    });
  });

  describe("统计信息", () => {
    it("应该正确跟踪统计信息", () => {
      sampler = new PinoSampler({
        levelSamplingRates: { info: 1.0, debug: 0.0 },
      });

      (Math.random as any).mockReturnValue(0.1);

      // 发送一些消息
      sampler.shouldSample("info", "info message 1");
      sampler.shouldSample("info", "info message 2");
      sampler.shouldSample("debug", "debug message 1");

      const stats = sampler.getStats();

      expect(stats.totalMessages).toBe(3);
      expect(stats.sampledMessages).toBe(2);
      expect(stats.droppedMessages).toBe(1);
      expect(stats.samplingRate).toBeCloseTo(2 / 3);

      expect(stats.levelStats.info.total).toBe(2);
      expect(stats.levelStats.info.sampled).toBe(2);
      expect(stats.levelStats.info.dropped).toBe(0);

      expect(stats.levelStats.debug.total).toBe(1);
      expect(stats.levelStats.debug.sampled).toBe(0);
      expect(stats.levelStats.debug.dropped).toBe(1);
    });

    it("应该跟踪重复抑制统计", () => {
      sampler = new PinoSampler({
        duplicateSuppressionEnabled: true,
        duplicateSuppressionMaxCount: 1,
        levelSamplingRates: { info: 1.0 },
      });

      (Math.random as any).mockReturnValue(0.1);

      const message = "重复消息";

      sampler.shouldSample("info", message);
      sampler.shouldSample("info", message); // 应该被抑制
      sampler.shouldSample("info", "不同消息");

      const stats = sampler.getStats();

      expect(stats.duplicateStats.total).toBe(3);
      expect(stats.duplicateStats.suppressed).toBe(1);
    });

    it("应该能重置统计信息", () => {
      sampler = new PinoSampler();

      (Math.random as any).mockReturnValue(0.1);

      sampler.shouldSample("info", "test message");

      let stats = sampler.getStats();
      expect(stats.totalMessages).toBe(1);

      sampler.resetStats();

      stats = sampler.getStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.sampledMessages).toBe(0);
      expect(stats.droppedMessages).toBe(0);
    });
  });

  describe("配置更新", () => {
    it("应该能更新配置", () => {
      sampler = new PinoSampler();

      sampler.updateConfig({
        globalSamplingRate: 0.5,
        alwaysLogErrors: false,
      });

      const config = sampler.getConfig();
      expect(config.globalSamplingRate).toBe(0.5);
      expect(config.alwaysLogErrors).toBe(false);
      // 其他配置应该保持不变
      expect(config.duplicateSuppressionEnabled).toBe(true);
    });
  });

  describe("重复跟踪器管理", () => {
    it("应该能清理重复跟踪器", () => {
      sampler = new PinoSampler({
        duplicateSuppressionEnabled: true,
        levelSamplingRates: { info: 1.0 },
      });

      (Math.random as any).mockReturnValue(0.1);

      sampler.shouldSample("info", "message 1");
      sampler.shouldSample("info", "message 2");

      expect(sampler.getDuplicateTrackerSize()).toBe(2);

      sampler.clearDuplicateTracker();

      expect(sampler.getDuplicateTrackerSize()).toBe(0);
    });
  });

  describe("统计摘要", () => {
    it("应该生成正确的统计摘要", () => {
      sampler = new PinoSampler({
        levelSamplingRates: { info: 1.0, debug: 0.5 },
      });

      (Math.random as any).mockReturnValue(0.1);

      sampler.shouldSample("info", "info message");
      sampler.shouldSample("debug", "debug message");

      const summary = sampler.getStatsSummary();

      expect(summary).toContain("totalMessages");
      expect(summary).toContain("sampledMessages");
      expect(summary).toContain("overallSamplingRate");
      expect(summary).toContain("levelBreakdown");

      const parsed = JSON.parse(summary);
      expect(parsed.totalMessages).toBe(2);
      expect(parsed.levelBreakdown).toHaveLength(2);
    });
  });

  describe("资源清理", () => {
    it("应该正确清理资源", () => {
      sampler = new PinoSampler();

      // 添加一些数据
      (Math.random as any).mockReturnValue(0.1);
      sampler.shouldSample("info", "test message");

      expect(sampler.getDuplicateTrackerSize()).toBeGreaterThan(0);

      sampler.destroy();

      expect(sampler.getDuplicateTrackerSize()).toBe(0);
    });
  });

  describe("长消息处理", () => {
    it("应该正确处理长消息的重复检测", () => {
      sampler = new PinoSampler({
        duplicateSuppressionEnabled: true,
        duplicateSuppressionMaxCount: 1,
        levelSamplingRates: { info: 1.0 },
      });

      (Math.random as any).mockReturnValue(0.1);

      // 创建一个超过100字符的长消息
      const longMessage = "a".repeat(200);
      const anotherLongMessage = "a".repeat(150) + "b".repeat(50);

      // 前100个字符相同的消息应该被视为重复
      expect(sampler.shouldSample("info", longMessage)).toBe(true);
      expect(sampler.shouldSample("info", anotherLongMessage)).toBe(false);
    });
  });
});
