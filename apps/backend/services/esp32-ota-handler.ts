/**
 * ESP32 OTA 处理器
 * 负责处理设备的 OTA（Over-The-Air）请求
 */

import { logger } from "@/Logger.js";
import type { ESP32DeviceReport, ESP32OTAResponse } from "@/types/esp32.js";
import { camelToSnakeCase, extractDeviceInfo } from "@/utils/esp32-utils.js";
import type { DeviceRegistryService } from "./device-registry.service.js";

/**
 * ESP32 OTA 处理器
 * 处理设备激活、固件升级和 WebSocket 配置返回
 */
export class ESP32OTAHandler {
  /** 设备注册服务 */
  private deviceRegistry: DeviceRegistryService;

  /**
   * 构造函数
   * @param deviceRegistry - 设备注册服务
   */
  constructor(deviceRegistry: DeviceRegistryService) {
    this.deviceRegistry = deviceRegistry;
  }

  /**
   * 处理 OTA 请求
   * 设备首次连接时自动激活，直接返回 WebSocket 配置
   * @param deviceId - 设备ID（MAC地址）
   * @param clientId - 客户端ID（设备UUID）
   * @param report - 设备上报信息
   * @param headerInfo - 从请求头获取的设备信息（优先级高于 body）
   * @param host - 请求的 Host 头（格式：IP:PORT 或 DOMAIN:PORT）
   * @returns OTA 响应
   */
  async handleOTARequest(
    deviceId: string,
    clientId: string,
    report: ESP32DeviceReport,
    headerInfo?: { deviceModel?: string; deviceVersion?: string },
    host?: string
  ): Promise<ESP32OTAResponse> {
    logger.info(`收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`);

    // 使用工具方法提取设备信息（支持多级回退机制）
    const { boardType, appVersion } = extractDeviceInfo(report, headerInfo);

    // 检查设备是否已存在
    let device = this.deviceRegistry.getDevice(deviceId);

    if (!device) {
      // 设备不存在，自动创建并激活
      device = this.deviceRegistry.createDevice(
        deviceId,
        boardType,
        appVersion
      );
      logger.info(`新设备自动激活: deviceId=${deviceId}`);
    }

    // 更新最后活跃时间
    this.deviceRegistry.updateLastSeen(deviceId);

    // 获取服务器地址（从请求中获取）
    if (!host) {
      throw new Error("无法获取服务器地址：缺少 Host 头", {
        cause: "MISSING_HOST_HEADER",
      });
    }

    // 如果 host 不包含端口，添加默认端口
    const serverAddress = host.includes(":") ? host : `${host}:9999`;

    // 构建完整的 WebSocket URL
    const wsUrl = `ws://${serverAddress}/ws`;

    logger.info(
      `返回WebSocket配置: deviceId=${deviceId}, clientId=${clientId}, wsUrl=${wsUrl}`
    );

    const response = {
      websocket: {
        url: wsUrl,
        token: "", // 简化为空字符串（向后兼容）
        version: 2,
      },
      serverTime: {
        timestamp: Date.now(),
        // getTimezoneOffset() 返回本地时区与 UTC 的分钟差
        // 乘以 -60 * 1000 转换为毫秒，并取负值使偏移量为正（东时区为正）
        timezoneOffset: new Date().getTimezoneOffset() * -60 * 1000,
      },
      firmware: {
        version: "2.2.2",
        url: "",
        force: false,
      },
    };

    // 转换为下划线命名后返回
    return camelToSnakeCase(response) as ESP32OTAResponse;
  }
}
