/**
 * ServiceHandler 测试
 * 测试服务消息处理器的功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketMessageType } from "../types.js";
import { ServiceHandler } from "./ServiceHandler.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ServiceHandler", () => {
  let serviceHandler: ServiceHandler;
  let mockWebSocket: any;
  let mockBroadcastCallback: ReturnType<typeof vi.fn>;
  let mockCreateContainer: ReturnType<typeof vi.fn>;
  let mockSpawn: any;

  beforeEach(async () => {
    serviceHandler = new ServiceHandler();
    mockBroadcastCallback = vi.fn();
    mockCreateContainer = vi.fn();

    // 获取 mock spawn 引用
    const childProcessModule = await import("node:child_process");
    mockSpawn = childProcessModule.spawn as any;

    // 设置回调函数
    serviceHandler.setBroadcastCallback(mockBroadcastCallback);
    serviceHandler.setCreateContainer(mockCreateContainer);

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    // Mock child process
    const mockChild = {
      unref: vi.fn(),
    };
    mockSpawn.mockReturnValue(mockChild);

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("应该能够处理 restartService 消息", () => {
      expect(
        serviceHandler.canHandle(WebSocketMessageType.RESTART_SERVICE)
      ).toBe(true);
    });

    it("应该不能处理其他类型的消息", () => {
      expect(serviceHandler.canHandle(WebSocketMessageType.GET_CONFIG)).toBe(
        false
      );
      expect(serviceHandler.canHandle(WebSocketMessageType.GET_STATUS)).toBe(
        false
      );
      expect(serviceHandler.canHandle("unknown")).toBe(false);
    });
  });

  describe("handle", () => {
    it("应该处理 restartService 消息", async () => {
      // Mock service manager
      const mockServiceManager = {
        getStatus: vi.fn().mockResolvedValue({
          running: true,
          mode: "daemon",
        }),
      };

      const mockContainer = {
        get: vi.fn().mockReturnValue(mockServiceManager),
      };

      mockCreateContainer.mockResolvedValue(mockContainer);

      const message = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      // 开始处理消息
      await serviceHandler.handle(mockWebSocket, message);

      // 验证立即广播重启状态
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });
    });

    it("应该处理服务未运行的情况", async () => {
      // Mock service manager - 服务未运行
      const mockServiceManager = {
        getStatus: vi.fn().mockResolvedValue({
          running: false,
          mode: "daemon",
        }),
      };

      const mockContainer = {
        get: vi.fn().mockReturnValue(mockServiceManager),
      };

      mockCreateContainer.mockResolvedValue(mockContainer);

      const message = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      await serviceHandler.handle(mockWebSocket, message);

      // 验证立即广播重启状态
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });
    });

    it("应该处理非守护进程模式", async () => {
      // Mock service manager - 非守护进程模式
      const mockServiceManager = {
        getStatus: vi.fn().mockResolvedValue({
          running: true,
          mode: "standalone",
        }),
      };

      const mockContainer = {
        get: vi.fn().mockReturnValue(mockServiceManager),
      };

      mockCreateContainer.mockResolvedValue(mockContainer);

      const message = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      await serviceHandler.handle(mockWebSocket, message);

      // 验证立即广播重启状态
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });
    });

    it("应该处理重启失败的情况", async () => {
      // Mock createContainer 抛出错误
      mockCreateContainer.mockRejectedValue(new Error("容器创建失败"));

      const message = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      await serviceHandler.handle(mockWebSocket, message);

      // 验证立即广播重启状态
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });
    });

    it("应该处理未知消息类型", async () => {
      const message = {
        type: "unknown",
      };

      await serviceHandler.handle(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"未知消息类型: unknown"')
      );
    });

    it("应该处理消息处理时的错误", async () => {
      // Mock WebSocket.send 抛出错误
      mockWebSocket.send.mockImplementation(() => {
        throw new Error("发送失败");
      });

      const message = {
        type: "unknown",
      };

      await serviceHandler.handle(mockWebSocket, message);

      // 应该不会抛出错误，只是记录日志
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });

  describe("triggerRestart", () => {
    it("应该手动触发服务重启", async () => {
      vi.useFakeTimers();

      // Mock service manager
      const mockServiceManager = {
        getStatus: vi.fn().mockResolvedValue({
          running: true,
          mode: "daemon",
        }),
      };

      const mockContainer = {
        get: vi.fn().mockReturnValue(mockServiceManager),
      };

      mockCreateContainer.mockResolvedValue(mockContainer);

      const restartPromise = serviceHandler.triggerRestart();

      // 验证立即广播重启状态
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });

      await restartPromise;

      // 验证spawn被调用
      expect(mockSpawn).toHaveBeenCalledWith(
        "xiaozhi",
        ["restart", "--daemon"],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
        })
      );

      // 快进5秒，触发完成状态
      vi.advanceTimersByTime(5000);

      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "completed",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });

      vi.useRealTimers();
    });

    it("应该处理手动重启失败的情况", async () => {
      // Mock createContainer 抛出错误
      mockCreateContainer.mockRejectedValue(new Error("重启失败"));

      await expect(serviceHandler.triggerRestart()).rejects.toThrow("重启失败");

      // 验证失败状态被广播
      expect(mockBroadcastCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "failed",
          error: "重启失败",
          timestamp: expect.any(Number),
        },
      });
    });
  });

  describe("setBroadcastCallback", () => {
    it("应该正确设置广播回调", async () => {
      const newCallback = vi.fn();
      serviceHandler.setBroadcastCallback(newCallback);

      vi.useFakeTimers();

      // Mock service manager
      const mockServiceManager = {
        getStatus: vi.fn().mockResolvedValue({
          running: true,
          mode: "daemon",
        }),
      };

      const mockContainer = {
        get: vi.fn().mockReturnValue(mockServiceManager),
      };

      mockCreateContainer.mockResolvedValue(mockContainer);

      const message = {
        type: WebSocketMessageType.RESTART_SERVICE,
      };

      const handlePromise = serviceHandler.handle(mockWebSocket, message);

      expect(newCallback).toHaveBeenCalledWith({
        type: WebSocketMessageType.RESTART_STATUS,
        data: {
          status: "restarting",
          error: undefined,
          timestamp: expect.any(Number),
        },
      });

      // 快进500ms完成处理
      vi.advanceTimersByTime(500);
      await handlePromise;

      vi.useRealTimers();
    });
  });

  describe("setCreateContainer", () => {
    it("应该正确设置容器创建函数", async () => {
      const newCreateContainer = vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue({
          getStatus: vi.fn().mockResolvedValue({
            running: true,
            mode: "daemon",
          }),
        }),
      });

      serviceHandler.setCreateContainer(newCreateContainer);

      await serviceHandler.triggerRestart();

      expect(newCreateContainer).toHaveBeenCalled();
    });

    it("应该处理未设置容器创建函数的情况", async () => {
      const handlerWithoutContainer = new ServiceHandler();
      handlerWithoutContainer.setBroadcastCallback(mockBroadcastCallback);

      await expect(handlerWithoutContainer.triggerRestart()).rejects.toThrow(
        "createContainer 函数未设置"
      );
    });
  });
});
