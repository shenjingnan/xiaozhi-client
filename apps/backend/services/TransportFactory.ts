import type { MCPServiceConfig } from "@/lib/mcp/types";
import { MCPTransportType } from "@/lib/mcp/types";
import type { SSEClientTransportOptions } from "@modelcontextprotocol/sdk/client/sse.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StreamableHTTPClientTransportOptions } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import { EventSource } from "eventsource";

// 全局 polyfill EventSource（用于 SSE）
if (typeof global !== "undefined" && !global.EventSource) {
  (global as any).EventSource = EventSource;
}

// Transport 基础接口
export interface Transport {
  connect?(): Promise<void>;
  close?(): Promise<void>;
}

// 创建 logger 实例
function getLogger(): Logger {
  return logger;
}

/**
 * 创建 transport 实例
 * @param config MCP 服务配置
 * @returns transport 实例
 */
export function createTransport(config: MCPServiceConfig): any {
  const logger = getLogger();
  logger.debug(
    `[TransportFactory] 创建 ${config.type} transport for ${config.name}`
  );

  switch (config.type) {
    case MCPTransportType.STDIO:
      return createStdioTransport(config);

    case MCPTransportType.SSE:
      return createSSETransport(config);

    case MCPTransportType.STREAMABLE_HTTP:
      return createStreamableHTTPTransport(config);

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
    env: config.env, // 传递环境变量
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
 * 创建 ModelScope SSE transport
 */
function createModelScopeSSETransport(
  config: MCPServiceConfig
): SSEClientTransport {
  if (!config.url) {
    throw new Error("ModelScope SSE transport 需要 URL 配置");
  }

  if (!config.apiKey) {
    throw new Error("ModelScope SSE transport 需要 apiKey 配置");
  }

  const url = new URL(config.url);
  const options = createModelScopeSSEOptions(config);

  return new SSEClientTransport(url, options);
}

function createStreamableHTTPTransport(
  config: MCPServiceConfig
): StreamableHTTPClientTransport {
  if (!config.url) {
    throw new Error("StreamableHTTP transport 需要 URL 配置");
  }

  const url = new URL(config.url);
  const options = createStreamableHTTPOptions(config);
  return new StreamableHTTPClientTransport(url, options);
}

/**
 * 创建 SSE 选项
 */
function createSSEOptions(config: MCPServiceConfig): SSEClientTransportOptions {
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
 * 创建 ModelScope SSE 选项
 */
function createModelScopeSSEOptions(config: MCPServiceConfig): any {
  const token = config.apiKey!; // 已在调用方验证过

  // 如果有自定义SSE选项，使用它们
  if (config.customSSEOptions) {
    return config.customSSEOptions;
  }

  // 默认的ModelScope SSE选项配置
  return {
    eventSourceInit: {
      fetch: async (url: string | URL | Request, init?: RequestInit) => {
        // 添加认证头
        const headers = {
          ...init?.headers,
          Authorization: `Bearer ${token}`,
        };

        return fetch(url, { ...init, headers });
      },
    },
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        ...config.headers,
      },
    },
  };
}

function createStreamableHTTPOptions(
  config: MCPServiceConfig
): StreamableHTTPClientTransportOptions {
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
 * 验证配置
 */
export function validateConfig(config: MCPServiceConfig): void {
  if (!config.name || typeof config.name !== "string") {
    throw new Error("配置必须包含有效的 name 字段");
  }

  // type 字段现在是可选的，由 MCPService 自动推断
  // 这里我们只验证如果 type 存在，必须是有效的类型
  if (config.type && !Object.values(MCPTransportType).includes(config.type)) {
    throw new Error(`不支持的传输类型: ${config.type}`);
  }

  // 注意：这个验证方法在 MCPService.inferTransportType 之后调用
  // 此时 config.type 应该已经被推断或显式设置
  if (!config.type) {
    throw new Error("传输类型未设置，这应该在 inferTransportType 中处理");
  }

  switch (config.type) {
    case MCPTransportType.STDIO:
      if (!config.command) {
        throw new Error("stdio 类型需要 command 字段");
      }
      break;

    case MCPTransportType.SSE:
      if (config.url === undefined || config.url === null) {
        throw new Error(`${config.type} 类型需要 url 字段`);
      }
      break;
    case MCPTransportType.STREAMABLE_HTTP:
      // STREAMABLE_HTTP 允许空 URL，会在后续处理中设置默认值
      if (config.url === undefined || config.url === null) {
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
  return [
    MCPTransportType.STDIO,
    MCPTransportType.SSE,
    MCPTransportType.STREAMABLE_HTTP,
  ];
}

/**
 * Transport 工厂对象（保持 API 兼容性）
 */
export const TransportFactory = {
  create: createTransport,
  validateConfig,
  getSupportedTypes,
};
