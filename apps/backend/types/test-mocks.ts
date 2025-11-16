/**
 * 测试通用 mock 类型定义
 * 用于替换测试文件中的 any 类型
 */

import type { vi } from "vitest";

/**
 * Mock Logger 类型
 */
export interface MockLogger {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  success?: ReturnType<typeof vi.fn>;
  withTag?: ReturnType<typeof vi.fn>;
}

/**
 * Mock EventBus 类型
 */
export interface MockEventBus {
  onEvent: ReturnType<typeof vi.fn>;
  emitEvent: ReturnType<typeof vi.fn>;
  offEvent?: ReturnType<typeof vi.fn>;
  removeAllListeners?: ReturnType<typeof vi.fn>;
}

/**
 * Mock ConfigManager 类型
 */
export interface MockConfigManager {
  getConfig: ReturnType<typeof vi.fn>;
  updateConfig: ReturnType<typeof vi.fn>;
  validateConfig: ReturnType<typeof vi.fn>;
  watchConfig?: ReturnType<typeof vi.fn>;
}

/**
 * Mock WebSocket 类型
 */
export interface MockWebSocket {
  on: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  CONNECTING?: number;
  OPEN?: number;
  CLOSING?: number;
  CLOSED?: number;
}

/**
 * Mock MCP Service 类型
 */
export interface MockMCPService {
  name: string;
  isInitialized: boolean;
  isConnected: boolean;
  getTools: () => unknown[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  initialize: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  destroy: () => Promise<void>;
}

/**
 * 通用 Mock 对象类型
 */
export type MockObject = Record<string, unknown>;

/**
 * 工具调用参数类型
 */
export type ToolCallArgs = Record<string, unknown>;

/**
 * 事件数据类型
 */
export type EventData = Record<string, unknown>;
