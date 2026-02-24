/**
 * MCP 传输层工厂模块
 *
 * 提供创建不同类型传输层实例的工厂函数
 * 支持 STDIO、SSE、StreamableHTTP 三种传输协议
 *
 * @module transport-factory
 */

import type { SSEClientTransportOptions } from "@modelcontextprotocol/sdk/client/sse.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StreamableHTTPClientTransportOptions } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { EventSource } from "eventsource";
import type { InternalMCPServiceConfig, MCPServerTransport } from "./types.js";
import { MCPTransportType } from "./types.js";
import { createLogger } from "./utils/index.js";

// 全局 polyfill EventSource（用于 SSE）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalThisAny: any =
  typeof globalThis !== "undefined" ? globalThis : global;
if (typeof globalThisAny !== "undefined" && !globalThisAny.EventSource) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  globalThisAny.EventSource = EventSource;
}

// 创建日志实例
const logger = createLogger("TransportFactory");

// Transport 基础接口
export interface Transport {
  connect?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * 创建 transport 实例
 * @param config MCP 服务配置（包含 name）
 * @returns transport 实例
 */
export function createTransport(
  config: InternalMCPServiceConfig
): MCPServerTransport {
  logger.debug(`创建 ${config.type} transport for ${config.name}`);

  switch (config.type) {
    case MCPTransportType.STDIO:
      return createStdioTransport(config);

    case MCPTransportType.SSE:
      return createSSETransport(config);

    case MCPTransportType.HTTP:
      return createHTTPTransport(config);

    default:
      throw new Error(`不支持的传输类型: ${config.type}`);
  }
}

/**
 * 创建 Stdio transport
 */
function createStdioTransport(
  config: InternalMCPServiceConfig
): StdioClientTransport {
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
function createSSETransport(
  config: InternalMCPServiceConfig
): SSEClientTransport {
  if (!config.url) {
    throw new Error("SSE transport 需要 URL 配置");
  }

  const url = new URL(config.url);
  const options = createSSEOptions(config);

  return new SSEClientTransport(url, options);
}

function createHTTPTransport(
  config: InternalMCPServiceConfig
): StreamableHTTPClientTransport {
  if (!config.url) {
    throw new Error("HTTP transport 需要 URL 配置");
  }

  const url = new URL(config.url);
  const options = createStreamableHTTPOptions(config);
  return new StreamableHTTPClientTransport(url, options);
}

/**
 * 创建认证请求头
 */
function createAuthHeaders(
  config: InternalMCPServiceConfig
): Record<string, string> | undefined {
  if (config.apiKey) {
    return {
      Authorization: `Bearer ${config.apiKey}`,
      ...config.headers,
    };
  }
  return config.headers;
}

/**
 * 创建 SSE 选项
 */
function createSSEOptions(
  config: InternalMCPServiceConfig
): SSEClientTransportOptions {
  const options: SSEClientTransportOptions = {};

  const headers = createAuthHeaders(config);
  if (headers) {
    options.requestInit = {
      headers,
    };
  }

  return options;
}

function createStreamableHTTPOptions(
  config: InternalMCPServiceConfig
): StreamableHTTPClientTransportOptions {
  const options: StreamableHTTPClientTransportOptions = {};

  const headers = createAuthHeaders(config);
  if (headers) {
    options.requestInit = {
      headers,
    };
  }

  return options;
}

/**
 * 验证配置
 * 注意：name 验证已在 MCPConnection 构造函数中进行
 * @param config MCP 服务配置（包含 name）
 */
export function validateConfig(config: InternalMCPServiceConfig): void {
  // name 验证已移至 MCPConnection 构造函数

  // type 字段现在是可选的，由 MCPService 自动推断
  // 这里我们只验证如果 type 存在，必须是有效的类型
  if (
    config.type &&
    !Object.values(MCPTransportType).includes(config.type as MCPTransportType)
  ) {
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
    case MCPTransportType.HTTP:
      // HTTP 允许空 URL，会在后续处理中设置默认值
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
  return [MCPTransportType.STDIO, MCPTransportType.SSE, MCPTransportType.HTTP];
}

/**
 * Transport 工厂对象（保持 API 兼容性）
 */
export const TransportFactory = {
  create: createTransport,
  validateConfig,
  getSupportedTypes,
};
