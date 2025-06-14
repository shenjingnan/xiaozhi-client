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
import {
  type MCPServerConfig,
  type MCPToolConfig,
  configManager,
} from "./configManager.js";

// CommonJS 兼容的 __dirname
const __dirname = dirname(__filename);

// Simple logger utility
const logger = {
  info: (message: string): void => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - MCPProxy - INFO - ${message}`);
  },
  error: (message: string): void => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - MCPProxy - ERROR - ${message}`);
  },
  debug: (message: string): void => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - MCPProxy - DEBUG - ${message}`);
  },
};

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

/**
 * MCP Client for communicating with child MCP servers
 */
class MCPClient {
  private name: string;
  private config: MCPServerConfig;
  private process: ChildProcess | null;
  public initialized: boolean;
  public tools: Tool[];
  public originalTools: Tool[]; // 存储原始工具名称
  private requestId: number;
  private pendingRequests: Map<number, PendingRequest>;
  private messageBuffer: string;

  constructor(name: string, config: MCPServerConfig) {
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
    logger.info(`Starting MCP client for ${this.name}`);

    const { command, args, env } = this.config;
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

    this.process = spawn(command, args, spawnOptions);

    // Handle process stdout - parse JSON-RPC messages
    this.process.stdout?.on("data", (data: Buffer) => {
      this.handleStdoutData(data.toString());
    });

    // Handle process stderr - log errors
    this.process.stderr?.on("data", (data: Buffer) => {
      logger.debug(`${this.name} stderr: ${data.toString().trim()}`);
    });

    // Handle process exit
    this.process.on(
      "exit",
      (code: number | null, signal: NodeJS.Signals | null) => {
        logger.error(
          `${this.name} process exited with code ${code}, signal ${signal}`
        );
        this.initialized = false;
      }
    );

    // Handle process error
    this.process.on("error", (error: Error) => {
      logger.error(`${this.name} process error: ${error.message}`);
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
          logger.error(`${this.name} failed to parse message: ${line.trim()}`);
        }
      }
    }
  }

  handleMessage(message: any): void {
    logger.debug(
      `${this.name} received: ${JSON.stringify(message).substring(0, 200)}...`
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
      throw new Error(`${this.name} process not available`);
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
          reject(new Error(`Request timeout for ${method}`));
        }
      }, 30000); // 30 second timeout

      const message = `${JSON.stringify(request)}\n`;
      logger.debug(`${this.name} sending: ${message.trim()}`);
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
        `${this.name} initialized with capabilities: ${JSON.stringify((initResult as any).capabilities)}`
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
      logger.info(`${this.name} client ready with ${this.tools.length} tools`);
    } catch (error) {
      logger.error(
        `Failed to initialize ${this.name}: ${error instanceof Error ? error.message : String(error)}`
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
        `${this.name} loaded ${this.originalTools.length} tools: ${this.originalTools.map((t) => t.name).join(", ")}`
      );
      logger.info(
        `${this.name} enabled ${this.tools.length} tools: ${this.tools.map((t) => t.name).join(", ")}`
      );
    } catch (error) {
      logger.error(
        `Failed to get tools from ${this.name}: ${error instanceof Error ? error.message : String(error)}`
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
        logger.info(`${this.name} updated tools configuration`);
      }
    } catch (error) {
      logger.error(
        `Failed to update tools config for ${this.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async callTool(prefixedName: string, arguments_: any): Promise<any> {
    try {
      // 将前缀名称转换回原始名称
      const originalName = this.getOriginalToolName(prefixedName);
      if (!originalName) {
        throw new Error(`Invalid tool name format: ${prefixedName}`);
      }

      const result = await this.sendRequest("tools/call", {
        name: originalName,
        arguments: arguments_,
      });
      return result;
    } catch (error) {
      logger.error(
        `Failed to call tool ${prefixedName} (original: ${this.getOriginalToolName(prefixedName)}) on ${this.name}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  stop(): void {
    if (this.process) {
      logger.info(`Stopping ${this.name} client`);
      this.process.kill("SIGTERM");
      this.process = null;
    }
    this.initialized = false;
  }
}

/**
 * Configuration loader for MCP servers
 */
function loadMCPConfig(): Record<string, MCPServerConfig> {
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
          throw new Error(
            "Invalid configuration: mcpServers section not found or invalid"
          );
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
      `Failed to load MCP configuration: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * MCP Server Proxy - Main proxy server implementation
 */
class MCPServerProxy {
  private clients: Map<string, MCPClient>;
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
    logger.info("Starting MCP Server Proxy");

    // Load configuration
    this.config = loadMCPConfig();

    // Initialize child MCP clients from configuration
    const clientPromises = [];

    for (const [serverName, serverConfig] of Object.entries(this.config)) {
      logger.info(`Initializing MCP client: ${serverName}`);
      const client = new MCPClient(serverName, serverConfig);
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
          logger.info(`Successfully started MCP client: ${serverName}`);
        } else {
          logger.error(
            `Failed to start MCP client ${serverName}: ${result.reason.message}`
          );
          // Remove failed client from clients map
          this.clients.delete(serverName);
        }
      }

      if (successCount === 0) {
        throw new Error("No MCP clients started successfully");
      }

      // Build tool mapping
      this.buildToolMap();
      this.initialized = true;

      logger.info(
        `MCP Server Proxy initialized successfully with ${successCount}/${Object.keys(this.config).length} clients`
      );
    } catch (error) {
      logger.error(
        `Failed to start MCP clients: ${error instanceof Error ? error.message : String(error)}`
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
            `Duplicate tool name: ${tool.name} (from ${clientName} and ${this.toolMap.get(tool.name)})`
          );
        } else {
          this.toolMap.set(tool.name, clientName);
        }
      }
    }

    logger.info(`Built tool map with ${this.toolMap.size} tools`);
    logger.debug(`Tool map: ${Array.from(this.toolMap.keys()).join(", ")}`);
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
      throw new Error(`Server ${serverName} not found`);
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
      throw new Error(`Server ${serverName} not found`);
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
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const client = this.clients.get(clientName);
    if (!client || !client.initialized) {
      throw new Error(`Client ${clientName} not available`);
    }

    return await client.callTool(toolName, arguments_);
  }

  stop() {
    logger.info("Stopping MCP Server Proxy");
    for (const client of this.clients.values()) {
      client.stop();
    }
    this.initialized = false;
  }
}

/**
 * Manual JSON-RPC 2.0 Server Implementation
 */
class JSONRPCServer {
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
        `Received request: ${JSON.stringify(parsedMessage).substring(0, 200)}...`
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
      throw new Error("Invalid JSON-RPC message");
    } catch (error) {
      logger.error(
        `Error handling message: ${error instanceof Error ? error.message : String(error)}`
      );
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
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
          throw new Error(`Unknown method: ${method}`);
      }

      return {
        jsonrpc: "2.0",
        id: id,
        result: result,
      };
    } catch (error) {
      logger.error(
        `Error handling request ${method}: ${error instanceof Error ? error.message : String(error)}`
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
        logger.info("Client sent initialized notification");
        break;
      default:
        logger.debug(`Received notification: ${method}`);
        break;
    }
  }

  async handleInitialize(params: any): Promise<any> {
    logger.info(
      `Initialize request from client: ${JSON.stringify(params.clientInfo)}`
    );

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
      throw new Error("Proxy not initialized");
    }

    const tools = this.proxy.getAllTools();
    logger.info(`Returning ${tools.length} tools`);

    return {
      tools: tools,
    };
  }

  async handleToolsCall(params: any): Promise<any> {
    const { name, arguments: args } = params;

    if (!name) {
      throw new Error("Tool name is required");
    }

    logger.info(`Calling tool: ${name} with args: ${JSON.stringify(args)}`);

    const result = await this.proxy.callTool(name, args || {});
    return result;
  }

  async handlePing(_params: any): Promise<any> {
    logger.debug("Received ping request");
    return {}; // Empty response for ping
  }
}

/**
 * Main function to start the MCP Server Proxy
 */
async function main() {
  logger.info("Starting MCP Server Proxy");

  // Create and start the proxy
  const proxy = new MCPServerProxy();
  const jsonrpcServer = new JSONRPCServer(proxy);

  // Setup graceful shutdown
  const cleanup = () => {
    logger.info("Shutting down MCP Server Proxy");
    proxy.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    // Start the proxy (initialize child clients)
    await proxy.start();

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
              `Error processing message: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    });

    process.stdin.on("end", () => {
      logger.info("stdin closed, shutting down");
      cleanup();
    });

    logger.info("MCP Server Proxy is running on stdio");
  } catch (error) {
    logger.error(
      `Failed to start MCP Server Proxy: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error(
      `Unhandled error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
