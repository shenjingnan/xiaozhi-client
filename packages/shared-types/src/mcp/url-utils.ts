/**
 * MCP URL 工具函数
 * 提供 URL 相关的推断和验证功能
 */

/**
 * MCP 传输类型枚举
 * 与 @xiaozhi-client/mcp-core 中的定义保持一致
 */
export enum MCPTransportType {
  STDIO = "stdio",
  SSE = "sse",
  HTTP = "http",
}

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
      return MCPTransportType.HTTP;
    }

    // 默认类型 - 使用 console 输出
    if (options?.serviceName) {
      console.info(
        `[MCP-${options.serviceName}] URL 路径 ${pathname} 不匹配特定规则，默认推断为 http 类型`
      );
    }
    return MCPTransportType.HTTP;
  } catch (error) {
    if (options?.serviceName) {
      console.warn(
        `[MCP-${options.serviceName}] URL 解析失败，默认推断为 http 类型`,
        error
      );
    }
    return MCPTransportType.HTTP;
  }
}
