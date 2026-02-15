/**
 * 设备注册管理服务
 * 负责ESP32设备的激活码生成、验证和设备信息存储
 */

import { logger } from "@/Logger.js";
import type {
  ESP32Device,
  ESP32DeviceStatus,
  ESP32PendingDevice,
} from "@/types/esp32.js";

/**
 * 激活码配置
 */
const ACTIVATION_CODE_LENGTH = 6;
const ACTIVATION_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟

/**
 * 生成随机激活码
 * @returns 6位数字字符串
 */
function generateRandomCode(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(ACTIVATION_CODE_LENGTH, "0");
}

/**
 * 生成挑战字符串
 * @returns 随机挑战字符串
 */
function generateChallenge(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 设备注册管理服务
 * 使用内存存储设备信息，可扩展为数据库或Redis
 */
export class DeviceRegistryService {
  /** 待激活设备映射（激活码 -> 设备信息） */
  private pendingDevices: Map<string, ESP32PendingDevice>;

  /** 已激活设备映射（设备ID -> 设备信息） */
  private activeDevices: Map<string, ESP32Device>;

  /** 设备ID到激活码的映射（用于查找待激活设备） */
  private deviceIdToCode: Map<string, string>;

  constructor() {
    this.pendingDevices = new Map();
    this.activeDevices = new Map();
    this.deviceIdToCode = new Map();
  }

  /**
   * 生成激活码
   * @param deviceId - 设备ID（MAC地址）
   * @param board - 硬件型号
   * @param appVersion - 固件版本
   * @returns 激活信息
   */
  generateActivationCode(
    deviceId: string,
    board: string,
    appVersion: string
  ): { code: string; challenge: string } {
    // 检查设备是否已激活
    if (this.activeDevices.has(deviceId)) {
      logger.debug(`设备 ${deviceId} 已激活，跳过激活码生成`);
      throw new Error("设备已激活");
    }

    // 检查是否有待处理的激活码
    const existingCode = this.deviceIdToCode.get(deviceId);
    if (existingCode) {
      const existingDevice = this.pendingDevices.get(existingCode);
      if (existingDevice) {
        // 检查是否过期
        const now = Date.now();
        const createdAt = existingDevice.createdAt.getTime();
        if (now - createdAt < ACTIVATION_CODE_EXPIRY_MS) {
          logger.debug(`设备 ${deviceId} 已有有效激活码 ${existingCode}`);
          return {
            code: existingCode,
            challenge: existingDevice.challenge,
          };
        }
        // 过期则清理
        this.pendingDevices.delete(existingCode);
        this.deviceIdToCode.delete(deviceId);
      }
    }

    // 生成新的激活码
    const code = generateRandomCode();
    const challenge = generateChallenge();

    const pendingDevice: ESP32PendingDevice = {
      deviceId,
      code,
      challenge,
      board,
      appVersion,
      createdAt: new Date(),
    };

    this.pendingDevices.set(code, pendingDevice);
    this.deviceIdToCode.set(deviceId, code);

    logger.info(`生成设备激活码: deviceId=${deviceId}, code=${code}`);

    return { code, challenge };
  }

  /**
   * 验证激活码
   * @param code - 激活码
   * @returns 设备ID，如果激活码无效则返回null
   */
  verifyActivationCode(code: string): string | null {
    const pendingDevice = this.pendingDevices.get(code);
    if (!pendingDevice) {
      logger.debug(`激活码无效: ${code}`);
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const createdAt = pendingDevice.createdAt.getTime();
    if (now - createdAt > ACTIVATION_CODE_EXPIRY_MS) {
      logger.debug(`激活码已过期: ${code}`);
      this.pendingDevices.delete(code);
      this.deviceIdToCode.delete(pendingDevice.deviceId);
      return null;
    }

    logger.debug(`激活码验证成功: ${code}, deviceId=${pendingDevice.deviceId}`);
    return pendingDevice.deviceId;
  }

  /**
   * 获取待激活设备
   * @param deviceId - 设备ID
   * @returns 待激活设备信息，如果不存在则返回null
   */
  getPendingDevice(deviceId: string): ESP32PendingDevice | null {
    const code = this.deviceIdToCode.get(deviceId);
    if (!code) {
      return null;
    }

    const pendingDevice = this.pendingDevices.get(code);
    if (!pendingDevice) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const createdAt = pendingDevice.createdAt.getTime();
    if (now - createdAt > ACTIVATION_CODE_EXPIRY_MS) {
      this.pendingDevices.delete(code);
      this.deviceIdToCode.delete(deviceId);
      return null;
    }

    return pendingDevice;
  }

  /**
   * 激活设备
   * @param code - 激活码
   * @param userId - 用户ID（可选）
   * @returns 已激活的设备信息，如果激活码无效则返回null
   */
  activateDevice(code: string, userId?: string): ESP32Device | null {
    const pendingDevice = this.pendingDevices.get(code);
    if (!pendingDevice) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const createdAt = pendingDevice.createdAt.getTime();
    if (now - createdAt > ACTIVATION_CODE_EXPIRY_MS) {
      this.pendingDevices.delete(code);
      this.deviceIdToCode.delete(pendingDevice.deviceId);
      return null;
    }

    // 创建已激活设备
    const device: ESP32Device = {
      deviceId: pendingDevice.deviceId,
      macAddress: pendingDevice.deviceId,
      board: pendingDevice.board,
      appVersion: pendingDevice.appVersion,
      status: "active",
      createdAt: pendingDevice.createdAt,
      lastSeenAt: new Date(),
    };

    // 移除待激活设备，添加到已激活设备
    this.pendingDevices.delete(code);
    this.deviceIdToCode.delete(pendingDevice.deviceId);
    this.activeDevices.set(device.deviceId, device);

    logger.info(
      `设备激活成功: deviceId=${device.deviceId}, code=${code}, userId=${userId ?? "未指定"}`
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
   * 获取所有已激活设备
   * @returns 所有已激活设备列表
   */
  getAllDevices(): ESP32Device[] {
    return Array.from(this.activeDevices.values());
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
   * 删除设备
   * @param deviceId - 设备ID
   * @returns 是否删除成功
   */
  deleteDevice(deviceId: string): boolean {
    const result = this.activeDevices.delete(deviceId);
    if (result) {
      logger.info(`设备已删除: ${deviceId}`);
    }
    return result;
  }

  /**
   * 获取待激活设备数量
   * @returns 待激活设备数量
   */
  getPendingDeviceCount(): number {
    return this.pendingDevices.size;
  }

  /**
   * 获取已激活设备数量
   * @returns 已激活设备数量
   */
  getActiveDeviceCount(): number {
    return this.activeDevices.size;
  }

  /**
   * 清理过期的待激活设备
   * @returns 清理的设备数量
   */
  cleanupExpiredPendingDevices(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [code, pendingDevice] of this.pendingDevices.entries()) {
      const createdAt = pendingDevice.createdAt.getTime();
      if (now - createdAt > ACTIVATION_CODE_EXPIRY_MS) {
        this.pendingDevices.delete(code);
        this.deviceIdToCode.delete(pendingDevice.deviceId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理过期待激活设备: ${cleanedCount} 个`);
    }

    return cleanedCount;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.pendingDevices.clear();
    this.activeDevices.clear();
    this.deviceIdToCode.clear();
    logger.debug("设备注册服务已销毁");
  }
}
