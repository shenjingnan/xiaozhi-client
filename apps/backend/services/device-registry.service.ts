/**
 * 设备注册管理服务
 * 负责ESP32设备的信息存储和管理
 *
 * 简化版本：设备首次连接时自动激活，无需激活码
 */

import { logger } from "@/Logger.js";
import type { ESP32Device, ESP32DeviceStatus } from "@/types/esp32.js";

/**
 * 设备注册管理服务
 * 使用内存存储设备信息，可扩展为数据库或Redis
 */
export class DeviceRegistryService {
  /** 已激活设备映射（设备ID -> 设备信息） */
  private activeDevices: Map<string, ESP32Device>;

  constructor() {
    this.activeDevices = new Map();
  }

  /**
   * 创建新设备（自动激活）
   * @param deviceId - 设备ID（MAC地址）
   * @param board - 硬件型号
   * @param appVersion - 固件版本
   * @returns 创建的设备信息
   */
  createDevice(
    deviceId: string,
    board: string,
    appVersion: string
  ): ESP32Device {
    const now = new Date();
    const device: ESP32Device = {
      deviceId,
      macAddress: deviceId,
      board,
      appVersion,
      status: "active",
      createdAt: now,
      lastSeenAt: now,
    };

    this.activeDevices.set(deviceId, device);
    logger.info(
      `自动激活新设备: deviceId=${deviceId}, board=${board}, appVersion=${appVersion}`
    );

    return device;
  }

  /**
   * 获取已激活设备
   * @param deviceId - 设备ID
   * @returns 设备信息，如果不存在则返回null
   */
  getDevice(deviceId: string): ESP32Device | null {
    return this.activeDevices.get(deviceId) ?? null;
  }

  /**
   * 更新设备状态
   * @param deviceId - 设备ID
   * @param status - 新状态
   */
  updateDeviceStatus(deviceId: string, status: ESP32DeviceStatus): void {
    const device = this.activeDevices.get(deviceId);
    if (!device) {
      logger.warn(`设备不存在，无法更新状态: ${deviceId}`);
      return;
    }

    device.status = status;
    logger.debug(`设备状态已更新: deviceId=${deviceId}, status=${status}`);
  }

  /**
   * 更新设备最后活跃时间
   * @param deviceId - 设备ID
   */
  updateLastSeen(deviceId: string): void {
    const device = this.activeDevices.get(deviceId);
    if (!device) {
      logger.warn(`设备不存在，无法更新最后活跃时间: ${deviceId}`);
      return;
    }

    device.lastSeenAt = new Date();
    logger.debug(`设备最后活跃时间已更新: deviceId=${deviceId}`);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.activeDevices.clear();
    logger.debug("设备注册服务已销毁");
  }
}
