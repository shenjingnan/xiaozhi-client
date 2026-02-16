/**
 * HTTP 请求处理器模块
 *
 * 提供 Web API 的各种请求处理器，包括：
 * - ConfigApiHandler: 配置管理 API（获取、更新配置等）
 * - CozeHandler: 扣子（Coze）平台集成处理器
 * - HeartbeatHandler: 心跳检测处理器，用于保持连接活跃
 * - EndpointHandler: MCP 端点管理处理器
 * - MCPRouteHandler: MCP 协议路由处理器（符合 Streamable HTTP 规范）
 * - MCPHandler: MCP 服务管理处理器
 * - RealtimeNotificationHandler: 实时通知处理器（WebSocket）
 * - ServiceApiHandler: 服务控制处理器（启动、停止、重启服务等）
 * - StaticFileHandler: 静态文件服务处理器
 * - StatusApiHandler: 状态查询处理器
 * - MCPToolHandler: MCP 工具调用处理器
 * - MCPToolLogHandler: MCP 工具调用日志处理器
 * - TTSApiHandler: TTS 语音合成处理器
 * - UpdateApiHandler: 更新管理处理器
 * - VersionApiHandler: 版本信息处理器
 *
 * @example
 * ```typescript
 * import { ConfigApiHandler, MCPRouteHandler, StatusApiHandler } from '@/handlers';
 *
 * // 使用配置处理器
 * const configHandler = new ConfigApiHandler();
 * const response = await configHandler.getConfig(context);
 *
 * // 使用 MCP 路由处理器
 * const mcpHandler = new MCPRouteHandler({ maxMessageSize: 1024 * 1024 });
 * const mcpResponse = await mcpHandler.handlePost(context);
 * ```
 */
export * from "./config.handler.js";
export { CozeHandler } from "./coze.handler.js";
export { EndpointHandler } from "./endpoint.handler.js";
export { ESP32Handler } from "./esp32.handler.js";
export * from "./heartbeat.handler.js";
export * from "./mcp.handler.js";
export { MCPHandler } from "./mcp-manage.handler.js";
export * from "./mcp-tool.handler.js";
export * from "./mcp-tool-log.handler.js";
export * from "./realtime-notification.handler.js";
export * from "./service.handler.js";
export { StaticFileHandler } from "./static-file.handler.js";
export * from "./status.handler.js";
export { TTSApiHandler } from "./tts.handler.js";
export * from "./update.handler.js";
export * from "./version.handler.js";
