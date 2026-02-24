/**
 * Demo: TTS 流式合成
 *
 * 此演示展示如何使用 TTS 客户端进行流式语音合成，
 * 即边合成边获取音频块，适用于实时播放场景。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { TTS } from "../src/index.js";

// 从环境变量读取配置
const APP_ID = process.env.BYTEDANCE_APP_ID || "your-app-id";
const TOKEN = process.env.BYTEDANCE_TOKEN || "your-token";
const OUTPUT_PATH = path.resolve(__dirname, "output-stream.wav");
const VOICE_TYPE =
  process.env.BYTEDANCE_VOICE_TYPE || "zh_female_xiaohe_uranus_bigtts";

/**
 * WAV 文件头常量
 */
const WAV_HEADER_SIZE = 44;

/**
 * 检测数据是否包含 WAV 头
 * WAV 文件以 "RIFF" (0x52 0x49 0x46 0x46) 开头
 */
function hasWavHeader(data: Uint8Array): boolean {
  return (
    data.length >= 4 &&
    data[0] === 0x52 && // R
    data[1] === 0x49 && // I
    data[2] === 0x46 && // F
    data[3] === 0x46 // F
  );
}

/**
 * 从 WAV 数据中提取音频数据（跳过 WAV 头）
 */
function extractAudioData(data: Uint8Array): Uint8Array {
  if (!hasWavHeader(data)) {
    return data;
  }
  // 跳过 44 字节的 WAV 头
  return data.slice(WAV_HEADER_SIZE);
}

/**
 * 从 WAV 数据中提取 WAV 头信息
 * 返回采样率、声道数、位深度等信息
 *
 * WAV 头结构:
 * - Bytes 0-3: "RIFF"
 * - Bytes 4-7: RIFF chunk size
 * - Bytes 8-11: "WAVE"
 * - Bytes 12-15: "fmt "
 * - Bytes 16-19: fmt chunk size (16)
 * - Bytes 20-21: audio format (1 = PCM)
 * - Bytes 22-23: number of channels
 * - Bytes 24-27: sample rate (little-endian)
 * - Bytes 28-31: byte rate
 * - Bytes 32-33: block align
 * - Bytes 34-35: bits per sample
 * - Bytes 36-39: "data"
 * - Bytes 40-43: data size
 */
function parseWavHeader(data: Uint8Array): {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
} | null {
  if (!hasWavHeader(data) || data.length < 44) {
    return null;
  }

  // 声道数位于偏移量 22-23
  const channels = data[22] | (data[23] << 8);
  // 采样率位于偏移量 24-27 (little-endian)
  const sampleRate =
    data[24] | (data[25] << 8) | (data[26] << 16) | (data[27] << 24);
  // 位深度位于偏移量 34-35
  const bitsPerSample = data[34] | (data[35] << 8);

  return { sampleRate, channels, bitsPerSample };
}

/**
 * 构建 WAV 文件头
 * @param sampleRate 采样率
 * @param channels 声道数
 * @param bitsPerSample 位深度
 * @param dataSize 音频数据大小
 */
function createWavHeader(
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
  dataSize: number
): Uint8Array {
  const header = new Uint8Array(44);

  // RIFF 头
  header[0] = 0x52; // R
  header[1] = 0x49; // I
  header[2] = 0x46; // F
  header[3] = 0x46; // F

  // 文件大小 - 8
  const fileSize = dataSize + 36;
  header[4] = fileSize & 0xff;
  header[5] = (fileSize >> 8) & 0xff;
  header[6] = (fileSize >> 16) & 0xff;
  header[7] = (fileSize >> 24) & 0xff;

  // WAVE
  header[8] = 0x57; // W
  header[9] = 0x41; // A
  header[10] = 0x56; // V
  header[11] = 0x45; // E

  // fmt chunk
  header[12] = 0x66; // f
  header[13] = 0x6d; // m
  header[14] = 0x74; // t
  header[15] = 0x20; // (space)

  // fmt chunk 大小 (16 for PCM)
  header[16] = 0x10;
  header[17] = 0x00;
  header[18] = 0x00;
  header[19] = 0x00;

  // 音频格式 (1 = PCM)
  header[20] = 0x01;
  header[21] = 0x00;

  // 声道数
  header[22] = channels & 0xff;
  header[23] = (channels >> 8) & 0xff;

  // 采样率
  header[24] = sampleRate & 0xff;
  header[25] = (sampleRate >> 8) & 0xff;
  header[26] = (sampleRate >> 16) & 0xff;
  header[27] = (sampleRate >> 24) & 0xff;

  // 字节率 = 采样率 * 声道数 * 位深度 / 8
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  header[28] = byteRate & 0xff;
  header[29] = (byteRate >> 8) & 0xff;
  header[30] = (byteRate >> 16) & 0xff;
  header[31] = (byteRate >> 24) & 0xff;

  // 块对齐 = 声道数 * 位深度 / 8
  const blockAlign = (channels * bitsPerSample) / 8;
  header[32] = blockAlign & 0xff;
  header[33] = (blockAlign >> 8) & 0xff;

  // 位深度
  header[34] = bitsPerSample & 0xff;
  header[35] = (bitsPerSample >> 8) & 0xff;

  // data chunk
  header[36] = 0x64; // d
  header[37] = 0x61; // a
  header[38] = 0x74; // t
  header[39] = 0x61; // a

  // 音频数据大小
  header[40] = dataSize & 0xff;
  header[41] = (dataSize >> 8) & 0xff;
  header[42] = (dataSize >> 16) & 0xff;
  header[43] = (dataSize >> 24) & 0xff;

  return header;
}

async function main() {
  console.log("=== TTS 流式合成 Demo ===\n");

  // 创建 TTS 客户端
  const client = new TTS({
    platform: "bytedance",
    config: {
      app: {
        appid: APP_ID,
        accessToken: TOKEN,
      },
      audio: {
        voice_type: VOICE_TYPE,
        encoding: "wav",
      },
    },
  });

  // 用于收集所有音频块
  const audioChunks: Uint8Array[] = [];
  let chunkCount = 0;

  // 设置事件监听
  client.on("open", () => {
    console.log("[事件] 连接已打开");
  });

  client.on("close", () => {
    console.log("[事件] 连接已关闭");
  });

  client.on("error", (error: Error) => {
    console.error("[事件] 错误:", error.message);
  });

  // 监听音频块事件
  client.on("audio_chunk", (chunk: Uint8Array, isLast: boolean) => {
    chunkCount++;
    console.log(
      `[事件] 收到音频块 #${chunkCount}, 大小: ${chunk.length} 字节, 最终块: ${isLast}`
    );
    audioChunks.push(chunk);
  });

  client.on("result", () => {
    console.log("[事件] 合成完成");
  });

  try {
    // 要合成的文本
    const text = "这是一段流式合成的语音，你会逐步听到每个音频块。";

    console.log("开始流式语音合成...");
    console.log(`文本: ${text}\n`);

    // 调用 synthesizeStream 方法进行流式合成
    await client.synthesizeStream(text);

    console.log("\n流式合成完成！");
    console.log(`收到 ${chunkCount} 个音频块`);

    // 过滤掉空块，获取有效块
    const validChunks = audioChunks.filter((chunk) => chunk.length > 0);
    console.log(`有效音频块: ${validChunks.length} 个`);

    // 找到第一个包含 WAV 头的块，提取音频参数
    let wavHeaderInfo: {
      sampleRate: number;
      channels: number;
      bitsPerSample: number;
    } | null = null;

    for (const chunk of validChunks) {
      const info = parseWavHeader(chunk);
      if (info) {
        wavHeaderInfo = info;
        console.log(
          `检测到 WAV 头: 采样率=${info.sampleRate}Hz, 声道=${info.channels}, 位深度=${info.bitsPerSample}bit`
        );
        break;
      }
    }

    // 如果没有找到 WAV 头，使用默认值
    if (!wavHeaderInfo) {
      console.log("未检测到 WAV 头，使用默认参数");
      wavHeaderInfo = {
        sampleRate: 24000,
        channels: 1,
        bitsPerSample: 16,
      };
    }

    // 从所有块中提取纯音频数据（跳过 WAV 头）
    const audioDataList: Uint8Array[] = [];
    let totalAudioDataSize = 0;

    for (const chunk of validChunks) {
      const audioData = extractAudioData(chunk);
      audioDataList.push(audioData);
      totalAudioDataSize += audioData.length;
    }

    console.log(`音频数据总大小: ${totalAudioDataSize} 字节`);

    // 合并所有音频数据
    const mergedAudioData = new Uint8Array(totalAudioDataSize);
    let offset = 0;
    for (const audioData of audioDataList) {
      mergedAudioData.set(audioData, offset);
      offset += audioData.length;
    }

    // 构建完整的 WAV 文件（正确的 WAV 头 + 音频数据）
    const wavHeader = createWavHeader(
      wavHeaderInfo.sampleRate,
      wavHeaderInfo.channels,
      wavHeaderInfo.bitsPerSample,
      totalAudioDataSize
    );

    // 合并 WAV 头和音频数据
    const finalWav = new Uint8Array(wavHeader.length + mergedAudioData.length);
    finalWav.set(wavHeader, 0);
    finalWav.set(mergedAudioData, wavHeader.length);

    console.log(`总 WAV 大小: ${finalWav.length} 字节`);

    // 将音频保存为 WAV 文件
    fs.writeFileSync(OUTPUT_PATH, finalWav);
    console.log(`音频已保存到: ${OUTPUT_PATH}`);

    // 关闭客户端
    client.close();
  } catch (error) {
    console.error("错误:", (error as Error).message);
    process.exit(1);
  }
}

main();
