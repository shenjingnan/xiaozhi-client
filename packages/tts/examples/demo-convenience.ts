/**
 * Demo: TTS 便捷函数
 *
 * 此演示展示如何使用 TTS 的便捷函数进行语音合成，
 * 便捷函数提供更简洁的 API 接口。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { synthesizeSpeech, synthesizeSpeechStream } from "../src/index.js";

// 从环境变量读取配置
const APP_ID = process.env.BYTEDANCE_APP_ID || "your-app-id";
const TOKEN = process.env.BYTEDANCE_TOKEN || "your-token";
const OUTPUT_PATH_1 = path.resolve(__dirname, "output-convenience.wav");
const OUTPUT_PATH_2 = path.resolve(__dirname, "output-convenience-stream.wav");

async function demoNonStreaming() {
  console.log("=== 便捷函数：非流式合成 Demo ===\n");

  try {
    const text = "使用便捷函数进行非流式语音合成。";

    console.log("开始合成...");
    console.log(`文本: ${text}\n`);

    // 使用 synthesizeSpeech 进行非流式合成
    const audio = await synthesizeSpeech({
      appid: APP_ID,
      accessToken: TOKEN,
      voice_type: "S_70000",
      text: text,
      encoding: "wav",
      speed: 1.0,
      pitch: 0,
      volume: 1.0,
    });

    console.log("合成完成！");
    console.log(`音频大小: ${audio.length} 字节`);

    // 保存音频
    const fs = await import("node:fs");
    fs.writeFileSync(OUTPUT_PATH_1, audio);
    console.log(`音频已保存到: ${OUTPUT_PATH_1}\n`);
  } catch (error) {
    console.error("非流式合成错误:", (error as Error).message);
  }
}

async function demoStreaming() {
  console.log("=== 便捷函数：流式合成 Demo ===\n");

  const audioChunks: Uint8Array[] = [];
  let chunkCount = 0;

  try {
    const text = "使用便捷函数进行流式语音合成。";

    console.log("开始流式合成...");
    console.log(`文本: ${text}\n`);

    // 使用 synthesizeSpeechStream 进行流式合成
    await synthesizeSpeechStream({
      appid: APP_ID,
      accessToken: TOKEN,
      voice_type: "S_70000",
      text: text,
      encoding: "wav",
      speed: 1.0,
      pitch: 0,
      volume: 1.0,
      onAudioChunk: async (chunk: Uint8Array, isLast: boolean) => {
        chunkCount++;
        console.log(
          `[回调] 收到音频块 #${chunkCount}, 大小: ${chunk.length} 字节, 最终块: ${isLast}`
        );
        audioChunks.push(chunk);
      },
    });

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

    // 保存音频
    const fs = await import("node:fs");
    fs.writeFileSync(OUTPUT_PATH_2, mergedAudio);
    console.log(`音频已保存到: ${OUTPUT_PATH_2}`);
  } catch (error) {
    console.error("流式合成错误:", (error as Error).message);
  }
}

async function main() {
  await demoNonStreaming();
  console.log(`\n${"=".repeat(50)}\n`);
  await demoStreaming();
}

main();
