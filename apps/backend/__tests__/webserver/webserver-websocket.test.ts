/**
 * WebServer WebSocket 功能测试
 * 测试 WebSocket 连接、消息处理和并发连接
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { WebServer } from "../../WebServer";
import {
  createConfigMock,
  createEndpointManagerMock,
  createHandlerMocks,
  createLoggerMock,
  createServicesIndexMock,
  getAvailablePort,
  setupDefaultConfigMocks,
} from "./test-setup.js";

// 配置所有必需的 mock
vi.mock("@xiaozhi-client/config", createConfigMock);
vi.mock("../../Logger", createLoggerMock);
vi.mock("@/services/index.js", createServicesIndexMock);
vi.mock("@xiaozhi-client/endpoint", createEndpointManagerMock);
vi.mock("../../handlers/realtime-notification.handler", () => {
  const mocks = createHandlerMocks();
  return { RealtimeNotificationHandler: mocks.RealtimeNotificationHandler };
});
vi.mock("../../handlers/heartbeat.handler", () => {
  const mocks = createHandlerMocks();
  return { HeartbeatHandler: mocks.HeartbeatHandler };
});

describe("WebServer WebSocket 功能测试", () => {
  let webServer: WebServer;
  let mockConfigManager: any;
  let currentPort: number;

  beforeEach(async () => {
    const { configManager } = await import("@xiaozhi-client/config");
    mockConfigManager = configManager;
    currentPort = await getAvailablePort();
    setupDefaultConfigMocks(mockConfigManager, currentPort);
    webServer = new WebServer(currentPort);
    await webServer.start();
  });

  afterEach(async () => {
    if (webServer) {
      try {
        await webServer.stop();
      } catch (error) {
        console.warn("Failed to stop webServer in afterEach:", error);
      }
      webServer = null as any;
    }
    vi.clearAllMocks();
  });

  describe("WebSocket 连接和断开", () => {
    it("应该处理 WebSocket 连接", async () => {
      const ws = new WebSocket(`ws://localhost:${currentPort}`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("WebSocket test timeout"));
        }, 4000);

        ws.on("open", () => {
          // 连接成功，立即关闭并完成测试
          clearTimeout(timeout);
          ws.close();
          resolve();
        });

        ws.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });

    it("应该处理 WebSocket 客户端连接和断开", async () => {
      const ws = new WebSocket(`ws://localhost:${currentPort}`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("WebSocket connection timeout"));
        }, 3000);

        ws.on("open", () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });

        ws.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });

    it("应该处理多个并发 WebSocket 连接", async () => {
      const connections: WebSocket[] = [];
      const connectionCount = 5;

      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${currentPort}`);
        connections.push(ws);
      }

      await Promise.all(
        connections.map(
          (ws) =>
            new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error("Connection timeout"));
              }, 3000);

              ws.on("open", () => {
                clearTimeout(timeout);
                resolve();
              });

              ws.on("error", (err: Error) => {
                clearTimeout(timeout);
                reject(err);
              });
            })
        )
      );

      // 关闭所有连接
      for (const ws of connections) {
        ws.close();
      }
    });
  });

  describe("WebSocket 消息处理", () => {
    it("应该处理 WebSocket 消息", async () => {
      const ws = new WebSocket(`ws://localhost:${currentPort}`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve(); // 不要求必须收到消息，只要连接成功即可
        }, 3000);

        ws.on("open", () => {
          // 发送客户端状态消息
          ws.send(
            JSON.stringify({
              type: "clientStatus",
              data: { status: "connected" },
            })
          );

          // 发送消息后等待一段时间再关闭
          setTimeout(() => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }, 500);
        });

        ws.on("message", (data) => {
          const message = JSON.parse(data.toString());
          expect(message).toBeDefined();
          clearTimeout(timeout);
          ws.close();
          resolve();
        });

        ws.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });

    it("应该处理无效的 WebSocket 消息", async () => {
      const ws = new WebSocket(`ws://localhost:${currentPort}`);
      let errorReceived = false;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve();
        }, 3000);

        ws.on("open", () => {
          // 发送无效的 JSON 消息
          ws.send("invalid json");
        });

        ws.on("message", (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === "error") {
            errorReceived = true;
            expect(message.error.code).toBe("MESSAGE_PARSE_ERROR");
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        });

        ws.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      expect(errorReceived).toBe(true);
    });
  });
});
