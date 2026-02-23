/**
 * Demo: ByteDance V2 流式 ASR（使用 listen API）
 *
 * 本示例展示如何使用 listen() API 进行流式语音识别。
 * 读取 V2 协议的 Opus 音频文件，解码为 PCM，然后通过 listen() API 发送。
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

// 从环境变量读取配置
const APP_ID = process.env.BYTEDANCE_APP_ID || "your-app-id";
const TOKEN = process.env.BYTEDANCE_TOKEN || "your-token";
const CLUSTER = process.env.BYTEDANCE_CLUSTER || "volcengine_streaming_common";

// 音频文件目录
const OPUS_DIR = new URL("./v2-opus-stream", import.meta.url).pathname;

// V2 协议头部常量
const PROTOCOL_HEADER_SIZE = 16;

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
 * 读取 V2 协议的 Opus 文件
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

/**
 * 创建异步可迭代的 PCM 流
 * 读取 Opus 文件，解码为 PCM，然后逐帧yield
 */
async function* createPcmStream(): AsyncGenerator<Buffer> {
  // 读取所有 Opus 文件
  console.log(`读取音频文件目录: ${OPUS_DIR}`);
  const opusChunks = readAllOpusFiles(OPUS_DIR);
  console.log(`读取到 ${opusChunks.length} 个 Opus 帧\n`);

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

  // 逐帧 yield PCM 数据
  let frameCount = 0;
  for (const pcmData of pcmChunks) {
    yield pcmData;
    frameCount++;

    if (frameCount % 20 === 0) {
      console.log(`  已发送 ${frameCount} 帧...`);
    }
  }
  console.log(`  总共发送: ${frameCount} 帧\n`);
}

async function main() {
  console.log("=== ByteDance V2 流式 ASR 示例（listen API）===\n");

  // 创建 ASR 客户端
  // 使用新版配置方式：音频配置通过 bytedance.v2.audio 传入
  const client = new ASR({
    bytedance: {
      v2: {
        app: {
          appid: APP_ID,
          token: TOKEN,
          cluster: CLUSTER,
        },
        user: {
          uid: "streaming_asr_client",
        },
        audio: {
          format: AudioFormat.RAW,
          // 语言配置
          language: "zh-CN",
        },
        request: {
          reqid: "uuid",
          sequence: 1,
        },
      },
    },
    // 认证配置
    authMethod: AuthMethod.TOKEN,
  });

  // 设置事件监听器
  client.on("open", () => {
    console.log("[事件] 连接已打开");
  });

  client.on("close", () => {
    console.log("[事件] 连接已关闭");
  });

  client.on("error", (error: Error) => {
    console.error("[事件] 错误:", error.message);
  });

  // client.on("result", (result) => {
  //   console.log("[事件] 识别结果:", JSON.stringify(result, null, 2));
  // });

  // client.on("full_response", (response) => {
  //   console.log("[事件] 完整响应:", JSON.stringify(response, null, 2));
  // });

  client.on("vad_end", (text: string) => {
    console.log("[事件] VAD 结束:", text);
  });

  client.on("audio_end", () => {
    console.log("[事件] 音频发送完成");
  });

  try {
    console.log("开始流式 ASR 识别...\n");

    // 使用 listen() API 进行流式识别
    // 传入异步可迭代的 PCM 流
    console.log("正在连接并发送音频...\n");

    let resultCount = 0;
    for await (const result of client.bytedance.v2.listen(createPcmStream())) {
      resultCount++;
      const status = result.isFinal ? "最终" : "中间";
      console.log(status, result);
      // console.log(`[${status}] #${result.seq || resultCount} ${result.text}`);
      if (result.isFinal) break;
    }

    console.log("\n=== 识别完成 ===");
    console.log(`共收到 ${resultCount} 个识别结果`);
  } catch (error) {
    console.error("错误:", (error as Error).message);
    process.exit(1);
  }
}

main();
