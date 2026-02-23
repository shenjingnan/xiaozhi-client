/**
 * 协议头测试
 */

import { describe, expect, it } from "vitest";
import {
  CompressionType,
  MessageType,
  MessageTypeSpecificFlags,
  PROTOCOL_VERSION,
  SerializationMethod,
  compressGzipSync,
  generateAudioDefaultHeader,
  generateFullDefaultHeader,
  generateHeader,
  generateLastAudioDefaultHeader,
  parseResponse,
} from "../../platforms/index.js";

describe("协议头生成", () => {
  it("应生成默认完整请求头", () => {
    const header = generateFullDefaultHeader();

    // 验证头部长度为 4 字节
    expect(header.length).toBe(4);

    // 验证协议版本
    const versionAndSize = header.readUInt8(0);
    const version = versionAndSize >> 4;
    expect(version).toBe(PROTOCOL_VERSION);

    // 验证消息类型为 CLIENT_FULL_REQUEST
    const messageTypeAndFlags = header.readUInt8(1);
    const messageType = messageTypeAndFlags >> 4;
    expect(messageType).toBe(MessageType.CLIENT_FULL_REQUEST);
  });

  it("应生成默认音频请求头", () => {
    const header = generateAudioDefaultHeader();

    expect(header.length).toBe(4);

    const messageTypeAndFlags = header.readUInt8(1);
    const messageType = messageTypeAndFlags >> 4;
    expect(messageType).toBe(MessageType.CLIENT_AUDIO_ONLY_REQUEST);
  });

  it("应生成带 NEG_SEQUENCE 标志的最后音频请求头", () => {
    const header = generateLastAudioDefaultHeader();

    expect(header.length).toBe(4);

    const messageTypeAndFlags = header.readUInt8(1);
    const messageType = messageTypeAndFlags >> 4;
    const flags = messageTypeAndFlags & 0x0f;

    expect(messageType).toBe(MessageType.CLIENT_AUDIO_ONLY_REQUEST);
    expect(flags).toBe(MessageTypeSpecificFlags.NEG_SEQUENCE);
  });

  it("应使用自定义选项生成头部", () => {
    const header = generateHeader({
      version: 0b0010,
      messageType: MessageType.SERVER_FULL_RESPONSE,
      messageTypeSpecificFlags: MessageTypeSpecificFlags.POS_SEQUENCE,
      serialMethod: SerializationMethod.JSON,
      compressionType: CompressionType.GZIP,
      reservedData: 0xff,
    });

    expect(header.length).toBe(4);

    // 验证版本和头部大小
    const versionAndSize = header.readUInt8(0);
    expect(versionAndSize >> 4).toBe(0b0010);
    expect(versionAndSize & 0x0f).toBe(1); // headerSize = 1 (4 字节 / 4)

    // 验证消息类型和标志
    const messageTypeAndFlags = header.readUInt8(1);
    expect(messageTypeAndFlags >> 4).toBe(MessageType.SERVER_FULL_RESPONSE);
    expect(messageTypeAndFlags & 0x0f).toBe(
      MessageTypeSpecificFlags.POS_SEQUENCE
    );

    // 验证序列化和压缩
    const serialAndCompression = header.readUInt8(2);
    expect(serialAndCompression >> 4).toBe(SerializationMethod.JSON);
    expect(serialAndCompression & 0x0f).toBe(CompressionType.GZIP);

    // 验证保留字段
    expect(header.readUInt8(3)).toBe(0xff);
  });

  it("应支持扩展头部", () => {
    const extensionHeader = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const header = generateHeader({
      extensionHeader,
    });

    // 扩展头部为 4 字节，所以 headerSize = 1 + 1 = 2
    expect(header.length).toBe(8);

    // 验证头部大小
    const versionAndSize = header.readUInt8(0);
    expect(versionAndSize & 0x0f).toBe(2);

    // 验证扩展头部内容
    expect(header.subarray(4, 8).toString()).toBe(extensionHeader.toString());
  });

  it("应使用自定义压缩类型生成头部", () => {
    const header = generateHeader({
      compressionType: CompressionType.NO_COMPRESSION,
    });

    const serialAndCompression = header.readUInt8(2);
    expect(serialAndCompression & 0x0f).toBe(CompressionType.NO_COMPRESSION);
  });
});

describe("响应解析", () => {
  it("应解析服务器完整响应", () => {
    // 构造一个模拟的服务器响应
    const payload = JSON.stringify({ result: "测试文本" });
    const compressedPayload = compressGzipSync(Buffer.from(payload, "utf-8"));

    const response = Buffer.alloc(8 + compressedPayload.length);

    // 头部字节
    response.writeUInt8((PROTOCOL_VERSION << 4) | 1, 0); // version | headerSize
    response.writeUInt8(
      (MessageType.SERVER_FULL_RESPONSE << 4) |
        MessageTypeSpecificFlags.NO_SEQUENCE,
      1
    ); // messageType | flags
    response.writeUInt8(
      (SerializationMethod.JSON << 4) | CompressionType.GZIP,
      2
    ); // serialMethod | compression
    response.writeUInt8(0x00, 3); // reserved

    // 负载大小 (4 字节)
    response.writeInt32BE(compressedPayload.length, 4);

    // 压缩后的负载
    compressedPayload.copy(response, 8);

    const parsed = parseResponse(response);

    expect(parsed.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(parsed.headerSize).toBe(1);
    expect(parsed.messageType).toBe(MessageType.SERVER_FULL_RESPONSE);
    expect(parsed.serializationMethod).toBe(SerializationMethod.JSON);
    expect(parsed.messageCompression).toBe(CompressionType.GZIP);
    expect(parsed.payloadMsg).toEqual({ result: "测试文本" });
  });

  it("应解析服务器 ACK 响应", () => {
    const response = Buffer.alloc(12);

    response.writeUInt8((PROTOCOL_VERSION << 4) | 1, 0);
    response.writeUInt8(
      (MessageType.SERVER_ACK << 4) | MessageTypeSpecificFlags.NO_SEQUENCE,
      1
    );
    response.writeUInt8(
      (SerializationMethod.JSON << 4) | CompressionType.GZIP,
      2
    );
    response.writeUInt8(0x00, 3);

    // seq (4 bytes)
    response.writeInt32BE(1, 4);

    // payload size (4 bytes)
    response.writeUInt32BE(0, 8);

    const parsed = parseResponse(response);

    expect(parsed.messageType).toBe(MessageType.SERVER_ACK);
    expect(parsed.seq).toBe(1);
  });

  it("应解析服务器错误响应", () => {
    const errorMessage = "Error: Invalid token";
    const payload = Buffer.from(errorMessage, "utf-8");

    const response = Buffer.alloc(12);

    response.writeUInt8((PROTOCOL_VERSION << 4) | 1, 0);
    response.writeUInt8(
      (MessageType.SERVER_ERROR_RESPONSE << 4) |
        MessageTypeSpecificFlags.NO_SEQUENCE,
      1
    );
    response.writeUInt8(
      (SerializationMethod.NO_SERIALIZATION << 4) |
        CompressionType.NO_COMPRESSION,
      2
    );
    response.writeUInt8(0x00, 3);

    // error code (4 bytes)
    response.writeUInt32BE(401, 4);

    // payload size (4 bytes)
    response.writeUInt32BE(payload.length, 8);

    // payload
    payload.copy(response, 12);

    const parsed = parseResponse(response);

    expect(parsed.messageType).toBe(MessageType.SERVER_ERROR_RESPONSE);
    expect(parsed.code).toBe(401);
  });

  it("应处理未压缩的负载", () => {
    const payload = JSON.stringify({ result: "未压缩数据" });
    const payloadBuffer = Buffer.from(payload, "utf-8");

    const response = Buffer.alloc(8 + payloadBuffer.length);

    response.writeUInt8((PROTOCOL_VERSION << 4) | 1, 0);
    response.writeUInt8(
      (MessageType.SERVER_FULL_RESPONSE << 4) |
        MessageTypeSpecificFlags.NO_SEQUENCE,
      1
    );
    response.writeUInt8(
      (SerializationMethod.JSON << 4) | CompressionType.NO_COMPRESSION,
      2
    );
    response.writeUInt8(0x00, 3);

    response.writeInt32BE(payloadBuffer.length, 4);
    payloadBuffer.copy(response, 8);

    const parsed = parseResponse(response);

    expect(parsed.messageCompression).toBe(CompressionType.NO_COMPRESSION);
    expect(parsed.payloadMsg).toEqual({ result: "未压缩数据" });
  });

  it("应处理无效的 GZIP 数据", () => {
    const response = Buffer.alloc(8);

    response.writeUInt8((PROTOCOL_VERSION << 4) | 1, 0);
    response.writeUInt8(
      (MessageType.SERVER_FULL_RESPONSE << 4) |
        MessageTypeSpecificFlags.NO_SEQUENCE,
      1
    );
    response.writeUInt8(
      (SerializationMethod.JSON << 4) | CompressionType.GZIP,
      2
    );
    response.writeUInt8(0x00, 3);

    // 无效的压缩数据
    response.writeInt32BE(0, 4);

    const parsed = parseResponse(response);

    // 应该不会抛出错误，而是返回原始数据
    expect(parsed.payloadMsg).toBeDefined();
  });
});

describe("GZIP 压缩", () => {
  it("应正确压缩数据", () => {
    const originalData = Buffer.from("测试压缩数据", "utf-8");
    const compressed = compressGzipSync(originalData);

    // 压缩后的数据应该比原始数据小（对于文本数据）
    expect(compressed.length).toBeGreaterThan(0);
    // GZIP 数据有特定的头部标识
    expect(compressed[0]).toBe(0x1f); // GZIP 魔数第一个字节
    expect(compressed[1]).toBe(0x8b); // GZIP 魔数第二个字节
  });

  it("应正确压缩空数据", () => {
    const compressed = compressGzipSync(Buffer.alloc(0));
    expect(compressed.length).toBeGreaterThan(0);
  });
});
