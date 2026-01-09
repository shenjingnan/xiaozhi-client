import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as commentJson from "comment-json";
import dayjs from "dayjs";
import { createJson5Writer, parseJson5 } from "./json5-adapter.js";
import { ConfigResolver } from "./resolver.js";

// 在 ESM 中，需要从 import.meta.url 获取当前文件目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// 默认连接配置
const DEFAULT_CONNECTION_CONFIG: Required<ConnectionConfig> = {
  heartbeatInterval: 30000, // 30秒心跳间隔
  heartbeatTimeout: 10000, // 10秒心跳超时
  reconnectInterval: 5000, // 5秒重连间隔
};

// 配置文件接口定义
// 本地 MCP 服务配置
export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// SSE MCP 服务配置
export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

// Streamable HTTP MCP 服务配置
export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，因为默认就是 streamable-http
  url: string;
  headers?: Record<string, string>;
}

// 统一的 MCP 服务配置
export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | StreamableHTTPMCPServerConfig;

export interface MCPToolConfig {
  description?: string;
  enable: boolean;
  usageCount?: number; // 工具使用次数
  lastUsedTime?: string; // 最后使用时间（ISO 8601 格式）
}

export interface MCPServerToolsConfig {
  tools: Record<string, MCPToolConfig>;
}

export interface ConnectionConfig {
  heartbeatInterval?: number; // 心跳检测间隔（毫秒），默认30000
  heartbeatTimeout?: number; // 心跳超时时间（毫秒），默认10000
  reconnectInterval?: number; // 重连间隔（毫秒），默认5000
}

export interface ModelScopeConfig {
  apiKey?: string; // ModelScope API 密钥
}

export interface WebUIConfig {
  port?: number; // Web UI 端口号，默认 9999
  autoRestart?: boolean; // 是否在配置更新后自动重启服务，默认 true
}

// 工具调用日志配置接口
export interface ToolCallLogConfig {
  maxRecords?: number; // 最大记录条数，默认 100
  logFilePath?: string; // 自定义日志文件路径（可选）
}

// CustomMCP 相关接口定义

// 代理处理器配置
export interface ProxyHandlerConfig {
  type: "proxy";
  platform: "coze" | "openai" | "anthropic" | "custom";
  config: {
    // Coze 平台配置
    workflow_id?: string;
    bot_id?: string;
    api_key?: string;
    base_url?: string;
    // 通用配置
    timeout?: number;
    retry_count?: number;
    retry_delay?: number;
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
  };
}

// HTTP 处理器配置
export interface HttpHandlerConfig {
  type: "http";
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  timeout?: number;
  retry_count?: number;
  retry_delay?: number;
  auth?: {
    type: "bearer" | "basic" | "api_key";
    token?: string;
    username?: string;
    password?: string;
    api_key?: string;
    api_key_header?: string;
  };
  body_template?: string; // 支持模板变量替换
  response_mapping?: {
    success_path?: string; // JSONPath 表达式
    error_path?: string;
    data_path?: string;
  };
}

// 函数处理器配置
export interface FunctionHandlerConfig {
  type: "function";
  module: string; // 模块路径
  function: string; // 函数名
  timeout?: number;
  context?: Record<string, unknown>; // 函数执行上下文
}

// 脚本处理器配置
export interface ScriptHandlerConfig {
  type: "script";
  script: string; // 脚本内容或文件路径
  interpreter?: "node" | "python" | "bash";
  timeout?: number;
  env?: Record<string, string>; // 环境变量
}

// 链式处理器配置
export interface ChainHandlerConfig {
  type: "chain";
  tools: string[]; // 要链式调用的工具名称
  mode: "sequential" | "parallel"; // 执行模式
  error_handling: "stop" | "continue" | "retry"; // 错误处理策略
}

// MCP 处理器配置（用于同步的工具）
export interface MCPHandlerConfig {
  type: "mcp";
  config: {
    serviceName: string;
    toolName: string;
  };
}

export type HandlerConfig =
  | ProxyHandlerConfig
  | HttpHandlerConfig
  | FunctionHandlerConfig
  | ScriptHandlerConfig
  | ChainHandlerConfig
  | MCPHandlerConfig;

// CustomMCP 工具接口（与核心库兼容）
export interface CustomMCPTool {
  // 确保必填字段
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: HandlerConfig;

  // 使用统计信息（可选）
  stats?: {
    usageCount?: number; // 工具使用次数
    lastUsedTime?: string; // 最后使用时间（ISO 8601格式）
  };
}

export interface CustomMCPConfig {
  tools: CustomMCPTool[];
}

// Web 服务器实例接口（用于配置更新通知）
export interface WebServerInstance {
  broadcastConfigUpdate(config: AppConfig): void;
}

export interface PlatformsConfig {
  [platformName: string]: PlatformConfig;
}

export interface PlatformConfig {
  token?: string;
}

/**
 * 扣子平台配置接口
 */
export interface CozePlatformConfig extends PlatformConfig {
  /** 扣子 API Token */
  token: string;
}

export interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  customMCP?: CustomMCPConfig; // 新增 customMCP 配置支持
  connection?: ConnectionConfig; // 连接配置（可选，用于向后兼容）
  modelscope?: ModelScopeConfig; // ModelScope 配置（可选）
  webUI?: WebUIConfig; // Web UI 配置（可选）
  platforms?: PlatformsConfig; // 平台配置（可选）
  toolCallLog?: ToolCallLogConfig; // 工具调用日志配置（可选）
}

/**
 * 配置管理类
 * 负责管理应用配置，提供只读访问和安全的配置更新功能
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private defaultConfigPath: string;
  private config: AppConfig | null = null;
  private currentConfigPath: string | null = null; // 跟踪当前使用的配置文件路径
  private json5Writer: {
    write(data: unknown): void;
    toSource(): string;
  } | null = null; // json5-writer 实例，用于保留 JSON5 注释

  // 统计更新并发控制
  private statsUpdateLocks: Map<string, Promise<void>> = new Map();
  private statsUpdateLockTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly STATS_UPDATE_TIMEOUT = 5000; // 5秒超时

  // 事件回调（用于解耦 EventBus 依赖）
  private eventCallbacks: Map<string, Array<(data: unknown) => void>> = new Map();

  private constructor() {
    // 使用模板目录中的默认配置文件
    // 在不同环境中尝试不同的路径
    const possiblePaths = [
      // 构建后的环境：dist/configManager.js -> dist/templates/default/xiaozhi.config.json
      resolve(__dirname, "templates", "default", "xiaozhi.config.json"),
      // 开发环境：src/configManager.ts -> templates/default/xiaozhi.config.json
      resolve(__dirname, "..", "templates", "default", "xiaozhi.config.json"),
      // 测试环境或其他情况
      resolve(process.cwd(), "templates", "default", "xiaozhi.config.json"),
    ];

    // 找到第一个存在的路径
    this.defaultConfigPath =
      possiblePaths.find((path) => existsSync(path)) || possiblePaths[0];
  }

  /**
   * 注册事件监听器
   */
  public on(eventName: string, callback: (data: unknown) => void): void {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }
    this.eventCallbacks.get(eventName)?.push(callback);
  }

  /**
   * 发射事件
   */
  private emitEvent(eventName: string, data: unknown): void {
    const callbacks = this.eventCallbacks.get(eventName);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件回调执行失败 [${eventName}]:`, error);
        }
      }
    }
  }

  /**
   * 获取配置文件路径（动态计算）
   * 支持多种配置文件格式：json5 > jsonc > json
   *
   * 查找优先级：
   * 1. 环境变量 XIAOZHI_CONFIG_DIR 指定的目录
   * 2. 当前工作目录
   * 3. 用户家目录/.xiaozhi-client/
   */
  private getConfigFilePath(): string {
    // 优先使用 ConfigResolver 解析配置路径
    const resolvedPath = ConfigResolver.resolveConfigPath();

    if (resolvedPath) {
      return resolvedPath;
    }

    // 如果都找不到，返回用户家目录的默认路径
    const defaultDir = ConfigResolver.getDefaultConfigDir();
    if (defaultDir) {
      return resolve(defaultDir, "xiaozhi.config.json");
    }

    // 最后回退到当前目录
    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    return resolve(configDir, "xiaozhi.config.json");
  }

  /**
   * 获取配置文件格式
   */
  private getConfigFileFormat(filePath: string): "json5" | "jsonc" | "json" {
    if (filePath.endsWith(".json5")) {
      return "json5";
    }

    if (filePath.endsWith(".jsonc")) {
      return "jsonc";
    }

    return "json";
  }

  /**
   * 获取配置管理器单例实例
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 检查配置文件是否存在
   *
   * 按优先级检查配置文件是否存在：
   * 1. 环境变量 XIAOZHI_CONFIG_DIR 指定的目录
   * 2. 当前工作目录
   * 3. 用户家目录/.xiaozhi-client/
   */
  public configExists(): boolean {
    return ConfigResolver.resolveConfigPath() !== null;
  }

  /**
   * 初始化配置文件
   * 从 config.default.json 复制到 config.json
   * @param format 配置文件格式，默认为 json
   */
  public initConfig(format: "json" | "json5" | "jsonc" = "json"): void {
    if (!existsSync(this.defaultConfigPath)) {
      throw new Error(`默认配置模板文件不存在: ${this.defaultConfigPath}`);
    }

    // 检查是否已有任何格式的配置文件
    if (this.configExists()) {
      throw new Error("配置文件已存在，无需重复初始化");
    }

    // 确定目标配置文件路径
    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    const targetFileName = `xiaozhi.config.${format}`;
    const configPath = resolve(configDir, targetFileName);

    // 复制默认配置文件
    copyFileSync(this.defaultConfigPath, configPath);
    this.config = null; // 重置缓存
    this.json5Writer = null; // 重置 json5Writer 实例
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): AppConfig {
    if (!this.configExists()) {
      const error = new Error(
        "配置文件不存在，请先运行 xiaozhi init 初始化配置"
      );
      this.emitEvent("config:error", {
        error,
        operation: "loadConfig",
      });
      throw error;
    }

    try {
      const configPath = this.getConfigFilePath();
      this.currentConfigPath = configPath; // 记录当前使用的配置文件路径
      const configFileFormat = this.getConfigFileFormat(configPath);
      const rawConfigData = readFileSync(configPath, "utf8");

      // 移除可能存在的UTF-8 BOM字符（\uFEFF）
      // BOM字符在某些编辑器中不可见，但会导致JSON解析失败
      // 这个过滤确保即使文件包含BOM字符也能正常解析
      const configData = rawConfigData.replace(/^\uFEFF/, "");

      let config: AppConfig;

      // 根据文件格式使用相应的解析器
      switch (configFileFormat) {
        case "json5":
          // 使用 JSON5 解析配置对象，同时使用适配器保留注释信息
          config = parseJson5(configData) as AppConfig;
          // 创建适配器实例用于后续保存时保留注释
          this.json5Writer = createJson5Writer(configData);
          break;
        case "jsonc":
          // 使用 comment-json 解析 JSONC 格式，保留注释信息
          config = commentJson.parse(configData) as unknown as AppConfig;
          break;
        default:
          config = JSON.parse(configData) as AppConfig;
          break;
      }

      // 验证配置结构
      this.validateConfig(config);

      return config;
    } catch (error) {
      // 发射配置错误事件
      this.emitEvent("config:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "loadConfig",
      });
      if (error instanceof SyntaxError) {
        throw new Error(`配置文件格式错误: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 验证配置文件结构
   */
  public validateConfig(config: unknown): void {
    if (!config || typeof config !== "object") {
      throw new Error("配置文件格式错误：根对象无效");
    }

    const configObj = config as Record<string, unknown>;

    if (configObj.mcpEndpoint === undefined || configObj.mcpEndpoint === null) {
      throw new Error("配置文件格式错误：mcpEndpoint 字段无效");
    }

    // 验证 mcpEndpoint 类型（字符串或字符串数组）
    if (typeof configObj.mcpEndpoint === "string") {
      // 空字符串是允许的，getMcpEndpoints 会返回空数组
    } else if (Array.isArray(configObj.mcpEndpoint)) {
      for (const endpoint of configObj.mcpEndpoint) {
        if (typeof endpoint !== "string" || endpoint.trim() === "") {
          throw new Error(
            "配置文件格式错误：mcpEndpoint 数组中的每个元素必须是非空字符串"
          );
        }
      }
    } else {
      throw new Error("配置文件格式错误：mcpEndpoint 必须是字符串或字符串数组");
    }

    if (!configObj.mcpServers || typeof configObj.mcpServers !== "object") {
      throw new Error("配置文件格式错误：mcpServers 字段无效");
    }

    // 验证每个 MCP 服务配置
    for (const [serverName, serverConfig] of Object.entries(
      configObj.mcpServers as Record<string, unknown>
    )) {
      if (!serverConfig || typeof serverConfig !== "object") {
        throw new Error(`配置文件格式错误：mcpServers.${serverName} 无效`);
      }

      // 基本验证：确保配置有效
      // 更详细的验证应该由调用方完成
    }
  }

  /**
   * 获取配置（只读）
   */
  public getConfig(): Readonly<AppConfig> {
    this.config = this.loadConfig();

    // 返回深度只读副本
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 获取可修改的配置对象（内部使用，保留注释信息）
   */
  private getMutableConfig(): AppConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    const config = this.getConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return config.mcpEndpoint[0] || "";
    }
    return config.mcpEndpoint;
  }

  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(): string[] {
    const config = this.getConfig();
    if (Array.isArray(config.mcpEndpoint)) {
      return [...config.mcpEndpoint];
    }
    return config.mcpEndpoint ? [config.mcpEndpoint] : [];
  }

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    const config = this.getConfig();
    return config.mcpServers;
  }

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(): Readonly<Record<string, MCPServerToolsConfig>> {
    const config = this.getConfig();
    return config.mcpServerConfig || {};
  }

  /**
   * 获取指定服务的工具配置
   */
  public getServerToolsConfig(
    serverName: string
  ): Readonly<Record<string, MCPToolConfig>> {
    const serverConfig = this.getMcpServerConfig();
    return serverConfig[serverName]?.tools || {};
  }

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    const toolsConfig = this.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];
    return toolConfig?.enable !== false; // 默认启用
  }

  /**
   * 更新 MCP 端点（支持字符串或数组）
   */
  public updateMcpEndpoint(endpoint: string | string[]): void {
    if (Array.isArray(endpoint)) {
      for (const ep of endpoint) {
        if (!ep || typeof ep !== "string") {
          throw new Error("MCP 端点数组中的每个元素必须是非空字符串");
        }
      }
    }

    const config = this.getMutableConfig();
    config.mcpEndpoint = endpoint;
    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "endpoint",
      timestamp: new Date(),
    });
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    // 检查是否已存在
    if (currentEndpoints.includes(endpoint)) {
      throw new Error(`MCP 端点 ${endpoint} 已存在`);
    }

    const newEndpoints = [...currentEndpoints, endpoint];
    config.mcpEndpoint = newEndpoints;
    this.saveConfig(config);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getMutableConfig();
    const currentEndpoints = this.getMcpEndpoints();

    // 检查是否存在
    const index = currentEndpoints.indexOf(endpoint);
    if (index === -1) {
      throw new Error(`MCP 端点 ${endpoint} 不存在`);
    }

    const newEndpoints = currentEndpoints.filter((ep) => ep !== endpoint);
    config.mcpEndpoint = newEndpoints;
    this.saveConfig(config);
  }

  /**
   * 更新 MCP 服务配置
   */
  public updateMcpServer(
    serverName: string,
    serverConfig: MCPServerConfig
  ): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.getMutableConfig();
    // 直接修改配置对象以保留注释信息
    config.mcpServers[serverName] = serverConfig;
    this.saveConfig(config);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.getMutableConfig();

    // 检查服务是否存在
    if (!config.mcpServers[serverName]) {
      throw new Error(`服务 ${serverName} 不存在`);
    }

    // 1. 清理 mcpServers 字段（现有逻辑）
    delete config.mcpServers[serverName];

    // 2. 清理 mcpServerConfig 字段（复用现有方法）
    if (config.mcpServerConfig?.[serverName]) {
      delete config.mcpServerConfig[serverName];
    }

    // 3. 清理 customMCP 字段中相关的工具定义
    if (config.customMCP?.tools) {
      // 查找与该服务相关的 CustomMCP 工具
      const relatedTools = config.customMCP.tools.filter(
        (tool) =>
          tool.handler?.type === "mcp" &&
          tool.handler.config?.serviceName === serverName
      );

      // 移除相关工具
      for (const tool of relatedTools) {
        const toolIndex = config.customMCP.tools.findIndex(
          (t) => t.name === tool.name
        );
        if (toolIndex !== -1) {
          config.customMCP.tools.splice(toolIndex, 1);
        }
      }

      // 如果没有工具了，可以清理整个 customMCP 对象
      if (config.customMCP.tools.length === 0) {
        config.customMCP = undefined;
      }
    }

    // 4. 保存配置（单次原子性操作）
    this.saveConfig(config);

    // 5. 发射配置更新事件，通知 CustomMCPHandler 重新初始化
    this.emitEvent("config:updated", {
      type: "customMCP",
      timestamp: new Date(),
    });

    // 记录清理结果
    console.log("成功移除 MCP 服务", { serverName });
  }

  /**
   * 批量更新配置（由 Handler 调用）
   */
  public updateConfig(newConfig: Partial<AppConfig>): void {
    const config = this.getMutableConfig();

    // 更新 MCP 端点
    if (newConfig.mcpEndpoint !== undefined) {
      config.mcpEndpoint = newConfig.mcpEndpoint;
    }

    // 更新 MCP 服务
    if (newConfig.mcpServers) {
      const currentServers = { ...config.mcpServers };
      for (const [name, serverConfig] of Object.entries(newConfig.mcpServers)) {
        config.mcpServers[name] = serverConfig;
      }
      // 删除不存在的服务
      for (const name of Object.keys(currentServers)) {
        if (!(name in newConfig.mcpServers)) {
          delete config.mcpServers[name];
          // 同时清理工具配置
          if (config.mcpServerConfig?.[name]) {
            delete config.mcpServerConfig[name];
          }
        }
      }
    }

    // 更新连接配置
    if (newConfig.connection) {
      if (!config.connection) {
        config.connection = {};
      }
      Object.assign(config.connection, newConfig.connection);
    }

    // 更新 ModelScope 配置
    if (newConfig.modelscope) {
      if (!config.modelscope) {
        config.modelscope = {};
      }
      Object.assign(config.modelscope, newConfig.modelscope);
    }

    // 更新 Web UI 配置
    if (newConfig.webUI) {
      if (!config.webUI) {
        config.webUI = {};
      }
      Object.assign(config.webUI, newConfig.webUI);
    }

    // 更新服务工具配置
    if (newConfig.mcpServerConfig) {
      for (const [serverName, toolsConfig] of Object.entries(
        newConfig.mcpServerConfig
      )) {
        if (config.mcpServerConfig?.[serverName]) {
          config.mcpServerConfig[serverName] = toolsConfig;
        }
      }
    }

    // 更新平台配置
    if (newConfig.platforms) {
      for (const [platformName, platformConfig] of Object.entries(
        newConfig.platforms
      )) {
        if (!config.platforms) {
          config.platforms = {};
        }
        config.platforms[platformName] = platformConfig;
      }
    }

    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "config",
      timestamp: new Date(),
    });
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 如果 toolsConfig 为空对象，则删除该服务的配置
    if (Object.keys(toolsConfig).length === 0) {
      delete config.mcpServerConfig[serverName];
    } else {
      // 更新指定服务的工具配置
      config.mcpServerConfig[serverName] = {
        tools: toolsConfig,
      };
    }

    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "serverTools",
      serviceName: serverName,
      timestamp: new Date(),
    });
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(serverName: string): void {
    const config = this.getConfig();
    const newConfig = { ...config };

    // 确保 mcpServerConfig 存在
    if (newConfig.mcpServerConfig) {
      // 删除指定服务的工具配置
      delete newConfig.mcpServerConfig[serverName];
      this.saveConfig(newConfig);
    }
  }

  /**
   * 清理无效的服务器工具配置
   * 删除在 mcpServerConfig 中存在但在 mcpServers 中不存在的服务配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    const config = this.getMutableConfig();

    // 如果没有 mcpServerConfig，无需清理
    if (!config.mcpServerConfig) {
      return;
    }

    const validServerNames = Object.keys(config.mcpServers);
    const configuredServerNames = Object.keys(config.mcpServerConfig);

    // 找出需要清理的服务名称
    const invalidServerNames = configuredServerNames.filter(
      (serverName) => !validServerNames.includes(serverName)
    );

    if (invalidServerNames.length > 0) {
      // 删除无效的服务配置
      for (const serverName of invalidServerNames) {
        delete config.mcpServerConfig[serverName];
      }

      this.saveConfig(config);

      console.log("已清理无效的服务工具配置", {
        count: invalidServerNames.length,
        serverNames: invalidServerNames,
      });
    }
  }

  /**
   * 设置工具启用状态
   */
  public setToolEnabled(
    serverName: string,
    toolName: string,
    enabled: boolean,
    description?: string
  ): void {
    const config = this.getMutableConfig();

    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 确保服务配置存在
    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    // 更新工具配置
    config.mcpServerConfig[serverName].tools[toolName] = {
      ...config.mcpServerConfig[serverName].tools[toolName],
      enable: enabled,
      ...(description && { description }),
    };

    this.saveConfig(config);
  }

  /**
   * 保存配置到文件
   * 保存到原始配置文件路径，保持文件格式一致性
   */
  private saveConfig(config: AppConfig): void {
    try {
      // 验证配置
      this.validateConfig(config);

      // 确定保存路径 - 优先使用当前配置文件路径，否则使用默认路径
      let configPath: string;
      if (this.currentConfigPath) {
        configPath = this.currentConfigPath;
      } else {
        // 如果没有当前路径，使用 getConfigFilePath 获取
        configPath = this.getConfigFilePath();
        this.currentConfigPath = configPath;
      }

      // 根据文件格式选择序列化方法
      const configFileFormat = this.getConfigFileFormat(configPath);
      let configContent: string;

      switch (configFileFormat) {
        case "json5":
          // 对于 JSON5 格式，使用适配器保留注释
          try {
            if (this.json5Writer) {
              // 使用适配器更新配置并保留注释
              this.json5Writer.write(config);
              configContent = this.json5Writer.toSource();
            } else {
              // 如果没有适配器实例，回退到 comment-json 序列化
              console.warn("没有 JSON5 适配器实例，使用 comment-json 序列化");
              configContent = commentJson.stringify(config, null, 2);
            }
          } catch (json5Error) {
            // 如果适配器序列化失败，回退到 comment-json 序列化
            console.warn(
              "使用 JSON5 适配器保存失败，回退到 comment-json 序列化:",
              json5Error
            );
            configContent = commentJson.stringify(config, null, 2);
          }
          break;
        case "jsonc":
          // 对于 JSONC 格式，使用 comment-json 库保留注释
          try {
            // 直接使用 comment-json 的 stringify 方法
            // 如果 config 是通过 comment-json.parse 解析的，注释信息会被保留
            configContent = commentJson.stringify(config, null, 2);
          } catch (commentJsonError) {
            // 如果 comment-json 序列化失败，回退到标准 JSON
            console.warn(
              "使用 comment-json 保存失败，回退到标准 JSON 格式:",
              commentJsonError
            );
            configContent = JSON.stringify(config, null, 2);
          }
          break;
        default:
          configContent = JSON.stringify(config, null, 2);
          break;
      }

      // 保存到文件
      writeFileSync(configPath, configContent, "utf8");

      // 更新缓存
      this.config = config;

      console.log("配置保存成功");

      // 通知 Web 界面配置已更新（如果 Web 服务器正在运行）
      this.notifyConfigUpdate(config);
    } catch (error) {
      // 发射配置错误事件
      this.emitEvent("config:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "saveConfig",
      });
      throw new Error(
        `保存配置失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 重新加载配置（清除缓存）
   */
  public reloadConfig(): void {
    this.config = null;
    this.currentConfigPath = null; // 清除配置文件路径缓存
    this.json5Writer = null; // 清除 json5Writer 实例
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.getConfigFilePath();
  }

  /**
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return this.defaultConfigPath;
  }

  /**
   * 获取连接配置（包含默认值）
   */
  public getConnectionConfig(): Required<ConnectionConfig> {
    const config = this.getConfig();
    const connectionConfig = config.connection || {};

    return {
      heartbeatInterval:
        connectionConfig.heartbeatInterval ??
        DEFAULT_CONNECTION_CONFIG.heartbeatInterval,
      heartbeatTimeout:
        connectionConfig.heartbeatTimeout ??
        DEFAULT_CONNECTION_CONFIG.heartbeatTimeout,
      reconnectInterval:
        connectionConfig.reconnectInterval ??
        DEFAULT_CONNECTION_CONFIG.reconnectInterval,
    };
  }

  /**
   * 获取心跳检测间隔（毫秒）
   */
  public getHeartbeatInterval(): number {
    return this.getConnectionConfig().heartbeatInterval;
  }

  /**
   * 获取心跳超时时间（毫秒）
   */
  public getHeartbeatTimeout(): number {
    return this.getConnectionConfig().heartbeatTimeout;
  }

  /**
   * 获取重连间隔（毫秒）
   */
  public getReconnectInterval(): number {
    return this.getConnectionConfig().reconnectInterval;
  }

  /**
   * 更新连接配置
   */
  public updateConnectionConfig(
    connectionConfig: Partial<ConnectionConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 connection 对象存在
    if (!config.connection) {
      config.connection = {};
    }

    // 直接修改现有的 connection 对象以保留注释
    Object.assign(config.connection, connectionConfig);
    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "connection",
      timestamp: new Date(),
    });
  }

  /**
   * 更新工具使用统计信息（MCP 服务工具）
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   */
  public async updateToolUsageStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新工具使用统计信息（CustomMCP 工具）
   * @param toolName 工具名称（customMCP 工具名称）
   * @param incrementUsageCount 是否增加使用计数，默认为 true
   */
  public async updateToolUsageStats(
    toolName: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  /**
   * 更新工具使用统计信息的实现
   */
  public async updateToolUsageStats(
    arg1: string,
    arg2: string | boolean | undefined,
    arg3?: string
  ): Promise<void> {
    try {
      // 判断参数类型来区分不同的重载
      if (typeof arg2 === "string" && arg3) {
        // 三个参数的情况：updateToolUsageStats(serverName, toolName, callTime)
        const serverName = arg1;
        const toolName = arg2;
        const callTime = arg3;

        // 双写机制：同时更新 mcpServerConfig 和 customMCP 中的统计信息
        await Promise.all([
          this._updateMCPServerToolStats(serverName, toolName, callTime),
          this.updateCustomMCPToolStats(serverName, toolName, callTime),
        ]);

        console.log("工具使用统计已更新", { serverName, toolName });
      } else {
        // 两个参数的情况：updateToolUsageStats(toolName, incrementUsageCount)
        const toolName = arg1;
        const incrementUsageCount = arg2 as boolean;
        const callTime = new Date().toISOString();

        // 只更新 customMCP 中的统计信息
        await this.updateCustomMCPToolStats(
          toolName,
          callTime,
          incrementUsageCount
        );

        console.log("CustomMCP 工具使用统计已更新", { toolName });
      }
    } catch (error) {
      // 错误不应该影响主要的工具调用流程
      if (typeof arg2 === "string" && arg3) {
        const serverName = arg1;
        const toolName = arg2;
        console.error("更新工具使用统计失败", { serverName, toolName, error });
      } else {
        const toolName = arg1;
        console.error("更新 CustomMCP 工具使用统计失败", { toolName, error });
      }
    }
  }

  /**
   * 更新 MCP 服务工具统计信息（重载方法）
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数，默认为 true
   */
  public async updateMCPServerToolStats(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    await this._updateMCPServerToolStats(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 设置心跳检测间隔
   */
  public setHeartbeatInterval(interval: number): void {
    if (interval <= 0) {
      throw new Error("心跳检测间隔必须大于0");
    }
    this.updateConnectionConfig({ heartbeatInterval: interval });
  }

  /**
   * 设置心跳超时时间
   */
  public setHeartbeatTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw new Error("心跳超时时间必须大于0");
    }
    this.updateConnectionConfig({ heartbeatTimeout: timeout });
  }

  /**
   * 设置重连间隔
   */
  public setReconnectInterval(interval: number): void {
    if (interval <= 0) {
      throw new Error("重连间隔必须大于0");
    }
    this.updateConnectionConfig({ reconnectInterval: interval });
  }

  /**
   * 获取 ModelScope 配置
   */
  public getModelScopeConfig(): Readonly<ModelScopeConfig> {
    const config = this.getConfig();
    return config.modelscope || {};
  }

  /**
   * 获取 ModelScope API Key
   * 优先从配置文件读取，其次从环境变量读取
   */
  public getModelScopeApiKey(): string | undefined {
    const modelScopeConfig = this.getModelScopeConfig();
    return modelScopeConfig.apiKey || process.env.MODELSCOPE_API_TOKEN;
  }

  /**
   * 更新 ModelScope 配置
   */
  public updateModelScopeConfig(
    modelScopeConfig: Partial<ModelScopeConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 modelscope 对象存在
    if (!config.modelscope) {
      config.modelscope = {};
    }

    // 直接修改现有的 modelscope 对象以保留注释
    Object.assign(config.modelscope, modelScopeConfig);
    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "modelscope",
      timestamp: new Date(),
    });
  }

  /**
   * 设置 ModelScope API Key
   */
  public setModelScopeApiKey(apiKey: string): void {
    if (!apiKey || typeof apiKey !== "string") {
      throw new Error("API Key 必须是非空字符串");
    }
    this.updateModelScopeConfig({ apiKey });
  }

  /**
   * 获取 customMCP 配置
   */
  public getCustomMCPConfig(): CustomMCPConfig | null {
    const config = this.getConfig();
    return config.customMCP || null;
  }

  /**
   * 获取 customMCP 工具列表
   */
  public getCustomMCPTools(): CustomMCPTool[] {
    const customMCPConfig = this.getCustomMCPConfig();
    if (!customMCPConfig || !customMCPConfig.tools) {
      return [];
    }

    return customMCPConfig.tools;
  }

  /**
   * 验证 customMCP 工具配置
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    if (!Array.isArray(tools)) {
      return false;
    }

    for (const tool of tools) {
      // 检查必需字段
      if (!tool.name || typeof tool.name !== "string") {
        console.warn("CustomMCP 工具缺少有效的 name 字段", { tool });
        return false;
      }

      if (!tool.description || typeof tool.description !== "string") {
        console.warn("CustomMCP 工具缺少有效的 description 字段", {
          toolName: tool.name,
        });
        return false;
      }

      if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
        console.warn("CustomMCP 工具缺少有效的 inputSchema 字段", {
          toolName: tool.name,
        });
        return false;
      }

      if (!tool.handler || typeof tool.handler !== "object") {
        console.warn("CustomMCP 工具缺少有效的 handler 字段", {
          toolName: tool.name,
        });
        return false;
      }

      // 检查 handler 类型
      if (
        !["proxy", "function", "http", "script", "chain", "mcp"].includes(
          tool.handler.type
        )
      ) {
        console.warn("CustomMCP 工具的 handler.type 类型无效", {
          toolName: tool.name,
          type: tool.handler.type,
        });
        return false;
      }

      // 根据处理器类型进行特定验证
      if (!this.validateHandlerConfig(tool.name, tool.handler)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证处理器配置
   */
  private validateHandlerConfig(
    toolName: string,
    handler: HandlerConfig
  ): boolean {
    switch (handler.type) {
      case "proxy":
        return this.validateProxyHandler(toolName, handler);
      case "http":
        return this.validateHttpHandler(toolName, handler);
      case "function":
        return this.validateFunctionHandler(toolName, handler);
      case "script":
        return this.validateScriptHandler(toolName, handler);
      case "chain":
        return this.validateChainHandler(toolName, handler);
      case "mcp":
        return this.validateMCPHandler(toolName, handler);
      default:
        console.warn("CustomMCP 工具使用了未知的处理器类型", {
          toolName,
          handlerType: (handler as HandlerConfig).type,
        });
        return false;
    }
  }

  /**
   * 验证代理处理器配置
   */
  private validateProxyHandler(
    toolName: string,
    handler: ProxyHandlerConfig
  ): boolean {
    if (!handler.platform) {
      console.warn("CustomMCP 工具的 proxy 处理器缺少 platform 字段", {
        toolName,
      });
      return false;
    }

    if (!["coze", "openai", "anthropic", "custom"].includes(handler.platform)) {
      console.warn("CustomMCP 工具的 proxy 处理器使用了不支持的平台", {
        toolName,
        platform: handler.platform,
      });
      return false;
    }

    if (!handler.config || typeof handler.config !== "object") {
      console.warn("CustomMCP 工具的 proxy 处理器缺少 config 字段", {
        toolName,
      });
      return false;
    }

    // Coze 平台特定验证
    if (handler.platform === "coze") {
      if (!handler.config.workflow_id && !handler.config.bot_id) {
        console.warn(
          "CustomMCP 工具的 Coze 处理器必须提供 workflow_id 或 bot_id",
          { toolName }
        );
        return false;
      }
    }

    return true;
  }

  /**
   * 验证 HTTP 处理器配置
   */
  private validateHttpHandler(
    toolName: string,
    handler: HttpHandlerConfig
  ): boolean {
    if (!handler.url || typeof handler.url !== "string") {
      console.warn("CustomMCP 工具的 http 处理器缺少有效的 url 字段", {
        toolName,
      });
      return false;
    }

    try {
      new URL(handler.url);
    } catch {
      console.warn("CustomMCP 工具的 http 处理器 url 格式无效", {
        toolName,
        url: handler.url,
      });
      return false;
    }

    if (
      handler.method &&
      !["GET", "POST", "PUT", "DELETE", "PATCH"].includes(handler.method)
    ) {
      console.warn("CustomMCP 工具的 http 处理器使用了不支持的 HTTP 方法", {
        toolName,
        method: handler.method,
      });
      return false;
    }

    return true;
  }

  /**
   * 验证函数处理器配置
   */
  private validateFunctionHandler(
    toolName: string,
    handler: FunctionHandlerConfig
  ): boolean {
    if (!handler.module || typeof handler.module !== "string") {
      console.warn("CustomMCP 工具的 function 处理器缺少有效的 module 字段", {
        toolName,
      });
      return false;
    }

    if (!handler.function || typeof handler.function !== "string") {
      console.warn("CustomMCP 工具的 function 处理器缺少有效的 function 字段", {
        toolName,
      });
      return false;
    }

    return true;
  }

  /**
   * 验证脚本处理器配置
   */
  private validateScriptHandler(
    toolName: string,
    handler: ScriptHandlerConfig
  ): boolean {
    if (!handler.script || typeof handler.script !== "string") {
      console.warn("CustomMCP 工具的 script 处理器缺少有效的 script 字段", {
        toolName,
      });
      return false;
    }

    if (
      handler.interpreter &&
      !["node", "python", "bash"].includes(handler.interpreter)
    ) {
      console.warn("CustomMCP 工具的 script 处理器使用了不支持的解释器", {
        toolName,
        interpreter: handler.interpreter,
      });
      return false;
    }

    return true;
  }

  /**
   * 验证链式处理器配置
   */
  private validateChainHandler(
    toolName: string,
    handler: ChainHandlerConfig
  ): boolean {
    if (
      !handler.tools ||
      !Array.isArray(handler.tools) ||
      handler.tools.length === 0
    ) {
      console.warn("CustomMCP 工具的 chain 处理器缺少有效的 tools 数组", {
        toolName,
      });
      return false;
    }

    if (!["sequential", "parallel"].includes(handler.mode)) {
      console.warn("CustomMCP 工具的 chain 处理器使用了不支持的执行模式", {
        toolName,
        mode: handler.mode,
      });
      return false;
    }

    if (!["stop", "continue", "retry"].includes(handler.error_handling)) {
      console.warn("CustomMCP 工具的 chain 处理器使用了不支持的错误处理策略", {
        toolName,
        errorHandling: handler.error_handling,
      });
      return false;
    }

    return true;
  }

  /**
   * 验证 MCP 处理器配置
   */
  private validateMCPHandler(
    toolName: string,
    handler: MCPHandlerConfig
  ): boolean {
    if (!handler.config || typeof handler.config !== "object") {
      console.warn("CustomMCP 工具的 mcp 处理器缺少 config 字段", { toolName });
      return false;
    }

    if (
      !handler.config.serviceName ||
      typeof handler.config.serviceName !== "string"
    ) {
      console.warn("CustomMCP 工具的 mcp 处理器缺少有效的 serviceName", {
        toolName,
      });
      return false;
    }

    if (
      !handler.config.toolName ||
      typeof handler.config.toolName !== "string"
    ) {
      console.warn("CustomMCP 工具的 mcp 处理器缺少有效的 toolName", {
        toolName,
      });
      return false;
    }

    return true;
  }

  /**
   * 检查是否配置了有效的 customMCP 工具
   */
  public hasValidCustomMCPTools(): boolean {
    try {
      const tools = this.getCustomMCPTools();
      if (tools.length === 0) {
        return false;
      }

      return this.validateCustomMCPTools(tools);
    } catch (error) {
      console.error("检查 customMCP 工具配置时出错", { error });
      return false;
    }
  }

  /**
   * 添加自定义 MCP 工具
   */
  public addCustomMCPTool(tool: CustomMCPTool): void {
    if (!tool || typeof tool !== "object") {
      throw new Error("工具配置不能为空");
    }

    const config = this.getMutableConfig();

    // 确保 customMCP 配置存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    // 检查工具名称是否已存在
    const existingTool = config.customMCP.tools.find(
      (t) => t.name === tool.name
    );
    if (existingTool) {
      throw new Error(`工具 "${tool.name}" 已存在`);
    }

    // 验证工具配置
    if (!this.validateCustomMCPTools([tool])) {
      throw new Error("工具配置验证失败");
    }

    // 添加工具
    config.customMCP.tools.unshift(tool);
    this.saveConfig(config);

    console.log("成功添加自定义 MCP 工具", { toolName: tool.name });
  }

  /**
   * 批量添加自定义 MCP 工具
   * @param tools 要添加的工具数组
   */
  public async addCustomMCPTools(tools: CustomMCPTool[]): Promise<void> {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    if (tools.length === 0) {
      return; // 空数组，无需处理
    }

    const config = this.getMutableConfig();

    // 确保 customMCP 配置存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    // 添加新工具，避免重复
    const existingNames = new Set(
      config.customMCP.tools.map((tool) => tool.name)
    );
    const newTools = tools.filter((tool) => !existingNames.has(tool.name));

    if (newTools.length > 0) {
      // 验证新工具配置
      if (!this.validateCustomMCPTools(newTools)) {
        throw new Error("工具配置验证失败");
      }

      // 添加工具
      config.customMCP.tools.push(...newTools);
      this.saveConfig(config);

      // 发射配置更新事件
      this.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      console.log("成功批量添加自定义 MCP 工具", {
        count: newTools.length,
        toolNames: newTools.map((t) => t.name),
      });
    }
  }

  /**
   * 删除自定义 MCP 工具
   */
  public removeCustomMCPTool(toolName: string): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称不能为空");
    }

    const config = this.getMutableConfig();

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("未配置自定义 MCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (t) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    // 删除工具
    config.customMCP.tools.splice(toolIndex, 1);
    this.saveConfig(config);

    console.log("成功删除自定义 MCP 工具", { toolName });
  }

  /**
   * 更新单个自定义 MCP 工具配置
   * @param toolName 工具名称
   * @param updatedTool 更新后的工具配置
   */
  public updateCustomMCPTool(
    toolName: string,
    updatedTool: CustomMCPTool
  ): void {
    if (!toolName || typeof toolName !== "string") {
      throw new Error("工具名称不能为空");
    }
    if (!updatedTool || typeof updatedTool !== "object") {
      throw new Error("更新后的工具配置不能为空");
    }

    const config = this.getMutableConfig();

    if (!config.customMCP || !config.customMCP.tools) {
      throw new Error("未配置自定义 MCP 工具");
    }

    const toolIndex = config.customMCP.tools.findIndex(
      (t) => t.name === toolName
    );
    if (toolIndex === -1) {
      throw new Error(`工具 "${toolName}" 不存在`);
    }

    // 验证更新后的工具配置
    if (!this.validateCustomMCPTools([updatedTool])) {
      throw new Error("更新后的工具配置验证失败");
    }

    // 更新工具配置
    config.customMCP.tools[toolIndex] = updatedTool;
    this.saveConfig(config);

    console.log("成功更新自定义 MCP 工具", { toolName });
  }

  /**
   * 更新自定义 MCP 工具配置
   */
  public updateCustomMCPTools(tools: CustomMCPTool[]): void {
    if (!Array.isArray(tools)) {
      throw new Error("工具配置必须是数组");
    }

    // 验证工具配置
    if (!this.validateCustomMCPTools(tools)) {
      throw new Error("工具配置验证失败");
    }

    const config = this.getMutableConfig();

    // 确保 customMCP 配置存在
    if (!config.customMCP) {
      config.customMCP = { tools: [] };
    }

    config.customMCP.tools = tools;
    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "customMCP",
      timestamp: new Date(),
    });

    console.log("成功更新自定义 MCP 工具配置", { count: tools.length });
  }

  /**
   * 获取 Web UI 配置
   */
  public getWebUIConfig(): Readonly<WebUIConfig> {
    const config = this.getConfig();
    return config.webUI || {};
  }

  /**
   * 获取 Web UI 端口号
   */
  public getWebUIPort(): number {
    const webUIConfig = this.getWebUIConfig();
    return webUIConfig.port ?? 9999; // 默认端口 9999
  }

  /**
   * 通知 Web 界面配置已更新
   * 如果 Web 服务器正在运行，通过 WebSocket 广播配置更新
   */
  private notifyConfigUpdate(config: AppConfig): void {
    try {
      // 检查是否有全局的 webServer 实例（当使用 --ui 参数启动时会设置）
      const webServer = (
        global as typeof global & { __webServer?: WebServerInstance }
      ).__webServer;
      if (webServer && typeof webServer.broadcastConfigUpdate === "function") {
        // 调用 webServer 的 broadcastConfigUpdate 方法来通知所有连接的客户端
        webServer.broadcastConfigUpdate(config);
        console.log("已通过 WebSocket 广播配置更新");
      }
    } catch (error) {
      // 静默处理错误，不影响配置保存的主要功能
      console.warn(
        "通知 Web 界面配置更新失败:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 更新 Web UI 配置
   */
  public updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void {
    const config = this.getMutableConfig();

    // 确保 webUI 对象存在
    if (!config.webUI) {
      config.webUI = {};
    }

    // 直接修改现有的 webUI 对象以保留注释
    Object.assign(config.webUI, webUIConfig);
    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "webui",
      timestamp: new Date(),
    });
  }

  /**
   * 设置 Web UI 端口号
   */
  public setWebUIPort(port: number): void {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error("端口号必须是 1-65535 之间的整数");
    }
    this.updateWebUIConfig({ port });
  }

  public updatePlatformConfig(
    platformName: string,
    platformConfig: PlatformConfig
  ): void {
    const config = this.getMutableConfig();
    if (!config.platforms) {
      config.platforms = {};
    }
    config.platforms[platformName] = platformConfig;
    // 注意：Web UI 可能需要刷新才能看到更新后的数据
    this.saveConfig(config);

    // 发射配置更新事件
    this.emitEvent("config:updated", {
      type: "platform",
      platformName,
      timestamp: new Date(),
    });
  }

  /**
   * 获取扣子平台配置
   */
  public getCozePlatformConfig(): CozePlatformConfig | null {
    const config = this.getConfig();
    const cozeConfig = config.platforms?.coze;

    if (!cozeConfig || !cozeConfig.token) {
      return null;
    }

    return {
      token: cozeConfig.token,
    };
  }

  /**
   * 获取扣子 API Token
   */
  public getCozeToken(): string | null {
    const cozeConfig = this.getCozePlatformConfig();
    return cozeConfig?.token || null;
  }

  /**
   * 设置扣子平台配置
   */
  public setCozePlatformConfig(config: CozePlatformConfig): void {
    if (
      !config.token ||
      typeof config.token !== "string" ||
      config.token.trim() === ""
    ) {
      throw new Error("扣子 API Token 不能为空");
    }

    this.updatePlatformConfig("coze", {
      token: config.token.trim(),
    });
  }

  /**
   * 检查扣子平台配置是否有效
   */
  public isCozeConfigValid(): boolean {
    const cozeConfig = this.getCozePlatformConfig();
    return (
      cozeConfig !== null &&
      typeof cozeConfig.token === "string" &&
      cozeConfig.token.trim() !== ""
    );
  }

  /**
   * 更新 mcpServerConfig 中的工具使用统计信息（内部实现）
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数
   * @private
   */
  private async _updateMCPServerToolStats(
    serverName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    const config = this.getMutableConfig();

    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 确保服务配置存在
    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    // 确保工具配置存在
    if (!config.mcpServerConfig[serverName].tools[toolName]) {
      config.mcpServerConfig[serverName].tools[toolName] = {
        enable: true, // 默认启用
      };
    }

    const toolConfig = config.mcpServerConfig[serverName].tools[toolName];
    const currentUsageCount = toolConfig.usageCount || 0;
    const currentLastUsedTime = toolConfig.lastUsedTime;

    // 根据参数决定是否更新使用次数
    if (incrementUsageCount) {
      toolConfig.usageCount = currentUsageCount + 1;
    }

    // 时间校验：只有新时间晚于现有时间才更新 lastUsedTime
    if (
      !currentLastUsedTime ||
      new Date(callTime) > new Date(currentLastUsedTime)
    ) {
      // 使用 dayjs 格式化时间为更易读的格式
      toolConfig.lastUsedTime = dayjs(callTime).format("YYYY-MM-DD HH:mm:ss");
    }

    // 保存配置
    this.saveConfig(config);
  }

  /**
   * 更新 customMCP 中的工具使用统计信息（服务名+工具名版本）
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   * @private
   */
  private async updateCustomMCPToolStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新 customMCP 中的工具使用统计信息（工具名版本）
   * @param toolName 工具名称（customMCP 工具名称）
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数，默认为 true
   * @private
   */
  private async updateCustomMCPToolStats(
    toolName: string,
    callTime: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  /**
   * 更新 customMCP 工具使用统计信息的实现
   * @private
   */
  private async updateCustomMCPToolStats(
    arg1: string,
    arg2: string,
    arg3?: string | boolean
  ): Promise<void> {
    try {
      let toolName: string;
      let callTime: string;
      let incrementUsageCount = true;
      let logPrefix: string;

      // 判断参数类型来区分不同的重载
      if (typeof arg3 === "string") {
        // 三个字符串参数的情况：updateCustomMCPToolStats(serverName, toolName, callTime)
        const serverName = arg1;
        toolName = `${serverName}__${arg2}`;
        callTime = arg3;
        logPrefix = `${serverName}/${arg2}`;
      } else {
        // 两个或三个参数的情况：updateCustomMCPToolStats(toolName, callTime, incrementUsageCount?)
        toolName = arg1;
        callTime = arg2;
        incrementUsageCount = (arg3 as boolean) || true;
        logPrefix = toolName;
      }

      const customTools = this.getCustomMCPTools();
      const toolIndex = customTools.findIndex((tool) => tool.name === toolName);

      if (toolIndex === -1) {
        // 如果 customMCP 中没有对应的工具，跳过更新
        return;
      }

      const updatedTools = [...customTools];
      const tool = updatedTools[toolIndex];

      // 确保 stats 对象存在
      if (!tool.stats) {
        tool.stats = {};
      }

      const currentUsageCount = tool.stats.usageCount || 0;
      const currentLastUsedTime = tool.stats.lastUsedTime;

      // 根据参数决定是否更新使用次数
      if (incrementUsageCount) {
        tool.stats.usageCount = currentUsageCount + 1;
      }

      // 时间校验：只有新时间晚于现有时间才更新 lastUsedTime
      if (
        !currentLastUsedTime ||
        new Date(callTime) > new Date(currentLastUsedTime)
      ) {
        tool.stats.lastUsedTime = dayjs(callTime).format("YYYY-MM-DD HH:mm:ss");
      }

      // 保存更新后的工具配置
      await this.updateCustomMCPTools(updatedTools);
    } catch (error) {
      // 根据参数类型决定错误日志的前缀
      if (typeof arg3 === "string") {
        const serverName = arg1;
        const toolName = arg2;
        console.error("更新 customMCP 工具统计信息失败", {
          serverName,
          toolName,
          error,
        });
      } else {
        const toolName = arg1;
        console.error("更新 customMCP 工具统计信息失败", { toolName, error });
      }
      // customMCP 统计更新失败不应该影响主要流程
    }
  }

  /**
   * 获取统计更新锁（确保同一工具的统计更新串行执行）
   * @param toolKey 工具键
   * @private
   */
  private async acquireStatsUpdateLock(toolKey: string): Promise<boolean> {
    if (this.statsUpdateLocks.has(toolKey)) {
      console.log("工具统计更新正在进行中，跳过本次更新", { toolKey });
      return false;
    }

    const updatePromise = new Promise<void>((resolve) => {
      // 锁定逻辑在调用者中实现
    });

    this.statsUpdateLocks.set(toolKey, updatePromise);

    // 设置超时自动释放锁
    const timeout = setTimeout(() => {
      this.releaseStatsUpdateLock(toolKey);
    }, this.STATS_UPDATE_TIMEOUT);

    this.statsUpdateLockTimeouts.set(toolKey, timeout);

    return true;
  }

  /**
   * 释放统计更新锁
   * @param toolKey 工具键
   * @private
   */
  private releaseStatsUpdateLock(toolKey: string): void {
    this.statsUpdateLocks.delete(toolKey);

    const timeout = this.statsUpdateLockTimeouts.get(toolKey);
    if (timeout) {
      clearTimeout(timeout);
      this.statsUpdateLockTimeouts.delete(toolKey);
    }

    console.log("已释放工具的统计更新锁", { toolKey });
  }

  /**
   * 带并发控制的工具统计更新（CustomMCP 工具）
   * @param toolName 工具名称
   * @param incrementUsageCount 是否增加使用计数
   */
  public async updateToolUsageStatsWithLock(
    toolName: string,
    incrementUsageCount = true
  ): Promise<void> {
    const toolKey = `custommcp_${toolName}`;

    if (!(await this.acquireStatsUpdateLock(toolKey))) {
      return; // 已有其他更新在进行
    }

    try {
      await this.updateToolUsageStats(toolName, incrementUsageCount);
      console.log("工具统计更新完成", { toolName });
    } catch (error) {
      console.error("工具统计更新失败", { toolName, error });
      throw error;
    } finally {
      this.releaseStatsUpdateLock(toolKey);
    }
  }

  /**
   * 带并发控制的工具统计更新（MCP 服务工具）
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间
   * @param incrementUsageCount 是否增加使用计数
   */
  public async updateMCPServerToolStatsWithLock(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    const toolKey = `mcpserver_${serviceName}_${toolName}`;

    if (!(await this.acquireStatsUpdateLock(toolKey))) {
      return; // 已有其他更新在进行
    }

    try {
      await this.updateMCPServerToolStats(
        serviceName,
        toolName,
        callTime,
        incrementUsageCount
      );
      console.log("MCP 服务工具统计更新完成", { serviceName, toolName });
    } catch (error) {
      console.error("MCP 服务工具统计更新失败", {
        serviceName,
        toolName,
        error,
      });
      throw error;
    } finally {
      this.releaseStatsUpdateLock(toolKey);
    }
  }

  /**
   * 清理所有统计更新锁（用于异常恢复）
   */
  public clearAllStatsUpdateLocks(): void {
    const lockCount = this.statsUpdateLocks.size;
    this.statsUpdateLocks.clear();

    // 清理所有超时定时器
    for (const timeout of this.statsUpdateLockTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.statsUpdateLockTimeouts.clear();

    if (lockCount > 0) {
      console.log("已清理统计更新锁", { count: lockCount });
    }
  }

  /**
   * 获取统计更新锁状态（用于调试和监控）
   */
  public getStatsUpdateLocks(): string[] {
    return Array.from(this.statsUpdateLocks.keys());
  }

  /**
   * 获取工具调用日志配置
   */
  public getToolCallLogConfig(): Readonly<ToolCallLogConfig> {
    const config = this.getConfig();
    return config.toolCallLog || {};
  }

  /**
   * 更新工具调用日志配置
   */
  public updateToolCallLogConfig(
    toolCallLogConfig: Partial<ToolCallLogConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 toolCallLog 对象存在
    if (!config.toolCallLog) {
      config.toolCallLog = {};
    }

    // 直接修改现有的 toolCallLog 对象以保留注释
    Object.assign(config.toolCallLog, toolCallLogConfig);
    this.saveConfig(config);
  }

  /**
   * 获取配置目录路径（与配置文件同级目录）
   */
  public getConfigDir(): string {
    // 配置文件路径 - 优先使用环境变量指定的目录，否则使用当前工作目录
    return process.env.XIAOZHI_CONFIG_DIR || process.cwd();
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();
