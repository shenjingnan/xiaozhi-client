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
 * 设备上报信息
 * ESP32设备在OTA接口上报的设备信息
 * 与 xiaozhi-esp32-server 的数据结构保持一致
 *
 * 支持两种格式：
 * 1. 新格式：board 在顶层
 * 2. 旧格式：board 嵌套在 application 下（兼容老设备）
 */
export interface ESP32DeviceReport {
  /** 协议版本 */
  version?: number;
  /** 语言设置 */
  language?: string;
  /** Flash大小 */
  flash_size?: number;
  /** 最小空闲堆大小 */
  minimum_free_heap_size?: string;
  /** MAC地址 */
  mac_address?: string;
  /** 设备UUID */
  uuid?: string;
  /** 芯片型号名称 */
  chip_model_name?: string;
  /** 芯片信息 */
  chip_info?: {
    model: number;
    cores: number;
    revision: number;
    features: number;
  };
  /** 应用程序信息 */
  application: {
    name?: string;
    version: string;
    compile_time?: string;
    idf_version?: string;
    elf_sha256?: string;
    /** 旧格式：硬件板信息可能嵌套在这里（兼容老设备） */
    board?: {
      /** 板型号 */
      type: string;
    };
  };
  /** 分区表 */
  partition_table?: Array<{
    label: string;
    type: number;
    subtype: number;
    address: number;
    size: number;
  }>;
  /** OTA信息 */
  ota?: {
    label: string;
  };
  /** 显示屏信息 */
  display?: {
    monochrome: boolean;
    width: number;
    height: number;
  };
  /** 新格式：硬件板信息在顶层（推荐格式） */
  board?: {
    /** 板型号 */
    type: string;
    /** 板名称 */
    name?: string;
    /** WiFi SSID */
    ssid?: string;
    /** WiFi信号强度 */
    rssi?: number;
    /** WiFi信道 */
    channel?: number;
    /** IP地址 */
    ip?: string;
    /** MAC地址 */
    mac?: string;
  };
}

/**
 * WebSocket配置信息
 */
export interface ESP32WebSocketConfig {
  /** WebSocket URL */
  url: string;
  /** 认证Token（已废弃，保留用于向后兼容） */
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
  keepalive?: number;
  /** 发布主题 */
  publish_topic?: string;
  /** 订阅主题 */
  subscribe_topic?: string;
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
 *
 * 注意：设备激活已改为自动激活，不再返回 activation 字段
 */
export interface ESP32OTAResponse {
  /** WebSocket配置 */
  websocket?: ESP32WebSocketConfig;
  /** MQTT配置（可选） */
  mqtt?: ESP32MQTTConfig;
  /** 服务器时间 */
  serverTime?: ESP32ServerTime;
  /** 固件信息（可选） */
  firmware?: ESP32FirmwareInfo;
}

/**
 * WebSocket消息类型枚举
 */
export type ESP32WSMessageType =
  | "hello"
  | "listen"
  | "audio"
  | "text"
  | "stt"
  | "tts"
  | "llm"
  | "mcp"
  | "system"
  | "custom"
  | "abort"
  | "error";

/**
 * WebSocket消息基础接口
 */
export interface ESP32WSMessageBase {
  /** 消息类型 */
  type: ESP32WSMessageType;
  /** 会话ID（可选，用于关联同一会话的消息） */
  session_id?: string;
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
 * 设备Listen消息
 * ESP32设备发送的监听状态消息
 * 用于报告唤醒词检测和监听状态变化
 */
export interface ESP32ListenMessage extends ESP32WSMessageBase {
  type: "listen";
  /** 监听状态 */
  state: "detect" | "start" | "stop";
  /** 监听模式 */
  mode?: "auto" | "manual" | "realtime";
  /** 唤醒词文本（state=detect时包含） */
  text?: string;
}

/**
 * 服务器Hello响应
 * 服务器对设备Hello消息的响应
 */
export interface ESP32ServerHelloMessage extends ESP32WSMessageBase {
  type: "hello";
  /** 协议版本 */
  version: number;
  /** 传输类型 */
  transport: "websocket";
  /** 会话ID */
  sessionId: string;
  /** 音频参数 */
  audioParams: {
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
 * 音频消息
 * 用于传输音频数据
 */
export interface ESP32AudioMessage extends ESP32WSMessageBase {
  type: "audio";
  /** 音频数据 */
  data: Uint8Array;
}

/**
 * STT（语音转文本）消息
 * 服务端发送给设备的语音识别结果
 */
export interface ESP32STTMessage extends ESP32WSMessageBase {
  type: "stt";
  /** 识别出的文本内容 */
  text: string;
}

/**
 * TTS（文本转语音）消息
 * 服务端发送给设备的语音合成消息
 */
export interface ESP32TTSMessage extends ESP32WSMessageBase {
  type: "tts";
  /** TTS状态 */
  state: "start" | "sentence_start" | "stop";
  /** 要播放的文本（state=sentence_start时包含） */
  text?: string;
}

/**
 * LLM（大语言模型）消息
 * 服务端发送给设备的LLM生成结果
 */
export interface ESP32LLMMessage extends ESP32WSMessageBase {
  type: "llm";
  /** 表情/情绪 */
  emotion?: string;
  /** LLM生成的文本或表情符号 */
  text: string;
}

/**
 * 文本消息
 * 用于传输通用文本数据（已废弃，使用具体类型）
 * @deprecated 使用具体的消息类型（ESP32STTMessage、ESP32TTSMessage等）
 */
export interface ESP32TextMessage extends ESP32WSMessageBase {
  type: "text";
  /** 消息数据 */
  data?: unknown;
}

/**
 * MCP消息
 * 用于传输 MCP 协议的 JSON-RPC 消息
 */
export interface ESP32MCPMessage extends ESP32WSMessageBase {
  type: "mcp";
  /** JSON-RPC 2.0 payload */
  payload: {
    jsonrpc: "2.0";
    id?: number | string;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: unknown;
  };
}

/**
 * System消息
 * 服务端发送给设备的系统控制命令
 */
export interface ESP32SystemMessage extends ESP32WSMessageBase {
  type: "system";
  /** 系统命令：reboot, shutdown 等 */
  command: string;
  /** 命令参数（可选） */
  args?: Record<string, unknown>;
}

/**
 * Abort消息
 * 设备端发送的终止请求，或服务端发送的终止通知
 */
export interface ESP32AbortMessage extends ESP32WSMessageBase {
  type: "abort";
  /** 终止原因 */
  reason: string;
}

/**
 * Custom消息
 * 自定义消息类型
 */
export interface ESP32CustomMessage extends ESP32WSMessageBase {
  type: "custom";
  /** 自定义数据 */
  payload: Record<string, unknown>;
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
  | ESP32ListenMessage
  | ESP32ServerHelloMessage
  | ESP32AudioMessage
  | ESP32TextMessage
  | ESP32STTMessage
  | ESP32TTSMessage
  | ESP32LLMMessage
  | ESP32MCPMessage
  | ESP32SystemMessage
  | ESP32AbortMessage
  | ESP32CustomMessage
  | ESP32ErrorMessage;

/**
 * WebSocket连接状态
 */
export type ESP32ConnectionState = "connecting" | "connected" | "disconnected";

/**
 * ESP32错误代码
 */
export enum ESP32ErrorCode {
  /** 设备ID缺失 */
  MISSING_DEVICE_ID = "MISSING_DEVICE_ID",
  /** 设备不存在 */
  DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND",
  /** 设备离线 */
  DEVICE_OFFLINE = "DEVICE_OFFLINE",
  /** 无效的设备状态 */
  INVALID_DEVICE_STATUS = "INVALID_DEVICE_STATUS",
  /** WebSocket连接失败 */
  WEBSOCKET_CONNECTION_FAILED = "WEBSOCKET_CONNECTION_FAILED",
  /** 无效的消息格式 */
  INVALID_MESSAGE_FORMAT = "INVALID_MESSAGE_FORMAT",
}
