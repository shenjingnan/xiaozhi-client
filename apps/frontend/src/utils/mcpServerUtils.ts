/**
 * MCP 服务工具函数
 * 用于判断 MCP 服务的通信类型和其他相关操作
 */

import type {
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
} from "@xiaozhi/shared-types";

// 定义通信类型
export type MCPCommunicationType = "stdio" | "sse" | "streamable-http";

/**
 * 判断 MCP 服务的通信类型
 *
 * @param serverConfig MCP 服务配置对象
 * @returns 通信类型：'stdio' | 'sse' | 'streamable-http'
 *
 * 判断逻辑：
 * 1. 如果配置对象有 command 字段 → stdio
 * 2. 如果配置对象有 type 字段且值为 "sse" → sse
 * 3. 如果配置对象有 url 字段但没有 type 字段，或者 type 字段不是 "sse" → streamable-http
 *
 * @example
 * ```typescript
 * // stdio 类型
 * const stdioConfig = {
 *   command: "node",
 *   args: ["./mcpServers/calculator.js"]
 * };
 * getMcpServerCommunicationType(stdioConfig); // "stdio"
 *
 * // sse 类型
 * const sseConfig = {
 *   type: "sse" as const,
 *   url: "https://mcp.api-inference.modelscope.net/d3cfd34529ae4e/sse"
 * };
 * getMcpServerCommunicationType(sseConfig); // "sse"
 *
 * // streamable-http 类型
 * const httpConfig = {
 *   url: "https://mcp.amap.com/mcp?key=1ec31da021b2702787841ea4ee822de3"
 * };
 * getMcpServerCommunicationType(httpConfig); // "streamable-http"
 * ```
 */
export function getMcpServerCommunicationType(
  serverConfig: MCPServerConfig | Record<string, any>
): MCPCommunicationType {
  // 参数验证
  if (!serverConfig || typeof serverConfig !== "object") {
    throw new Error("服务配置必须是一个有效的对象");
  }

  // 1. 检查是否为 stdio 类型（有 command 字段）
  if ("command" in serverConfig && typeof serverConfig.command === "string") {
    return "stdio";
  }

  // 2. 检查是否为 sse 类型（有 type: "sse" 字段）
  if ("type" in serverConfig && serverConfig.type === "sse") {
    return "sse";
  }

  // 3. 检查是否为 streamable-http 类型（有 url 字段）
  if ("url" in serverConfig && typeof serverConfig.url === "string") {
    return "streamable-http";
  }

  // 如果都不匹配，抛出错误
  throw new Error(
    "无法识别的 MCP 服务配置类型。配置必须包含 command 字段（stdio）、type: 'sse' 字段（sse）或 url 字段（streamable-http）"
  );
}

/**
 * 检查 MCP 服务配置是否为 stdio 类型
 */
export function isStdioMcpServer(
  serverConfig: MCPServerConfig | Record<string, any>
): serverConfig is LocalMCPServerConfig {
  return getMcpServerCommunicationType(serverConfig) === "stdio";
}

/**
 * 检查 MCP 服务配置是否为 sse 类型
 */
export function isSSEMcpServer(
  serverConfig: MCPServerConfig | Record<string, any>
): serverConfig is SSEMCPServerConfig {
  return getMcpServerCommunicationType(serverConfig) === "sse";
}

/**
 * 检查 MCP 服务配置是否为 streamable-http 类型
 */
export function isStreamableHTTPMcpServer(
  serverConfig: MCPServerConfig | Record<string, any>
): serverConfig is StreamableHTTPMCPServerConfig {
  return getMcpServerCommunicationType(serverConfig) === "streamable-http";
}

/**
 * 获取 MCP 服务配置的显示名称
 * 用于在 UI 中显示更友好的通信类型名称
 */
export function getMcpServerTypeDisplayName(
  serverConfig: MCPServerConfig | Record<string, any>
): string {
  const type = getMcpServerCommunicationType(serverConfig);

  switch (type) {
    case "stdio":
      return "本地进程 (stdio)";
    case "sse":
      return "服务器推送 (SSE)";
    case "streamable-http":
      return "流式 HTTP";
    default:
      return "未知类型";
  }
}
