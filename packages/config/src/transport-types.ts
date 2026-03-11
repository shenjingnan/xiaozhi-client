/**
 * MCP 传输类型定义
 * 定义在 config 包中，避免与 mcp-core 包的循环依赖
 */

/**
 * 通信方式枚举
 * 定义 MCP 支持的传输类型
 */
export enum MCPTransportType {
  STDIO = "stdio",
  SSE = "sse",
  HTTP = "http",
}

/**
 * 传输类型字符串字面量
 * 方便外部用户直接使用字符串而不需要导入枚举
 */
export type MCPTransportTypeString = "stdio" | "sse" | "http";

/**
 * 传输类型输入值（枚举或字符串字面量）
 */
export type MCPTransportTypeInput = MCPTransportType | MCPTransportTypeString;

/**
 * 传输类型推断选项
 */
export interface InferTransportTypeOptions {
  /** 服务名称（用于日志输出） */
  serviceName?: string;
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
  options?: InferTransportTypeOptions
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
