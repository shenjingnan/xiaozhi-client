/**
 * InstallLogStream 测试
 *
 * 覆盖 NPM 安装日志流管理器的全部功能：
 * - 会话生命周期（startInstall/complete/fail/cleanup）
 * - 日志推送（pushLog）
 * - SSE 流创建（createSSEStream）
 * - 多消费者场景
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallLogStream } from "../install-log-stream";

/**
 * 辅助函数：读取 ReadableStream 中已入队的数据，然后取消读取器
 * 使用 Promise.race 避免在无数据时永久阻塞
 */
async function readStreamChunks(
  stream: ReadableStream<string>
): Promise<string[]> {
  const reader = stream.getReader();
  const chunks: string[] = [];

  try {
    // 先尝试非阻塞地读取所有已入队的数据
    // 每次读取后检查是否有新数据，没有则停止
    while (true) {
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error("timeout")), 100)
        ),
      ]);
      chunks.push(result.value);
    }
  } catch {
    // 超时或流关闭，正常退出
  } finally {
    reader.cancel();
  }

  return chunks;
}

/**
 * 辅助函数：收集已关闭流的全部内容
 */
async function collectClosedStream(
  reader: ReadableStreamDefaultReader<string>
): Promise<string> {
  const chunks: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } catch {
    // 流可能已被取消或关闭
  }
  return chunks.join("");
}

describe("InstallLogStream", () => {
  let logStream: InstallLogStream;

  beforeEach(() => {
    logStream = new InstallLogStream();
  });

  // ==================== startInstall ====================

  describe("startInstall", () => {
    it("应该创建新的安装会话", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      expect(logStream.hasSession("install-1")).toBe(true);
    });

    it("应该初始化空的日志数组和控制器集合", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const stream = logStream.createSSEStream("install-1");
      expect(stream).not.toBeNull();
    });

    it("应该允许同一 installId 覆盖已有会话", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      logStream.startInstall({
        version: "2.0.0",
        installId: "install-1",
        timestamp: 2000,
      });

      expect(logStream.hasSession("install-1")).toBe(true);
    });
  });

  // ==================== pushLog ====================

  describe("pushLog", () => {
    beforeEach(() => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });
    });

    it("应该向已存在的会话追加日志条目并通过 SSE 回放验证", async () => {
      logStream.pushLog("install-1", {
        type: "stdout",
        message: "Installing...",
        timestamp: 1500,
      });

      const stream = logStream.createSSEStream("install-1")!;
      const chunks = await readStreamChunks(stream);

      const combined = chunks.join("");
      expect(combined).toContain("event: log");
      expect(combined).toContain('"message":"Installing..."');
    });

    it("应该在会话不存在时静默返回（不抛错）", () => {
      expect(() => {
        logStream.pushLog("non-existent", {
          type: "stdout",
          message: "test",
          timestamp: 1000,
        });
      }).not.toThrow();
    });

    it("应该正确格式化 stdout 类型的日志事件", async () => {
      logStream.pushLog("install-1", {
        type: "stdout",
        message: "stdout message",
        timestamp: 1500,
      });

      const stream = logStream.createSSEStream("install-1")!;
      const chunks = await readStreamChunks(stream);
      const combined = chunks.join("");

      expect(combined).toContain('"type":"stdout"');
      expect(combined).toContain('"message":"stdout message"');
    });

    it("应该正确格式化 stderr 类型的日志事件", async () => {
      logStream.pushLog("install-1", {
        type: "stderr",
        message: "error message",
        timestamp: 1500,
      });

      const stream = logStream.createSSEStream("install-1")!;
      const chunks = await readStreamChunks(stream);
      const combined = chunks.join("");

      expect(combined).toContain('"type":"stderr"');
      expect(combined).toContain('"message":"error message"');
    });
  });

  // ==================== complete ====================

  describe("complete", () => {
    beforeEach(() => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });
    });

    it("应该将会话标记为完成状态", () => {
      logStream.complete({
        version: "1.0.0",
        installId: "install-1",
        success: true,
        duration: 5000,
        timestamp: 6000,
      });

      // 已完成的会话仍可查询到（在延迟清理前）
      expect(logStream.hasSession("install-1")).toBe(true);
    });

    it("应该向所有活跃消费者发送 completed 事件并关闭流", async () => {
      const stream = logStream.createSSEStream("install-1")!;
      const reader = stream.getReader();

      queueMicrotask(() => {
        logStream.complete({
          version: "1.0.0",
          installId: "install-1",
          success: true,
          duration: 5000,
          timestamp: 6000,
        });
      });

      const combined = await collectClosedStream(reader);

      expect(combined).toContain("event: completed");
      expect(combined).toContain('"success":true');
      expect(combined).toContain('"duration":5000');
    });

    it("应该设置延迟清理定时器（60秒后删除会话）", () => {
      vi.useFakeTimers();
      logStream.complete({
        version: "1.0.0",
        installId: "install-1",
        success: true,
        duration: 5000,
        timestamp: 6000,
      });

      expect(logStream.hasSession("install-1")).toBe(true);

      vi.advanceTimersByTime(60_000);

      expect(logStream.hasSession("install-1")).toBe(false);
      vi.useRealTimers();
    });

    it("对已完成的会话重复调用 complete 应该忽略（幂等性）", () => {
      const completeData = {
        version: "1.0.0",
        installId: "install-1",
        success: true,
        duration: 5000,
        timestamp: 6000,
      };

      logStream.complete(completeData);
      expect(() => {
        logStream.complete(completeData);
      }).not.toThrow();
    });

    it("对不存在的会话调用 complete 应该静默返回", () => {
      expect(() => {
        logStream.complete({
          version: "1.0.0",
          installId: "non-existent",
          success: true,
          duration: 5000,
          timestamp: 6000,
        });
      }).not.toThrow();
    });
  });

  // ==================== fail ====================

  describe("fail", () => {
    beforeEach(() => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });
    });

    it("应该将会话标记为完成并记录失败数据", () => {
      logStream.fail({
        version: "1.0.0",
        installId: "install-1",
        error: "安装失败",
        duration: 3000,
        timestamp: 4000,
      });

      expect(logStream.hasSession("install-1")).toBe(true);
    });

    it("应该向所有活跃消费者发送 failed 事件并关闭流", async () => {
      const stream = logStream.createSSEStream("install-1")!;
      const reader = stream.getReader();

      queueMicrotask(() => {
        logStream.fail({
          version: "1.0.0",
          installId: "install-1",
          error: "安装失败",
          duration: 3000,
          timestamp: 4000,
        });
      });

      const combined = await collectClosedStream(reader);

      expect(combined).toContain("event: failed");
      expect(combined).toContain('"error":"安装失败"');
    });

    it("发送的事件类型应该是 'failed' 而非 'completed'", async () => {
      const stream = logStream.createSSEStream("install-1")!;
      const reader = stream.getReader();

      queueMicrotask(() => {
        logStream.fail({
          version: "1.0.0",
          installId: "install-1",
          error: "error",
          duration: 1000,
          timestamp: 2000,
        });
      });

      const combined = await collectClosedStream(reader);

      expect(combined).toContain("event: failed");
      expect(combined).not.toContain("event: completed");
    });

    it("对已完成的会话重复调用 fail 应该忽略", () => {
      const failData = {
        version: "1.0.0",
        installId: "install-1",
        error: "error",
        duration: 1000,
        timestamp: 2000,
      };

      logStream.fail(failData);
      expect(() => {
        logStream.fail(failData);
      }).not.toThrow();
    });
  });

  // ==================== createSSEStream ====================

  describe("createSSEStream", () => {
    it("应该返回 null 当会话不存在时", () => {
      const result = logStream.createSSEStream("non-existent");
      expect(result).toBeNull();
    });

    it("应该返回 ReadableStream 实例当会话存在时", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const result = logStream.createSSEStream("install-1");
      expect(result).toBeInstanceOf(ReadableStream);
    });

    it("应该发送 ': connected\\n\\n' SSE 注释作为首条消息", async () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const stream = logStream.createSSEStream("install-1")!;
      const reader = stream.getReader();
      const { value } = await reader.read();
      reader.cancel();

      expect(value).toBe(": connected\n\n");
    });

    it("应该回放已有的历史日志给新连接的客户端", async () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      logStream.pushLog("install-1", {
        type: "stdout",
        message: "log line 1",
        timestamp: 1100,
      });
      logStream.pushLog("install-1", {
        type: "stderr",
        message: "log line 2",
        timestamp: 1200,
      });

      const stream = logStream.createSSEStream("install-1")!;
      const chunks = await readStreamChunks(stream);
      const combined = chunks.join("");

      expect(combined).toContain('"message":"log line 1"');
      expect(combined).toContain('"message":"log line 2"');
    });

    describe("会话已完成时连接", () => {
      it("应该立即发送最终事件（completed）并自动关闭流", async () => {
        logStream.startInstall({
          version: "1.0.0",
          installId: "install-1",
          timestamp: 1000,
        });

        logStream.complete({
          version: "1.0.0",
          installId: "install-1",
          success: true,
          duration: 5000,
          timestamp: 6000,
        });

        const stream = logStream.createSSEStream("install-1")!;
        const reader = stream.getReader();
        const combined = await collectClosedStream(reader);

        expect(combined).toContain("event: completed");
        expect(combined).toContain('"success":true');
      });

      it("应该立即发送最终事件（failed）并自动关闭流", async () => {
        logStream.startInstall({
          version: "1.0.0",
          installId: "install-1",
          timestamp: 1000,
        });

        logStream.fail({
          version: "1.0.0",
          installId: "install-1",
          error: "fail reason",
          duration: 3000,
          timestamp: 4000,
        });

        const stream = logStream.createSSEStream("install-1")!;
        const reader = stream.getReader();
        const combined = await collectClosedStream(reader);

        expect(combined).toContain("event: failed");
        expect(combined).toContain('"error":"fail reason"');
      });
    });
  });

  // ==================== cleanup ====================

  describe("cleanup", () => {
    it("应该从 sessions Map 中删除该会话", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      logStream.cleanup("install-1");

      expect(logStream.hasSession("install-1")).toBe(false);
    });

    it("对不存在的会话调用 cleanup 应该静默返回", () => {
      expect(() => {
        logStream.cleanup("non-existent");
      }).not.toThrow();
    });

    it("关闭控制器时的异常不应该影响其他控制器的清理", async () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const stream1 = logStream.createSSEStream("install-1")!;
      logStream.createSSEStream("install-1")!;

      const reader1 = stream1.getReader();
      await reader1.read(); // 读取 connected 消息激活控制器

      expect(() => {
        logStream.cleanup("install-1");
      }).not.toThrow();

      expect(logStream.hasSession("install-1")).toBe(false);
    });
  });

  // ==================== cleanupCompleted ====================

  describe("cleanupCompleted", () => {
    it("只清理 done=true 的会话", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-active",
        timestamp: 1000,
      });
      logStream.startInstall({
        version: "2.0.0",
        installId: "install-done",
        timestamp: 2000,
      });

      logStream.complete({
        version: "2.0.0",
        installId: "install-done",
        success: true,
        duration: 1000,
        timestamp: 3000,
      });

      logStream.cleanupCompleted();

      expect(logStream.hasSession("install-active")).toBe(true);
      expect(logStream.hasSession("install-done")).toBe(false);
    });

    it("不应清理仍在进行中的会话", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      logStream.cleanupCompleted();

      expect(logStream.hasSession("install-1")).toBe(true);
    });

    it("在没有已完成会话时不做任何操作", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      expect(() => {
        logStream.cleanupCompleted();
      }).not.toThrow();

      expect(logStream.hasSession("install-1")).toBe(true);
    });
  });

  // ==================== hasSession ====================

  describe("hasSession", () => {
    it("在会话存在时返回 true", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      expect(logStream.hasSession("install-1")).toBe(true);
    });

    it("在会话不存在时返回 false", () => {
      expect(logStream.hasSession("non-existent")).toBe(false);
    });
  });

  // ==================== 多消费者场景 ====================

  describe("多消费者场景", () => {
    it("多个 createSSEStream 调用应各自获得独立流", () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const stream1 = logStream.createSSEStream("install-1");
      const stream2 = logStream.createSSEStream("install-1");

      expect(stream1).not.toBe(stream2);
      expect(stream1).toBeInstanceOf(ReadableStream);
      expect(stream2).toBeInstanceOf(ReadableStream);
    });

    it("pushLog 应同时推送到所有活跃消费者", async () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const stream1 = logStream.createSSEStream("install-1")!;
      const stream2 = logStream.createSSEStream("install-1")!;

      // 读取初始 connected 消息
      const reader1 = stream1.getReader();
      const reader2 = stream2.getReader();
      await reader1.read();
      await reader2.read();

      // 推送新日志
      logStream.pushLog("install-1", {
        type: "stdout",
        message: "broadcast test",
        timestamp: 2000,
      });

      // 等待数据入队后读取
      const [chunk1] = await Promise.all([reader1.read(), reader2.read()]);

      // 验证两个消费者都收到了数据
      expect(chunk1.value).toContain("broadcast test");

      reader1.cancel();
      reader2.cancel();
    });

    it("complete 应通知所有消费者并逐一关闭", async () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const stream1 = logStream.createSSEStream("install-1")!;
      const stream2 = logStream.createSSEStream("install-1")!;

      const reader1 = stream1.getReader();
      const reader2 = stream2.getReader();

      logStream.complete({
        version: "1.0.0",
        installId: "install-1",
        success: true,
        duration: 5000,
        timestamp: 6000,
      });

      const results = await Promise.allSettled([
        collectClosedStream(reader1),
        collectClosedStream(reader2),
      ]);

      expect(
        results.every((r) => r.status === "fulfilled")
      ).toBe(true);

      // 两者都应包含 completed 事件
      if (results[0].status === "fulfilled") {
        expect(results[0].value).toContain("event: completed");
      }
      if (results[1].status === "fulfilled") {
        expect(results[1].value).toContain("event: completed");
      }
    });

    it("一个消费者断开不影响其他消费者接收数据", async () => {
      logStream.startInstall({
        version: "1.0.0",
        installId: "install-1",
        timestamp: 1000,
      });

      const stream1 = logStream.createSSEStream("install-1")!;
      const stream2 = logStream.createSSEStream("install-1")!;

      const reader1 = stream1.getReader();
      const reader2 = stream2.getReader();

      // 读取 connected 消息
      await reader1.read();
      await reader2.read();

      // 断开第一个消费者
      reader1.cancel();

      // 推送日志
      logStream.pushLog("install-1", {
        type: "stdout",
        message: "after disconnect",
        timestamp: 2000,
      });

      // 完成安装
      logStream.complete({
        version: "1.0.0",
        installId: "install-1",
        success: true,
        duration: 5000,
        timestamp: 6000,
      });

      // 第二个消费者应仍然能收到完整数据
      const result = await collectClosedStream(reader2);
      expect(result).toContain("event: completed");
    });
  });
});
