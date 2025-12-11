/**
 * 测试专用类型定义
 * 用于提供类型安全的测试辅助函数和接口
 */

import type { MCPMessage } from "@root/types/mcp.js";
import { vi } from "vitest";
import type { Data } from "ws";
import type WebSocket from "ws";
import type { ProxyMCPServer } from "../connection.js";

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
}

/**
 * Mock ServiceManager 类型
 * 在测试中，我们只需要模拟 routeMessage 方法
 */
export type MockServiceManager = {
  routeMessage: ReturnType<typeof vi.fn>;
};

/**
 * Mock WebSocket 类型
 * 基于 createMockWebSocket 函数返回值定义
 */
export interface MockWebSocket {
  readyState: number; // WebSocket.OPEN
  send: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  trigger: (event: string, ...args: unknown[]) => void;
  getListeners: () => Record<string, ((...args: unknown[]) => void)[]>;
}

/**
 * ProxyMCPServer 内部状态访问接口
 * 用于测试时安全访问私有成员
 */
export interface ProxyServerInternals {
  ws: WebSocket | null;
  connectionStatus: boolean;
  connectionState: ConnectionState;
  serviceManager: MockServiceManager | null;
  handleMessage: (message: MCPMessage) => Promise<void>;
  endpointUrl: string;
}

/**
 * 获取 ProxyMCPServer 的内部状态访问器
 * 提供类型安全的私有成员访问
 */
export function getProxyServerInternals(
  server: ProxyMCPServer
): ProxyServerInternals {
  return server as unknown as ProxyServerInternals;
}

/**
 * WebSocket 消息处理函数类型
 */
export type WebSocketMessageHandler = (data: Data) => void;

/**
 * 工具调用测试参数类型
 */
export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * 测试用的 JSON-RPC 消息类型
 */
export interface TestJSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * 测试用的 JSON-RPC 响应类型
 */
export interface TestJSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * 工具列表项类型（从 connection.ts 中的定义复制）
 */
export interface ToolListItem {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
  };
  serviceName?: string;
  originalName?: string;
}

/**
 * 创建 Mock ServiceManager 的辅助函数
 */
export function createMockServiceManager(): MockServiceManager {
  return {
    routeMessage: vi.fn(),
  };
}

/**
 * 类型守卫：检查是否为有效的 WebSocket Data
 */
export function isValidWebSocketData(data: unknown): data is Data {
  return typeof data === "string" || Buffer.isBuffer(data);
}

/**
 * 安全解析 WebSocket 数据为 JSON
 */
export function parseWebSocketData(data: Data): unknown {
  let dataString: string;

  if (Buffer.isBuffer(data)) {
    dataString = data.toString("utf8");
  } else if (typeof data === "string") {
    dataString = data;
  } else if (ArrayBuffer.isView(data)) {
    dataString = Buffer.from(
      data.buffer,
      data.byteOffset,
      data.byteLength
    ).toString("utf8");
  } else if (data instanceof ArrayBuffer) {
    dataString = Buffer.from(data).toString("utf8");
  } else {
    dataString = String(data);
  }

  return JSON.parse(dataString);
}
