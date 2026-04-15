/**
 * useNPMInstall Hook 测试
 *
 * 覆盖 NPM 安装 Hook 的全部功能：
 * - 初始状态
 * - startInstall 成功/失败流程
 * - SSE 事件处理（log/completed/failed/onerror）
 * - clearStatus
 * - 工具函数（getStatusText/getStatusColor/isInstalling/canCloseDialog）
 * - 组件卸载清理
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNPMInstall } from "../useNPMInstall";

describe("useNPMInstall", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockEventSourceInstances: Array<{
    url: string;
    addEventListener: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onerror: ((error: unknown) => void) | null;
    _emit: (event: string, data: unknown) => void;
    _emitError: () => void;
  }>;

  function createMockEventSource(url: string) {
    const listeners = new Map<string, Set<(e: { data: string }) => void>>();
    const instance: (typeof mockEventSourceInstances)[number] = {
      url,
      addEventListener: vi.fn(
        (event: string, handler: (e: { data: string }) => void) => {
          if (!listeners.has(event)) {
            listeners.set(event, new Set());
          }
          listeners.get(event)!.add(handler);
        }
      ),
      close: vi.fn(),
      onerror: null as any,
      _emit(event: string, data: unknown) {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach((h) => h({ data: JSON.stringify(data) }));
        }
      },
      _emitError() {
        if (instance.onerror) {
          instance.onerror(new Error("SSE connection error"));
        }
      },
    };
    mockEventSourceInstances.push(instance);
    return instance;
  }

  /** 辅助：执行完整的 startInstall 成功流程并返回最新 EventSource 实例 */
  async function doStartInstall(
    result: { current: ReturnType<typeof useNPMInstall> },
    version = "1.0.0",
    installId = "test-install-id"
  ) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { installId },
        }),
    });

    await act(async () => {
      await result.current.startInstall(version);
    });

    return mockEventSourceInstances[mockEventSourceInstances.length - 1];
  }

  beforeEach(() => {
    mockEventSourceInstances = [];
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    vi.stubGlobal(
      "EventSource",
      vi.fn().mockImplementation(createMockEventSource)
    );

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== 初始状态 ====================

  describe("初始状态", () => {
    it("初始状态应为 idle，日志为空数组", () => {
      const { result } = renderHook(() => useNPMInstall());

      expect(result.current.installStatus.status).toBe("idle");
      expect(result.current.installStatus.logs).toEqual([]);
    });

    it("应返回所有预期的属性和方法", () => {
      const { result } = renderHook(() => useNPMInstall());

      expect(result.current).toHaveProperty("installStatus");
      expect(result.current).toHaveProperty("startInstall");
      expect(result.current).toHaveProperty("clearStatus");
      expect(result.current).toHaveProperty("getStatusText");
      expect(result.current).toHaveProperty("getStatusColor");
      expect(result.current).toHaveProperty("isInstalling");
      expect(result.current).toHaveProperty("canCloseDialog");
    });
  });

  // ==================== startInstall - 成功流程 ====================

  describe("startInstall - 成功流程", () => {
    it("应该 POST /api/update 发起安装请求", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result, "1.7.9");

      expect(mockFetch).toHaveBeenCalledWith("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "1.7.9" }),
      });
    });

    it("请求体应包含 version 字段", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result, "2.0.0");

      const callArgs = mockFetch.mock.calls[0][1];
      expect(JSON.parse(callArgs.body)).toEqual({ version: "2.0.0" });
    });

    it("成功后应将状态切换为 installing", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result);

      expect(result.current.installStatus.status).toBe("installing");
      expect(result.current.installStatus.version).toBe("1.0.0");
      expect(result.current.installStatus.installId).toBe("test-install-id");
    });

    it("应该建立 SSE 连接获取安装日志", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result);

      expect(mockEventSourceInstances.length).toBe(1);
      expect(mockEventSourceInstances[0].url).toContain(
        "/api/install/logs?installId=test-install-id"
      );
    });

    it("SSE URL 应包含正确的 installId 参数", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result, "1.5.0", "special-999");

      expect(mockEventSourceInstances[0].url).toBe(
        "/api/install/logs?installId=special-999"
      );
    });
  });

  // ==================== startInstall - SSE 日志事件 ====================

  describe("startInstall - SSE 日志事件处理", () => {
    it("收到 log 事件时应追加到 logs 数组", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("log", {
        installId: "test-install-id",
        type: "stdout",
        message: "Installing package...",
        timestamp: 1000,
      });

      // 等待 React 状态更新
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.logs).toHaveLength(1);
      expect(result.current.installStatus.logs[0]).toEqual({
        type: "stdout",
        message: "Installing package...",
        timestamp: 1000,
      });
    });

    it("多条 log 事件应按顺序累积", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("log", {
        installId: "test-install-id",
        type: "stdout",
        message: "line 1",
        timestamp: 1000,
      });
      es._emit("log", {
        installId: "test-install-id",
        type: "stderr",
        message: "line 2",
        timestamp: 2000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.logs).toHaveLength(2);
      expect(result.current.installStatus.logs[0].message).toBe("line 1");
      expect(result.current.installStatus.logs[1].message).toBe("line 2");
    });

    it("非当前 installId 的日志应被忽略（防串扰）", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("log", {
        installId: "other-install-id",
        type: "stdout",
        message: "should be ignored",
        timestamp: 1000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.logs).toHaveLength(0);
    });
  });

  // ==================== startInstall - 安装完成事件 ====================

  describe("startInstall - 安装完成事件", () => {
    it("收到 completed 事件时应将状态切换为 completed", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("completed", {
        installId: "test-install-id",
        duration: 5000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.status).toBe("completed");
      expect(result.current.installStatus.duration).toBe(5000);
    });

    it("完成后应关闭 EventSource 连接", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("completed", {
        installId: "test-install-id",
        duration: 3000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(es.close).toHaveBeenCalled();
    });

    it("非当前 installId 的完成事件应被忽略", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("completed", {
        installId: "other-id",
        duration: 3000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.status).toBe("installing");
    });
  });

  // ==================== startInstall - 安装失败事件 ====================

  describe("startInstall - 安装失败事件", () => {
    it("收到 failed 事件时应将状态切换为 failed", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("failed", {
        installId: "test-install-id",
        error: "Installation failed",
        duration: 2000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.status).toBe("failed");
      expect(result.current.installStatus.error).toBe("Installation failed");
      expect(result.current.installStatus.duration).toBe(2000);
    });

    it("失败后应关闭 EventSource 连接", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("failed", {
        installId: "test-install-id",
        error: "error",
        duration: 1000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(es.close).toHaveBeenCalled();
    });

    it("非当前 installId 的失败事件应被忽略", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("failed", {
        installId: "other-id",
        error: "error",
        duration: 1000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.status).toBe("installing");
    });
  });

  // ==================== startInstall - SSE 连接错误 ====================

  describe("startInstall - SSE 连接错误", () => {
    it("EventSource.onerror 触发且正在安装时应标记为 failed", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emitError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(result.current.installStatus.status).toBe("failed");
    });

    it("错误信息应为 'SSE 连接中断...'", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emitError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(result.current.installStatus.error).toContain("SSE 连接中断");
    });

    it("错误后应关闭 EventSource 并置空引用", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emitError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(es.close).toHaveBeenCalled();
    });
  });

  // ==================== startInstall - API 请求失败 ====================

  describe("startInstall - API 请求失败", () => {
    it("fetch 失败时应抛出原始错误", async () => {
      const networkError = new Error("Network error");
      mockFetch.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useNPMInstall());

      await expect(
        act(async () => {
          await result.current.startInstall("1.0.0");
        })
      ).rejects.toThrow("Network error");
    });

    it("API 返回 success:false 时应抛出错误", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "版本不存在" },
          }),
      });

      const { result } = renderHook(() => useNPMInstall());

      await expect(
        act(async () => {
          await result.current.startInstall("99.99.99");
        })
      ).rejects.toThrow("版本不存在");
    });

    it("失败时应将状态设为 failed 并记录 error 信息", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useNPMInstall());

      await act(async () => {
        try {
          await result.current.startInstall("1.0.0");
        } catch {
          // 预期抛出错误
        }
        // 等待 React 处理 catch 块中的 setState
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.installStatus.status).toBe("failed");
      expect(result.current.installStatus.error).toBe("Server error");
    });
  });

  // ==================== startInstall - 重复安装 ====================

  describe("startInstall - 重复安装", () => {
    it("再次调用 startInstall 时应关闭之前的 EventSource", async () => {
      const { result } = renderHook(() => useNPMInstall());

      // 第一次安装
      const es1 = await doStartInstall(result, "1.0.0", "first-id");

      // 第二次安装
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { installId: "second-id" },
          }),
      });

      await act(async () => {
        await result.current.startInstall("2.0.0");
      });

      // 第一个 EventSource 应被关闭
      expect(es1.close).toHaveBeenCalled();

      // 应有第二个 EventSource 实例
      expect(mockEventSourceInstances.length).toBe(2);
    });

    it("应使用新的 installId 建立新的 SSE 连接", async () => {
      const { result } = renderHook(() => useNPMInstall());

      await doStartInstall(result, "1.0.0", "id-1");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { installId: "id-2" },
          }),
      });

      await act(async () => {
        await result.current.startInstall("2.0.0");
      });

      const lastES =
        mockEventSourceInstances[mockEventSourceInstances.length - 1];
      expect(lastES.url).toContain("installId=id-2");
    });
  });

  // ==================== clearStatus ====================

  describe("clearStatus", () => {
    it("应将状态重置为 idle", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result);

      expect(result.current.installStatus.status).toBe("installing");

      act(() => {
        result.current.clearStatus();
      });

      expect(result.current.installStatus.status).toBe("idle");
    });

    it("应清空日志数组", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result);

      act(() => {
        result.current.clearStatus();
      });

      expect(result.current.installStatus.logs).toEqual([]);
    });

    it("应关闭活跃的 EventSource 连接", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      act(() => {
        result.current.clearStatus();
      });

      expect(es.close).toHaveBeenCalled();
    });
  });

  // ==================== getStatusText ====================

  describe("getStatusText", () => {
    it("idle 状态应返回空字符串", () => {
      const { result } = renderHook(() => useNPMInstall());
      expect(result.current.getStatusText()).toBe("");
    });

    it("installing 状态应返回包含版本号的安装中文提示", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result, "1.7.9");

      const text = result.current.getStatusText();
      expect(text).toContain("正在安装");
      expect(text).toContain("1.7.9");
    });

    it("completed 状态应返回 '安装完成！'", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("completed", {
        installId: "test-install-id",
        duration: 1000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.getStatusText()).toBe("安装完成！");
    });

    it("failed 状态应返回包含错误信息的失败提示", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("failed", {
        installId: "test-install-id",
        error: "磁盘空间不足",
        duration: 1000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const text = result.current.getStatusText();
      expect(text).toContain("安装失败");
      expect(text).toContain("磁盘空间不足");
    });
  });

  // ==================== getStatusColor ====================

  describe("getStatusColor", () => {
    it("idle 状态应返回灰色类名", () => {
      const { result } = renderHook(() => useNPMInstall());
      expect(result.current.getStatusColor()).toBe("text-gray-600");
    });

    it("installing 状态应返回蓝色类名", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result);

      expect(result.current.getStatusColor()).toBe("text-blue-600");
    });

    it("completed 状态应返回绿色类名", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("completed", {
        installId: "test-install-id",
        duration: 1000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.getStatusColor()).toBe("text-green-600");
    });

    it("failed 状态应返回红色类名", async () => {
      const { result } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      es._emit("failed", {
        installId: "test-install-id",
        error: "error",
        duration: 1000,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.getStatusColor()).toBe("text-red-600");
    });
  });

  // ==================== isInstalling ====================

  describe("isInstalling", () => {
    it("installing 状态应返回 true", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result);

      expect(result.current.isInstalling()).toBe(true);
    });

    it("其他状态应返回 false", () => {
      const { result } = renderHook(() => useNPMInstall());
      expect(result.current.isInstalling()).toBe(false);
    });
  });

  // ==================== canCloseDialog ====================

  describe("canCloseDialog", () => {
    it("installing 状态应返回 false（不可关闭）", async () => {
      const { result } = renderHook(() => useNPMInstall());
      await doStartInstall(result);

      expect(result.current.canCloseDialog()).toBe(false);
    });

    it("其他状态应返回 true（可以关闭）", () => {
      const { result } = renderHook(() => useNPMInstall());
      expect(result.current.canCloseDialog()).toBe(true);
    });
  });

  // ==================== 组件卸载清理 ====================

  describe("组件卸载清理", () => {
    it("unmount 时应关闭活跃的 EventSource 连接", async () => {
      const { result, unmount } = renderHook(() => useNPMInstall());
      const es = await doStartInstall(result);

      act(() => {
        unmount();
      });

      expect(es.close).toHaveBeenCalled();
    });
  });
});
