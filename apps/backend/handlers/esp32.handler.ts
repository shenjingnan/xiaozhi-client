/**
 * ESP32设备处理器
 * 处理ESP32设备相关的HTTP请求
 */

import type { ESP32Service } from "@/services/esp32.service.js";
import type { ESP32DeviceReport } from "@/types/esp32.js";
import { ESP32ErrorCode } from "@/types/esp32.js";
import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";
import { BaseHandler } from "./base.handler.js";

/**
 * ESP32设备处理器
 * 处理ESP32设备的管理操作
 *
 * 注意：设备激活已改为自动激活，不再需要手动输入激活码
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

      console.log(response);
      return c.json(response);
    } catch (error) {
      return this.handleError(c, error, "处理OTA请求");
    }
  }

  /**
   * 获取设备列表
   * GET /api/esp32/devices
   */
  async listDevices(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");

    try {
      const response = await this.esp32Service.listDevices();

      logger.debug(`获取设备列表: total=${response.total}`);

      return c.success(response);
    } catch (error) {
      return this.handleError(c, error, "获取设备列表");
    }
  }

  /**
   * 获取单个设备信息
   * GET /api/esp32/devices/:deviceId
   */
  async getDevice(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");

    try {
      const deviceId = c.req.param("deviceId");
      if (!deviceId) {
        return c.fail(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少设备ID",
          undefined,
          400
        );
      }

      const device = await this.esp32Service.getDevice(deviceId);

      if (!device) {
        return c.fail(
          ESP32ErrorCode.DEVICE_NOT_FOUND,
          "设备不存在",
          undefined,
          404
        );
      }

      logger.debug(`获取设备信息: deviceId=${deviceId}`);

      return c.success(device);
    } catch (error) {
      return this.handleError(c, error, "获取设备信息");
    }
  }

  /**
   * 删除设备
   * DELETE /api/esp32/devices/:deviceId
   */
  async deleteDevice(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");

    try {
      const deviceId = c.req.param("deviceId");
      if (!deviceId) {
        return c.fail(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少设备ID",
          undefined,
          400
        );
      }

      await this.esp32Service.deleteDevice(deviceId);

      logger.info(`设备已删除: deviceId=${deviceId}`);

      return c.success(undefined, "设备已删除");
    } catch (error) {
      // 检查是否是设备不存在错误
      if (
        error instanceof Error &&
        error.cause === ESP32ErrorCode.DEVICE_NOT_FOUND
      ) {
        return c.fail(
          ESP32ErrorCode.DEVICE_NOT_FOUND,
          "设备不存在",
          undefined,
          404
        );
      }

      return this.handleError(c, error, "删除设备");
    }
  }

  /**
   * 断开设备连接
   * POST /api/esp32/devices/:deviceId/disconnect
   */
  async disconnectDevice(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");

    try {
      const deviceId = c.req.param("deviceId");
      if (!deviceId) {
        return c.fail(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少设备ID",
          undefined,
          400
        );
      }

      await this.esp32Service.disconnectDevice(deviceId);

      logger.info(`设备连接已断开: deviceId=${deviceId}`);

      return c.success(undefined, "设备连接已断开");
    } catch (error) {
      return this.handleError(c, error, "断开设备连接");
    }
  }

  /**
   * 获取设备连接状态
   * GET /api/esp32/devices/:deviceId/status
   */
  async getDeviceStatus(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");

    try {
      const deviceId = c.req.param("deviceId");
      if (!deviceId) {
        return c.fail(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少设备ID",
          undefined,
          400
        );
      }

      const device = await this.esp32Service.getDevice(deviceId);

      if (!device) {
        return c.fail(
          ESP32ErrorCode.DEVICE_NOT_FOUND,
          "设备不存在",
          undefined,
          404
        );
      }

      logger.debug(
        `获取设备状态: deviceId=${deviceId}, status=${device.status}`
      );

      return c.success({
        deviceId: device.deviceId,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        connected: device.status === "active",
      });
    } catch (error) {
      return this.handleError(c, error, "获取设备状态");
    }
  }
}
