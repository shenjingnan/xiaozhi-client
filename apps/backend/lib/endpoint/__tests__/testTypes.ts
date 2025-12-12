/**
 * 测试专用类型定义
 * 用于提供类型安全的测试辅助函数和接口
 */

import type { MCPMessage } from "@root/types/mcp.js";
import { vi } from "vitest";
import type { Data } from "ws";
import type WebSocket from "ws";
import type { EndpointConnection } from "../connection.js";

// 从 connection.ts 导入必要的类型
// 注意：这些接口在 connection.ts 中是私有的，我们在这里重新定义用于测试
interface IMCPServiceManager {
  /**
   * 获取所有可用的工具列表
   * @returns 工具定义数组
   */
  getAllTools(): Array<{
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties?: Record<string, unknown>;
    };
    serviceName?: string;
    originalName?: string;
  }>;
  /**
   * 调用指定的工具
   * @param toolName 工具名称
   * @param arguments_ 工具参数
   * @returns 工具执行结果
   */
  callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<{
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
  /**
   * 以下属性为测试兼容性而添加，用于模拟实际的 MCPServiceManager 类型结构。
   * 请保持与实际 MCPServiceManager 类型同步。
   * @see ../connection.ts 中的 MCPServiceManager 类型定义
   */
  /**
   * 服务集合，模拟 MCPServiceManager 的 services 属性
   */
  services?: Map<string, unknown>;
  /**
   * 配置集合，模拟 MCPServiceManager 的 configs 属性
   */
  configs?: Map<string, unknown>;
  /**
   * 工具集合，模拟 MCPServiceManager 的 tools 属性
   */
  tools?: Map<string, unknown>;
  /**
   * 自定义 MCP 处理器，模拟 MCPServiceManager 的 customMCPHandler 属性
   */
  customMCPHandler?: unknown;
  /**
   * 允许添加其他属性以匹配 MCPServiceManager 的实际结构
   */
  [key: string]: unknown;
}

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
}

/**
 * Mock ServiceManager 类型
 * 模拟 IMCPServiceManager 接口的测试实现
 */
export interface MockServiceManager {
  callTool: ReturnType<typeof vi.fn>;
  getAllTools: ReturnType<typeof vi.fn>;
  /**
   * 服务集合，模拟 MCPServiceManager 的 services 属性
   * 用于存储注册的服务实例
   */
  services?: Map<string, unknown>;
  /**
   * 配置集合，模拟 MCPServiceManager 的 configs 属性
   * 用于存储服务配置信息
   */
  configs?: Map<string, unknown>;
  /**
   * 工具集合，模拟 MCPServiceManager 的 tools 属性
   * 用于存储可用的工具定义
   */
  tools?: Map<string, unknown>;
  /**
   * 自定义 MCP 处理器，模拟 MCPServiceManager 的 customMCPHandler 属性
   * 用于处理自定义的 MCP 协议消息
   */
  customMCPHandler?: unknown;
  /**
   * 允许添加其他属性以匹配 MCPServiceManager 的实际结构
   * 这确保了 mock 可以完全模拟真实的 MCPServiceManager 接口
   */
  [key: string]: unknown;
}

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
 * EndpointConnection 内部状态访问接口
 * 用于测试时安全访问私有成员
 */
export interface EndpointConnectionInternals {
  ws: WebSocket | null;
  connectionStatus: boolean;
  serverInitialized: boolean;
  connectionState: ConnectionState;
  serviceManager: IMCPServiceManager | null;
  handleMessage: (message: MCPMessage) => void;
  endpointUrl: string;
  toolCallTimeout: number;
}

/**
 * 获取 EndpointConnection 的内部状态访问器
 * 提供类型安全的私有成员访问
 */
export function getEndpointConnectionInternals(
  server: EndpointConnection
): EndpointConnectionInternals {
  return server as unknown as EndpointConnectionInternals;
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
    callTool: vi.fn(),
    getAllTools: vi.fn().mockReturnValue([]),
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
