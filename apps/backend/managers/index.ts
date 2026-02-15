/**
 * 管理器统一导出模块
 *
 * 提供 WebServer 管理器的统一导出接口
 *
 * @packageDocumentation
 */

export { MiddlewareManager } from "./MiddlewareManager.js";
export type { MiddlewareManagerOptions } from "./MiddlewareManager.js";

export { WebSocketManager } from "./WebSocketManager.js";
export type { WebSocketManagerOptions } from "./WebSocketManager.js";

export { EventCoordinator } from "./EventCoordinator.js";
export type { EventCoordinatorOptions } from "./EventCoordinator.js";

export { HandlerRegistry } from "./HandlerRegistry.js";
export type { HandlerName } from "./HandlerRegistry.js";
