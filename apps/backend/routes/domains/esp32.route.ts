/**
 * ESP32设备路由模块
 * 处理所有ESP32设备相关的API路由
 *
 * 硬件API定义：
 * - POST /              # OTA/配置获取（根路径，按硬件定义）
 * - WebSocket /ws       # WebSocket连接
 *
 * 管理API（保留 /api/esp32 前缀）：
 * - GET    /api/esp32/devices              # 设备列表
 * - GET    /api/esp32/devices/:deviceId     # 获取设备
 * - DELETE /api/esp32/devices/:deviceId     # 删除设备
 *
 * 注意：设备激活已改为自动激活，不再需要激活码
 */

import type { Context } from "hono";
import type { RouteDefinition } from "../types.js";
import { type HandlerDependencies, createHandler } from "../types.js";

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
      // WebSocket升级由WebServer的ws服务器处理
      return c.json({ message: "WebSocket endpoint" });
    }),
  },

  // ========== 管理API（保留 /api/esp32 前缀） ==========

  // 获取设备列表
  {
    method: "GET",
    path: "/api/esp32/devices",
    handler: createESP32Handler((handler, c) => handler.listDevices(c)),
  },

  // 获取单个设备信息
  {
    method: "GET",
    path: "/api/esp32/devices/:deviceId",
    handler: createESP32Handler((handler, c) => handler.getDevice(c)),
  },

  // 获取设备状态
  {
    method: "GET",
    path: "/api/esp32/devices/:deviceId/status",
    handler: createESP32Handler((handler, c) => handler.getDeviceStatus(c)),
  },

  // 断开设备连接
  {
    method: "POST",
    path: "/api/esp32/devices/:deviceId/disconnect",
    handler: createESP32Handler((handler, c) => handler.disconnectDevice(c)),
  },

  // 删除设备
  {
    method: "DELETE",
    path: "/api/esp32/devices/:deviceId",
    handler: createESP32Handler((handler, c) => handler.deleteDevice(c)),
  },
];
