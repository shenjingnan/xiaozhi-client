import { MCP_SERVICE_NAMES } from "@/constants/mcp";
import type { CustomMCPToolWithStats, JSONSchema } from "@xiaozhi-client/shared-types";

/**
 * 格式化后的工具信息
 */
export interface FormattedToolInfo {
  /** 工具名称（内部标识符） */
  name: string;
  /** 服务名称 */
  serverName: string;
  /** 工具显示名称 */
  toolName: string;
  /** 工具描述 */
  description?: string;
  /** 使用次数 */
  usageCount?: number;
  /** 最后使用时间 */
  lastUsedTime?: string;
  /** 输入模式 */
  inputSchema?: JSONSchema;
  /** 是否启用（已弃用，使用 enabled） */
  enable?: boolean;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 从工具对象中提取服务名称和工具名称
 * @param tool - 工具对象
 * @returns 服务名称和工具名称
 */
function extractServiceAndToolName(
  tool: CustomMCPToolWithStats
): { serviceName: string; toolName: string } {
  // 安全检查：确保 handler 存在
  if (!tool || !tool.handler) {
    return {
      serviceName: MCP_SERVICE_NAMES.UNKNOWN,
      toolName: tool?.name || MCP_SERVICE_NAMES.UNKNOWN,
    };
  }

  // MCP 类型工具
  if (tool.handler.type === "mcp") {
    return {
      serviceName:
        tool.handler.config?.serviceName || MCP_SERVICE_NAMES.UNKNOWN,
      toolName: tool.handler.config?.toolName || tool.name,
    };
  }

  // Coze 代理类型工具
  if (tool.handler.type === "proxy" && tool.handler.platform === "coze") {
    return {
      serviceName: "customMCP",
      toolName: tool.name,
    };
  }

  // 默认自定义服务
  return {
    serviceName: MCP_SERVICE_NAMES.CUSTOM,
    toolName: tool.name,
  };
}

/**
 * 格式化工具信息
 * @param tool - 原始工具对象
 * @param enabled - 是否启用
 * @returns 格式化后的工具信息
 */
export function formatToolInfo(
  tool: CustomMCPToolWithStats,
  enabled: boolean
): FormattedToolInfo {
  const { serviceName, toolName } = extractServiceAndToolName(tool);

  return {
    name: tool.name,
    serverName: serviceName,
    toolName,
    enable: enabled,
    enabled,
    description: tool.description,
    usageCount: tool.usageCount,
    lastUsedTime: tool.lastUsedTime,
    inputSchema: tool.inputSchema,
  };
}
