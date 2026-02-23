/**
 * ByteDance TTS 协议消息测试
 */

import {
  CompressionBits,
  EventType,
  HeaderSizeBits,
  MsgType,
  MsgTypeFlagBits,
  SerializationBits,
  VersionBits,
  createMessage,
  getEventTypeName,
  getMsgTypeName,
  marshalMessage,
  messageToString,
  unmarshalMessage,
} from "@/platforms/index.js";
import { describe, expect, it } from "vitest";

describe("协议消息", () => {
  describe("EventType 枚举", () => {
    it("应包含连接事件", () => {
      expect(EventType.StartConnection).toBe(1);
      expect(EventType.FinishConnection).toBe(2);
      expect(EventType.ConnectionStarted).toBe(50);
      expect(EventType.ConnectionFailed).toBe(51);
      expect(EventType.ConnectionFinished).toBe(52);
    });

    it("应包含会话事件", () => {
      expect(EventType.StartSession).toBe(100);
      expect(EventType.CancelSession).toBe(101);
      expect(EventType.FinishSession).toBe(102);
      expect(EventType.SessionStarted).toBe(150);
      expect(EventType.SessionFailed).toBe(153);
    });

    it("应包含 TTS 事件", () => {
      expect(EventType.SayHello).toBe(300);
      expect(EventType.TTSSentenceStart).toBe(350);
      expect(EventType.TTSSentenceEnd).toBe(351);
      expect(EventType.TTSResponse).toBe(352);
      expect(EventType.TTSEnded).toBe(359);
    });
  });

  describe("MsgType 枚举", () => {
    it("应包含有效的消息类型", () => {
      expect(MsgType.Invalid).toBe(0);
      expect(MsgType.FullClientRequest).toBe(0b1);
      expect(MsgType.AudioOnlyClient).toBe(0b10);
      expect(MsgType.FullServerResponse).toBe(0b1001);
      expect(MsgType.AudioOnlyServer).toBe(0b1011);
      expect(MsgType.Error).toBe(0b1111);
    });
  });

  describe("MsgTypeFlagBits 枚举", () => {
    it("应包含有效的标志位", () => {
      expect(MsgTypeFlagBits.NoSeq).toBe(0);
      expect(MsgTypeFlagBits.PositiveSeq).toBe(0b1);
      expect(MsgTypeFlagBits.LastNoSeq).toBe(0b10);
      expect(MsgTypeFlagBits.NegativeSeq).toBe(0b11);
      expect(MsgTypeFlagBits.WithEvent).toBe(0b100);
    });
  });

  describe("VersionBits 枚举", () => {
    it("应包含有效的版本", () => {
      expect(VersionBits.Version1).toBe(1);
      expect(VersionBits.Version2).toBe(2);
      expect(VersionBits.Version3).toBe(3);
      expect(VersionBits.Version4).toBe(4);
    });
  });

  describe("HeaderSizeBits 枚举", () => {
    it("应包含有效的头部大小", () => {
      expect(HeaderSizeBits.HeaderSize4).toBe(1);
      expect(HeaderSizeBits.HeaderSize8).toBe(2);
      expect(HeaderSizeBits.HeaderSize12).toBe(3);
      expect(HeaderSizeBits.HeaderSize16).toBe(4);
    });
  });

  describe("SerializationBits 枚举", () => {
    it("应包含有效的序列化类型", () => {
      expect(SerializationBits.Raw).toBe(0);
      expect(SerializationBits.JSON).toBe(0b1);
      expect(SerializationBits.Thrift).toBe(0b11);
      expect(SerializationBits.Custom).toBe(0b1111);
    });
  });

  describe("CompressionBits 枚举", () => {
    it("应包含有效的压缩类型", () => {
      expect(CompressionBits.None).toBe(0);
      expect(CompressionBits.Gzip).toBe(0b1);
      expect(CompressionBits.Custom).toBe(0b1111);
    });
  });

  describe("getEventTypeName", () => {
    it("应返回有效的事件类型名称", () => {
      expect(getEventTypeName(EventType.StartConnection)).toBe(
        "StartConnection"
      );
      expect(getEventTypeName(EventType.TTSResponse)).toBe("TTSResponse");
      expect(getEventTypeName(EventType.SessionStarted)).toBe("SessionStarted");
    });

    it("应在无效事件类型时返回错误提示", () => {
      expect(getEventTypeName(9999 as EventType)).toBe(
        "invalid event type: 9999"
      );
    });
  });

  describe("getMsgTypeName", () => {
    it("应返回有效的消息类型名称", () => {
      expect(getMsgTypeName(MsgType.FullClientRequest)).toBe(
        "FullClientRequest"
      );
      expect(getMsgTypeName(MsgType.AudioOnlyServer)).toBe("AudioOnlyServer");
      expect(getMsgTypeName(MsgType.Error)).toBe("Error");
    });

    it("应在无效消息类型时返回错误提示", () => {
      expect(getMsgTypeName(9999 as MsgType)).toBe(
        "invalid message type: 9999"
      );
    });
  });

  describe("createMessage", () => {
    it("应创建具有默认值的消息", () => {
      const msg = createMessage(
        MsgType.FullClientRequest,
        MsgTypeFlagBits.NoSeq
      );

      expect(msg.type).toBe(MsgType.FullClientRequest);
      expect(msg.flag).toBe(MsgTypeFlagBits.NoSeq);
      expect(msg.version).toBe(VersionBits.Version1);
      expect(msg.headerSize).toBe(HeaderSizeBits.HeaderSize4);
      expect(msg.serialization).toBe(SerializationBits.JSON);
      expect(msg.compression).toBe(CompressionBits.None);
      expect(msg.payload).toEqual(new Uint8Array(0));
    });

    it("应创建带有 toString 方法的消息", () => {
      const msg = createMessage(
        MsgType.FullClientRequest,
        MsgTypeFlagBits.NoSeq
      );

      expect(typeof msg.toString).toBe("function");
      expect(msg.toString()).toContain("FullClientRequest");
    });

    it("应创建不同类型的消息", () => {
      const audioMsg = createMessage(
        MsgType.AudioOnlyClient,
        MsgTypeFlagBits.PositiveSeq
      );

      expect(audioMsg.type).toBe(MsgType.AudioOnlyClient);
      expect(audioMsg.flag).toBe(MsgTypeFlagBits.PositiveSeq);
    });
  });

  describe("messageToString", () => {
    it("应将消息转换为字符串", () => {
      const msg = createMessage(
        MsgType.AudioOnlyServer,
        MsgTypeFlagBits.PositiveSeq
      );
      msg.event = EventType.TTSResponse;
      msg.sequence = 1;
      msg.payload = new TextEncoder().encode("test payload");

      const str = messageToString(msg);

      expect(str).toContain("AudioOnlyServer");
      expect(str).toContain("TTSResponse");
      expect(str).toContain("Sequence: 1");
    });

    it("应处理没有 sequence 的消息", () => {
      const msg = createMessage(MsgType.AudioOnlyServer, MsgTypeFlagBits.NoSeq);
      msg.event = EventType.TTSResponse;
      msg.payload = new TextEncoder().encode("test payload");

      const str = messageToString(msg);

      expect(str).toContain("AudioOnlyServer");
      expect(str).not.toContain("Sequence");
    });

    it("应处理错误消息", () => {
      const msg = createMessage(MsgType.Error, MsgTypeFlagBits.NoSeq);
      msg.event = EventType.SessionFailed;
      msg.errorCode = 1001;
      msg.payload = new TextEncoder().encode("error message");

      const str = messageToString(msg);

      expect(str).toContain("Error");
      expect(str).toContain("ErrorCode: 1001");
    });
  });

  describe("marshalMessage 和 unmarshalMessage", () => {
    it("应序列化并反序列化简单消息", () => {
      const originalMsg = createMessage(
        MsgType.FullClientRequest,
        MsgTypeFlagBits.NoSeq
      );
      originalMsg.payload = new TextEncoder().encode("test data");

      const marshalled = marshalMessage(originalMsg);
      const unmarshalled = unmarshalMessage(marshalled);

      expect(unmarshalled.version).toBe(originalMsg.version);
      expect(unmarshalled.headerSize).toBe(originalMsg.headerSize);
      expect(unmarshalled.type).toBe(originalMsg.type);
      expect(unmarshalled.flag).toBe(originalMsg.flag);
      expect(unmarshalled.serialization).toBe(originalMsg.serialization);
      expect(unmarshalled.compression).toBe(originalMsg.compression);
    });

    it("应序列化并反序列化带序列号的消息", () => {
      const originalMsg = createMessage(
        MsgType.AudioOnlyClient,
        MsgTypeFlagBits.PositiveSeq
      );
      originalMsg.sequence = 5;
      originalMsg.payload = new TextEncoder().encode("audio data");

      const marshalled = marshalMessage(originalMsg);
      const unmarshalled = unmarshalMessage(marshalled);

      expect(unmarshalled.type).toBe(MsgType.AudioOnlyClient);
      expect(unmarshalled.flag).toBe(MsgTypeFlagBits.PositiveSeq);
      expect(unmarshalled.sequence).toBe(5);
    });

    it("应序列化并反序列化带事件的消息", () => {
      const originalMsg = createMessage(
        MsgType.FullClientRequest,
        MsgTypeFlagBits.WithEvent
      );
      originalMsg.event = EventType.StartConnection;
      originalMsg.payload = new TextEncoder().encode("{}");

      const marshalled = marshalMessage(originalMsg);
      const unmarshalled = unmarshalMessage(marshalled);

      expect(unmarshalled.event).toBe(EventType.StartConnection);
    });

    it("应在数据太短时抛出错误", () => {
      const shortData = new Uint8Array([1, 2]);

      expect(() => {
        unmarshalMessage(shortData);
      }).toThrow();
    });

    it("应在不支持的消息类型时抛出错误", () => {
      // 创建一个有效的头部，但使用不支持的消息类型
      const data = new Uint8Array([
        (VersionBits.Version1 << 4) | HeaderSizeBits.HeaderSize4, // version + headerSize
        (99 << 4) | MsgTypeFlagBits.NoSeq, // 不支持的 msgType
        (SerializationBits.JSON << 4) | CompressionBits.None, // serialization + compression
      ]);

      expect(() => {
        unmarshalMessage(data);
      }).toThrow();
    });

    it("应正确处理空 payload", () => {
      const originalMsg = createMessage(
        MsgType.FullClientRequest,
        MsgTypeFlagBits.NoSeq
      );
      originalMsg.payload = new Uint8Array(0);

      const marshalled = marshalMessage(originalMsg);
      const unmarshalled = unmarshalMessage(marshalled);

      expect(unmarshalled.payload.length).toBe(0);
    });

    it("应正确处理二进制 payload", () => {
      const originalMsg = createMessage(
        MsgType.AudioOnlyServer,
        MsgTypeFlagBits.PositiveSeq
      );
      originalMsg.sequence = -1; // 表示最后一个包
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]);
      originalMsg.payload = binaryData;

      const marshalled = marshalMessage(originalMsg);
      const unmarshalled = unmarshalMessage(marshalled);

      expect(unmarshalled.payload).toEqual(binaryData);
    });
  });
});
