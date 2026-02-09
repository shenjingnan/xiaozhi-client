/**
 * OggOpusTTSService 单元测试
 */

import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { OggOpusTTSService } from "../ogg-opus-tts.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("OggOpusTTSService", () => {
  describe("预处理模式 (usePreprocessed=true)", () => {
    let service: OggOpusTTSService;

    beforeEach(() => {
      service = new OggOpusTTSService({
        usePreprocessed: true,
        audioFilePath: join(__dirname, "../../../assets/audio/test.opus"),
      });
    });

    describe("initialize", () => {
      it("应该成功加载预处理Opus文件", async () => {
        await service.initialize();

        expect(service.getAudioDataSize()).toBeGreaterThan(0);
      });

      it("应该只初始化一次", async () => {
        await service.initialize();
        const size1 = service.getAudioDataSize();

        await service.initialize();
        const size2 = service.getAudioDataSize();

        expect(size1).toBe(size2);
      });

      it("应该记录音频数据大小", async () => {
        await service.initialize();

        const size = service.getAudioDataSize();
        expect(size).toBeGreaterThan(1000); // 测试音频至少有1KB
      });
    });

    describe("synthesize", () => {
      it("应该在未初始化时自动初始化", async () => {
        const result = await service.synthesize("测试文本");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
      });

      it("应该返回测试音频数据", async () => {
        await service.initialize();

        const result = await service.synthesize("任意文本");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(service.getAudioDataSize());
      });

      it("应该忽略输入文本内容", async () => {
        await service.initialize();

        const result1 = await service.synthesize("文本1");
        const result2 = await service.synthesize("文本2");

        expect(result1).toEqual(result2);
      });
    });

    describe("getAudioDataSize", () => {
      it("应该在未初始化时返回0", () => {
        expect(service.getAudioDataSize()).toBe(0);
      });

      it("应该在初始化后返回实际大小", async () => {
        await service.initialize();

        expect(service.getAudioDataSize()).toBeGreaterThan(0);
      });
    });

    describe("reset", () => {
      it("应该重置服务状态", async () => {
        await service.initialize();
        expect(service.getAudioDataSize()).toBeGreaterThan(0);

        service.reset();
        expect(service.getAudioDataSize()).toBe(0);
      });
    });

    describe("完整流程", () => {
      it("应该能够连续处理多个TTS请求", async () => {
        const result1 = await service.synthesize("第一句话");
        const result2 = await service.synthesize("第二句话");
        const result3 = await service.synthesize("第三句话");

        expect(result1).toEqual(result2);
        expect(result2).toEqual(result3);
      });
    });
  });

  describe("兼容模式 (usePreprocessed=false, enableDemuxing=true)", () => {
    let service: OggOpusTTSService;

    beforeEach(() => {
      service = new OggOpusTTSService({
        usePreprocessed: false,
        enableDemuxing: true,
        audioFilePath: join(__dirname, "../../../assets/audio/test.opus"),
      });
    });

    describe("initialize", () => {
      it("应该成功加载Ogg文件并解封装", async () => {
        await service.initialize();

        expect(service.getAudioDataSize()).toBeGreaterThan(0);
      });

      it("应该只初始化一次", async () => {
        await service.initialize();
        const size1 = service.getAudioDataSize();

        await service.initialize();
        const size2 = service.getAudioDataSize();

        expect(size1).toBe(size2);
      });

      it("解封装后的数据应该小于原始文件", async () => {
        await service.initialize();

        const opusSize = service.getAudioDataSize();
        // 解封装后去掉Ogg容器开销，应该小于原文件
        expect(opusSize).toBeGreaterThan(1000);
      });
    });

    describe("synthesize", () => {
      it("应该在未初始化时自动初始化", async () => {
        const result = await service.synthesize("测试文本");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
      });

      it("应该返回解封装后的Opus数据", async () => {
        await service.initialize();

        const result = await service.synthesize("任意文本");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(service.getAudioDataSize());
      });
    });

    describe("完整流程", () => {
      it("应该能够连续处理多个TTS请求", async () => {
        const result1 = await service.synthesize("第一句话");
        const result2 = await service.synthesize("第二句话");
        const result3 = await service.synthesize("第三句话");

        expect(result1).toEqual(result2);
        expect(result2).toEqual(result3);
      });
    });
  });

  describe("直通模式 (usePreprocessed=false, enableDemuxing=false)", () => {
    let service: OggOpusTTSService;

    beforeEach(() => {
      service = new OggOpusTTSService({
        usePreprocessed: false,
        enableDemuxing: false,
        audioFilePath: join(__dirname, "../../../assets/audio/test.opus"),
      });
    });

    describe("initialize", () => {
      it("应该直接加载原始数据", async () => {
        await service.initialize();

        expect(service.getAudioDataSize()).toBeGreaterThan(0);
      });
    });

    describe("synthesize", () => {
      it("应该返回原始文件数据", async () => {
        await service.initialize();

        const result = await service.synthesize("任意文本");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(service.getAudioDataSize());
      });
    });
  });
});
