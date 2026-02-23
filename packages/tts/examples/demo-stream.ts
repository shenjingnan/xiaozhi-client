/**
 * Demo: TTS 流式合成
 *
 * 此演示展示如何使用 TTS 客户端进行流式语音合成，
 * 即边合成边获取音频块，适用于实时播放场景。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import fs from "node:fs";

// 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { TTS } from "../src/index.js";

// 从环境变量读取配置
const APP_ID = process.env.BYTEDANCE_APP_ID || "your-app-id";
const TOKEN = process.env.BYTEDANCE_TOKEN || "your-token";
const OUTPUT_PATH = path.resolve(__dirname, "output-stream.wav");
const VOICE_TYPE = process.env.BYTEDANCE_VOICE_TYPE || "zh_female_xiaohe_uranus_bigtts";

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
        speed: 1.0,
        pitch: 0,
        volume: 1.0,
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

    // 合并所有音频块
    const totalLength = audioChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );
    const mergedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      mergedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`总音频大小: ${mergedAudio.length} 字节`);

    // 将音频保存为 WAV 文件
    fs.writeFileSync(OUTPUT_PATH, mergedAudio);
    console.log(`音频已保存到: ${OUTPUT_PATH}`);

    // 关闭客户端
    client.close();
  } catch (error) {
    console.error("错误:", (error as Error).message);
    process.exit(1);
  }
}

main();
