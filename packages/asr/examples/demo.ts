/**
 * Demo: Streaming ASR Client
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { ASR, AudioFormat, AuthMethod } from "../src/index.js";

// 从环境变量读取配置
const APP_ID = process.env.BYTEDANCE_APP_ID || "your-app-id";
const TOKEN = process.env.BYTEDANCE_TOKEN || "your-token";
const CLUSTER = process.env.BYTEDANCE_CLUSTER || "volcengine_streaming_common";
const AUDIO_PATH =
  "/Users/nemo/Projects/shenjingnan/xiaozhi-client/packages/asr/examples/demo-60ms-16khz.ogg";
const AUDIO_FORMAT = AudioFormat.OGG;

async function main() {
  console.log("=== Streaming ASR Demo ===\n");

  // Create client
  const client = new ASR({
    wsUrl: "wss://openspeech.bytedance.com/api/v2/asr",
    cluster: CLUSTER,
    appid: APP_ID,
    token: TOKEN,
    audioPath: AUDIO_PATH,
    format: AUDIO_FORMAT,
    authMethod: AuthMethod.TOKEN,
    // Audio config
    sampleRate: 16000,
    language: "zh-CN",
    channel: 1,
    bits: 16,
    // Request config
    segDuration: 15000,
    nbest: 1,
    resultType: "full",
    workflow: "audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate",
    showLanguage: false,
    showUtterances: false,
  });

  // Set up event handlers
  client.on("open", () => {
    console.log("[Event] Connection opened");
  });

  client.on("close", () => {
    console.log("[Event] Connection closed");
  });

  client.on("error", (error: Error) => {
    console.error("[Event] Error:", error.message);
  });

  client.on("result", (result) => {
    console.log("[Event] Result:", JSON.stringify(result, null, 2));
  });

  client.on("full_response", (response) => {
    console.log("[Event] Full Response:", JSON.stringify(response, null, 2));
  });

  client.on("audio_end", () => {
    console.log("[Event] Audio sent completely");
  });

  try {
    console.log("Starting ASR request...");
    console.log(`Audio file: ${AUDIO_PATH}`);
    console.log(`Format: ${AUDIO_FORMAT}\n`);

    const result = await client.execute();

    console.log("\n=== Final Result ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

main();
