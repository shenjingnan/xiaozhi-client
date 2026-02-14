/**
 * 业务服务层模块
 *
 * 提供后端核心业务服务，包括：
 * - StatusService: 统一的状态管理服务，管理客户端连接状态、MCP 服务状态等
 * - NotificationService: 通知服务，处理系统通知和消息推送
 * - EventBus / getEventBus: 事件总线服务，提供发布-订阅模式的事件处理机制
 * - CustomMCPHandler: 自定义 MCP 处理器（重新导出，保持向后兼容性）
 *
 * @example
 * ```typescript
 * import { StatusService, NotificationService, getEventBus } from '@/services';
 *
 * // 使用状态服务
 * const statusService = new StatusService();
 * const status = statusService.getFullStatus();
 *
 * // 使用事件总线
 * const eventBus = getEventBus();
 * eventBus.onEvent('event-name', (data) => {
 *   console.log('Event received:', data);
 * });
 * ```
 */
export * from "./status.service.js";
export * from "./notification.service.js";
export * from "./event-bus.service.js";
export * from "./coze-tool.service.js";

// CustomMCPHandler 重新导出 - 保持向后兼容性
export { CustomMCPHandler } from "@/lib/mcp/custom.js";
