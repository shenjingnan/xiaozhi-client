/**
 * Demo: ByteDance V1 流式 TTS（使用 speak API）
 *
 * 本示例展示如何使用 speak() API 进行流式语音合成，
 * 使用 for await...of 迭代器风格获取音频块。
 *
 * 注意：V1 API 支持 ogg_opus 格式流式返回
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
const VOICE_TYPE =
  process.env.BYTEDANCE_VOICE_TYPE || "zh_female_xiaohe_uranus_bigtts";
const OUTPUT_PATH = path.resolve(__dirname, "output-bytedance-v1-stream.ogg");

async function main() {
  console.log("=== ByteDance V1 流式 TTS 示例（speak API）===\n");

  // 创建 TTS 客户端
  // 使用新版配置方式：通过 bytedance.v1 配置
  const client = new TTS({
    bytedance: {
      v1: {
        app: {
          appid: APP_ID,
          accessToken: TOKEN,
        },
        audio: {
          voice_type: VOICE_TYPE,
          encoding: "ogg_opus",
          // 注意：speak API 会自动使用 ogg_opus 编码
        },
      },
    },
  });

  // 用于收集所有音频块
  const audioChunks: Uint8Array[] = [];
  let chunkCount = 0;

  // 要合成的文本
  const text = "你好，这是使用 V1 流式 API 合成的语音。";

  console.log("开始流式语音合成...");
  console.log(`文本: ${text}\n`);

  try {
    // 使用 speak() API 进行流式合成
    // 使用 for await...of 迭代器风格
    for await (const result of client.bytedance.v1.speak(text)) {
      chunkCount++;
      const status = result.isFinal ? "最终" : "中间";
      console.log(
        `[${status}] 收到音频块 #${chunkCount}, 大小: ${result.chunk.length} 字节`
      );
      audioChunks.push(result.chunk);
    }

    console.log("\n流式合成完成！");
    console.log(`共收到 ${chunkCount} 个音频块`);

    // 合并所有音频数据
    const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    console.log(`音频数据总大小: ${totalSize} 字节`);

    const mergedAudio = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of audioChunks) {
      mergedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // 保存为 opus 文件
    fs.writeFileSync(OUTPUT_PATH, mergedAudio);
    console.log(`音频已保存到: ${OUTPUT_PATH}`);

    console.log("\n=== 示例完成 ===");
  } catch (error) {
    console.error("错误:", (error as Error).message);
    process.exit(1);
  }
}

main();
