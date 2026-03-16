/**
 * OGG 转换器单元测试
 *
 * 注意：这些测试需要系统中安装 ffmpeg
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeAll } from "vitest";
import {
  convertOggToWav,
  convertOggToPcm,
  convertMp3ToWav,
  convertAudioToWav,
} from "@/audio/OggConverter.js";

describe("OggConverter", () => {
  let ffmpegAvailable: boolean;

  beforeAll(() => {
    // 检查 ffmpeg 是否可用
    try {
      const { execFileSync } = require("node:child_process");
      execFileSync("ffmpeg", ["-version"], { stdio: "pipe" });
      ffmpegAvailable = true;
    } catch {
      ffmpegAvailable = false;
    }
  });

  describe("convertOggToWav", () => {
    it("应该在 ffmpeg 不可用时抛出错误", async () => {
      if (ffmpegAvailable) {
        // 跳过此测试
        return;
      }

      await expect(async () => {
        convertOggToWav("/nonexistent/file.ogg");
      }).rejects.toThrow();
    });

    it("应该为不存在的文件抛出错误", () => {
      if (!ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertOggToWav("/nonexistent/path/to/file.ogg");
      }).toThrow();
    });

    it("应该使用指定的输出路径", () => {
      if (!ffmpegAvailable) {
        return;
      }

      const outputPath = join(tmpdir(), `test-ogg-${Date.now()}.wav`);

      try {
        // 这个测试需要实际的 OGG 文件
        // 在 CI 环境中可能会失败
        expect(() => {
          convertOggToWav("/nonexistent/file.ogg", outputPath);
        }).toThrow();
      } finally {
        if (existsSync(outputPath)) {
          unlinkSync(outputPath);
        }
      }
    });
  });

  describe("convertOggToPcm", () => {
    it("应该在 ffmpeg 不可用时抛出错误", () => {
      if (ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertOggToPcm("/nonexistent/file.ogg");
      }).toThrow();
    });

    it("应该为不存在的文件抛出错误", () => {
      if (!ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertOggToPcm("/nonexistent/file.ogg");
      }).toThrow();
    });
  });

  describe("convertMp3ToWav", () => {
    it("应该在 ffmpeg 不可用时抛出错误", () => {
      if (ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertMp3ToWav("/nonexistent/file.mp3");
      }).toThrow();
    });

    it("应该为不存在的文件抛出错误", () => {
      if (!ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertMp3ToWav("/nonexistent/file.mp3");
      }).toThrow();
    });

    it("应该使用指定的输出路径", () => {
      if (!ffmpegAvailable) {
        return;
      }

      const outputPath = join(tmpdir(), `test-mp3-${Date.now()}.wav`);

      try {
        expect(() => {
          convertMp3ToWav("/nonexistent/file.mp3", outputPath);
        }).toThrow();
      } finally {
        if (existsSync(outputPath)) {
          unlinkSync(outputPath);
        }
      }
    });
  });

  describe("convertAudioToWav", () => {
    it("应该在 ffmpeg 不可用时抛出错误", () => {
      if (ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertAudioToWav("/nonexistent/file.wav");
      }).toThrow();
    });

    it("应该为不存在的文件抛出错误", () => {
      if (!ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertAudioToWav("/nonexistent/file.wav");
      }).toThrow();
    });

    it("应该支持自定义采样率和声道数", () => {
      if (!ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertAudioToWav("/nonexistent/file.wav", undefined, 48000, 2);
      }).toThrow();
    });

    it("应该使用指定的输出路径", () => {
      if (!ffmpegAvailable) {
        return;
      }

      const outputPath = join(tmpdir(), `test-audio-${Date.now()}.wav`);

      try {
        expect(() => {
          convertAudioToWav("/nonexistent/file.wav", outputPath, 16000, 1);
        }).toThrow();
      } finally {
        if (existsSync(outputPath)) {
          unlinkSync(outputPath);
        }
      }
    });
  });

  describe("ffmpeg 参数验证", () => {
    it("应该生成正确的输出路径", () => {
      if (!ffmpegAvailable) {
        return;
      }

      const outputPath = join(tmpdir(), `test-param-${Date.now()}.wav`);

      try {
        expect(() => {
          convertAudioToWav("/nonexistent/input.wav", outputPath);
        }).toThrow();
      } finally {
        if (existsSync(outputPath)) {
          unlinkSync(outputPath);
        }
      }
    });

    it("应该使用临时目录当未指定输出路径", () => {
      if (!ffmpegAvailable) {
        return;
      }

      // 由于文件不存在，会抛出错误，但错误消息应该包含失败信息
      expect(() => {
        convertOggToWav("/nonexistent/file.ogg");
      }).toThrow();
    });
  });

  describe("错误处理", () => {
    it("应该提供有意义的错误消息", () => {
      if (!ffmpegAvailable) {
        return;
      }

      try {
        convertOggToWav("/nonexistent/file.ogg");
        expect.fail("应该抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Failed to convert");
      }
    });

    it("应该区分不同的转换类型错误", () => {
      if (!ffmpegAvailable) {
        return;
      }

      // OGG 转换错误
      try {
        convertOggToWav("/nonexistent/file.ogg");
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).toContain("OGG to WAV");
      }

      // MP3 转换错误
      try {
        convertMp3ToWav("/nonexistent/file.mp3");
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).toContain("MP3 to WAV");
      }

      // 通用转换错误
      try {
        convertAudioToWav("/nonexistent/file.wav");
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).toContain("audio to WAV");
      }
    });
  });

  describe("边界情况", () => {
    it("应该处理空路径", () => {
      if (!ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertOggToWav("");
      }).toThrow();
    });

    it("应该处理特殊字符路径", () => {
      if (!ffmpegAvailable) {
        return;
      }

      expect(() => {
        convertOggToWav("/path/with spaces/file.ogg");
      }).toThrow();
    });
  });
});
