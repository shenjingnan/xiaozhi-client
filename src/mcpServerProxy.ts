#!/usr/bin/env node

/**
 * MCP Server Proxy - JavaScript Implementation
 * Provides a proxy to aggregate multiple MCP servers dynamically from configuration
 * Version: 0.3.0 - Manual JSON-RPC 2.0 implementation (no SDK) with dynamic config
 */

import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  type LocalMCPServerConfig,
  type MCPServerConfig,
  type MCPToolConfig,
  type SSEMCPServerConfig,
  type StreamableHTTPMCPServerConfig,
  configManager,
} from "./configManager";
import { logger as globalLogger } from "./logger";
import { ModelScopeMCPClient } from "./modelScopeMCPClient";
import { StreamableHTTPMCPClient } from "./streamableHttpMCPClient";

// ESM 兼容的 __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// 为 MCPProxy 创建带标签的 logger
const logger = globalLogger.withTag("MCPProxy");

// 如果在守护进程模式下运行，初始化日志文件
if (process.env.XIAOZHI_DAEMON === "true" && process.env.XIAOZHI_CONFIG_DIR) {
  globalLogger.initLogFile(process.env.XIAOZHI_CONFIG_DIR);
  globalLogger.enableFileLogging(true);
}

// Type definitions

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

// 定义 MCP 客户端接口
export interface IMCPClient {
  initialized: boolean;
  tools: Tool[];
  originalTools: Tool[];
  start(): Promise<void>;
  refreshTools(): Promise<void>;
  callTool(toolName: string, arguments_: any): Promise<any>;
  stop(): void | Promise<void>;
  getOriginalToolName(prefixedToolName: string): string | null;
}

/**
 * MCP Client for communicating with child MCP servers
 */
export class MCPClient implements IMCPClient {
  private name: string;
  private config: LocalMCPServerConfig;
  private process: ChildProcess | null;
  public initialized: boolean;
  public tools: Tool[];
  public originalTools: Tool[]; // 存储原始工具名称
  private requestId: number;
  private pendingRequests: Map<number, PendingRequest>;
  private messageBuffer: string;

  constructor(name: string, config: LocalMCPServerConfig) {
    this.name = name;
    this.config = config;
    this.process = null;
    this.initialized = false;
    this.tools = [];
    this.originalTools = [];
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.messageBuffer = "";
  }

  /**
   * Resolve command for cross-platform execution
   * On Windows, npm/npx/uvx commands need special handling
   */
  public resolveCommand(
    command: string,
    args: string[]
  ): { resolvedCommand: string; resolvedArgs: string[] } {
    if (process.platform === "win32") {
      // On Windows, npm, npx, and uvx are .cmd files or .exe files
      if (command === "npm" || command === "npx") {
        return {
          resolvedCommand: `${command}.cmd`,
          resolvedArgs: args,
        };
      }
      // uvx is typically installed as uvx.bat on Windows (via pyenv)
      if (command === "uvx") {
        return {
          resolvedCommand: "uvx.bat",
          resolvedArgs: args,
        };
      }
    }

    return {
      resolvedCommand: command,
      resolvedArgs: args,
    };
  }

  /**
   * 生成带前缀的工具名称
   * 将服务器名称中的中划线替换为下划线，并添加 xzcli 前缀
   */
  private generatePrefixedToolName(originalToolName: string): string {
    const normalizedServerName = this.name.replace(/-/g, "_");
    return `${normalizedServerName}_xzcli_${originalToolName}`;
  }

  /**
   * 根据前缀工具名称获取原始工具名称
   */
  getOriginalToolName(prefixedToolName: string): string | null {
    const normalizedServerName = this.name.replace(/-/g, "_");
    const prefix = `${normalizedServerName}_xzcli_`;

    if (prefixedToolName.startsWith(prefix)) {
      return prefixedToolName.substring(prefix.length);
    }

    return null;
  }

  async start() {
    logger.info(`正在启动 MCP 客户端：${this.name}`);

    const { command, args, env } = this.config;

    // Handle cross-platform command execution
    const { resolvedCommand, resolvedArgs } = this.resolveCommand(
      command,
      args
    );

    const spawnOptions: any = {
      stdio: ["pipe", "pipe", "pipe"],
    };

    // Set working directory to user's current working directory
    // This ensures relative paths in MCP server configs are resolved correctly
    const userWorkingDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    spawnOptions.cwd = userWorkingDir;

    // Add environment variables if specified
    if (env) {
      spawnOptions.env = { ...process.env, ...env };
    } else {
      spawnOptions.env = { ...process.env };
    }

    // On Windows, we need to set shell: true for npm/npx/uvx commands
    if (
      process.platform === "win32" &&
      (command === "npm" || command === "npx" || command === "uvx")
    ) {
      spawnOptions.shell = true;
    }

    logger.debug(
      `${this.name} 正在生成进程：${resolvedCommand} ${resolvedArgs.join(" ")} 工作目录：${spawnOptions.cwd}`
    );
    logger.debug(
      `${this.name} 平台：${process.platform}，shell 模式：${spawnOptions.shell || false}`
    );

    this.process = spawn(resolvedCommand, resolvedArgs, spawnOptions);

    // Handle process stdout - parse JSON-RPC messages
    this.process.stdout?.on("data", (data: Buffer) => {
      this.handleStdoutData(data.toString());
    });

    // Handle process stderr - log errors
    this.process.stderr?.on("data", (data: Buffer) => {
      logger.debug(`${this.name} 标准错误输出：${data.toString().trim()}`);
    });

    // Handle process exit
    this.process.on(
      "exit",
      (code: number | null, signal: NodeJS.Signals | null) => {
        logger.error(
          `${this.name} 进程已退出，退出码：${code}，信号：${signal}`
        );
        this.initialized = false;
      }
    );

    // Handle process error
    this.process.on("error", (error: Error) => {
      logger.error(`${this.name} 进程错误：${error.message}`);
      this.initialized = false;
    });

    // Initialize the MCP connection
    await this.initialize();
  }

  handleStdoutData(data: string): void {
    this.messageBuffer = `${this.messageBuffer}${data}`;

    // Split by newlines and process complete messages
    const lines = this.messageBuffer.split("\n");
    this.messageBuffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line.trim());
          this.handleMessage(message);
        } catch (error) {
          logger.error(`${this.name} 解析消息失败：${line.trim()}`);
        }
      }
    }
  }

  handleMessage(message: any): void {
    logger.debug(
      `${this.name} 收到消息：${JSON.stringify(message).substring(0, 200)}...`
    );

    if (message.id && this.pendingRequests.has(message.id)) {
      // This is a response to our request
      const pendingRequest = this.pendingRequests.get(message.id);
      if (pendingRequest) {
        const { resolve, reject } = pendingRequest;
        this.pendingRequests.delete(message.id);

        if (message.error) {
          reject(
            new Error(`${message.error.message} (code: ${message.error.code})`)
          );
        } else {
          resolve(message.result);
        }
      }
    }
    // Note: We don't handle notifications or requests from child servers in this proxy
  }

  async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error(`${this.name} 进程不可用`);
    }

    const id = this.requestId++;
    const request = {
      jsonrpc: "2.0",
      id: id,
      method: method,
      params: params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`请求超时：${method}`));
        }
      }, 30000); // 30 second timeout

      const message = `${JSON.stringify(request)}\n`;
      logger.debug(`${this.name} 正在发送：${message.trim()}`);
      this.process?.stdin?.write(message);
    });
  }

  async initialize() {
    try {
      // Send initialize request
      const initResult = await this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "MCPProxy",
          version: "0.3.0",
        },
      });

      logger.info(
        `${this.name} 已初始化，能力：${JSON.stringify((initResult as any).capabilities)}`
      );

      // Send initialized notification
      const notification = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      };
      this.process?.stdin?.write(`${JSON.stringify(notification)}\n`);

      // Get tools list
      await this.refreshTools();

      this.initialized = true;
      logger.info(`${this.name} 客户端已就绪，共 ${this.tools.length} 个工具`);
    } catch (error) {
      logger.error(
        `初始化 ${this.name} 失败：${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  async refreshTools(): Promise<void> {
    try {
      const result = await this.sendRequest("tools/list");
      this.originalTools = (result as any).tools || [];

      // 为每个工具生成带前缀的名称，并应用过滤
      const allPrefixedTools = this.originalTools.map((tool) => ({
        ...tool,
        name: this.generatePrefixedToolName(tool.name),
      }));

      // 根据配置过滤工具
      this.tools = this.filterEnabledTools(allPrefixedTools);

      // 更新配置文件中的工具列表（如果需要）
      await this.updateToolsConfig();

      logger.info(
        `${this.name} 加载了 ${this.originalTools.length} 个工具：${this.originalTools.map((t) => t.name).join(", ")}`
      );
      logger.info(
        `${this.name} 启用了 ${this.tools.length} 个工具：${this.tools.map((t) => t.name).join(", ")}`
      );
    } catch (error) {
      logger.error(
        `从 ${this.name} 获取工具失败：${error instanceof Error ? error.message : String(error)}`
      );
      this.tools = [];
      this.originalTools = [];
    }
  }

  /**
   * 过滤启用的工具
   */
  private filterEnabledTools(allTools: Tool[]): Tool[] {
    return allTools.filter((tool) => {
      const originalName = this.getOriginalToolName(tool.name);
      if (!originalName) return true; // 如果无法解析原始名称，默认启用

      return configManager.isToolEnabled(this.name, originalName);
    });
  }

  /**
   * 更新配置文件中的工具列表
   */
  private async updateToolsConfig(): Promise<void> {
    try {
      const currentConfig = configManager.getServerToolsConfig(this.name);
      const toolsConfig: Record<string, MCPToolConfig> = {};

      // 为每个工具创建配置项
      for (const tool of this.originalTools) {
        const existingConfig = currentConfig[tool.name];
        toolsConfig[tool.name] = {
          description: tool.description || "",
          enable: existingConfig?.enable !== false, // 默认启用
        };
      }

      // 只有当配置发生变化时才更新
      const hasChanges = Object.keys(toolsConfig).some((toolName) => {
        const existing = currentConfig[toolName];
        const newConfig = toolsConfig[toolName];
        return (
          !existing ||
          existing.enable !== newConfig.enable ||
          existing.description !== newConfig.description
        );
      });

      if (hasChanges || Object.keys(currentConfig).length === 0) {
        configManager.updateServerToolsConfig(this.name, toolsConfig);
        logger.info(`${this.name} 已更新工具配置`);
      }
    } catch (error) {
      logger.error(
        `更新 ${this.name} 的工具配置失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async callTool(prefixedName: string, arguments_: any): Promise<any> {
    try {
      // 将前缀名称转换回原始名称
      const originalName = this.getOriginalToolName(prefixedName);
      if (!originalName) {
        throw new Error(`无效的工具名称格式：${prefixedName}`);
      }

      const result = await this.sendRequest("tools/call", {
        name: originalName,
        arguments: arguments_,
      });
      return result;
    } catch (error) {
      logger.error(
        `在 ${this.name} 上调用工具 ${prefixedName} (原始名称：${this.getOriginalToolName(prefixedName)}) 失败：${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  stop(): void {
    if (this.process) {
      logger.info(`正在停止 ${this.name} 客户端`);
      this.process.kill("SIGTERM");
      this.process = null;
    }
    this.initialized = false;
  }
}

/**
 * Configuration loader for MCP servers
 */
export function loadMCPConfig(): Record<string, MCPServerConfig> {
  try {
    // 首先尝试从配置管理器读取
    if (configManager.configExists()) {
      const mcpServers = configManager.getMcpServers();
      logger.info(
        `从配置文件加载了 ${Object.keys(mcpServers).length} 个 MCP 服务`
      );
      return mcpServers as Record<string, MCPServerConfig>;
    }

    // 如果配置文件不存在，尝试从旧的 mcp_server.json 读取（向后兼容）
    const legacyConfigPath = resolve(__dirname, "mcp_server.json");
    if (readFileSync) {
      // 检查是否可以读取文件
      try {
        const configData = readFileSync(legacyConfigPath, "utf8");
        const config = JSON.parse(configData);

        if (!config.mcpServers || typeof config.mcpServers !== "object") {
          throw new Error("无效的配置：mcpServers 部分未找到或无效");
        }

        logger.info(
          `从旧配置文件加载了 ${Object.keys(config.mcpServers).length} 个 MCP 服务（建议迁移到新配置格式）`
        );
        return config.mcpServers;
      } catch (legacyError) {
        // 旧配置文件也不存在或无效
        logger.error('配置文件不存在，请运行 "xiaozhi init" 初始化配置');
        throw new Error('配置文件不存在，请运行 "xiaozhi init" 初始化配置');
      }
    }

    throw new Error('配置文件不存在，请运行 "xiaozhi init" 初始化配置');
  } catch (error) {
    logger.error(
      `加载 MCP 配置失败：${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * MCP Server Proxy - Main proxy server implementation
 */
export class MCPServerProxy {
  private clients: Map<string, IMCPClient>;
  private toolMap: Map<string, string>; // Maps tool name to client name
  public initialized: boolean;
  private config: Record<string, MCPServerConfig> | null;

  constructor() {
    this.clients = new Map();
    this.toolMap = new Map(); // Maps tool name to client name
    this.initialized = false;
    this.config = null;
  }

  async start() {
    logger.info("正在启动 MCP 服务代理");

    // Load configuration
    this.config = loadMCPConfig();

    // Initialize child MCP clients from configuration
    const clientPromises = [];

    for (const [serverName, serverConfig] of Object.entries(this.config)) {
      logger.info(`正在初始化 MCP 客户端：${serverName}`);

      let client: IMCPClient;

      // 判断服务类型
      if ("url" in serverConfig) {
        // URL 类型的配置
        const url = serverConfig.url;
        
        // 判断是 SSE 还是 Streamable HTTP
        const isSSE = 
          // 1. 显式指定 type: "sse"
          ("type" in serverConfig && serverConfig.type === "sse") ||
          // 2. URL 以 /sse 结尾
          url.endsWith("/sse") ||
          // 3. 域名包含 modelscope.net（向后兼容魔搭社区）
          url.includes("modelscope.net");
        
        if (isSSE) {
          // SSE MCP 服务
          client = new ModelScopeMCPClient(serverName, serverConfig as SSEMCPServerConfig);
        } else {
          // Streamable HTTP MCP 服务
          client = new StreamableHTTPMCPClient(serverName, serverConfig as StreamableHTTPMCPServerConfig);
        }
      } else {
        // 本地 MCP 服务
        client = new MCPClient(
          serverName,
          serverConfig as LocalMCPServerConfig
        );
      }

      this.clients.set(serverName, client);
      clientPromises.push(client.start());
    }

    // Start all clients
    try {
      const results = await Promise.allSettled(clientPromises);

      // Check for failed clients
      let successCount = 0;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const serverName = Object.keys(this.config)[i];

        if (result.status === "fulfilled") {
          successCount++;
          logger.info(`成功启动 MCP 客户端：${serverName}`);
        } else {
          logger.error(
            `启动 MCP 客户端 ${serverName} 失败：${result.reason.message}`
          );
          // Remove failed client from clients map
          this.clients.delete(serverName);
        }
      }

      if (successCount === 0) {
        throw new Error("没有成功启动任何 MCP 客户端");
      }

      // Build tool mapping
      this.buildToolMap();
      this.initialized = true;

      logger.info(
        `MCP 服务代理初始化成功，启动了 ${successCount}/${Object.keys(this.config).length} 个客户端`
      );
    } catch (error) {
      logger.error(
        `启动 MCP 客户端失败：${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  buildToolMap() {
    this.toolMap.clear();

    for (const [clientName, client] of this.clients) {
      for (const tool of client.tools) {
        // 工具名称现在已经带有前缀，应该不会有重复
        // 但我们仍然检查以防万一
        if (this.toolMap.has(tool.name)) {
          logger.error(
            `重复的工具名称：${tool.name} (来自 ${clientName} 和 ${this.toolMap.get(tool.name)})`
          );
        } else {
          this.toolMap.set(tool.name, clientName);
        }
      }
    }

    logger.info(`已构建工具映射，共 ${this.toolMap.size} 个工具`);
    logger.debug(`工具映射：${Array.from(this.toolMap.keys()).join(", ")}`);
  }

  getAllTools(): Tool[] {
    const allTools: Tool[] = [];
    for (const client of this.clients.values()) {
      allTools.push(...client.tools);
    }
    return allTools;
  }

  /**
   * 获取所有服务器的信息
   */
  getAllServers(): Array<{
    name: string;
    toolCount: number;
    enabledToolCount: number;
  }> {
    const servers: Array<{
      name: string;
      toolCount: number;
      enabledToolCount: number;
    }> = [];

    for (const [serverName, client] of this.clients) {
      servers.push({
        name: serverName,
        toolCount: client.originalTools.length,
        enabledToolCount: client.tools.length,
      });
    }

    return servers;
  }

  /**
   * 获取指定服务器的工具信息
   */
  getServerTools(
    serverName: string
  ): Array<{ name: string; description: string; enabled: boolean }> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`未找到服务器 ${serverName}`);
    }

    return client.originalTools.map((tool) => ({
      name: tool.name,
      description: tool.description || "",
      enabled: configManager.isToolEnabled(serverName, tool.name),
    }));
  }

  /**
   * 刷新指定服务器的工具列表
   */
  async refreshServerTools(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`未找到服务器 ${serverName}`);
    }

    await client.refreshTools();
    this.buildToolMap(); // 重新构建工具映射
  }

  /**
   * 刷新所有服务器的工具列表
   */
  async refreshAllTools(): Promise<void> {
    const refreshPromises = Array.from(this.clients.values()).map((client) =>
      client.refreshTools()
    );
    await Promise.allSettled(refreshPromises);
    this.buildToolMap(); // 重新构建工具映射
  }

  async callTool(toolName: string, arguments_: any): Promise<any> {
    const clientName = this.toolMap.get(toolName);
    if (!clientName) {
      throw new Error(`未知的工具：${toolName}`);
    }

    const client = this.clients.get(clientName);
    if (!client || !client.initialized) {
      throw new Error(`客户端 ${clientName} 不可用`);
    }

    return await client.callTool(toolName, arguments_);
  }

  stop() {
    logger.info("正在停止 MCP 服务代理");
    for (const client of this.clients.values()) {
      client.stop();
    }
    this.initialized = false;
  }
}

/**
 * Manual JSON-RPC 2.0 Server Implementation
 */
export class JSONRPCServer {
  private proxy: MCPServerProxy;
  private requestId: number;

  constructor(proxy: MCPServerProxy) {
    this.proxy = proxy;
    this.requestId = 1;
  }

  async handleMessage(message: string): Promise<string | null> {
    try {
      const parsedMessage = JSON.parse(message);
      logger.debug(
        `收到请求：${JSON.stringify(parsedMessage).substring(0, 200)}...`
      );

      if (parsedMessage.method) {
        if (parsedMessage.id !== undefined) {
          // This is a request
          const response = await this.handleRequest(parsedMessage);
          return JSON.stringify(response);
        }
        // This is a notification
        await this.handleNotification(parsedMessage);
        return null; // No response for notifications
      }
      throw new Error("无效的 JSON-RPC 消息");
    } catch (error) {
      logger.error(
        `处理消息时出错：${error instanceof Error ? error.message : String(error)}`
      );
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "解析错误",
        },
      });
    }
  }

  async handleRequest(request: any): Promise<any> {
    const { id, method, params = {} } = request;

    try {
      let result: any;

      switch (method) {
        case "initialize":
          result = await this.handleInitialize(params);
          break;
        case "tools/list":
          result = await this.handleToolsList(params);
          break;
        case "tools/call":
          result = await this.handleToolsCall(params);
          break;
        case "ping":
          result = await this.handlePing(params);
          break;
        default:
          throw new Error(`未知的方法：${method}`);
      }

      return {
        jsonrpc: "2.0",
        id: id,
        result: result,
      };
    } catch (error) {
      logger.error(
        `处理请求 ${method} 时出错：${error instanceof Error ? error.message : String(error)}`
      );
      return {
        jsonrpc: "2.0",
        id: id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  async handleNotification(notification: any): Promise<void> {
    const { method } = notification;

    switch (method) {
      case "notifications/initialized":
        logger.info("客户端发送了初始化通知");
        break;
      default:
        logger.debug(`收到通知：${method}`);
        break;
    }
  }

  async handleInitialize(params: any): Promise<any> {
    logger.info(`收到客户端的初始化请求：${JSON.stringify(params.clientInfo)}`);

    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "MCPServerProxy",
        version: "0.3.0",
      },
    };
  }

  async handleToolsList(_params: any): Promise<any> {
    if (!this.proxy.initialized) {
      throw new Error("代理未初始化");
    }

    const tools = this.proxy.getAllTools();
    logger.info(`返回 ${tools.length} 个工具`);

    return {
      tools: tools,
    };
  }

  async handleToolsCall(params: any): Promise<any> {
    const { name, arguments: args } = params;

    if (!name) {
      throw new Error("工具名称是必需的");
    }

    logger.info(`调用工具：${name}，参数：${JSON.stringify(args)}`);

    const result = await this.proxy.callTool(name, args || {});

    // 添加调试日志
    logger.info(`工具调用结果类型: ${typeof result}`);
    logger.info(`工具调用结果: ${JSON.stringify(result).substring(0, 500)}...`);

    return result;
  }

  async handlePing(_params: any): Promise<any> {
    logger.debug("收到 ping 请求");
    return {}; // Empty response for ping
  }
}

/**
 * Check if running in MCP Server mode
 */
function isMCPServerMode(): boolean {
  return process.env.MCP_SERVER_MODE === "true";
}

/**
 * Main function to start the MCP Server Proxy
 */
async function main() {
  logger.info("正在启动 MCP 服务代理");

  // Create and start the proxy
  const proxy = new MCPServerProxy();
  const jsonrpcServer = new JSONRPCServer(proxy);

  // Setup graceful shutdown
  const cleanup = () => {
    logger.info("正在关闭 MCP 服务代理");
    proxy.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    // Start the proxy (initialize child clients)
    await proxy.start();

    // In MCP Server mode, announce readiness
    if (isMCPServerMode()) {
      logger.info("MCP proxy ready in server mode");
      console.log("MCP proxy ready"); // For parent process detection
    }

    // Handle stdin/stdout communication
    process.stdin.setEncoding("utf8");

    let messageBuffer = "";

    process.stdin.on("data", async (data) => {
      messageBuffer = `${messageBuffer}${data}`;

      // Split by newlines and process complete messages
      const lines = messageBuffer.split("\n");
      messageBuffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = await jsonrpcServer.handleMessage(line.trim());
            if (response) {
              process.stdout.write(`${response}\n`);
            }
          } catch (error) {
            logger.error(
              `处理消息时出错：${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    });

    process.stdin.on("end", () => {
      logger.info("标准输入已关闭，正在关闭");
      cleanup();
    });

    logger.info("MCP 服务代理正在通过 stdio 运行");
  } catch (error) {
    logger.error(
      `启动 MCP 服务代理失败：${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// Run the server if this file is executed directly
// Use fileURLToPath to properly handle Windows paths
const currentFileUrl = import.meta.url;
const scriptPath = fileURLToPath(currentFileUrl);
const argv1Path = process.argv[1];

if (scriptPath === argv1Path) {
  main().catch((error) => {
    logger.error(
      `未处理的错误：${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
