/**
 * 配置接口定义
 */

import type {
  AppConfig,
  ConnectionConfig,
  MCPServerConfig,
} from "@xiaozhi-client/shared-types";

/**
 * 依赖注入容器接口
 */
export interface IDIContainer {
  /** 注册服务 */
  register<T>(key: string, factory: () => T): void;
  /** 获取服务实例 */
  get<T>(key: string): T;
  /** 检查服务是否已注册 */
  has(key: string): boolean;
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * CLI 命令所需的 ConfigManager 接口
 * 定义 CLI 配置管理命令处理器所需的最小方法集
 */
export interface CLIConfigManager {
  /** 检查配置文件是否存在 */
  configExists(): boolean;
  /** 初始化配置文件 */
  initConfig(format: "json" | "json5" | "jsonc"): void;
  /** 获取配置对象 */
  getConfig(): Readonly<AppConfig>;
  /** 获取 MCP 端点列表 */
  getMcpEndpoints(): string[];
  /** 获取心跳检测间隔（毫秒） */
  getHeartbeatInterval(): number;
  /** 获取心跳超时时间（毫秒） */
  getHeartbeatTimeout(): number;
  /** 获取重连间隔（毫秒） */
  getReconnectInterval(): number;
  /** 获取连接配置 */
  getConnectionConfig(): Required<ConnectionConfig>;
  /** 更新 MCP 端点 */
  updateMcpEndpoint(endpoint: string | string[]): void;
  /** 更新心跳检测间隔（毫秒） */
  updateHeartbeatInterval(interval: number): void;
  /** 更新心跳超时时间（毫秒） */
  updateHeartbeatTimeout(timeout: number): void;
  /** 更新重连间隔（毫秒） */
  updateReconnectInterval(interval: number): void;
}

/**
 * CLI 命令中使用的 MCP 服务器配置类型
 * 用于处理配置显示时的类型安全
 */
export type CLIMCPServerConfig = MCPServerConfig;
