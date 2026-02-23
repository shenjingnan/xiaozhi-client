/**
 * Demo: Streaming ASR with Frame-by-Frame Input
 *
 * This demo shows how to use the streaming API to send audio frames
 * incrementally instead of sending a complete audio file.
 *
 * The developer is responsible for:
 * 1. Using prism-media to decode OGG to Opus frames
 * 2. Sending each frame via sendFrame()
 * 3. Calling end() when all frames are sent
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { ASR, AudioFormat, AuthMethod } from "../src/index.js";

// 从环境变量读取配置
const APP_ID = process.env.BYTEDANCE_APP_ID || "your-app-id";
const TOKEN = process.env.BYTEDANCE_TOKEN || "your-token";
const CLUSTER = process.env.BYTEDANCE_CLUSTER || "volcengine_streaming_common";
const AUDIO_PATH = new URL("./demo-60ms-16khz.ogg", import.meta.url).pathname;

async function main() {
  console.log("=== Streaming ASR Frame-by-Frame Demo ===\n");

  // Create client (no audioPath needed for streaming mode)
  const client = new ASR({
    wsUrl: "wss://openspeech.bytedance.com/api/v2/asr",
    cluster: CLUSTER,
    appid: APP_ID,
    token: TOKEN,
    // No audioPath - we will send frames manually
    format: AudioFormat.OGG,
    authMethod: AuthMethod.TOKEN,
    // Audio config
    sampleRate: 16000,
    language: "zh-CN",
    channel: 1,
    bits: 16,
    codec: "opus",
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
    console.log("Starting streaming ASR...");
    console.log(`Audio file: ${AUDIO_PATH}\n`);

    // Step 1: Connect and send initial configuration
    console.log("Step 1: Connecting to ASR server...");
    await client.connect();
    console.log("Connected!\n");

    // Step 2: Read OGG file and send frames
    // Note: In a real application, you would use prism-media to decode OGG:
    //
    // import * as prism from "prism-media";
    // import * as fs from "node:fs";
    //
    // const oggStream = fs.createReadStream(AUDIO_PATH);
    // const oggParser = new prism.ogg.Opus({});
    //
    // oggParser.on("data", async (buffer: Buffer) => {
    //   await client.sendFrame(buffer);
    // });
    //
    // oggStream.pipe(oggParser);
    // await new Promise((resolve) => oggParser.on("end", resolve));

    // For demo purposes, we'll simulate frame sending
    // by reading the file and splitting into chunks
    console.log("Step 2: Sending audio frames...");

    // Import required modules for file reading
    const fs = await import("node:fs");

    // For OGG/Opus files, we read the raw Opus data
    // In production, use prism-media to decode OGG to Opus frames
    const { AudioProcessor } = await import("../src/audio/index.js");
    const processor = new AudioProcessor(AUDIO_PATH, AudioFormat.OGG);
    const opusData = processor.getOpusData();

    // Split into frames (simulating what prism-media would do)
    const frameSize = 3200; // ~100ms at 16kHz
    let offset = 0;
    let frameCount = 0;

    while (offset < opusData.length) {
      const chunk = opusData.subarray(
        offset,
        Math.min(offset + frameSize, opusData.length)
      );
      const isLast = offset + frameSize >= opusData.length;

      await client.sendFrame(chunk);
      frameCount++;

      if (frameCount % 10 === 0) {
        console.log(`  Sent ${frameCount} frames...`);
      }

      offset += frameSize;
    }

    console.log(`  Total frames sent: ${frameCount}\n`);

    // Step 3: End the stream and get final result
    console.log("Step 3: Ending stream and getting final result...");
    const result = await client.end();

    console.log("\n=== Final Result ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

main();
