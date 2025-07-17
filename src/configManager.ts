import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

// SSE MCP 服务配置（支持 ModelScope、高德地图等 SSE 服务）
export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
}

// Streamable HTTP MCP 服务配置
export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，因为默认就是 streamable-http
  url: string;
}

// 统一的 MCP 服务配置
export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | StreamableHTTPMCPServerConfig;

export interface MCPToolConfig {
  description?: string;
  enable: boolean;
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

export interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  connection?: ConnectionConfig; // 连接配置（可选，用于向后兼容）
  modelscope?: ModelScopeConfig; // ModelScope 配置（可选）
  webUI?: WebUIConfig; // Web UI 配置（可选）
}

/**
 * 配置管理类
 * 负责管理应用配置，提供只读访问和安全的配置更新功能
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private defaultConfigPath: string;
  private config: AppConfig | null = null;

  private constructor() {
    this.defaultConfigPath = resolve(__dirname, "xiaozhi.config.default.json");
  }

  /**
   * 获取配置文件路径（动态计算）
   */
  private getConfigFilePath(): string {
    // 配置文件路径 - 优先使用环境变量指定的目录，否则使用当前工作目录
    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    return resolve(configDir, "xiaozhi.config.json");
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
   */
  public configExists(): boolean {
    const configPath = this.getConfigFilePath();
    return existsSync(configPath);
  }

  /**
   * 初始化配置文件
   * 从 config.default.json 复制到 config.json
   */
  public initConfig(): void {
    if (!existsSync(this.defaultConfigPath)) {
      throw new Error("默认配置文件 xiaozhi.config.default.json 不存在");
    }

    if (this.configExists()) {
      throw new Error("配置文件 xiaozhi.config.json 已存在，无需重复初始化");
    }

    const configPath = this.getConfigFilePath();
    copyFileSync(this.defaultConfigPath, configPath);
    this.config = null; // 重置缓存
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): AppConfig {
    if (!this.configExists()) {
      throw new Error(
        "配置文件 xiaozhi.config.json 不存在，请先运行 xiaozhi init 初始化配置"
      );
    }

    try {
      const configPath = this.getConfigFilePath();
      const configData = readFileSync(configPath, "utf8");
      const config = JSON.parse(configData) as AppConfig;

      // 验证配置结构
      this.validateConfig(config);

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`配置文件格式错误: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 验证配置文件结构
   */
  private validateConfig(config: unknown): void {
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
      if (configObj.mcpEndpoint.length === 0) {
        throw new Error("配置文件格式错误：mcpEndpoint 数组不能为空");
      }
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

      const sc = serverConfig as Record<string, unknown>;

      // 检查服务类型
      if (sc.url && typeof sc.url === "string") {
        // URL 类型的服务（SSE 或 Streamable HTTP）
        // type 字段是可选的，可以是 "sse" 或 "streamable-http"
        if (sc.type && sc.type !== "sse" && sc.type !== "streamable-http") {
          throw new Error(
            `配置文件格式错误：mcpServers.${serverName}.type 必须是 "sse" 或 "streamable-http"`
          );
        }
      } else {
        // 本地类型的验证
        if (!sc.command || typeof sc.command !== "string") {
          throw new Error(
            `配置文件格式错误：mcpServers.${serverName}.command 无效`
          );
        }

        if (!Array.isArray(sc.args)) {
          throw new Error(
            `配置文件格式错误：mcpServers.${serverName}.args 必须是数组`
          );
        }

        if (sc.env && typeof sc.env !== "object") {
          throw new Error(
            `配置文件格式错误：mcpServers.${serverName}.env 必须是对象`
          );
        }
      }
    }
  }

  /**
   * 获取配置（只读）
   */
  public getConfig(): Readonly<AppConfig> {
    if (!this.config) {
      this.config = this.loadConfig();
    }

    // 返回深度只读副本
    return JSON.parse(JSON.stringify(this.config));
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
      if (endpoint.length === 0) {
        throw new Error("MCP 端点数组不能为空");
      }
      for (const ep of endpoint) {
        if (!ep || typeof ep !== "string") {
          throw new Error("MCP 端点数组中的每个元素必须是非空字符串");
        }
      }
    } else {
      if (!endpoint || typeof endpoint !== "string") {
        throw new Error("MCP 端点必须是非空字符串");
      }
    }

    const config = this.getConfig();
    const newConfig = { ...config, mcpEndpoint: endpoint };
    this.saveConfig(newConfig);
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getConfig();
    const currentEndpoints = this.getMcpEndpoints();

    // 检查是否已存在
    if (currentEndpoints.includes(endpoint)) {
      throw new Error(`MCP 端点 ${endpoint} 已存在`);
    }

    const newEndpoints = [...currentEndpoints, endpoint];
    const newConfig = { ...config, mcpEndpoint: newEndpoints };
    this.saveConfig(newConfig);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("MCP 端点必须是非空字符串");
    }

    const config = this.getConfig();
    const currentEndpoints = this.getMcpEndpoints();

    // 检查是否存在
    const index = currentEndpoints.indexOf(endpoint);
    if (index === -1) {
      throw new Error(`MCP 端点 ${endpoint} 不存在`);
    }

    // 不允许删除最后一个端点
    if (currentEndpoints.length === 1) {
      throw new Error("不能删除最后一个 MCP 端点");
    }

    const newEndpoints = currentEndpoints.filter((ep) => ep !== endpoint);
    const newConfig = { ...config, mcpEndpoint: newEndpoints };
    this.saveConfig(newConfig);
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

    // 验证服务配置
    if ("type" in serverConfig && serverConfig.type === "sse") {
      // SSE 类型的验证
      if (!serverConfig.url || typeof serverConfig.url !== "string") {
        throw new Error("SSE 服务配置的 url 字段必须是非空字符串");
      }
    } else {
      // 本地类型的验证
      const localConfig = serverConfig as LocalMCPServerConfig;
      if (!localConfig.command || typeof localConfig.command !== "string") {
        throw new Error("服务配置的 command 字段必须是非空字符串");
      }

      if (!Array.isArray(localConfig.args)) {
        throw new Error("服务配置的 args 字段必须是数组");
      }

      if (localConfig.env && typeof localConfig.env !== "object") {
        throw new Error("服务配置的 env 字段必须是对象");
      }
    }

    const config = this.getConfig();
    const newConfig = {
      ...config,
      mcpServers: {
        ...config.mcpServers,
        [serverName]: serverConfig,
      },
    };
    this.saveConfig(newConfig);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    if (!serverName || typeof serverName !== "string") {
      throw new Error("服务名称必须是非空字符串");
    }

    const config = this.getConfig();
    if (!config.mcpServers[serverName]) {
      throw new Error(`服务 ${serverName} 不存在`);
    }

    const newMcpServers = { ...config.mcpServers };
    delete newMcpServers[serverName];

    const newConfig = {
      ...config,
      mcpServers: newMcpServers,
    };
    this.saveConfig(newConfig);
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    const config = this.getConfig();
    const newConfig = { ...config };

    // 确保 mcpServerConfig 存在
    if (!newConfig.mcpServerConfig) {
      newConfig.mcpServerConfig = {};
    }

    // 更新指定服务的工具配置
    newConfig.mcpServerConfig[serverName] = {
      tools: toolsConfig,
    };

    this.saveConfig(newConfig);
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
    const config = this.getConfig();
    const newConfig = { ...config };

    // 确保 mcpServerConfig 存在
    if (!newConfig.mcpServerConfig) {
      newConfig.mcpServerConfig = {};
    }

    // 确保服务配置存在
    if (!newConfig.mcpServerConfig[serverName]) {
      newConfig.mcpServerConfig[serverName] = { tools: {} };
    }

    // 更新工具配置
    newConfig.mcpServerConfig[serverName].tools[toolName] = {
      enable: enabled,
      ...(description && { description }),
    };

    this.saveConfig(newConfig);
  }

  /**
   * 保存配置到文件
   */
  private saveConfig(config: AppConfig): void {
    try {
      // 验证配置
      this.validateConfig(config);

      // 格式化 JSON 并保存
      const configPath = this.getConfigFilePath();
      const configJson = JSON.stringify(config, null, 2);
      writeFileSync(configPath, configJson, "utf8");

      // 更新缓存
      this.config = config;
    } catch (error) {
      throw new Error(
        `保存配置失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 重新加载配置（清除缓存）
   */
  public reloadConfig(): void {
    this.config = null;
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
    const config = this.getConfig();
    const currentConnectionConfig = config.connection || {};

    const newConnectionConfig = {
      ...currentConnectionConfig,
      ...connectionConfig,
    };

    const newConfig = {
      ...config,
      connection: newConnectionConfig,
    };

    this.saveConfig(newConfig);
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
    const config = this.getConfig();
    const currentModelScopeConfig = config.modelscope || {};

    const newModelScopeConfig = {
      ...currentModelScopeConfig,
      ...modelScopeConfig,
    };

    const newConfig = {
      ...config,
      modelscope: newModelScopeConfig,
    };

    this.saveConfig(newConfig);
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
   * 更新 Web UI 配置
   */
  public updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void {
    const config = this.getConfig();
    const currentWebUIConfig = config.webUI || {};

    const newWebUIConfig = {
      ...currentWebUIConfig,
      ...webUIConfig,
    };

    const newConfig = {
      ...config,
      webUI: newWebUIConfig,
    };

    this.saveConfig(newConfig);
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
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();
