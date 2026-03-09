/**
 * TTS 协议消息类型定义
 *
 * 定义与 TTS WebSocket 通信相关的协议消息类型和枚举：
 * - EventType: 事件类型枚举（连接、会话、音频等事件）
 * - MsgType: 消息类型枚举
 * - Message 接口: 协议消息结构
 * - 消息序列化/反序列化函数
 * - WebSocket 通信辅助函数
 */

import { Buffer } from "node:buffer";
import type WebSocket from "ws";

/**
 * 事件类型定义，对应 protobuf 生成的事件类型
 */
export enum EventType {
  // Default event, used when no events are needed
  None = 0,

  // Connection events (1-99)
  StartConnection = 1,
  FinishConnection = 2,
  ConnectionStarted = 50,
  ConnectionFailed = 51,
  ConnectionFinished = 52,

  // Session events (100-199)
  StartSession = 100,
  CancelSession = 101,
  FinishSession = 102,
  SessionStarted = 150,
  SessionCanceled = 151,
  SessionFinished = 152,
  SessionFailed = 153,
  UsageResponse = 154,

  // General events (200-299)
  TaskRequest = 200,
  UpdateConfig = 201,
  AudioMuted = 250,

  // TTS events (300-399)
  SayHello = 300,
  TTSSentenceStart = 350,
  TTSSentenceEnd = 351,
  TTSResponse = 352,
  TTSEnded = 359,
  PodcastRoundStart = 360,
  PodcastRoundResponse = 361,
  PodcastRoundEnd = 362,

  // ASR events (450-499)
  ASRInfo = 450,
  ASRResponse = 451,
  ASREnded = 459,

  // Chat events (500-599)
  ChatTTSText = 500,
  ChatResponse = 550,
  ChatEnded = 559,

  // Subtitle events (650-699)
  SourceSubtitleStart = 650,
  SourceSubtitleResponse = 651,
  SourceSubtitleEnd = 652,
  TranslationSubtitleStart = 653,
  TranslationSubtitleResponse = 654,
  TranslationSubtitleEnd = 655,
}

/**
 * 消息协议相关定义
 */
export enum MsgType {
  Invalid = 0,
  FullClientRequest = 0b1,
  AudioOnlyClient = 0b10,
  FullServerResponse = 0b1001,
  AudioOnlyServer = 0b1011,
  FrontEndResultServer = 0b1100,
  Error = 0b1111,
}

export const MsgTypeServerACK = MsgType.AudioOnlyServer;

export enum MsgTypeFlagBits {
  NoSeq = 0,
  PositiveSeq = 0b1,
  LastNoSeq = 0b10,
  NegativeSeq = 0b11,
  WithEvent = 0b100,
}

export enum VersionBits {
  Version1 = 1,
  Version2 = 2,
  Version3 = 3,
  Version4 = 4,
}

export enum HeaderSizeBits {
  HeaderSize4 = 1,
  HeaderSize8 = 2,
  HeaderSize12 = 3,
  HeaderSize16 = 4,
}

export enum SerializationBits {
  Raw = 0,
  JSON = 0b1,
  Thrift = 0b11,
  Custom = 0b1111,
}

export enum CompressionBits {
  None = 0,
  Gzip = 0b1,
  Custom = 0b1111,
}

/**
 * 协议消息结构
 */
export interface Message {
  version: VersionBits;
  headerSize: HeaderSizeBits;
  type: MsgType;
  flag: MsgTypeFlagBits;
  serialization: SerializationBits;
  compression: CompressionBits;
  event?: EventType;
  sessionId?: string;
  connectId?: string;
  sequence?: number;
  errorCode?: number;
  payload: Uint8Array;
}

/**
 * 获取事件类型名称
 * @param eventType - 事件类型枚举值
 * @returns 事件类型对应的字符串名称，如果无效则返回错误提示
 */
export function getEventTypeName(eventType: EventType): string {
  return EventType[eventType] || `invalid event type: ${eventType}`;
}

/**
 * 获取消息类型名称
 * @param msgType - 消息类型枚举值
 * @returns 消息类型对应的字符串名称，如果无效则返回错误提示
 */
export function getMsgTypeName(msgType: MsgType): string {
  return MsgType[msgType] || `invalid message type: ${msgType}`;
}

/**
 * 将消息对象转换为可读字符串表示
 */
export function messageToString(msg: Message): string {
  const eventStr =
    msg.event !== undefined ? getEventTypeName(msg.event) : "NoEvent";
  const typeStr = getMsgTypeName(msg.type);

  switch (msg.type) {
    case MsgType.AudioOnlyServer:
    case MsgType.AudioOnlyClient:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, PayloadSize: ${msg.payload.length}`;
      }
      return `MsgType: ${typeStr}, EventType: ${eventStr}, PayloadSize: ${msg.payload.length}`;

    case MsgType.Error:
      return `MsgType: ${typeStr}, EventType: ${eventStr}, ErrorCode: ${msg.errorCode}, Payload: ${new TextDecoder().decode(msg.payload)}`;

    default:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, Payload: ${new TextDecoder().decode(msg.payload)}`;
      }

      return `MsgType: ${typeStr}, EventType: ${eventStr}, Payload: ${new TextDecoder().decode(msg.payload)}`;
  }
}

/**
 * 创建消息对象
 */
export function createMessage(
  msgType: MsgType,
  flag: MsgTypeFlagBits
): Message {
  const msg = {
    type: msgType,
    flag: flag,
    version: VersionBits.Version1,
    headerSize: HeaderSizeBits.HeaderSize4,
    serialization: SerializationBits.JSON,
    compression: CompressionBits.None,
    payload: new Uint8Array(0),
  };

  // 使用 Object.defineProperty 添加 toString 方法
  Object.defineProperty(msg, "toString", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function () {
      return messageToString(this);
    },
  });

  return msg as Message;
}

/**
 * 消息序列化
 */
export function marshalMessage(msg: Message): Uint8Array {
  const buffers: Uint8Array[] = [];

  // 构建基础头部
  const headerSize = 4 * msg.headerSize;
  const header = new Uint8Array(headerSize);

  header[0] = (msg.version << 4) | msg.headerSize;
  header[1] = (msg.type << 4) | msg.flag;
  header[2] = (msg.serialization << 4) | msg.compression;

  buffers.push(header);

  // 根据消息类型和标志位写入字段
  const writers = getWriters(msg);
  for (const writer of writers) {
    const data = writer(msg);
    if (data) buffers.push(data);
  }

  // 合并所有缓冲区
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return result;
}

/**
 * 消息反序列化
 */
export function unmarshalMessage(data: Uint8Array): Message {
  if (data.length < 3) {
    throw new Error(
      `data too short: expected at least 3 bytes, got ${data.length}`
    );
  }

  let offset = 0;

  // 读取基础头部
  const versionAndHeaderSize = data[offset++];
  const typeAndFlag = data[offset++];
  const serializationAndCompression = data[offset++];

  const msg = {
    version: (versionAndHeaderSize >> 4) as VersionBits,
    headerSize: (versionAndHeaderSize & 0b00001111) as HeaderSizeBits,
    type: (typeAndFlag >> 4) as MsgType,
    flag: (typeAndFlag & 0b00001111) as MsgTypeFlagBits,
    serialization: (serializationAndCompression >> 4) as SerializationBits,
    compression: (serializationAndCompression & 0b00001111) as CompressionBits,
    payload: new Uint8Array(0),
  };

  Object.defineProperty(msg, "toString", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function () {
      return messageToString(this);
    },
  });

  // 跳过剩余的头部字节
  offset = 4 * msg.headerSize;

  // 根据消息类型和标志位读取字段
  const readers = getReaders(msg as Message);
  for (const reader of readers) {
    offset = reader(msg as Message, data, offset);
  }

  return msg as Message;
}

// 序列化辅助函数
function getWriters(msg: Message): Array<(msg: Message) => Uint8Array | null> {
  const writers: Array<(msg: Message) => Uint8Array | null> = [];

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    writers.push(writeEvent, writeSessionId, writeConnectId);
  }

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        writers.push(writeSequence);
      }
      break;
    case MsgType.Error:
      writers.push(writeErrorCode);
      break;
    default:
      throw new Error(`unsupported message type: ${msg.type}`);
  }

  writers.push(writePayload);
  return writers;
}

function getReaders(
  msg: Message
): Array<(msg: Message, data: Uint8Array, offset: number) => number> {
  const readers: Array<
    (msg: Message, data: Uint8Array, offset: number) => number
  > = [];

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        readers.push(readSequence);
      }
      break;
    case MsgType.Error:
      readers.push(readErrorCode);
      break;
    default:
      throw new Error(`unsupported message type: ${msg.type}`);
  }

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    readers.push(readEvent, readSessionId, readConnectId);
  }

  readers.push(readPayload);
  return readers;
}

// 写入函数
function writeEvent(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, msg.event, false);
  return new Uint8Array(buffer);
}

function writeSessionId(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null;

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      return null;
  }

  const sessionId = msg.sessionId || "";
  const sessionIdBytes = Buffer.from(sessionId, "utf8");
  const sizeBuffer = new ArrayBuffer(4);
  const sizeView = new DataView(sizeBuffer);
  sizeView.setUint32(0, sessionIdBytes.length, false);

  const result = new Uint8Array(4 + sessionIdBytes.length);
  result.set(new Uint8Array(sizeBuffer), 0);
  result.set(sessionIdBytes, 4);

  return result;
}

function writeConnectId(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null;

  switch (msg.event) {
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      break;
    default:
      return null;
  }

  const connectId = msg.connectId || "";
  const connectIdBytes = Buffer.from(connectId, "utf8");
  const sizeBuffer = new ArrayBuffer(4);
  const sizeView = new DataView(sizeBuffer);
  sizeView.setUint32(0, connectIdBytes.length, false);

  const result = new Uint8Array(4 + connectIdBytes.length);
  result.set(new Uint8Array(sizeBuffer), 0);
  result.set(connectIdBytes, 4);

  return result;
}

function writeSequence(msg: Message): Uint8Array | null {
  if (msg.sequence === undefined) return null;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, msg.sequence, false);
  return new Uint8Array(buffer);
}

function writeErrorCode(msg: Message): Uint8Array | null {
  if (msg.errorCode === undefined) return null;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, msg.errorCode, false);
  return new Uint8Array(buffer);
}

function writePayload(msg: Message): Uint8Array | null {
  const payloadSize = msg.payload.length;
  const sizeBuffer = new ArrayBuffer(4);
  const sizeView = new DataView(sizeBuffer);
  sizeView.setUint32(0, payloadSize, false);

  const result = new Uint8Array(4 + payloadSize);
  result.set(new Uint8Array(sizeBuffer), 0);
  result.set(msg.payload, 4);

  return result;
}

// 读取函数
function readEvent(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error("insufficient data for event");
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  msg.event = view.getInt32(0, false);
  return offset + 4;
}

function readSessionId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset;

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      return offset;
  }

  if (offset + 4 > data.length) {
    throw new Error("insufficient data for session ID size");
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  const size = view.getUint32(0, false);
  let currentOffset = offset + 4;

  if (size > 0) {
    if (currentOffset + size > data.length) {
      throw new Error("insufficient data for session ID");
    }
    msg.sessionId = new TextDecoder().decode(
      data.slice(currentOffset, currentOffset + size)
    );
    currentOffset += size;
  }

  return currentOffset;
}

function readConnectId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset;

  switch (msg.event) {
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      break;
    default:
      return offset;
  }

  if (offset + 4 > data.length) {
    throw new Error("insufficient data for connect ID size");
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  const size = view.getUint32(0, false);
  let currentOffset = offset + 4;

  if (size > 0) {
    if (currentOffset + size > data.length) {
      throw new Error("insufficient data for connect ID");
    }
    msg.connectId = new TextDecoder().decode(
      data.slice(currentOffset, currentOffset + size)
    );
    currentOffset += size;
  }

  return currentOffset;
}

function readSequence(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error("insufficient data for sequence");
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  msg.sequence = view.getInt32(0, false);
  return offset + 4;
}

function readErrorCode(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error("insufficient data for error code");
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  msg.errorCode = view.getUint32(0, false);
  return offset + 4;
}

function readPayload(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error("insufficient data for payload size");
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  const size = view.getUint32(0, false);
  let currentOffset = offset + 4;

  if (size > 0) {
    if (currentOffset + size > data.length) {
      throw new Error("insufficient data for payload");
    }
    msg.payload = data.slice(currentOffset, currentOffset + size);
    currentOffset += size;
  }

  return currentOffset;
}

const messageQueues = new Map<WebSocket, Message[]>();
const messageCallbacks = new Map<WebSocket, ((msg: Message) => void)[]>();

function setupMessageHandler(ws: WebSocket) {
  if (!messageQueues.has(ws)) {
    messageQueues.set(ws, []);
    messageCallbacks.set(ws, []);

    ws.on("message", (data: WebSocket.RawData) => {
      try {
        let uint8Data: Uint8Array;
        if (Buffer.isBuffer(data)) {
          uint8Data = new Uint8Array(data);
        } else if (data instanceof ArrayBuffer) {
          uint8Data = new Uint8Array(data);
        } else if (data instanceof Uint8Array) {
          uint8Data = data;
        } else {
          throw new Error(`Unexpected WebSocket message type: ${typeof data}`);
        }

        const msg = unmarshalMessage(uint8Data);
        const queue = messageQueues.get(ws)!;
        const callbacks = messageCallbacks.get(ws)!;

        if (callbacks.length > 0) {
          // 如果有等待的回调，立即处理消息
          const callback = callbacks.shift()!;
          callback(msg);
        } else {
          // 否则，将消息加入队列
          queue.push(msg);
        }
      } catch (error) {
        throw new Error(`Error processing message: ${error}`);
      }
    });

    ws.on("close", () => {
      messageQueues.delete(ws);
      messageCallbacks.delete(ws);
    });
  }
}

/**
 * 接收消息
 * @param ws - WebSocket 连接实例
 * @returns 消息对象
 */
export async function ReceiveMessage(ws: WebSocket): Promise<Message> {
  setupMessageHandler(ws);

  return new Promise((resolve, reject) => {
    const queue = messageQueues.get(ws)!;
    const callbacks = messageCallbacks.get(ws)!;

    // 如果队列中有消息，立即处理
    if (queue.length > 0) {
      resolve(queue.shift()!);
      return;
    }

    // 否则，等待下一条消息
    const errorHandler = (error: WebSocket.ErrorEvent) => {
      const index = callbacks.findIndex((cb) => cb === resolver);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
      reject(error);
    };

    const resolver = (msg: Message) => {
      ws.removeListener("error", errorHandler);
      resolve(msg);
    };

    callbacks.push(resolver);
    ws.once("error", errorHandler);
  });
}

/**
 * 等待并验证特定类型的消息
 * @param ws - WebSocket 连接实例
 * @param msgType - 期望的消息类型
 * @param eventType - 期望的事件类型
 * @returns 验证后的消息对象
 * @throws 如果接收到的消息类型或事件类型与期望不符
 */
export async function WaitForEvent(
  ws: WebSocket,
  msgType: MsgType,
  eventType: EventType
): Promise<Message> {
  const msg = await ReceiveMessage(ws);
  if (msg.type !== msgType || msg.event !== eventType) {
    throw new Error(
      `Unexpected message: type=${getMsgTypeName(msg.type)}, event=${getEventTypeName(msg.event || 0)}`
    );
  }
  return msg;
}

/**
 * 通用的 WebSocket 消息发送函数
 * @param ws - WebSocket 连接实例
 * @param msgType - 消息类型
 * @param flag - 消息标志位
 * @param setupMessage - 配置消息的回调函数
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
async function sendMessage(
  ws: WebSocket,
  msgType: MsgType,
  flag: MsgTypeFlagBits,
  setupMessage: (msg: Message) => void
): Promise<void> {
  const msg = createMessage(msgType, flag);
  setupMessage(msg);
  const data = marshalMessage(msg);

  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * 发送完整的客户端请求
 * @param ws - WebSocket 连接实例
 * @param payload - 请求负载数据
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function FullClientRequest(
  ws: WebSocket,
  payload: Uint8Array
): Promise<void> {
  return sendMessage(
    ws,
    MsgType.FullClientRequest,
    MsgTypeFlagBits.NoSeq,
    (msg) => {
      msg.payload = payload;
    }
  );
}

/**
 * 发送仅音频的客户端请求
 * @param ws - WebSocket 连接实例
 * @param payload - 请求负载数据
 * @param flag - 消息标志位
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function AudioOnlyClient(
  ws: WebSocket,
  payload: Uint8Array,
  flag: MsgTypeFlagBits
): Promise<void> {
  return sendMessage(ws, MsgType.AudioOnlyClient, flag, (msg) => {
    msg.payload = payload;
  });
}

/**
 * 发送启动连接事件
 * @param ws - WebSocket 连接实例
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function StartConnection(ws: WebSocket): Promise<void> {
  return sendMessage(
    ws,
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
    (msg) => {
      msg.event = EventType.StartConnection;
      msg.payload = new TextEncoder().encode("{}");
    }
  );
}

/**
 * 发送完成连接事件
 * @param ws - WebSocket 连接实例
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function FinishConnection(ws: WebSocket): Promise<void> {
  return sendMessage(
    ws,
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
    (msg) => {
      msg.event = EventType.FinishConnection;
      msg.payload = new TextEncoder().encode("{}");
    }
  );
}

/**
 * 发送启动会话事件
 * @param ws - WebSocket 连接实例
 * @param payload - 请求负载数据
 * @param sessionId - 会话 ID
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function StartSession(
  ws: WebSocket,
  payload: Uint8Array,
  sessionId: string
): Promise<void> {
  return sendMessage(
    ws,
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
    (msg) => {
      msg.event = EventType.StartSession;
      msg.sessionId = sessionId;
      msg.payload = payload;
    }
  );
}

/**
 * 发送完成会话事件
 * @param ws - WebSocket 连接实例
 * @param sessionId - 会话 ID
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function FinishSession(
  ws: WebSocket,
  sessionId: string
): Promise<void> {
  return sendMessage(
    ws,
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
    (msg) => {
      msg.event = EventType.FinishSession;
      msg.sessionId = sessionId;
      msg.payload = new TextEncoder().encode("{}");
    }
  );
}

/**
 * 发送取消会话事件
 * @param ws - WebSocket 连接实例
 * @param sessionId - 会话 ID
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function CancelSession(
  ws: WebSocket,
  sessionId: string
): Promise<void> {
  return sendMessage(
    ws,
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
    (msg) => {
      msg.event = EventType.CancelSession;
      msg.sessionId = sessionId;
      msg.payload = new TextEncoder().encode("{}");
    }
  );
}

/**
 * 发送任务请求事件
 * @param ws - WebSocket 连接实例
 * @param payload - 请求负载数据
 * @param sessionId - 会话 ID
 * @returns Promise，发送成功后 resolve，失败后 reject
 */
export async function TaskRequest(
  ws: WebSocket,
  payload: Uint8Array,
  sessionId: string
): Promise<void> {
  return sendMessage(
    ws,
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
    (msg) => {
      msg.event = EventType.TaskRequest;
      msg.sessionId = sessionId;
      msg.payload = payload;
    }
  );
}
