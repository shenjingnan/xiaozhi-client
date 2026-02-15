import { describe, expect, it } from "vitest";
import {
  CompressionBits,
  EventType,
  HeaderSizeBits,
  MsgType,
  MsgTypeFlagBits,
  ReceiveMessage,
  SerializationBits,
  VersionBits,
  createMessage,
  getEventTypeName,
  getMsgTypeName,
  marshalMessage,
  unmarshalMessage,
} from "../protocols.js";

describe("protocols - 辅助函数测试", () => {
  describe("getEventTypeName", () => {
    it("应该返回有效事件类型的名称", () => {
      expect(getEventTypeName(EventType.StartSession)).toBe("StartSession");
      expect(getEventTypeName(EventType.SessionFinished)).toBe(
        "SessionFinished"
      );
      expect(getEventTypeName(EventType.ConnectionStarted)).toBe(
        "ConnectionStarted"
      );
    });

    it("应该对无效事件类型返回错误信息", () => {
      expect(getEventTypeName(999 as EventType)).toBe(
        "invalid event type: 999"
      );
    });
  });

  describe("getMsgTypeName", () => {
    it("应该返回有效消息类型的名称", () => {
      expect(getMsgTypeName(MsgType.AudioOnlyServer)).toBe("AudioOnlyServer");
      expect(getMsgTypeName(MsgType.AudioOnlyClient)).toBe("AudioOnlyClient");
      expect(getMsgTypeName(MsgType.Error)).toBe("Error");
    });

    it("应该对无效消息类型返回错误信息", () => {
      expect(getMsgTypeName(999 as MsgType)).toBe("invalid message type: 999");
    });
  });
});

describe("protocols - createMessage 测试", () => {
  it("应该创建带有默认值的基本消息", () => {
    const msg = createMessage(MsgType.AudioOnlyClient, MsgTypeFlagBits.NoSeq);

    expect(msg.type).toBe(MsgType.AudioOnlyClient);
    expect(msg.flag).toBe(MsgTypeFlagBits.NoSeq);
    expect(msg.version).toBe(VersionBits.Version1);
    expect(msg.headerSize).toBe(HeaderSizeBits.HeaderSize4);
    expect(msg.serialization).toBe(SerializationBits.JSON);
    expect(msg.compression).toBe(CompressionBits.None);
    expect(msg.payload).toEqual(new Uint8Array(0));
  });

  it("应该包含 toString 方法", () => {
    const msg = createMessage(MsgType.AudioOnlyClient, MsgTypeFlagBits.NoSeq);
    const str = msg.toString();

    expect(typeof str).toBe("string");
    expect(str).toContain("AudioOnlyClient");
  });
});

describe("protocols - marshalMessage/unmarshalMessage 往返测试", () => {
  it("应该处理 NoSeq 标志（最小消息）", () => {
    const originalMsg = createMessage(
      MsgType.AudioOnlyClient,
      MsgTypeFlagBits.NoSeq
    );
    originalMsg.payload = new TextEncoder().encode("test");

    const data = marshalMessage(originalMsg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.type).toBe(originalMsg.type);
    expect(decodedMsg.flag).toBe(originalMsg.flag);
    expect(decodedMsg.payload).toEqual(originalMsg.payload);
  });

  it("应该处理 PositiveSeq 标志（带正序列号）", () => {
    const originalMsg = createMessage(
      MsgType.AudioOnlyClient,
      MsgTypeFlagBits.PositiveSeq
    );
    originalMsg.sequence = 100;
    originalMsg.payload = new TextEncoder().encode("test payload");

    const data = marshalMessage(originalMsg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.type).toBe(originalMsg.type);
    expect(decodedMsg.flag).toBe(originalMsg.flag);
    expect(decodedMsg.sequence).toBe(100);
    expect(decodedMsg.payload).toEqual(originalMsg.payload);
  });

  it("应该处理 NegativeSeq 标志（带负序列号）", () => {
    const originalMsg = createMessage(
      MsgType.AudioOnlyServer,
      MsgTypeFlagBits.NegativeSeq
    );
    originalMsg.sequence = -1;
    originalMsg.payload = new TextEncoder().encode("end");

    const data = marshalMessage(originalMsg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.type).toBe(originalMsg.type);
    expect(decodedMsg.flag).toBe(originalMsg.flag);
    expect(decodedMsg.sequence).toBe(-1);
    expect(decodedMsg.payload).toEqual(originalMsg.payload);
  });

  it("应该处理 WithEvent 标志（带事件）", () => {
    const originalMsg = createMessage(
      MsgType.FullClientRequest,
      MsgTypeFlagBits.WithEvent
    );
    originalMsg.event = EventType.StartSession;
    originalMsg.sessionId = "test-session-123";
    originalMsg.payload = new TextEncoder().encode("{}");

    const data = marshalMessage(originalMsg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.type).toBe(originalMsg.type);
    expect(decodedMsg.flag).toBe(originalMsg.flag);
    expect(decodedMsg.event).toBe(EventType.StartSession);
    expect(decodedMsg.sessionId).toBe("test-session-123");
    expect(decodedMsg.payload).toEqual(originalMsg.payload);
  });

  it("应该处理 Error 消息类型", () => {
    const originalMsg = createMessage(MsgType.Error, MsgTypeFlagBits.NoSeq);
    originalMsg.errorCode = 1001;
    originalMsg.payload = new TextEncoder().encode("error message");

    const data = marshalMessage(originalMsg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.type).toBe(MsgType.Error);
    expect(decodedMsg.errorCode).toBe(1001);
    expect(decodedMsg.payload).toEqual(originalMsg.payload);
  });

  it("应该处理大 payload (10KB)", () => {
    const largePayload = new Uint8Array(10 * 1024);
    for (let i = 0; i < largePayload.length; i++) {
      largePayload[i] = i % 256;
    }

    const originalMsg = createMessage(
      MsgType.AudioOnlyServer,
      MsgTypeFlagBits.PositiveSeq
    );
    originalMsg.sequence = 1;
    originalMsg.payload = largePayload;

    const data = marshalMessage(originalMsg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.payload).toEqual(largePayload);
  });

  it("应该处理空 payload", () => {
    const originalMsg = createMessage(
      MsgType.AudioOnlyServer,
      MsgTypeFlagBits.NoSeq
    );
    originalMsg.payload = new Uint8Array(0);

    const data = marshalMessage(originalMsg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.payload).toEqual(new Uint8Array(0));
  });
});

describe("protocols - 消息类型编码测试", () => {
  it("应该正确编码 AudioOnlyClient", () => {
    const msg = createMessage(MsgType.AudioOnlyClient, MsgTypeFlagBits.NoSeq);
    msg.payload = new Uint8Array([1, 2, 3]);

    const data = marshalMessage(msg);
    const typeAndFlag = data[1];
    const decodedType = typeAndFlag >> 4;

    expect(decodedType).toBe(MsgType.AudioOnlyClient);
  });

  it("应该正确编码 AudioOnlyServer", () => {
    const msg = createMessage(MsgType.AudioOnlyServer, MsgTypeFlagBits.NoSeq);
    msg.payload = new Uint8Array([1, 2, 3]);

    const data = marshalMessage(msg);
    const typeAndFlag = data[1];
    const decodedType = typeAndFlag >> 4;

    expect(decodedType).toBe(MsgType.AudioOnlyServer);
  });

  it("应该正确编码 FullClientRequest", () => {
    const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq);
    msg.payload = new Uint8Array([1, 2, 3]);

    const data = marshalMessage(msg);
    const typeAndFlag = data[1];
    const decodedType = typeAndFlag >> 4;

    expect(decodedType).toBe(MsgType.FullClientRequest);
  });

  it("应该正确编码 Error", () => {
    const msg = createMessage(MsgType.Error, MsgTypeFlagBits.NoSeq);
    msg.errorCode = 500;
    msg.payload = new TextEncoder().encode("error");

    const data = marshalMessage(msg);
    const typeAndFlag = data[1];
    const decodedType = typeAndFlag >> 4;

    expect(decodedType).toBe(MsgType.Error);
  });
});

describe("protocols - EventType 字段测试", () => {
  it("应该写入 StartSession 事件", () => {
    const msg = createMessage(
      MsgType.FullClientRequest,
      MsgTypeFlagBits.WithEvent
    );
    msg.event = EventType.StartSession;
    msg.sessionId = "session-001";
    msg.payload = new TextEncoder().encode("{}");

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.event).toBe(EventType.StartSession);
    expect(decodedMsg.sessionId).toBe("session-001");
  });

  it("应该写入 SessionFinished 事件", () => {
    const msg = createMessage(
      MsgType.FullClientRequest,
      MsgTypeFlagBits.WithEvent
    );
    msg.event = EventType.SessionFinished;
    msg.sessionId = "session-002";
    msg.payload = new TextEncoder().encode("{}");

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.event).toBe(EventType.SessionFinished);
    expect(decodedMsg.sessionId).toBe("session-002");
  });

  it("应该处理 ConnectionStarted 事件", () => {
    const msg = createMessage(
      MsgType.FullClientRequest,
      MsgTypeFlagBits.WithEvent
    );
    msg.event = EventType.ConnectionStarted;
    msg.connectId = "connect-003";
    msg.payload = new TextEncoder().encode("{}");

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.event).toBe(EventType.ConnectionStarted);
    expect(decodedMsg.connectId).toBe("connect-003");
  });

  it("应该处理空 sessionId（实现上返回 undefined）", () => {
    const msg = createMessage(
      MsgType.FullClientRequest,
      MsgTypeFlagBits.WithEvent
    );
    msg.event = EventType.StartSession;
    msg.sessionId = "";
    msg.payload = new TextEncoder().encode("{}");

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.event).toBe(EventType.StartSession);
    // 实现上空字符串 sessionId 被处理为 undefined（写入 size=0）
    expect(decodedMsg.sessionId).toBeUndefined();
  });
});

describe("protocols - Payload 测试", () => {
  it("应该处理空 payload", () => {
    const msg = createMessage(MsgType.AudioOnlyServer, MsgTypeFlagBits.NoSeq);
    msg.payload = new Uint8Array(0);

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.payload.length).toBe(0);
  });

  it("应该处理小数据 payload (10 字节)", () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const msg = createMessage(MsgType.AudioOnlyServer, MsgTypeFlagBits.NoSeq);
    msg.payload = payload;

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.payload).toEqual(payload);
  });

  it("应该处理大数据 payload (50KB)", () => {
    const payload = new Uint8Array(50 * 1024);
    for (let i = 0; i < payload.length; i++) {
      payload[i] = (i * 7) % 256;
    }

    const msg = createMessage(MsgType.AudioOnlyServer, MsgTypeFlagBits.NoSeq);
    msg.payload = payload;

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.payload).toEqual(payload);
  });

  it("应该处理二进制数据（包含 0x00, 0xFF 等）", () => {
    const payload = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xff, 0x00, 0xff]);
    const msg = createMessage(MsgType.AudioOnlyServer, MsgTypeFlagBits.NoSeq);
    msg.payload = payload;

    const data = marshalMessage(msg);
    const decodedMsg = unmarshalMessage(data);

    expect(decodedMsg.payload).toEqual(payload);
  });
});

describe("protocols - messageToString 测试", () => {
  it("应该正确格式化 AudioOnlyServer 带序列号", () => {
    const msg = createMessage(
      MsgType.AudioOnlyServer,
      MsgTypeFlagBits.PositiveSeq
    );
    msg.sequence = 100;
    msg.payload = new TextEncoder().encode("audio data");

    const str = msg.toString();

    expect(str).toContain("AudioOnlyServer");
    expect(str).toContain("Sequence: 100");
  });

  it("应该正确格式化 Error 类型", () => {
    const msg = createMessage(MsgType.Error, MsgTypeFlagBits.NoSeq);
    msg.errorCode = 500;
    msg.payload = new TextEncoder().encode("Internal Error");

    const str = msg.toString();

    expect(str).toContain("Error");
    expect(str).toContain("ErrorCode: 500");
  });
});

describe("protocols - 错误场景测试", () => {
  it("应该在数据过短时抛出错误", () => {
    const shortData = new Uint8Array([1, 2]);

    expect(() => unmarshalMessage(shortData)).toThrow("data too short");
  });

  it("应该在无效消息类型时抛出错误", () => {
    // Create a message with invalid type (0 which is Invalid)
    const header = new Uint8Array(3);
    header[0] = (VersionBits.Version1 << 4) | HeaderSizeBits.HeaderSize4;
    header[1] = (MsgType.Invalid << 4) | MsgTypeFlagBits.NoSeq;
    header[2] = (SerializationBits.JSON << 4) | CompressionBits.None;

    // Add minimal payload
    const payloadSize = new Uint8Array(4);
    const view = new DataView(payloadSize.buffer);
    view.setUint32(0, 0, false);
    const data = new Uint8Array([...header, ...payloadSize]);

    expect(() => unmarshalMessage(data)).toThrow("unsupported message type");
  });

  it("应该在不完整 event 数据时抛出错误", () => {
    // Create message with WithEvent flag but not enough data
    const header = new Uint8Array(4); // Just header, no event data
    header[0] = (VersionBits.Version1 << 4) | HeaderSizeBits.HeaderSize4;
    header[1] = (MsgType.FullClientRequest << 4) | MsgTypeFlagBits.WithEvent;
    header[2] = (SerializationBits.JSON << 4) | CompressionBits.None;
    header[3] = 0; // padding

    expect(() => unmarshalMessage(header)).toThrow(
      "insufficient data for event"
    );
  });

  it("应该在不完整 payload 时抛出错误", () => {
    // Create a valid header but declare larger payload than available
    const header = new Uint8Array(8);
    header[0] = (VersionBits.Version1 << 4) | HeaderSizeBits.HeaderSize4;
    header[1] = (MsgType.AudioOnlyServer << 4) | MsgTypeFlagBits.NoSeq;
    header[2] = (SerializationBits.JSON << 4) | CompressionBits.None;
    header[3] = 0;

    // Declare payload size of 100 bytes but only provide 10
    const sizeView = new DataView(header.buffer, header.byteOffset + 4, 4);
    sizeView.setUint32(0, 100, false);

    const data = new Uint8Array([...header, ...new Uint8Array(10)]);

    expect(() => unmarshalMessage(data)).toThrow(
      "insufficient data for payload"
    );
  });
});

describe("protocols - ReceiveMessage 测试", () => {
  it("应该导出 ReceiveMessage 函数", () => {
    // 验证 ReceiveMessage 函数已正确导出
    expect(ReceiveMessage).toBeDefined();
    expect(typeof ReceiveMessage).toBe("function");
  });
});
