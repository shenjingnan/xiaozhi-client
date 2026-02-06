/**
 * ESP32设备路由模块
 * 处理所有ESP32设备相关的API路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("esp32Handler");

/**
 * ESP32设备路由定义
 */
export const esp32Routes: RouteDefinition[] = [
  // 设备激活/OTA接口
  {
    method: "POST",
    path: "/api/esp32/ota",
    handler: h((handler, c) => handler.handleOTA(c)),
  },

  // 设备绑定接口
  {
    method: "POST",
    path: "/api/esp32/bind/:code",
    handler: h((handler, c) => handler.bindDevice(c)),
  },

  // 获取设备列表
  {
    method: "GET",
    path: "/api/esp32/devices",
    handler: h((handler, c) => handler.listDevices(c)),
  },

  // 获取单个设备信息
  {
    method: "GET",
    path: "/api/esp32/devices/:deviceId",
    handler: h((handler, c) => handler.getDevice(c)),
  },

  // 获取设备状态
  {
    method: "GET",
    path: "/api/esp32/devices/:deviceId/status",
    handler: h((handler, c) => handler.getDeviceStatus(c)),
  },

  // 断开设备连接
  {
    method: "POST",
    path: "/api/esp32/devices/:deviceId/disconnect",
    handler: h((handler, c) => handler.disconnectDevice(c)),
  },

  // 删除设备
  {
    method: "DELETE",
    path: "/api/esp32/devices/:deviceId",
    handler: h((handler, c) => handler.deleteDevice(c)),
  },

  // WebSocket升级（由WebServer直接处理，这里仅作为占位符）
  {
    method: "GET",
    path: "/api/esp32/ws",
    handler: h(async (handler, c) => {
      c.get("logger").debug("ESP32 WebSocket端点访问");
      // WebSocket升级由WebServer的ws服务器处理
      return c.json({ message: "WebSocket endpoint" });
    }),
  },
];
