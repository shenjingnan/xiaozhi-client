import { MCPTransportType } from "./types.js";
import type { MCPServiceConfig } from "./types.js";

/**
 * 根据 URL 路径推断传输类型
 * 基于路径末尾推断，支持包含多个 / 的复杂路径
 *
 * @param url - 要推断的 URL
 * @param options - 可选配置项
 * @returns 推断出的传输类型
 */
export function inferTransportTypeFromUrl(
  url: string,
  options?: {
    serviceName?: string;
  }
): MCPTransportType {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;

    // 检查路径末尾
    if (pathname.endsWith("/sse")) {
      return MCPTransportType.SSE;
    }
    if (pathname.endsWith("/mcp")) {
      return MCPTransportType.STREAMABLE_HTTP;
    }

    // 默认类型 - 使用 console 输出
    if (options?.serviceName) {
      console.info(
        `[MCP-${options.serviceName}] URL 路径 ${pathname} 不匹配特定规则，默认推断为 streamable-http 类型`
      );
    }
    return MCPTransportType.STREAMABLE_HTTP;
  } catch (error) {
    if (options?.serviceName) {
      console.warn(
        `[MCP-${options.serviceName}] URL 解析失败，默认推断为 streamable-http 类型`,
        error
      );
    }
    return MCPTransportType.STREAMABLE_HTTP;
  }
}

/**
 * 完整的配置类型推断（包括 command 字段）
 *
 * @param config - MCP 服务配置
 * @returns 完整的配置对象，包含推断出的类型
 */
export function inferTransportTypeFromConfig(
  config: MCPServiceConfig
): MCPServiceConfig {
  // 如果已显式指定类型，直接返回
  if (config.type) {
    return config;
  }

  // 基于 command 字段推断
  if (config.command) {
    return {
      ...config,
      type: MCPTransportType.STDIO,
    };
  }

  // 基于 URL 字段推断（排除 null 和 undefined）
  if (config.url !== undefined && config.url !== null) {
    const inferredType = inferTransportTypeFromUrl(config.url, {
      serviceName: config.name,
    });
    return {
      ...config,
      type: inferredType,
    };
  }

  throw new Error(
    `无法为服务 ${config.name} 推断传输类型。请显式指定 type 字段，或提供 command/url 配置`
  );
}
