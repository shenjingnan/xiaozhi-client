/**
 * ESP32硬件设备通信相关类型定义
 * 定义ESP32设备激活、通信、管理等所需的类型
 */

/**
 * 设备状态枚举
 */
export type ESP32DeviceStatus = "activating" | "active" | "offline";

/**
 * 设备信息
 * 表示一个已注册的ESP32设备
 */
export interface ESP32Device {
  /** 设备ID（使用MAC地址） */
  deviceId: string;
  /** MAC地址 */
  macAddress: string;
  /** 硬件型号 */
  board: string;
  /** 固件版本 */
  appVersion: string;
  /** 设备状态 */
  status: ESP32DeviceStatus;
  /** 创建时间 */
  createdAt: Date;
  /** 最后活跃时间 */
  lastSeenAt: Date;
}

/**
 * 待激活设备信息
 * 存储在设备注册表中的临时设备信息
 */
export interface ESP32PendingDevice {
  /** 设备ID（MAC地址） */
  deviceId: string;
  /** 激活码（6位） */
  code: string;
  /** 挑战字符串 */
  challenge: string;
  /** 硬件型号 */
  board: string;
  /** 固件版本 */
  appVersion: string;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 设备激活信息
 * 返回给ESP32设备的激活响应
 */
export interface ESP32Activation {
  /** 6位激活码 */
  code: string;
  /** 挑战字符串 */
  challenge: string;
  /** 显示消息 */
  message: string;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
}

/**
 * 设备上报信息
 * ESP32设备在OTA接口上报的设备信息
 */
export interface ESP32DeviceReport {
  /** 应用程序信息 */
  application: {
    /** 版本号 */
    version: string;
    /** 硬件板信息 */
    board: {
      /** 板型号 */
      type: string;
    };
  };
  /** 芯片型号名称（可选） */
  chipModelName?: string;
}

/**
 * WebSocket配置信息
 */
export interface ESP32WebSocketConfig {
  /** WebSocket URL */
  url: string;
  /** 认证Token */
  token: string;
  /** 协议版本 */
  version: number;
}

/**
 * MQTT配置信息
 */
export interface ESP32MQTTConfig {
  /** MQTT端点 */
  endpoint: string;
  /** 客户端ID */
  clientId: string;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 保活时间（秒） */
  keepalive: number;
}

/**
 * 服务器时间信息
 */
export interface ESP32ServerTime {
  /** Unix时间戳（毫秒） */
  timestamp: number;
  /** 时区偏移（分钟） */
  timezoneOffset: number;
}

/**
 * 固件信息
 */
export interface ESP32FirmwareInfo {
  /** 固件版本 */
  version: string;
  /** 固件URL */
  url: string;
  /** 是否强制更新 */
  force: boolean;
}

/**
 * OTA响应
 * POST /api/esp32/ota 接口的响应类型
 */
export interface ESP32OTAResponse {
  /** 设备激活信息（未激活设备返回） */
  activation?: ESP32Activation;
  /** WebSocket配置（已激活设备返回） */
  websocket?: ESP32WebSocketConfig;
  /** MQTT配置（可选） */
  mqtt?: ESP32MQTTConfig;
  /** 服务器时间（可选） */
  serverTime?: ESP32ServerTime;
  /** 固件信息（可选） */
  firmware?: ESP32FirmwareInfo;
}

/**
 * WebSocket消息类型枚举
 */
export type ESP32WSMessageType =
  | "hello"
  | "audio"
  | "text"
  | "stt"
  | "tts"
  | "llm"
  | "mcp"
  | "system"
  | "custom"
  | "error";

/**
 * WebSocket消息基础接口
 */
export interface ESP32WSMessageBase {
  /** 消息类型 */
  type: ESP32WSMessageType;
}

/**
 * 设备Hello消息
 * ESP32设备连接后发送的握手消息
 */
export interface ESP32HelloMessage extends ESP32WSMessageBase {
  type: "hello";
  /** 协议版本 */
  version: number;
  /** 设备特性 */
  features?: {
    /** 是否支持回声消除 */
    aec?: boolean;
    /** 是否支持MCP */
    mcp?: boolean;
  };
  /** 传输类型 */
  transport: "websocket";
  /** 音频参数 */
  audioParams?: {
    /** 音频格式 */
    format: "opus" | "pcm";
    /** 采样率 */
    sampleRate: number;
    /** 声道数 */
    channels: number;
    /** 帧时长（毫秒） */
    frameDuration: number;
  };
}

/**
 * 服务器Hello响应
 * 服务器对设备Hello消息的响应
 */
export interface ESP32ServerHelloMessage extends ESP32WSMessageBase {
  type: "hello";
  /** 协议版本 */
  version: number;
  /** 会话ID */
  sessionId: string;
}

/**
 * 音频消息
 * 用于传输音频数据
 */
export interface ESP32AudioMessage extends ESP32WSMessageBase {
  type: "audio";
  /** 音频数据 */
  data: Uint8Array;
}

/**
 * 文本消息
 * 用于传输文本数据
 */
export interface ESP32TextMessage extends ESP32WSMessageBase {
  type: "text" | "stt" | "tts" | "llm" | "mcp" | "system" | "custom";
  /** 消息数据 */
  data?: unknown;
}

/**
 * 错误消息
 * 用于传输错误信息
 */
export interface ESP32ErrorMessage extends ESP32WSMessageBase {
  type: "error";
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
}

/**
 * WebSocket消息联合类型
 */
export type ESP32WSMessage =
  | ESP32HelloMessage
  | ESP32ServerHelloMessage
  | ESP32AudioMessage
  | ESP32TextMessage
  | ESP32ErrorMessage;

/**
 * WebSocket连接状态
 */
export type ESP32ConnectionState = "connecting" | "connected" | "disconnected";

/**
 * 设备绑定请求
 */
export interface ESP32BindRequest {
  /** 激活码 */
  code: string;
  /** 用户ID（可选） */
  userId?: string;
}

/**
 * 设备列表响应
 */
export interface ESP32DeviceListResponse {
  /** 设备列表 */
  devices: ESP32Device[];
  /** 设备总数 */
  total: number;
}

/**
 * ESP32错误代码
 */
export enum ESP32ErrorCode {
  /** 设备ID缺失 */
  MISSING_DEVICE_ID = "MISSING_DEVICE_ID",
  /** 设备不存在 */
  DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND",
  /** 设备已激活 */
  DEVICE_ALREADY_ACTIVATED = "DEVICE_ALREADY_ACTIVATED",
  /** 设备未激活 */
  DEVICE_NOT_ACTIVATED = "DEVICE_NOT_ACTIVATED",
  /** 激活码无效 */
  INVALID_ACTIVATION_CODE = "INVALID_ACTIVATION_CODE",
  /** 激活码过期 */
  ACTIVATION_CODE_EXPIRED = "ACTIVATION_CODE_EXPIRED",
  /** 设备离线 */
  DEVICE_OFFLINE = "DEVICE_OFFLINE",
  /** 无效的设备状态 */
  INVALID_DEVICE_STATUS = "INVALID_DEVICE_STATUS",
  /** WebSocket连接失败 */
  WEBSOCKET_CONNECTION_FAILED = "WEBSOCKET_CONNECTION_FAILED",
  /** 无效的消息格式 */
  INVALID_MESSAGE_FORMAT = "INVALID_MESSAGE_FORMAT",
}
