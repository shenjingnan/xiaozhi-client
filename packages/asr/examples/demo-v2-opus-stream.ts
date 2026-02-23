/**
 * Demo: V2 协议裸 Opus 流式 ASR
 *
 * 本示例展示如何将 V2 协议封装的 Opus 数据解析为裸 Opus，
 * 解码为 PCM，然后通过流式方式发送给字节跳动的 ASR 服务。
 *
 * V2 协议格式（16字节头部 + Opus payload）：
 * ┌──────────┬──────┬──────────┬──────────┬──────────┬──────────┐
 * │ version  │ type │ reserved │ timestamp│pay size  │ payload  │
 * │  (2B)    │ (2B) │   (4B)   │   (4B)   │   (4B)   │  (N B)   │
 * └──────────┴──────┴──────────┴──────────┴──────────┴──────────┘
 * │                      头部 (16 字节)                        │
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import fs from "node:fs";
import { ASR, AudioFormat, AuthMethod, OpusDecoder } from "../src/index.js";

// V2 协议头部常量
const PROTOCOL_HEADER_SIZE = 16;

// 从环境变量读取配置
const APP_ID = process.env.BYTEDANCE_APP_ID || "your-app-id";
const TOKEN = process.env.BYTEDANCE_TOKEN || "your-token";
const CLUSTER = process.env.BYTEDANCE_CLUSTER || "volcengine_streaming_common";
const OPUS_DIR = new URL("./v2-opus-stream", import.meta.url).pathname;

/**
 * 解析 V2 协议头部，提取 Opus payload
 *
 * @param buffer V2 协议封装的音频数据
 * @returns 裸 Opus 数据
 */
function parseProtocol2(buffer: Buffer): Buffer {
  // 解析头部字段（大端序）
  const version = buffer.readUInt16BE(0);
  const type = buffer.readUInt16BE(2);
  const timestamp = buffer.readUInt32BE(8);
  const payloadSize = buffer.readUInt32BE(12);

  // 验证协议版本
  if (version !== 2) {
    throw new Error(`无效的协议版本: ${version}，期望: 2`);
  }

  // 验证数据类型 (0 = Opus)
  if (type !== 0) {
    throw new Error(`无效的数据类型: ${type}，期望: 0 (Opus)`);
  }

  // 提取 Opus payload
  const opusData = buffer.slice(
    PROTOCOL_HEADER_SIZE,
    PROTOCOL_HEADER_SIZE + payloadSize
  );

  return opusData;
}

/**
 * 读取并解析 V2 协议的 Opus 文件
 *
 * @param filePath V2 协议文件路径
 * @returns 裸 Opus 数据
 */
function readV2OpusFile(filePath: string): Buffer {
  const buffer = fs.readFileSync(filePath);
  return parseProtocol2(buffer);
}

/**
 * 读取目录中所有 V2 Opus 文件
 *
 * @param dirPath V2 Opus 文件目录
 * @returns 裸 Opus 数据数组
 */
function readAllOpusFiles(dirPath: string): Buffer[] {
  const files = fs
    .readdirSync(dirPath)
    .filter((f: string) => f.endsWith(".opus"))
    .sort((a: string, b: string) => {
      // 按文件名数字排序
      const numA = Number.parseInt(a.replace(".opus", ""), 10);
      const numB = Number.parseInt(b.replace(".opus", ""), 10);
      return numA - numB;
    });

  return files.map((f: string) => readV2OpusFile(path.join(dirPath, f)));
}

async function main() {
  console.log("=== V2 协议裸 Opus 流式 ASR 示例 ===\n");

  // 创建 ASR 客户端，使用 RAW 格式
  // 关键配置：format = AudioFormat.RAW，codec = "raw"（解码后的 PCM）
  const client = new ASR({
    wsUrl: "wss://openspeech.bytedance.com/api/v2/asr",
    cluster: CLUSTER,
    appid: APP_ID,
    token: TOKEN,
    // 关键：使用 RAW 格式 + raw 编解码器（发送 PCM 数据）
    format: AudioFormat.RAW,
    authMethod: AuthMethod.TOKEN,
    // 音频配置
    sampleRate: 16000,
    language: "zh-CN",
    channel: 1,
    bits: 16,
    codec: "raw",
    // 请求配置
    segDuration: 15000,
    nbest: 1,
    resultType: "full",
    workflow: "audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate",
    showLanguage: false,
    showUtterances: false,
  });

  // 设置事件处理器
  client.on("open", () => {
    console.log("[事件] 连接已打开");
  });

  client.on("close", () => {
    console.log("[事件] 连接已关闭");
  });

  client.on("error", (error: Error) => {
    console.error("[事件] 错误:", error.message);
  });

  client.on("result", (result) => {
    console.log("[事件] 识别结果:", JSON.stringify(result, null, 2));
  });

  client.on("full_response", (response) => {
    console.log("[事件] 完整响应:", JSON.stringify(response, null, 2));
  });

  client.on("audio_end", () => {
    console.log("[事件] 音频发送完成");
  });

  try {
    console.log("开始流式 ASR 识别...");
    console.log(`音频目录: ${OPUS_DIR}\n`);

    // 步骤 1: 连接并发送初始配置
    console.log("步骤 1: 连接到 ASR 服务器...");
    await client.connect();
    console.log("已连接!\n");

    // 步骤 2: 读取 V2 Opus 文件，解码为 PCM 并发送
    console.log("步骤 2: 读取 Opus 文件，解码为 PCM 并发送...");

    const opusChunks = readAllOpusFiles(OPUS_DIR);
    console.log(`读取到 ${opusChunks.length} 个 Opus 帧`);

    // 解码所有 Opus 帧为 PCM
    console.log("正在解码 Opus 为 PCM...");
    const pcmChunks: Buffer[] = [];
    for (let i = 0; i < opusChunks.length; i++) {
      const pcmData = await OpusDecoder.toPcm(opusChunks[i]);
      pcmChunks.push(pcmData);

      if ((i + 1) % 20 === 0) {
        console.log(`  已解码 ${i + 1}/${opusChunks.length} 帧...`);
      }
    }
    console.log(`解码完成，共 ${pcmChunks.length} 个 PCM 帧\n`);

    // 流式发送每个 PCM chunk
    let frameCount = 0;
    for (const pcmData of pcmChunks) {
      await client.sendFrame(pcmData);
      frameCount++;

      if (frameCount % 20 === 0) {
        console.log(`  已发送 ${frameCount} 帧...`);
      }
    }

    console.log(`  总共发送: ${frameCount} 帧\n`);

    // 步骤 3: 结束流并获取最终结果
    console.log("步骤 3: 结束流并获取最终结果...");
    const result = await client.end();

    console.log("\n=== 最终结果 ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("错误:", (error as Error).message);
    process.exit(1);
  }
}

main();
