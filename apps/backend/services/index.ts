/**
 * 服务层模块统一导出入口
 *
 * 导出状态服务、通知服务和事件总线服务等业务服务
 *
 * @packageDocumentation
 */
export * from "./status.service.js";
export * from "./notification.service.js";
export * from "./event-bus.service.js";

// CustomMCPHandler 重新导出 - 保持向后兼容性
export { CustomMCPHandler } from "@/lib/mcp/custom.js";
