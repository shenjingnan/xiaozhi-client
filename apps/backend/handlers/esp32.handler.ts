/**
 * ESP32设备处理器
 * 处理ESP32设备相关的HTTP请求
 */

import type { Context } from "hono";
import type { ESP32Service } from "@/services/esp32.service.js";
import type { ESP32DeviceReport } from "@/types/esp32.js";
import { ESP32ErrorCode } from "@/types/esp32.js";
import type { AppContext } from "@/types/hono.context.js";
import { BaseHandler } from "./base.handler.js";

/**
 * ESP32设备处理器
 * 仅处理硬件OTA/配置请求
 *
 * 注意：设备采用自动激活模式，无需管理API
 */
export class ESP32Handler extends BaseHandler {
  private esp32Service: ESP32Service;

  constructor(esp32Service: ESP32Service) {
    super();
    this.esp32Service = esp32Service;
  }

  /**
   * 处理OTA/配置请求
   * POST /
   *
   * 硬件API定义：根路径OTA接口
   *
   * 请求头：
   * - Device-Id: 设备MAC地址
   * - Client-Id: 设备UUID
   *
   * 请求体：
   * ```json
   * {
   *   "application": {
   *     "version": "1.0.0",
   *     "board": {
   *       "type": "ESP32-S3-BOX"
   *     }
   *   }
   * }
   * ```
   */
  async handleOTA(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");

    try {
      // 获取设备ID和客户端ID
      const deviceId = c.req.header("Device-Id") || c.req.header("device-id");
      const clientId = c.req.header("Client-Id") || c.req.header("client-id");

      if (!deviceId) {
        return c.fail(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少 Device-Id 请求头",
          undefined,
          400
        );
      }

      // Client-Id 强制要求
      if (!clientId) {
        return c.fail(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少 Client-Id 请求头",
          undefined,
          400
        );
      }

      // 解析请求体
      const report: ESP32DeviceReport = await this.parseJsonBody(
        c,
        "请求体格式错误"
      );

      logger.debug(`收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`);

      // 委托给服务层处理（支持从请求头获取设备型号，与 xiaozhi-esp32-server 保持一致）
      const response = await this.esp32Service.handleOTARequest(
        deviceId,
        clientId,
        report,
        // 可选：从请求头获取设备信息（优先级高于 body）
        {
          deviceModel:
            c.req.header("device-model") ||
            c.req.header("Device-Model") ||
            undefined,
          deviceVersion:
            c.req.header("device-version") ||
            c.req.header("Device-Version") ||
            undefined,
        },
        c.req.header("host") // 传递 Host 头用于构建完整 WebSocket URL
      );

      logger.debug("OTA响应", { response });
      return c.json(response);
    } catch (error) {
      return this.handleError(c, error, "处理OTA请求");
    }
  }
}
