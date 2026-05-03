#!/usr/bin/env node
/**
 * TTS 文件播放测试脚本（自包含版本）
 * 启动本地 WebSocket 服务器，模拟硬件端连接，
 * 读取 OGG 文件并通过 TTSService 管线逐包发送音频数据，
 * 在模拟硬件端验证接收到的 BinaryProtocol2 数据格式是否正确。
 *
 * 此脚本无需依赖运行中的 xiaozhi-client 服务器，也无需真实硬件。
 *
 * 使用方式：
 *   npx tsx scripts/test-tts-file.ts --file-path doubao-tts-demo_24khz_opus_60ms.ogg
 *
 * 可选参数：
 *   --port         本地 WebSocket 服务器端口（默认: 19999）
 *   --device-id    设备 ID（默认: test-device-001）
 */

import { randomBytes } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  TTSService,
  encodeBinaryProtocol2,
  parseBinaryProtocol2,
} from "../src/esp32/index.js";
import type { ESP32WSMessage, IDeviceConnection } from "../src/esp32/index.js";

// ===================== 参数解析 =====================

function parseArgs(): {
  deviceId: string;
  filePath: string;
  port: number;
} {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      parsed[args[i]] = args[i + 1];
      i++;
    }
  }

  const deviceId = parsed["--device-id"] || "test-device-001";
  const filePath = parsed["--file-path"];
  const port = Number.parseInt(parsed["--port"] || "19999", 10);

  if (!filePath) {
    console.error("错误: 必须指定 --file-path 参数");
    console.error(
      "使用方式: npx tsx scripts/test-tts-file.ts --file-path <ogg文件路径>"
    );
    process.exit(1);
  }

  return { deviceId, filePath, port };
}

// ===================== 日志工具 =====================

const logger = {
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};

// ===================== 硬件模拟客户端 =====================

/**
 * 模拟 ESP32 硬件端，连接 WebSocket 服务器并接收音频数据
 * 解析接收到的 BinaryProtocol2 消息并记录统计信息
 */
class MockHardwareClient {
  private receivedPackets = 0;
  private totalBytes = 0;
  private timestamps: number[] = [];
  private startTime = 0;
  private ttsStarted = false;
  private ttsStopped = false;
  private errors: string[] = [];

  /**
   * 处理接收到的消息
   */
  handleMessage(data: Buffer): void {
    // 尝试解析为 JSON 消息
    try {
      const text = data.toString("utf-8");
      const message = JSON.parse(text);

      if (message.type === "hello") {
        logger.info(
          `收到 ServerHello: sessionId=${message.sessionId}, ` +
            `audioParams=${JSON.stringify(message.audioParams)}`
        );
        return;
      }

      if (message.type === "tts") {
        if (message.state === "start") {
          this.ttsStarted = true;
          this.startTime = Date.now();
          logger.info("收到 TTS start 消息");
        } else if (message.state === "stop") {
          this.ttsStopped = true;
          const elapsed = Date.now() - this.startTime;
          logger.info(`收到 TTS stop 消息，总耗时: ${elapsed}ms`);
        }
        return;
      }

      logger.debug(`收到 JSON 消息: ${text.substring(0, 100)}`);
      return;
    } catch {
      // 不是 JSON，尝试作为 BinaryProtocol2 解析
    }

    // 尝试解析 BinaryProtocol2 数据
    const parsed = parseBinaryProtocol2(data);
    if (parsed) {
      this.receivedPackets++;
      this.totalBytes += parsed.payload.length;
      this.timestamps.push(parsed.timestamp);

      // 验证数据格式
      if (parsed.protocolVersion !== 2) {
        this.errors.push(
          `包 #${this.receivedPackets}: 协议版本错误，期望 2，实际 ${parsed.protocolVersion}`
        );
      }
      if (parsed.type !== "opus") {
        this.errors.push(
          `包 #${this.receivedPackets}: 类型错误，期望 opus，实际 ${parsed.type}`
        );
      }
      if (parsed.payload.length === 0) {
        this.errors.push(`包 #${this.receivedPackets}: 负载为空`);
      }

      // 打印前几个包的详细信息
      if (this.receivedPackets <= 5) {
        logger.info(
          `音频包 #${this.receivedPackets}: type=${parsed.type}, ` +
            `timestamp=${parsed.timestamp}ms, payloadSize=${parsed.payload.length}bytes, ` +
            `toc=0x${parsed.payload[0]?.toString(16).padStart(2, "0") || "??"}`
        );
      }

      return;
    }

    // 未知数据
    this.errors.push(`未知格式数据: size=${data.length}`);
    logger.warn(`收到未知格式数据: size=${data.length}`);
  }

  /**
   * 输出接收统计摘要
   */
  printSummary(): void {
    logger.info("");
    logger.info("╔══════════════════════════════════╗");
    logger.info("║     音频接收统计                 ║");
    logger.info("╠══════════════════════════════════╣");
    logger.info(
      `║ 总包数:         ${String(this.receivedPackets).padEnd(15)}║`
    );
    logger.info(
      `${`║ 总数据量:       ${(this.totalBytes / 1024).toFixed(2)} KB`.padEnd(35)}║`
    );

    if (this.timestamps.length > 0) {
      logger.info(`${`║ 起始时间戳:     ${this.timestamps[0]}ms`.padEnd(35)}║`);
      logger.info(
        `${`║ 结束时间戳:     ${this.timestamps[this.timestamps.length - 1]}ms`.padEnd(35)}║`
      );

      if (this.timestamps.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < this.timestamps.length; i++) {
          intervals.push(this.timestamps[i] - this.timestamps[i - 1]);
        }
        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        logger.info(
          `${`║ 平均包间隔:     ${avgInterval.toFixed(2)}ms`.padEnd(35)}║`
        );
      }
    }

    if (this.errors.length > 0) {
      logger.info("╠══════════════════════════════════╣");
      logger.info(`║ 错误数: ${String(this.errors.length).padEnd(26)}║`);
      for (const err of this.errors.slice(0, 5)) {
        logger.info(`║  - ${err.substring(0, 28).padEnd(28)}║`);
      }
    }

    logger.info("╚══════════════════════════════════╝");
    logger.info("");
  }

  getStats() {
    return {
      receivedPackets: this.receivedPackets,
      totalBytes: this.totalBytes,
      ttsStarted: this.ttsStarted,
      ttsStopped: this.ttsStopped,
      errors: this.errors,
    };
  }
}

// ===================== 服务端连接包装器 =====================

/**
 * 实现 IDeviceConnection 接口，将 TTSService 连接到 WebSocket
 * processBuffer 会调用 send() 发送 JSON 消息，调用 sendBinaryProtocol2() 发送音频数据
 */
class ServerSideConnection implements IDeviceConnection {
  constructor(
    private ws: WebSocket,
    private sessionId: string
  ) {}

  async send(message: ESP32WSMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const jsonStr = JSON.stringify(message);
      this.ws.send(jsonStr, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async sendBinaryProtocol2(
    data: Uint8Array,
    timestamp?: number
  ): Promise<void> {
    // 将 Opus 原始数据编码为 BinaryProtocol2 格式（16 字节头部 + 负载）
    const timestampInMs = timestamp ?? 0;
    const packet = encodeBinaryProtocol2(data, timestampInMs, "opus");
    return new Promise((resolve, reject) => {
      this.ws.send(packet, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

// ===================== 主函数 =====================

async function main(): Promise<void> {
  const { deviceId, filePath, port } = parseArgs();

  logger.info("╔══════════════════════════════════╗");
  logger.info("║  TTS 文件播放测试（自包含版本）  ║");
  logger.info("╚══════════════════════════════════╝");
  logger.info("");
  logger.info(`设备 ID:   ${deviceId}`);
  logger.info(`文件路径:  ${filePath}`);
  logger.info(`本地端口:  ${port}`);
  logger.info("");

  const hardware = new MockHardwareClient();

  try {
    // ===== 启动本地 WebSocket 服务器 =====
    const wss = new WebSocketServer({ port });
    logger.info(`WebSocket 服务器已启动: ws://localhost:${port}`);

    // ===== 处理客户端连接 =====
    const serverReady = new Promise<{
      ws: WebSocket;
      connection: ServerSideConnection;
    }>((resolve) => {
      wss.on("connection", (ws) => {
        logger.info("硬件模拟客户端已连接");

        // 发送握手完成确认
        const sessionId = `test-session-${randomBytes(4).toString("hex")}`;
        ws.send(
          JSON.stringify({
            type: "hello",
            version: 1,
            transport: "websocket",
            sessionId,
            audioParams: {
              format: "opus",
              sampleRate: 24000,
              channels: 1,
              frameDuration: 60,
            },
          })
        );

        const connection = new ServerSideConnection(ws, sessionId);
        resolve({ ws, connection });
      });

      wss.on("error", (error) => {
        logger.error(`WebSocket 服务器错误: ${error.message}`);
      });
    });

    // ===== 模拟硬件端连接服务器 =====
    const wsUrl = `ws://localhost:${port}`;
    const clientWs = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      clientWs.on("open", () => {
        logger.info("硬件模拟客户端 WebSocket 已连接");
        resolve();
      });
      clientWs.on("message", (data: Buffer) => {
        hardware.handleMessage(data);
      });
      clientWs.on("error", (error) => {
        reject(error);
      });
      setTimeout(() => reject(new Error("客户端连接超时")), 5000);
    });

    // ===== 等待服务端 accept 连接 =====
    const { connection } = await serverReady;

    // ===== 创建 TTSService 并发送音频 =====
    // 使用 onTTSComplete 回调来等待异步发送完成
    let ttsCompleted = false;
    const service = new TTSService({
      logger,
      onTTSComplete: () => {
        ttsCompleted = true;
      },
    });

    service.setGetConnection((id) => {
      if (id === deviceId) return connection;
      return undefined;
    });

    logger.info("开始发送音频数据...");
    logger.info("");

    const sendStartTime = Date.now();
    await service.speakFromFile(deviceId, filePath);
    const sendElapsed = Date.now() - sendStartTime;

    // 等待异步发送完成：processBuffer 逐包发送，每包流控等待约 60ms
    // 完整发送 33 个包需要约 33 × 60ms = 1980ms，加上轮询和清理开销
    // 这里等待最多 15 秒，每 200ms 检查一次
    logger.info("等待音频数据发送完成...");
    const maxWaitMs = 30000;
    const pollIntervalMs = 200;
    let waitedMs = 0;
    while (!ttsCompleted && waitedMs < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      waitedMs += pollIntervalMs;
    }

    if (ttsCompleted) {
      logger.info(`音频发送完成，等待耗时: ${waitedMs}ms`);
    } else {
      logger.warn(`等待超时 (${maxWaitMs}ms)，音频可能未完全发送`);
    }

    // ===== 输出结果 =====
    logger.info("");
    hardware.printSummary();

    const stats = hardware.getStats();

    logger.info("╔══════════════════════════════════╗");
    logger.info("║     测试结果                     ║");
    logger.info("╠══════════════════════════════════╣");
    logger.info(
      `${`║ TTS start:  ${stats.ttsStarted ? "✅ 通过" : "❌ 失败"}`.padEnd(35)}║`
    );
    logger.info(
      `${`║ TTS stop:   ${stats.ttsStopped ? "✅ 通过" : "❌ 失败"}`.padEnd(35)}║`
    );
    const audioPacketsMsg =
      stats.receivedPackets > 0 ? `✅ ${stats.receivedPackets} 包` : "❌ 0 包";
    logger.info(`${`║ 音频包数:   ${audioPacketsMsg}`.padEnd(35)}║`);
    logger.info(`${`║ 发送耗时:   ${sendElapsed}ms`.padEnd(35)}║`);
    const errorsMsg =
      stats.errors.length === 0 ? "✅ 无" : `❌ ${stats.errors.length} 个`;
    logger.info(`${`║ 格式错误:   ${errorsMsg}`.padEnd(35)}║`);
    logger.info("╠══════════════════════════════════╣");

    const allPassed =
      stats.ttsStarted &&
      stats.ttsStopped &&
      stats.receivedPackets > 0 &&
      stats.errors.length === 0;

    logger.info(
      `${`║ 总体结果:   ${allPassed ? "✅ 测试通过" : "❌ 测试失败"}`.padEnd(35)}║`
    );
    logger.info("╚══════════════════════════════════╝");

    // ===== 清理 =====
    service.destroy();
    clientWs.close();
    wss.close();

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    logger.error(`测试失败: ${error}`);
    process.exit(1);
  }
}

main();
