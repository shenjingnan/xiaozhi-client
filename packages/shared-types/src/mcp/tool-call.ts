/**
 * MCP 工具调用相关类型定义
 * 统一 packages/endpoint 和 packages/mcp-core 中的重复类型
 */

// =========================
// 1. 工具调用参数和结果类型
// =========================

/**
 * 工具调用参数接口
 */
export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * 验证后的工具调用参数
 */
export interface ValidatedToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * 工具调用错误码枚举
 */
export enum ToolCallErrorCode {
  /** 无效参数 */
  INVALID_PARAMS = -32602,
  /** 工具不存在 */
  TOOL_NOT_FOUND = -32601,
  /** 服务不可用 */
  SERVICE_UNAVAILABLE = -32001,
  /** 调用超时 */
  TIMEOUT = -32002,
  /** 工具执行错误 */
  TOOL_EXECUTION_ERROR = -32000,
}

/**
 * 工具调用错误类
 */
export class ToolCallError extends Error {
  constructor(
    public code: ToolCallErrorCode,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ToolCallError";
  }
}

// =========================
// 2. 连接状态枚举
// =========================

/**
 * 连接状态枚举
 * 合并了 packages/endpoint 和 packages/mcp-core 中的状态定义
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
  ERROR = "error",
}

// =========================
// 3. JSON Schema 类型
// =========================

/**
 * JSON Schema 类型定义
 * 兼容 MCP SDK 的 JSON Schema 格式
 */
export type ToolJSONSchema =
  | (Record<string, unknown> & {
      type: "object";
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    })
  | Record<string, unknown>;

/**
 * 确保对象符合 MCP Tool JSON Schema 格式
 * 返回类型兼容 MCP SDK 的 Tool 类型
 */
export function ensureToolJSONSchema(schema: ToolJSONSchema): {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  additionalProperties?: boolean;
} {
  if (
    typeof schema === "object" &&
    schema !== null &&
    "type" in schema &&
    schema.type === "object"
  ) {
    return schema as {
      type: "object";
      properties?: Record<string, object>;
      required?: string[];
      additionalProperties?: boolean;
    };
  }

  // 如果不符合标准格式，返回默认的空对象 schema
  return {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: true,
  };
}

// =========================
// 4. 增强工具信息类型
// =========================

/**
 * 增强的工具信息接口
 * 统一 packages/endpoint 和 packages/mcp-core 中的定义
 */
export interface EnhancedToolInfo {
  /** 工具唯一标识符，格式为 "{serviceName}__{originalName}" */
  name: string;
  /** 工具描述信息 */
  description: string;
  /** 工具输入参数的 JSON Schema 定义 */
  inputSchema: ToolJSONSchema;
  /** 工具所属的 MCP 服务名称 */
  serviceName: string;
  /** 工具在 MCP 服务中的原始名称 */
  originalName: string;
  /** 工具是否启用 */
  enabled: boolean;
  /** 工具使用次数统计 */
  usageCount: number;
  /** 工具最后使用时间 (ISO 8601 格式字符串) */
  lastUsedTime: string;
}
