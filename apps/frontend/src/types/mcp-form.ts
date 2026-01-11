/**
 * MCP 服务表单相关的类型定义
 * 用于表单模式下的数据结构和验证
 */

/**
 * MCP 服务类型枚举
 */
export type McpServiceType = "stdio" | "http" | "sse";

/**
 * stdio 类型表单字段
 */
export interface StdioFormFields {
  /** MCP 服务名称 */
  name: string;
  /** 完整命令字符串，如 "npx -y @z_ai/mcp-server" */
  command: string;
  /** 多行环境变量文本 */
  env: string;
}

/**
 * 远程服务 (http/sse) 类型表单字段
 */
export interface RemoteFormFields {
  /** MCP 服务名称 */
  name: string;
  /** 服务 URL 地址 */
  url: string;
  /** 多行请求头文本 */
  headers: string;
}

/**
 * stdio 类型完整表单数据
 */
export interface StdioFormData {
  type: "stdio";
  name: string;
  command: string;
  env: string;
}

/**
 * http 类型完整表单数据
 */
export interface HttpFormData {
  type: "http";
  name: string;
  url: string;
  headers: string;
}

/**
 * sse 类型完整表单数据
 */
export interface SseFormData {
  type: "sse";
  name: string;
  url: string;
  headers: string;
}

/**
 * MCP 服务表单数据联合类型
 */
export type McpServerFormData = StdioFormData | HttpFormData | SseFormData;
