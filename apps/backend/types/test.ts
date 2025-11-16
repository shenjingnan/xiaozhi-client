/**
 * 测试相关的类型定义
 * 用于替换测试文件中的 any 类型，提升类型安全性
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Mock } from "vitest";
import type {
  AppConfig,
  ConnectionConfig,
  MCPServerConfig,
  ModelScopeConfig,
  WebUIConfig,
} from "../configManager";

/**
 * Node.js 服务器地址信息接口
 */
export interface ServerAddress {
  port: number;
  address: string;
  family: string;
}

/**
 * Mock ConfigManager 接口
 * 将所有方法转换为 vitest Mock 类型
 */
export interface MockConfigManager {
  configExists: Mock<() => boolean>;
  getConfig: Mock<() => Readonly<AppConfig>>;
  getMcpEndpoint: Mock<() => string>;
  getMcpServers: Mock<() => Readonly<Record<string, MCPServerConfig>>>;
  updateMcpEndpoint: Mock<(endpoint: string | string[]) => void>;
  updateMcpServer: Mock<
    (serverName: string, serverConfig: MCPServerConfig) => void
  >;
  removeMcpServer: Mock<(serverName: string) => void>;
  updateConnectionConfig: Mock<
    (connectionConfig: Partial<ConnectionConfig>) => void
  >;
  updateModelScopeConfig: Mock<
    (modelScopeConfig: Partial<ModelScopeConfig>) => void
  >;
  updateWebUIConfig: Mock<(webUIConfig: Partial<WebUIConfig>) => void>;
  getWebUIPort: Mock<() => number>;
  setToolEnabled: Mock<
    (serverName: string, toolName: string, enabled: boolean) => void
  >;
  removeServerToolsConfig: Mock<(serverName: string) => void>;
  cleanupInvalidServerToolsConfig: Mock<() => void>;
}

/**
 * MCP 消息接口
 */
export interface MCPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
}

/**
 * Mock WebSocket 接口
 */
export interface MockWebSocket {
  readyState: number;
  send: Mock<(data: string) => void>;
  on: Mock<(event: string, listener: (...args: unknown[]) => void) => void>;
  close: Mock<(code?: number, reason?: string) => void>;
  addEventListener: Mock<
    (event: string, listener: (...args: unknown[]) => void) => void
  >;
  removeEventListener: Mock<
    (event: string, listener: (...args: unknown[]) => void) => void
  >;
  removeAllListeners?: Mock<(event?: string) => void>;
}

/**
 * Mock ServiceManager 接口
 */
export interface MockServiceManager {
  callTool: Mock<(toolName: string, args?: unknown) => Promise<unknown>>;
  getAllTools: Mock<
    () => Array<{
      name: string;
      description: string;
      inputSchema?: unknown;
    }>
  >;
}

/**
 * 测试专用的 ProxyMCPServer 接口
 * 包含需要测试的私有成员
 */
export interface TestableProxyMCPServer {
  ws: WebSocket | MockWebSocket | null;
  connectionStatus: boolean;
  tools: Map<string, Tool>;
  serviceManager: MockServiceManager | unknown;
  syncToolsFromServiceManager(): Promise<void> | void;
  handleServerRequest(request: MCPMessage): Promise<void> | void;
  handleToolCall(request: MCPMessage): Promise<void>;
  handleToolCallError(
    error: Error | null,
    toolName: string,
    id: number | string
  ): void;
}
