/**
 * ESP32设备服务
 * 负责ESP32设备的连接管理和消息路由
 */

import { logger } from "@/Logger.js";
import { ESP32Connection } from "@/lib/esp32/connection.js";
import {
  type ESP32Device,
  type ESP32DeviceListResponse,
  type ESP32DeviceReport,
  ESP32ErrorCode,
  type ESP32OTAResponse,
  type ESP32WSMessage,
} from "@/types/esp32.js";
import type WebSocket from "ws";
import type { DeviceRegistryService } from "./device-registry.service.js";

/**
 * WebSocket认证Token有效期（毫秒）
 */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时

/**
 * 生成认证Token
 * @returns 随机Token
 */
function generateToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * ESP32设备服务
 * 管理所有ESP32设备的连接和通信
 */
export class ESP32Service {
  /** 设备注册服务 */
  private deviceRegistry: DeviceRegistryService;

  /** 活跃的设备连接映射（设备ID -> 连接实例） */
  private connections: Map<string, ESP32Connection>;

  /** 客户端ID到设备ID的映射 */
  private clientIdToDeviceId: Map<string, string>;

  /** Token到设备ID的映射（用于WebSocket认证） */
  private tokenToDeviceId: Map<string, { deviceId: string; expiresAt: number }>;

  /**
   * 构造函数
   * @param deviceRegistry - 设备注册服务
   */
  constructor(deviceRegistry: DeviceRegistryService) {
    this.deviceRegistry = deviceRegistry;
    this.connections = new Map();
    this.clientIdToDeviceId = new Map();
    this.tokenToDeviceId = new Map();
  }

  /**
   * 处理OTA请求
   * @param deviceId - 设备ID（MAC地址）
   * @param report - 设备上报信息
   * @returns OTA响应
   */
  async handleOTARequest(
    deviceId: string,
    report: ESP32DeviceReport
  ): Promise<ESP32OTAResponse> {
    logger.info(`收到OTA请求: deviceId=${deviceId}`);

    const { application, chipModelName } = report;
    const { version: appVersion, board } = application;

    // 检查设备是否已激活
    const existingDevice = this.deviceRegistry.getDevice(deviceId);
    if (existingDevice) {
      // 设备已激活，更新最后活跃时间
      this.deviceRegistry.updateLastSeen(deviceId);

      // 生成新的WebSocket认证Token
      const token = generateToken();
      const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
      this.tokenToDeviceId.set(token, { deviceId, expiresAt });

      // 构建WebSocket URL
      const wsUrl = "/api/esp32/ws";

      logger.info(`设备已激活，返回WebSocket配置: deviceId=${deviceId}`);

      return {
        websocket: {
          url: wsUrl,
          token,
          version: 1,
        },
        serverTime: {
          timestamp: Date.now(),
          timezoneOffset: new Date().getTimezoneOffset() * -60 * 1000,
        },
      };
    }

    // 设备未激活，生成激活码
    try {
      const { code, challenge } = this.deviceRegistry.generateActivationCode(
        deviceId,
        board.type,
        appVersion
      );

      logger.info(`设备未激活，生成激活码: deviceId=${deviceId}, code=${code}`);

      return {
        activation: {
          code,
          challenge,
          message: "请在Web界面输入激活码完成设备绑定",
          timeoutMs: 5 * 60 * 1000, // 5分钟
        },
        serverTime: {
          timestamp: Date.now(),
          timezoneOffset: new Date().getTimezoneOffset() * -60 * 1000,
        },
      };
    } catch (error) {
      // 如果设备已在待激活列表中，返回现有激活码
      const pendingDevice = this.deviceRegistry.getPendingDevice(deviceId);
      if (pendingDevice) {
        logger.info(
          `设备待激活中，返回现有激活码: deviceId=${deviceId}, code=${pendingDevice.code}`
        );

        return {
          activation: {
            code: pendingDevice.code,
            challenge: pendingDevice.challenge,
            message: "请在Web界面输入激活码完成设备绑定",
            timeoutMs: 5 * 60 * 1000,
          },
          serverTime: {
            timestamp: Date.now(),
            timezoneOffset: new Date().getTimezoneOffset() * -60 * 1000,
          },
        };
      }

      throw error;
    }
  }

  /**
   * 绑定设备
   * @param code - 激活码
   * @param userId - 用户ID（可选）
   * @returns 已激活的设备信息
   * @throws 如果激活码无效
   */
  async bindDevice(code: string, userId?: string): Promise<ESP32Device> {
    logger.info(`设备绑定请求: code=${code}, userId=${userId ?? "未指定"}`);

    const device = this.deviceRegistry.activateDevice(code, userId);
    if (!device) {
      throw new Error("激活码无效或已过期", {
        cause: ESP32ErrorCode.INVALID_ACTIVATION_CODE,
      });
    }

    logger.info(`设备绑定成功: deviceId=${device.deviceId}`);

    return device;
  }

  /**
   * 处理WebSocket连接
   * @param ws - WebSocket实例
   * @param deviceId - 设备ID
   * @param clientId - 客户端ID
   * @param token - 认证Token
   */
  async handleWebSocketConnection(
    ws: WebSocket,
    deviceId: string,
    clientId: string,
    token?: string
  ): Promise<void> {
    logger.info(
      `ESP32设备WebSocket连接: deviceId=${deviceId}, clientId=${clientId}`
    );

    // 验证设备是否已激活
    const device = this.deviceRegistry.getDevice(deviceId);
    if (!device) {
      logger.warn(`设备未激活，拒绝连接: deviceId=${deviceId}`);
      ws.close(1008, "Device not activated");
      return;
    }

    // 如果提供了Token，验证Token
    if (token) {
      const tokenInfo = this.tokenToDeviceId.get(token);
      if (!tokenInfo) {
        logger.warn(`Token无效，拒绝连接: deviceId=${deviceId}`);
        ws.close(1008, "Invalid token");
        return;
      }

      // 检查Token是否过期
      if (Date.now() > tokenInfo.expiresAt) {
        logger.warn(`Token已过期，拒绝连接: deviceId=${deviceId}`);
        this.tokenToDeviceId.delete(token);
        ws.close(1008, "Token expired");
        return;
      }

      // 验证Token对应的设备ID
      if (tokenInfo.deviceId !== deviceId) {
        logger.warn(`Token与设备ID不匹配，拒绝连接: deviceId=${deviceId}`);
        ws.close(1008, "Token mismatch");
        return;
      }

      // Token验证通过，删除Token（一次性使用）
      this.tokenToDeviceId.delete(token);
    }

    // 检查设备是否已有连接
    const existingConnection = this.connections.get(deviceId);
    if (existingConnection) {
      logger.info(`设备已有连接，断开旧连接: deviceId=${deviceId}`);
      await existingConnection.close();
      this.connections.delete(deviceId);
    }

    // 更新设备状态
    this.deviceRegistry.updateDeviceStatus(deviceId, "active");
    this.deviceRegistry.updateLastSeen(deviceId);

    // 创建新的连接
    const connection = new ESP32Connection(deviceId, clientId, ws, {
      onMessage: async (message) => {
        await this.handleDeviceMessage(deviceId, message);
      },
      onClose: () => {
        this.handleDeviceDisconnect(deviceId, clientId);
      },
      onError: (error) => {
        logger.error(`设备连接错误: deviceId=${deviceId}`, error);
      },
    });

    this.connections.set(deviceId, connection);
    this.clientIdToDeviceId.set(clientId, deviceId);

    logger.info(
      `ESP32设备连接已建立: deviceId=${deviceId}, clientId=${clientId}`
    );
  }

  /**
   * 发送消息到设备
   * @param deviceId - 设备ID
   * @param message - 消息内容
   */
  async sendToDevice(deviceId: string, message: ESP32WSMessage): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      throw new Error(`设备未连接: ${deviceId}`, {
        cause: ESP32ErrorCode.DEVICE_OFFLINE,
      });
    }

    await connection.send(message);
    logger.debug(
      `消息已发送到设备: deviceId=${deviceId}, type=${message.type}`
    );
  }

  /**
   * 处理设备消息
   * @param deviceId - 设备ID
   * @param message - 消息内容
   */
  private async handleDeviceMessage(
    deviceId: string,
    message: ESP32WSMessage
  ): Promise<void> {
    logger.debug(`收到设备消息: deviceId=${deviceId}, type=${message.type}`);

    // 更新设备最后活跃时间
    this.deviceRegistry.updateLastSeen(deviceId);

    // 根据消息类型处理
    // 这里可以扩展不同的消息处理逻辑
    switch (message.type) {
      case "hello":
        // Hello消息在连接层处理
        break;
      case "audio":
        // 音频消息处理
        logger.debug(`收到音频消息: deviceId=${deviceId}`);
        break;
      case "text":
      case "stt":
      case "tts":
      case "llm":
      case "mcp":
      case "system":
      case "custom":
        // 文本消息处理
        logger.debug(
          `收到文本消息: deviceId=${deviceId}, subtype=${message.type}`
        );
        break;
      default:
        logger.warn(`未知消息类型: ${message.type}`);
    }
  }

  /**
   * 处理设备断开连接
   * @param deviceId - 设备ID
   * @param clientId - 客户端ID
   */
  private handleDeviceDisconnect(deviceId: string, clientId: string): void {
    logger.info(`设备断开连接: deviceId=${deviceId}, clientId=${clientId}`);

    this.connections.delete(deviceId);
    this.clientIdToDeviceId.delete(clientId);

    // 更新设备状态
    this.deviceRegistry.updateDeviceStatus(deviceId, "offline");
  }

  /**
   * 断开设备连接
   * @param deviceId - 设备ID
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (connection) {
      await connection.close();
      this.connections.delete(deviceId);
      logger.info(`设备连接已断开: ${deviceId}`);
    }
  }

  /**
   * 获取设备列表
   * @returns 设备列表响应
   */
  async listDevices(): Promise<ESP32DeviceListResponse> {
    const devices = this.deviceRegistry.getAllDevices();
    return {
      devices,
      total: devices.length,
    };
  }

  /**
   * 获取单个设备信息
   * @param deviceId - 设备ID
   * @returns 设备信息，如果不存在则返回null
   */
  async getDevice(deviceId: string): Promise<ESP32Device | null> {
    return this.deviceRegistry.getDevice(deviceId);
  }

  /**
   * 删除设备
   * @param deviceId - 设备ID
   */
  async deleteDevice(deviceId: string): Promise<void> {
    // 先断开连接
    await this.disconnectDevice(deviceId);

    // 删除设备
    const deleted = this.deviceRegistry.deleteDevice(deviceId);
    if (!deleted) {
      throw new Error(`设备不存在: ${deviceId}`, {
        cause: ESP32ErrorCode.DEVICE_NOT_FOUND,
      });
    }
  }

  /**
   * 获取连接的设备数量
   * @returns 连接的设备数量
   */
  getConnectedDeviceCount(): number {
    return this.connections.size;
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    // 断开所有设备连接
    const disconnectPromises = Array.from(
      this.connections.values(),
      (connection) => connection.close()
    );

    await Promise.all(disconnectPromises);

    this.connections.clear();
    this.clientIdToDeviceId.clear();
    this.tokenToDeviceId.clear();

    logger.debug("ESP32服务已销毁");
  }
}
