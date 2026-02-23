/**
 * ByteDance Streaming ASR WebSocket Client
 */

import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import { AudioFormat } from "@/audio";
import { AudioProcessor } from "@/audio/index.js";
import { AuthMethod, SignatureAuth, TokenAuth } from "@/auth";
import type { ASROption, ASRRequestConfig, ASRResult } from "@/client/types.js";
import {
  BYTEDANCE_V2_DEFAULT_CLUSTER,
  type ByteDanceV2Config,
  type ByteDanceV3Config,
  isV2Config,
  parseByteDanceConfig,
} from "@/platforms/index.js";
import {
  ByteDanceV2Controller,
  ByteDanceV2RequestBuilder,
  ByteDanceV3Controller,
} from "@/platforms/index.js";
import {
  MessageType,
  compressGzipSync,
  generateAudioDefaultHeader,
  generateFullDefaultHeader,
  generateLastAudioDefaultHeader,
  parseResponse,
} from "@/platforms/index.js";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";

/**
 * Streaming ASR WebSocket Client
 */
export class ASR extends EventEmitter {
  // ByteDance 控制器
  public readonly bytedance: {
    v2: ByteDanceV2Controller;
    v3: ByteDanceV3Controller;
  };

  // API 版本
  private apiVersion: "v2" | "v3" = "v2";

  // Server config
  private wsUrl: string;
  private cluster: string;

  // App config
  private appid: string;
  private token: string;

  // User config
  private uid: string;

  // Audio config
  private audioPath: string;
  private format: AudioFormat;
  private sampleRate: number;
  private language: string;
  private bits: number;
  private channel: number;
  private codec: string;

  // Request config
  private segDuration: number;
  private nbest: number;
  private workflow: string;
  private showLanguage: boolean;
  private showUtterances: boolean;
  private resultType: string;

  // Auth config
  private authMethod: AuthMethod;
  private secret: string;

  // MP3 specific
  private mp3SegSize: number;

  // Success code
  private successCode: number;

  // WebSocket connection
  private ws: WebSocket | null = null;

  // Connection state
  private connected = false;

  // Request ID for streaming
  private reqid = "";

  // Indicates if this is a streaming session
  private isStreaming = false;

  // Indicates if audio has ended
  private audioEnded = false;

  // Record triggered VAD end sequences to prevent duplicate triggers
  private triggeredVADSequences: Set<number | string> = new Set();

  // V2 请求构造器
  private v2RequestBuilder: ByteDanceV2RequestBuilder | null = null;

  constructor(options: ASROption) {
    super();

    // 解析 ByteDance 配置
    if (options.bytedance) {
      // 使用 zod 校验并解析配置
      const config = parseByteDanceConfig(options.bytedance);

      if (isV2Config(options.bytedance)) {
        // V2 配置
        const v2Config = config as ByteDanceV2Config;
        this.apiVersion = "v2";
        this.wsUrl = "wss://openspeech.bytedance.com/api/v2/asr";
        this.cluster = v2Config.app.cluster || BYTEDANCE_V2_DEFAULT_CLUSTER;
        this.appid = v2Config.app.appid;
        this.token = v2Config.app.token;
        this.uid = v2Config.user.uid || "streaming_asr_client";
      } else {
        // V3 配置
        const v3Config = config as ByteDanceV3Config;
        this.apiVersion = "v3";
        this.wsUrl = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel";
        this.cluster = "";
        this.appid = v3Config.appKey;
        this.token = v3Config.accessKey;
        this.uid = v3Config.user?.uid || "streaming_asr_client";
      }
    } else {
      // 兼容旧版配置
      this.wsUrl = options.wsUrl || "wss://openspeech.bytedance.com/api/v2/asr";
      this.cluster = options.cluster || BYTEDANCE_V2_DEFAULT_CLUSTER;
      this.appid = options.appid || "";
      this.token = options.token || "";
      this.uid = options.uid || "streaming_asr_client";
    }

    // Audio config
    this.audioPath = options.audioPath || "";
    this.format = options.format || AudioFormat.WAV;
    this.sampleRate = options.sampleRate || 16000;
    this.language = options.language || "zh-CN";
    this.bits = options.bits || 16;
    this.channel = options.channel || 1;
    this.codec = options.codec || "raw";

    // Request config
    this.segDuration = options.segDuration || 15000;
    this.nbest = options.nbest || 1;
    this.workflow =
      options.workflow ||
      "audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate";
    this.showLanguage = options.showLanguage || false;
    this.showUtterances = options.showUtterances || false;
    this.resultType = options.resultType || "full";

    // Auth config
    this.authMethod = options.authMethod || AuthMethod.TOKEN;
    this.secret = options.secret || "";

    // MP3 specific
    this.mp3SegSize = options.mp3SegSize || 10000;

    // Success code
    this.successCode = options.successCode || 1000;

    // 初始化 V2 请求构造器
    if (this.apiVersion === "v2") {
      this.v2RequestBuilder = new ByteDanceV2RequestBuilder({
        appid: this.appid,
        cluster: this.cluster,
        token: this.token,
        uid: this.uid,
        format: this.format,
        sampleRate: this.sampleRate,
        language: this.language,
        bits: this.bits,
        channel: this.channel,
        codec: this.codec,
        nbest: this.nbest,
        workflow: this.workflow,
        showLanguage: this.showLanguage,
        showUtterances: this.showUtterances,
        resultType: this.resultType,
      });
    }

    // 初始化 ByteDance 控制器
    this.bytedance = {
      v2: new ByteDanceV2Controller(this),
      v3: new ByteDanceV3Controller(this),
    };
  }

  /**
   * Set audio path
   */
  setAudioPath(audioPath: string, format?: AudioFormat): void {
    this.audioPath = audioPath;
    if (format) {
      this.format = format;
    }
  }

  /**
   * Set format
   */
  setFormat(format: AudioFormat): void {
    this.format = format;
  }

  /**
   * Construct ASR request
   */
  private constructRequest(reqid: string): ASRRequestConfig {
    if (!this.v2RequestBuilder) {
      throw new Error("V2 request builder not initialized");
    }
    return this.v2RequestBuilder.build(reqid);
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(requestData?: Buffer): Record<string, string> {
    // V3 使用不同的认证方式
    if (this.apiVersion === "v3") {
      return this.getV3AuthHeaders();
    }

    if (this.authMethod === AuthMethod.TOKEN) {
      return new TokenAuth(this.token).getHeaders();
    }
    return new SignatureAuth(this.token, this.secret, this.wsUrl).getHeaders(
      requestData
    );
  }

  /**
   * Get V3 authentication headers
   * V3 使用 appKey 和 accessKey 进行认证
   */
  private getV3AuthHeaders(): Record<string, string> {
    // V3 认证格式: app_key 和 access_key
    return {
      Authorization: `Bearer; ${this.token}`,
      "X-App-Key": this.appid,
    };
  }

  /**
   * Get API version
   */
  getApiVersion(): "v2" | "v3" {
    return this.apiVersion;
  }

  /**
   * Handle server message
   */
  private handleMessage(data: Buffer): void {
    const result = parseResponse(data);

    // Check for errors
    if (result.code && result.code !== this.successCode) {
      const error = new Error(
        `ASR error: code=${result.code}, message=${JSON.stringify(result.payloadMsg)}`
      );
      this.emit("error", error);
      return;
    }

    // Handle full response
    if (result.messageType === MessageType.SERVER_FULL_RESPONSE) {
      this.emit("full_response", result.payloadMsg);
    }

    // Handle ACK
    if (
      result.messageType === MessageType.SERVER_ACK ||
      result.messageType === MessageType.SERVER_FULL_RESPONSE
    ) {
      if (result.payloadMsg) {
        this.emit("result", result.payloadMsg as ASRResult);

        // 检测 VAD 结束信号
        this.checkVADEnd(result.payloadMsg as ASRResult);
      }
    }
  }

  /**
   * 检测 VAD 结束信号
   * 根据字节跳动 ASR 文档：
   * 1. sequence < 0 表示最后一包音频
   * 2. utterances[n].definite = true 表示分句最终结果
   */
  private checkVADEnd(asrResult: ASRResult): void {
    const seq = asrResult.sequence ?? asrResult.seq;
    const definite = asrResult.result?.some((r) =>
      r.utterances?.some((u) => u.definite === true)
    );

    // 条件1：sequence < 0 表示最后一包音频
    // 条件2：utterances 中 definite=true 表示分句最终结果
    const isVADEnd = (seq !== undefined && seq < 0) || definite;

    // 防重：避免同一 sequence 重复触发 vad_end
    if (isVADEnd && seq !== undefined) {
      if (this.triggeredVADSequences.has(seq)) {
        return;
      }
      this.triggeredVADSequences.add(seq);

      const finalText = asrResult.result?.map((r) => r.text).join("") || "";
      this.emit("vad_end", finalText);
    }
  }

  /**
   * Send message through WebSocket
   */
  private async sendMessage(message: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      this.ws.send(message, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Slice audio data into chunks
   */
  private *sliceData(
    data: Buffer,
    chunkSize: number
  ): Generator<{ chunk: Buffer; last: boolean }, void, unknown> {
    const dataLen = data.length;
    let offset = 0;

    while (offset + chunkSize < dataLen) {
      yield { chunk: data.subarray(offset, offset + chunkSize), last: false };
      offset += chunkSize;
    }

    yield { chunk: data.subarray(offset, dataLen), last: true };
  }

  /**
   * Process audio data
   */
  private async processAudioData(wavData: Buffer): Promise<ASRResult> {
    const reqid = uuidv4();

    // Construct request
    const requestParams = this.constructRequest(reqid);
    const payloadBytes = Buffer.from(JSON.stringify(requestParams), "utf-8");
    const compressedPayload = compressGzipSync(payloadBytes);

    // Build full client request: header + payload size (4 bytes) + payload
    const fullRequest = Buffer.alloc(compressedPayload.length + 8);
    generateFullDefaultHeader().copy(fullRequest, 0);
    fullRequest.writeUInt32BE(compressedPayload.length, 4);
    compressedPayload.copy(fullRequest, 8);

    // Connect
    await this._connect();

    // Send full request
    await this.sendMessage(fullRequest);

    // Receive response
    await this.receiveMessage();

    // Process audio chunks
    const segmentSize =
      this.format === AudioFormat.MP3
        ? this.mp3SegSize
        : this.calculateSegmentSize(wavData);

    for (const { chunk, last } of this.sliceData(wavData, segmentSize)) {
      // Compress audio data
      const compressedChunk = compressGzipSync(chunk);

      // Generate header
      const header = last
        ? generateLastAudioDefaultHeader()
        : generateAudioDefaultHeader();

      // Build audio-only request
      const audioRequest = Buffer.alloc(compressedChunk.length + 8);
      header.copy(audioRequest, 0);
      audioRequest.writeUInt32BE(compressedChunk.length, 4);
      compressedChunk.copy(audioRequest, 8);

      // Send audio
      await this.sendMessage(audioRequest);

      // Receive response
      const result = await this.receiveMessage();

      // Check for errors
      if (result.code && result.code !== this.successCode) {
        return result;
      }

      // Emit audio end event for last chunk
      if (last) {
        this.emit("audio_end");
      }
    }

    // Close connection
    this.close();

    return { code: this.successCode };
  }

  /**
   * Receive message from server
   */
  private receiveMessage(): Promise<ASRResult> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      const messageHandler = (data: Buffer) => {
        const result = parseResponse(data);
        this.ws?.removeListener("message", messageHandler);

        if (result.code && result.code !== this.successCode) {
          reject(new Error(`ASR error: code=${result.code}`));
          return;
        }

        const asrResult = result.payloadMsg as ASRResult;

        // 检测 VAD 结束信号
        this.checkVADEnd(asrResult);

        resolve(asrResult);
      };

      this.ws.on("message", messageHandler);
    });
  }

  /**
   * Calculate segment size based on audio info
   */
  private calculateSegmentSize(wavData: Buffer): number {
    // Read WAV header to get audio parameters
    const processor = new AudioProcessor(this.audioPath, this.format);
    const info = processor.getWavInfo();

    const bytesPerSecond = info.nchannels * info.sampwidth * info.framerate;
    const segmentSize = Math.floor(bytesPerSecond * (this.segDuration / 1000));

    return Math.min(segmentSize, wavData.length);
  }

  /**
   * Close WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
    // Reset streaming state
    this.isStreaming = false;
    this.audioEnded = false;
    this.reqid = "";
    // 重置 VAD 触发记录
    this.triggeredVADSequences.clear();
  }

  /**
   * Execute ASR request
   */
  async execute(): Promise<ASRResult> {
    // Check required parameters
    if (!this.audioPath) {
      throw new Error("Audio path is required");
    }

    if (!this.appid || !this.token) {
      throw new Error("App ID and Token are required");
    }

    // Process audio based on format
    const processor = new AudioProcessor(this.audioPath, this.format);

    // Handle OGG format - send raw Opus data
    if (this.format === AudioFormat.OGG) {
      this.codec = "opus";
      // Keep original format
      const opusData = processor.getOpusData();
      return this.processOpusData(opusData);
    }

    // Handle other formats (WAV, MP3) - convert to WAV PCM
    const wavData = processor.getWavData();

    // Update codec based on format
    if (this.format === AudioFormat.MP3) {
      this.codec = "raw";
      this.sampleRate = 16000;
      this.channel = 1;
    }

    return this.processAudioData(wavData);
  }

  /**
   * Process Opus data for OGG format
   */
  private async processOpusData(opusData: Buffer): Promise<ASRResult> {
    const reqid = uuidv4();

    // Construct request
    const requestParams = this.constructRequest(reqid);
    const payloadBytes = Buffer.from(JSON.stringify(requestParams), "utf-8");
    const compressedPayload = compressGzipSync(payloadBytes);

    // Build full client request: header + payload size (4 bytes) + payload
    const fullRequest = Buffer.alloc(compressedPayload.length + 8);
    generateFullDefaultHeader().copy(fullRequest, 0);
    fullRequest.writeUInt32BE(compressedPayload.length, 4);
    compressedPayload.copy(fullRequest, 8);

    // Connect
    await this._connect();

    // Send full request
    await this.sendMessage(fullRequest);

    // Receive response
    await this.receiveMessage();

    // Process audio chunks - use smaller chunk size for Opus
    const segmentSize = 3200; // ~100ms at 16kHz

    for (const { chunk, last } of this.sliceData(opusData, segmentSize)) {
      // Compress audio data
      const compressedChunk = compressGzipSync(chunk);

      // Generate header
      const header = last
        ? generateLastAudioDefaultHeader()
        : generateAudioDefaultHeader();

      // Build audio-only request
      const audioRequest = Buffer.alloc(compressedChunk.length + 8);
      header.copy(audioRequest, 0);
      audioRequest.writeUInt32BE(compressedChunk.length, 4);
      compressedChunk.copy(audioRequest, 8);

      // Send audio
      await this.sendMessage(audioRequest);

      // Receive response
      const result = await this.receiveMessage();

      // Check for errors
      if (result.code && result.code !== this.successCode) {
        return result;
      }

      // Emit audio end event for last chunk
      if (last) {
        this.emit("audio_end");
      }
    }

    // Close connection
    this.close();

    return { code: this.successCode };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Check if in streaming mode
   */
  isInStreamingMode(): boolean {
    return this.isStreaming;
  }

  /**
   * Connect to WebSocket server and send initial configuration request
   * This method establishes the connection and prepares for streaming audio data
   */
  async connect(): Promise<void> {
    // Validate required parameters
    if (!this.appid || !this.token) {
      throw new Error("App ID and Token are required");
    }

    // Generate request ID
    this.reqid = uuidv4();
    this.isStreaming = true;
    this.audioEnded = false;

    // Construct request
    const requestParams = this.constructRequest(this.reqid);
    const payloadBytes = Buffer.from(JSON.stringify(requestParams), "utf-8");
    const compressedPayload = compressGzipSync(payloadBytes);

    // Build full client request: header + payload size (4 bytes) + payload
    const fullRequest = Buffer.alloc(compressedPayload.length + 8);
    generateFullDefaultHeader().copy(fullRequest, 0);
    fullRequest.writeUInt32BE(compressedPayload.length, 4);
    compressedPayload.copy(fullRequest, 8);

    // Connect
    await this._connect();

    // Send full request
    await this.sendMessage(fullRequest);

    // Receive response (server acknowledgment)
    await this.receiveMessage();
  }

  /**
   * Internal connect method (private)
   */
  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers = this.getAuthHeaders();
      this.ws = new WebSocket(this.wsUrl, {
        headers,
        handshakeTimeout: 30000,
      });

      this.ws.on("open", () => {
        this.connected = true;
        this.emit("open");
        resolve();
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.emit("close");
      });

      this.ws.on("error", (error) => {
        this.emit("error", error);
        reject(error);
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.emit("close");
      });

      // Register global message handler for event-driven mode
      // In streaming mode, this enables result/vad_end events via on()
      this.ws.on("message", (data: Buffer) => {
        this.handleMessage(data);
      });
    });
  }

  /**
   * Send a single audio frame to the server
   * @param frame - Opus audio frame data (decoded from OGG by the caller)
   */
  async sendFrame(frame: Buffer): Promise<void> {
    if (!this.isStreaming) {
      throw new Error("Not in streaming mode. Call connect() first.");
    }

    if (this.audioEnded) {
      throw new Error(
        "Audio stream has already ended. Cannot send more frames."
      );
    }

    // Compress frame data
    const compressedChunk = compressGzipSync(frame);

    // Generate header (normal audio frame)
    const header = generateAudioDefaultHeader();

    // Build audio-only request
    const audioRequest = Buffer.alloc(compressedChunk.length + 8);
    header.copy(audioRequest, 0);
    audioRequest.writeUInt32BE(compressedChunk.length, 4);
    compressedChunk.copy(audioRequest, 8);

    // Send audio (不等待响应，通过事件传递结果)
    await this.sendMessage(audioRequest);
  }

  /**
   * Mark audio as complete and wait for final result
   * @returns The final ASR result
   */
  async end(): Promise<ASRResult> {
    if (!this.isStreaming) {
      throw new Error("Not in streaming mode. Call connect() first.");
    }

    if (this.audioEnded) {
      throw new Error("Audio already ended.");
    }

    // Send a zero-length last frame to indicate end of audio
    const compressedChunk = compressGzipSync(Buffer.alloc(0));

    // Generate last audio header (with NEG_SEQUENCE flag)
    const header = generateLastAudioDefaultHeader();

    // Build audio-only request
    const audioRequest = Buffer.alloc(compressedChunk.length + 8);
    header.copy(audioRequest, 0);
    audioRequest.writeUInt32BE(compressedChunk.length, 4);
    compressedChunk.copy(audioRequest, 8);

    // Send last frame
    await this.sendMessage(audioRequest);

    // Wait for final result
    const finalResult = await this.receiveMessage();

    // Mark audio as ended after successfully receiving result
    this.audioEnded = true;
    this.emit("audio_end");

    // Close connection
    this.close();
    this.isStreaming = false;
    this.reqid = "";

    return finalResult;
  }
}

/**
 * Execute ASR with one audio file
 */
export async function executeOne(
  audioPath: string,
  cluster: string,
  options: ASROption
): Promise<ASRResult> {
  const client = new ASR({
    ...options,
    audioPath,
    cluster,
  });

  return client.execute();
}
