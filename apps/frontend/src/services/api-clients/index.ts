/**
 * API 客户端模块统一导出
 * 提供独立的 API 客户端类，遵循单一职责原则
 */

export { HttpClient } from "./http-client";
export type { ApiResponse } from "./http-client";

export { ConfigApiClient } from "./config-api";
export type { PromptFileInfo } from "./config-api";

export { StatusApiClient } from "./status-api";
export type { RestartStatus, FullStatus } from "./status-api";

export { ToolApiClient } from "./tool-api";
export type { CustomMCPTool } from "./tool-api";

export { ServiceControlApiClient } from "./service-api";
export type { ServiceStatus, ServiceHealth } from "./service-api";

export { VersionApiClient } from "./version-api";
export type { VersionInfo } from "./version-api";

export { EndpointApiClient } from "./endpoint-api";
export type { EndpointStatusResponse } from "./endpoint-api";

export { MCPServerApiClient } from "./mcp-server-api";

export { MCPToolApiClient } from "./mcp-tool-api";
export type {
  MCPToolManageRequest,
  MCPToolManageResponse,
  MCPToolListRequest,
  MCPToolListResponse,
} from "./mcp-tool-api";
