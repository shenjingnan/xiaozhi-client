/**
 * Demo: TTS 非流式合成
 *
 * 此演示展示如何使用 TTS 客户端进行非流式语音合成，
 * 即一次性获取完整音频。
 */

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
const OUTPUT_PATH = path.resolve(__dirname, "output.wav");
const VOICE_TYPE = process.env.BYTEDANCE_VOICE_TYPE || "zh_female_xiaohe_uranus_bigtts";
async function main() {
  console.log("=== TTS 非流式合成 Demo ===\n");

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

  client.on("result", (audio: Uint8Array) => {
    console.log(`[事件] 合成完成，音频大小: ${audio.length} 字节`);
  });

  try {
    // 要合成的文本
    const text = "你好，这是一段测试语音。";

    console.log("开始语音合成...");
    console.log(`文本: ${text}`);
    console.log(`输出文件: ${OUTPUT_PATH}\n`);

    // 调用 synthesize 方法进行非流式合成
    const audio = await client.synthesize(text);

    console.log("\n合成完成！");
    console.log(`音频大小: ${audio.length} 字节`);

    // 将音频保存为 WAV 文件
    const fs = await import("node:fs");
    fs.writeFileSync(OUTPUT_PATH, audio);
    console.log(`音频已保存到: ${OUTPUT_PATH}`);

    // 关闭客户端
    client.close();
  } catch (error) {
    console.error("错误:", (error as Error).message);
    process.exit(1);
  }
}

main();
