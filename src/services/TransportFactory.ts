import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EventSource } from "eventsource";
import { Logger } from "../logger.js";
import { type MCPServiceConfig, MCPTransportType } from "./MCPService.js";

// 全局 polyfill EventSource（用于 SSE）
if (typeof global !== "undefined" && !global.EventSource) {
  (global as any).EventSource = EventSource;
}

// Transport 基础接口
export interface Transport {
  connect?(): Promise<void>;
  close?(): Promise<void>;
}

// HTTP Transport 实现（用于 streamable-http）
class StreamableHttpTransport implements Transport {
  private config: MCPServiceConfig;
  private logger: Logger;

  constructor(config: MCPServiceConfig) {
    this.config = config;
    this.logger = new Logger().withTag(`HTTP-${config.name}`);
  }

  async connect(): Promise<void> {
    this.logger.info(`连接到 HTTP MCP 服务: ${this.config.url}`);
    // HTTP transport 通常不需要持久连接
  }

  async close(): Promise<void> {
    this.logger.info(`关闭 HTTP MCP 服务连接: ${this.config.url}`);
    // HTTP transport 清理逻辑
  }

  // HTTP 特定的请求方法
  async request(method: string, params?: any): Promise<any> {
    if (!this.config.url) {
      throw new Error("HTTP transport 需要 URL 配置");
    }

    const requestBody = {
      jsonrpc: "2.0",
      method,
      params: params || {},
      id: Date.now(),
    };

    const response = await fetch(this.config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `HTTP 请求失败: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(`MCP 错误: ${result.error.message}`);
    }

    return result.result;
  }
}

// 创建 logger 实例
function getLogger(): Logger {
  return new Logger().withTag("TransportFactory");
}

/**
 * 创建 transport 实例
 * @param config MCP 服务配置
 * @returns transport 实例
 */
export function createTransport(config: MCPServiceConfig): any {
  const logger = getLogger();
  logger.info(`创建 ${config.type} transport for ${config.name}`);

  switch (config.type) {
    case MCPTransportType.STDIO:
      return createStdioTransport(config);

    case MCPTransportType.SSE:
      return createSSETransport(config);

    case MCPTransportType.STREAMABLE_HTTP:
      return createStreamableHttpTransport(config);

    default:
      throw new Error(`不支持的传输类型: ${config.type}`);
  }
}

/**
 * 创建 Stdio transport
 */
function createStdioTransport(config: MCPServiceConfig): StdioClientTransport {
  if (!config.command) {
    throw new Error("stdio transport 需要 command 配置");
  }

  return new StdioClientTransport({
    command: config.command,
    args: config.args || [],
  });
}

/**
 * 创建 SSE transport
 */
function createSSETransport(config: MCPServiceConfig): SSEClientTransport {
  if (!config.url) {
    throw new Error("SSE transport 需要 URL 配置");
  }

  const url = new URL(config.url);
  const options = createSSEOptions(config);

  return new SSEClientTransport(url, options);
}

/**
 * 创建 SSE 选项
 */
function createSSEOptions(config: MCPServiceConfig): any {
  const options: any = {};

  // 添加认证头
  if (config.apiKey) {
    options.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      ...config.headers,
    };
  } else if (config.headers) {
    options.headers = config.headers;
  }

  return options;
}

/**
 * 创建 Streamable HTTP transport
 */
function createStreamableHttpTransport(
  config: MCPServiceConfig
): StreamableHttpTransport {
  if (!config.url) {
    throw new Error("streamable-http transport 需要 URL 配置");
  }

  return new StreamableHttpTransport(config);
}

/**
 * 验证配置
 */
export function validateConfig(config: MCPServiceConfig): void {
  if (!config.name || typeof config.name !== "string") {
    throw new Error("配置必须包含有效的 name 字段");
  }

  if (!config.type) {
    throw new Error("配置必须包含 type 字段");
  }

  switch (config.type) {
    case MCPTransportType.STDIO:
      if (!config.command) {
        throw new Error("stdio 类型需要 command 字段");
      }
      break;

    case MCPTransportType.SSE:
    case MCPTransportType.STREAMABLE_HTTP:
      if (!config.url) {
        throw new Error(`${config.type} 类型需要 url 字段`);
      }
      break;

    default:
      throw new Error(`不支持的传输类型: ${config.type}`);
  }
}

/**
 * 获取支持的传输类型列表
 */
export function getSupportedTypes(): MCPTransportType[] {
  return [MCPTransportType.STDIO, MCPTransportType.SSE, MCPTransportType.STREAMABLE_HTTP];
}

/**
 * Transport 工厂对象（保持 API 兼容性）
 */
export const TransportFactory = {
  create: createTransport,
  validateConfig,
  getSupportedTypes,
};

export { StreamableHttpTransport };
