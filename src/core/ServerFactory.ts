/**
 * MCP 服务器工厂
 * 阶段三重构：支持多种传输协议的自动选择和服务器创建
 *
 * 主要功能：
 * 1. 根据环境自动选择合适的传输协议
 * 2. 创建和配置 UnifiedMCPServer 实例
 * 3. 注册和管理传输适配器
 * 4. 提供便捷的服务器创建方法
 */

import { Logger } from "../Logger.js";
import { HTTPAdapter, type HTTPConfig } from "../transports/HTTPAdapter.js";
import { StdioAdapter, type StdioConfig } from "../transports/StdioAdapter.js";
import { TransportAdapter } from "../transports/TransportAdapter.js";
import {
  WebSocketAdapter,
  type WebSocketConfig,
} from "../transports/WebSocketAdapter.js";
import type { MCPMessageHandler } from "./MCPMessageHandler.js";
import {
  UnifiedMCPServer,
  type UnifiedServerConfig,
} from "./UnifiedMCPServer.js";

/**
 * 服务器模式枚举
 */
export enum ServerMode {
  STDIO = "stdio", // 标准输入输出模式（Cursor 等客户端）
  HTTP = "http", // HTTP 服务器模式（Web 客户端）
  WEBSOCKET = "websocket", // WebSocket 模式（实时双向通信）
  HYBRID = "hybrid", // 混合模式（同时支持多种传输）
  AUTO = "auto", // 自动检测模式
}

/**
 * 服务器工厂配置
 */
export interface ServerFactoryConfig {
  mode?: ServerMode;
  serverConfig?: UnifiedServerConfig;
  stdioConfig?: StdioConfig;
  httpConfig?: HTTPConfig;
  websocketConfig?: WebSocketConfig;
  autoDetect?: {
    checkStdin?: boolean;
    checkEnvironment?: boolean;
    defaultMode?: ServerMode;
  };
}

/**
 * 环境检测结果
 */
interface EnvironmentDetection {
  hasStdin: boolean;
  isInteractive: boolean;
  hasPort: boolean;
  suggestedMode: ServerMode;
  reasons: string[];
}

// 创建 logger 实例
const logger = new Logger();

/**
 * 创建 MCP 服务器
 * 根据配置或环境自动选择合适的传输协议
 */
export async function createServer(
  config: ServerFactoryConfig = {}
): Promise<UnifiedMCPServer> {
  logger.info("开始创建 MCP 服务器", config);

  try {
    // 确定服务器模式
    const mode = await determineServerMode(config);
    logger.info(`确定服务器模式: ${mode}`);

    // 创建统一服务器实例
    const server = new UnifiedMCPServer(config.serverConfig);
    await server.initialize();

    // 根据模式注册传输适配器
    await registerTransportsForMode(server, mode, config);

    logger.info("MCP 服务器创建成功");
    return server;
  } catch (error) {
    logger.error("创建 MCP 服务器失败", error);
    throw error;
  }
}

/**
 * 创建 Stdio 模式服务器
 * 专门用于 Cursor 等客户端的标准输入输出通信
 */
export async function createStdioServer(
  config: StdioConfig = { name: "stdio" }
): Promise<UnifiedMCPServer> {
  logger.info("创建 Stdio 模式服务器");

  const server = new UnifiedMCPServer();
  await server.initialize();

  const messageHandler = server.getMessageHandler();
  const stdioAdapter = new StdioAdapter(messageHandler, config);

  await server.registerTransport("stdio", stdioAdapter);

  logger.info("Stdio 模式服务器创建成功");
  return server;
}

/**
 * 创建 HTTP 模式服务器
 * 专门用于 Web 客户端的 HTTP/SSE 通信
 */
export async function createHTTPServer(
  config: HTTPConfig = { name: "http" }
): Promise<UnifiedMCPServer> {
  logger.info("创建 HTTP 模式服务器");

  const server = new UnifiedMCPServer();
  await server.initialize();

  const messageHandler = server.getMessageHandler();
  const httpAdapter = new HTTPAdapter(messageHandler, config);

  await server.registerTransport("http", httpAdapter);

  logger.info("HTTP 模式服务器创建成功");
  return server;
}

/**
 * 创建 WebSocket 模式服务器
 * 专门用于实时双向通信
 */
export async function createWebSocketServer(
  config: WebSocketConfig = {
    name: "websocket",
    endpointUrl: "ws://localhost:8080",
  }
): Promise<UnifiedMCPServer> {
  logger.info("创建 WebSocket 模式服务器");

  const server = new UnifiedMCPServer();
  await server.initialize();

  const messageHandler = server.getMessageHandler();
  const wsAdapter = new WebSocketAdapter(messageHandler, config);

  await server.registerTransport("websocket", wsAdapter);

  logger.info("WebSocket 模式服务器创建成功");
  return server;
}

/**
 * 创建混合模式服务器
 * 同时支持多种传输协议
 */
export async function createHybridServer(
  stdioConfig: StdioConfig = { name: "stdio" },
  httpConfig: HTTPConfig = { name: "http" },
  websocketConfig?: WebSocketConfig
): Promise<UnifiedMCPServer> {
  logger.info("创建混合模式服务器");

  const server = new UnifiedMCPServer();
  await server.initialize();

  const messageHandler = server.getMessageHandler();

  // 注册 Stdio 适配器
  const stdioAdapter = new StdioAdapter(messageHandler, stdioConfig);
  await server.registerTransport("stdio", stdioAdapter);

  // 注册 HTTP 适配器
  const httpAdapter = new HTTPAdapter(messageHandler, httpConfig);
  await server.registerTransport("http", httpAdapter);

  // 可选注册 WebSocket 适配器
  if (websocketConfig) {
    const wsAdapter = new WebSocketAdapter(messageHandler, websocketConfig);
    await server.registerTransport("websocket", wsAdapter);
  }

  logger.info("混合模式服务器创建成功");
  return server;
}

/**
 * 确定服务器模式
 */
async function determineServerMode(
  config: ServerFactoryConfig
): Promise<ServerMode> {
  if (config.mode && config.mode !== ServerMode.AUTO) {
    return config.mode;
  }

  // 自动检测环境
  const detection = await detectEnvironment(config.autoDetect);
  logger.info("环境检测结果", detection);

  return detection.suggestedMode;
}

/**
 * 检测运行环境
 */
async function detectEnvironment(
  options: ServerFactoryConfig["autoDetect"] = {}
): Promise<EnvironmentDetection> {
  const {
    checkStdin = true,
    checkEnvironment = true,
    defaultMode = ServerMode.HTTP,
  } = options;

  const detection: EnvironmentDetection = {
    hasStdin: false,
    isInteractive: false,
    hasPort: false,
    suggestedMode: defaultMode,
    reasons: [],
  };

  // 检查标准输入
  if (checkStdin) {
    detection.hasStdin = !process.stdin.isTTY;
    detection.isInteractive = process.stdin.isTTY || false;

    if (detection.hasStdin) {
      detection.reasons.push("检测到标准输入流");
    }

    if (detection.isInteractive) {
      detection.reasons.push("检测到交互式终端");
    }
  }

  // 检查环境变量
  let explicitModeSet = false;
  if (checkEnvironment) {
    const mcpServerMode = process.env.MCP_SERVER_MODE;
    const port = process.env.PORT || process.env.MCP_PORT;

    if (mcpServerMode === "stdio") {
      detection.suggestedMode = ServerMode.STDIO;
      detection.reasons.push("环境变量 MCP_SERVER_MODE=stdio");
      explicitModeSet = true;
    } else if (mcpServerMode === "http") {
      detection.suggestedMode = ServerMode.HTTP;
      detection.reasons.push("环境变量 MCP_SERVER_MODE=http");
      explicitModeSet = true;
    } else if (mcpServerMode === "websocket") {
      detection.suggestedMode = ServerMode.WEBSOCKET;
      detection.reasons.push("环境变量 MCP_SERVER_MODE=websocket");
      explicitModeSet = true;
    } else if (mcpServerMode === "hybrid") {
      detection.suggestedMode = ServerMode.HYBRID;
      detection.reasons.push("环境变量 MCP_SERVER_MODE=hybrid");
      explicitModeSet = true;
    }

    if (port) {
      detection.hasPort = true;
      detection.reasons.push(`检测到端口配置: ${port}`);
    }
  }

  // 智能推断模式（仅在没有明确设置环境变量时）
  if (!explicitModeSet && detection.suggestedMode === defaultMode) {
    if (detection.hasStdin && !detection.isInteractive) {
      detection.suggestedMode = ServerMode.STDIO;
      detection.reasons.push("推断：非交互式环境，适合 Stdio 模式");
    } else if (detection.isInteractive || detection.hasPort) {
      detection.suggestedMode = ServerMode.HTTP;
      detection.reasons.push("推断：交互式环境或有端口配置，适合 HTTP 模式");
    }
  }

  return detection;
}

/**
 * 为指定模式注册传输适配器
 */
async function registerTransportsForMode(
  server: UnifiedMCPServer,
  mode: ServerMode,
  config: ServerFactoryConfig
): Promise<void> {
  const messageHandler = server.getMessageHandler();

  switch (mode) {
    case ServerMode.STDIO:
      await registerStdioTransport(server, messageHandler, config.stdioConfig);
      break;

    case ServerMode.HTTP:
      await registerHTTPTransport(server, messageHandler, config.httpConfig);
      break;

    case ServerMode.WEBSOCKET:
      await registerWebSocketTransport(
        server,
        messageHandler,
        config.websocketConfig
      );
      break;

    case ServerMode.HYBRID:
      await registerStdioTransport(server, messageHandler, config.stdioConfig);
      await registerHTTPTransport(server, messageHandler, config.httpConfig);
      if (config.websocketConfig) {
        await registerWebSocketTransport(
          server,
          messageHandler,
          config.websocketConfig
        );
      }
      break;

    default:
      throw new Error(`不支持的服务器模式: ${mode}`);
  }
}

/**
 * 注册 Stdio 传输适配器
 */
async function registerStdioTransport(
  server: UnifiedMCPServer,
  messageHandler: MCPMessageHandler,
  config: StdioConfig = { name: "stdio" }
): Promise<void> {
  const stdioAdapter = new StdioAdapter(messageHandler, config);
  await server.registerTransport("stdio", stdioAdapter);
  logger.info("Stdio 传输适配器注册成功");
}

/**
 * 注册 HTTP 传输适配器
 */
async function registerHTTPTransport(
  server: UnifiedMCPServer,
  messageHandler: MCPMessageHandler,
  config: HTTPConfig = { name: "http" }
): Promise<void> {
  // 设置默认端口
  const httpConfig: HTTPConfig = {
    port: 3000,
    host: "0.0.0.0",
    ...config,
  };

  // 从环境变量获取端口
  if (process.env.PORT) {
    httpConfig.port = Number.parseInt(process.env.PORT, 10);
  } else if (process.env.MCP_PORT) {
    httpConfig.port = Number.parseInt(process.env.MCP_PORT, 10);
  }

  const httpAdapter = new HTTPAdapter(messageHandler, httpConfig);
  await server.registerTransport("http", httpAdapter);
  logger.info(`HTTP 传输适配器注册成功 (端口: ${httpConfig.port})`);
}

/**
 * 注册 WebSocket 传输适配器
 */
async function registerWebSocketTransport(
  server: UnifiedMCPServer,
  messageHandler: MCPMessageHandler,
  config: WebSocketConfig = {
    name: "websocket",
    endpointUrl: "ws://localhost:8080",
  }
): Promise<void> {
  // 设置默认配置
  const wsConfig: WebSocketConfig = {
    mode: "client",
    compression: true,
    batchSize: 10,
    batchTimeout: 100,
    maxConnections: 100,
    ...config,
  };

  // 从环境变量获取端点URL
  if (process.env.WEBSOCKET_URL) {
    wsConfig.endpointUrl = process.env.WEBSOCKET_URL;
  } else if (process.env.MCP_WEBSOCKET_URL) {
    wsConfig.endpointUrl = process.env.MCP_WEBSOCKET_URL;
  }

  const wsAdapter = new WebSocketAdapter(messageHandler, wsConfig);
  await server.registerTransport("websocket", wsAdapter);
  logger.info(`WebSocket 传输适配器注册成功 (端点: ${wsConfig.endpointUrl})`);
}

/**
 * 获取推荐的服务器配置
 * 根据环境提供最佳的配置建议
 */
export async function getRecommendedConfig(): Promise<ServerFactoryConfig> {
  const detection = await detectEnvironment();

  const config: ServerFactoryConfig = {
    mode: detection.suggestedMode,
    autoDetect: {
      checkStdin: true,
      checkEnvironment: true,
      defaultMode: ServerMode.HTTP,
    },
  };

  // 根据检测结果调整配置
  if (detection.hasPort) {
    config.httpConfig = {
      name: "http",
      port: Number.parseInt(
        process.env.PORT || process.env.MCP_PORT || "3000",
        10
      ),
    };
  }

  if (detection.hasStdin) {
    config.stdioConfig = {
      name: "stdio",
      encoding: "utf8",
    };
  }

  // WebSocket 配置（如果有相关环境变量）
  if (process.env.WEBSOCKET_URL || process.env.MCP_WEBSOCKET_URL) {
    config.websocketConfig = {
      name: "websocket",
      endpointUrl:
        process.env.WEBSOCKET_URL ||
        process.env.MCP_WEBSOCKET_URL ||
        "ws://localhost:8080",
      mode: "client",
      compression: true,
    };
  }

  return config;
}

/**
 * 验证服务器配置
 */
export function validateConfig(config: ServerFactoryConfig): void {
  if (config.mode === ServerMode.HTTP && config.httpConfig?.port) {
    const port = config.httpConfig.port;
    if (port < 1 || port > 65535) {
      throw new Error(`无效的端口号: ${port}`);
    }
  }

  if (config.stdioConfig?.encoding) {
    const validEncodings = [
      "utf8",
      "ascii",
      "utf16le",
      "ucs2",
      "base64",
      "latin1",
      "binary",
      "hex",
    ];
    if (!validEncodings.includes(config.stdioConfig.encoding)) {
      throw new Error(`不支持的编码: ${config.stdioConfig.encoding}`);
    }
  }

  if (config.websocketConfig) {
    const wsConfig = config.websocketConfig;

    // 验证端点URL
    if (!wsConfig.endpointUrl) {
      throw new Error("WebSocket 端点URL不能为空");
    }

    try {
      new URL(wsConfig.endpointUrl);
    } catch {
      throw new Error(`无效的 WebSocket 端点URL: ${wsConfig.endpointUrl}`);
    }

    // 验证模式
    if (wsConfig.mode && !["client", "server"].includes(wsConfig.mode)) {
      throw new Error(`无效的 WebSocket 模式: ${wsConfig.mode}`);
    }

    // 验证批处理配置
    if (
      wsConfig.batchSize !== undefined &&
      (wsConfig.batchSize < 1 || wsConfig.batchSize > 1000)
    ) {
      throw new Error(`无效的批处理大小: ${wsConfig.batchSize}`);
    }

    // 验证最大连接数
    if (
      wsConfig.maxConnections &&
      (wsConfig.maxConnections < 1 || wsConfig.maxConnections > 10000)
    ) {
      throw new Error(`无效的最大连接数: ${wsConfig.maxConnections}`);
    }
  }
}
