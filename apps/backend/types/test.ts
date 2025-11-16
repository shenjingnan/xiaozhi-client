/**
 * 测试相关的类型定义
 * 用于替换测试文件中的 any 类型，提升类型安全性
 */

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
  updateMcpServer: Mock<(serverName: string, serverConfig: MCPServerConfig) => void>;
  removeMcpServer: Mock<(serverName: string) => void>;
  updateConnectionConfig: Mock<(connectionConfig: Partial<ConnectionConfig>) => void>;
  updateModelScopeConfig: Mock<(modelScopeConfig: Partial<ModelScopeConfig>) => void>;
  updateWebUIConfig: Mock<(webUIConfig: Partial<WebUIConfig>) => void>;
  getWebUIPort: Mock<() => number>;
  setToolEnabled: Mock<(serverName: string, toolName: string, enabled: boolean) => void>;
  removeServerToolsConfig: Mock<(serverName: string) => void>;
  cleanupInvalidServerToolsConfig: Mock<() => void>;
}
