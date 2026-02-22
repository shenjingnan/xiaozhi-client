/**
 * ESP32设备路由模块
 * 处理ESP32设备相关的API路由
 *
 * 硬件API定义：
 * - POST /              # OTA/配置获取（根路径，按硬件定义）
 * - POST /xiaozhi/ota/  # 小智硬件官方OTA路径（兼容）
 * - WebSocket /ws       # WebSocket连接
 *
 * 注意：设备采用自动激活模式，无需管理API
 */

import type { RouteDefinition } from "@/routes/types.js";
import { type HandlerDependencies, createHandler } from "@/routes/types.js";
import type { Context } from "hono";

const h = createHandler("esp32Handler");

/**
 * 创建 ESP32 路由处理器（带可选检查）
 */
const createESP32Handler = (
  method: (
    handler: NonNullable<HandlerDependencies["esp32Handler"]>,
    c: Context
  ) => Promise<Response>
) => {
  return async (c: Context) => {
    const dependencies = c.get("dependencies") as HandlerDependencies;
    const handler = dependencies.esp32Handler;
    if (!handler) {
      return c.json({ error: "ESP32 service not available" }, 503);
    }
    return method(handler, c);
  };
};

/**
 * ESP32设备路由定义
 */
export const esp32Routes: RouteDefinition[] = [
  // ========== 硬件API（按硬件定义的路径） ==========

  // 硬件 OTA/配置接口（根路径）
  {
    method: "POST",
    path: "/",
    handler: createESP32Handler((handler, c) => handler.handleOTA(c)),
  },

  // 小智硬件官方 OTA 路径（兼容硬件默认配置）
  {
    method: "POST",
    path: "/xiaozhi/ota/",
    handler: createESP32Handler((handler, c) => handler.handleOTA(c)),
  },

  // WebSocket端点（由WebServer直接处理，这里仅作为占位符）
  {
    method: "GET",
    path: "/ws",
    handler: createESP32Handler(async (handler, c) => {
      c.get("logger").debug("ESP32 WebSocket端点访问");
      // 返回 426 Upgrade Required，明确提示需要 WebSocket 升级
      return c.text("WebSocket Upgrade Required", 426);
    }),
  },
];
