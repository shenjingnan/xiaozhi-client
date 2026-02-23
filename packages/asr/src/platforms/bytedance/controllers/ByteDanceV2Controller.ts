/**
 * ByteDance V2 流式 ASR 控制器
 */

import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import type { ASR as ASRClient } from "../../../client";
import type { AudioInput, ListenResult } from "../../../types";
import { ByteDanceController } from "./ByteDanceController.js";

/**
 * ByteDance V2 流式 ASR 控制器实现
 */
export class ByteDanceV2Controller extends ByteDanceController {
  private asr: ASRClient;

  constructor(asr: ASRClient) {
    super();
    this.asr = asr;
  }

  /**
   * 监听音频流并返回识别结果
   * @param audioStream - 音频流输入
   */
  async *listen(
    audioStream: AudioInput
  ): AsyncGenerator<ListenResult, void, unknown> {
    // 设置结果事件处理 - 在 connect() 之前注册，避免错过初始响应
    const resultQueue: ListenResult[] = [];
    let resolveNext: (() => void) | null = null;
    let settled = false;
    let endCalled = false; // 标记是否已经调用过 end()

    // 监听识别结果事件
    this.asr.on("result", (data) => {
      const result = data as {
        code: number;
        sequence?: number;
        addition?: {
          termination?: string;
        };
        result?: Array<{
          text: string;
          utterances?: Array<{ text: string; definite?: boolean }>;
        }>;
      };

      // 提取文本
      const text = result.result?.[0]?.text || "";

      // 判断是否为最终结果
      // V2: sequence < 0 或 utterances 中 definite=true 或 termination=true 表示最终结果
      const seq = result.sequence;
      const definite = Boolean(
        result.result?.some((r) =>
          r.utterances?.some((u) => u.definite === true)
        )
      );
      const isFinal =
        (seq !== undefined && seq < 0) ||
        definite ||
        result.addition?.termination === "true";

      const listenResult: ListenResult = {
        text,
        isFinal,
        seq,
      };

      resultQueue.push(listenResult);

      // 如果有等待的消费者，唤醒它
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      }
    });

    // 连接服务器（在事件监听器注册之后）
    await this.asr.connect();

    // 处理错误事件
    this.asr.on("error", (error) => {
      if (!settled) {
        settled = true;
        // 关闭连接
        this.asr.close();
        throw error;
      }
    });

    // 处理音频结束事件
    this.asr.on("audio_end", async () => {
      try {
        // 如果 end() 已经被调用过了，不需要再次调用
        if (endCalled) {
          return;
        }
        endCalled = true;

        // 等待最终结果
        const finalResult = await this.asr.end();

        // 发送最终结果
        const text = finalResult.result?.[0]?.text || "";
        const listenResult: ListenResult = {
          text,
          isFinal: true,
          seq: finalResult.sequence,
        };

        resultQueue.push(listenResult);

        // 如果有等待的消费者，唤醒它
        if (resolveNext) {
          const resolve = resolveNext;
          resolveNext = null;
          resolve();
        }
      } catch (error) {
        if (!settled) {
          settled = true;
          throw error;
        }
      }
    });

    // 发送音频帧
    try {
      // 将输入转换为异步可迭代对象
      const asyncIterable = this.toAsyncIterable(audioStream);

      for await (const chunk of asyncIterable) {
        // 确保是 Buffer 类型
        const frame = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        await this.asr.sendFrame(frame);

        // 发送完一帧后，检查并 yield 可用的结果
        while (resultQueue.length > 0) {
          yield resultQueue.shift()!;
        }
      }
    } catch (error) {
      settled = true;
      this.asr.close();
      throw error;
    }

    // 发送结束信号
    endCalled = true;
    await this.asr.end();

    // 监听连接关闭事件
    let connectionClosed = false;
    this.asr.on("close", () => {
      connectionClosed = true;
      // 唤醒等待的消费者
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      }
    });

    // 现在持续 yield 所有结果，使用 resolveNext 等待新结果
    while (true) {
      // 如果队列中有结果，立即 yield
      while (resultQueue.length > 0) {
        yield resultQueue.shift()!;
      }

      // 如果连接已关闭，退出
      if (connectionClosed) {
        break;
      }

      // 如果没有结果，等待新结果
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });

      // 如果连接已关闭，退出
      if (connectionClosed) {
        break;
      }

      // 被唤醒后继续循环
    }
  }

  /**
   * 将各种输入转换为异步可迭代对象
   */
  private toAsyncIterable(
    input: AudioInput
  ): AsyncIterable<Buffer | Uint8Array> {
    // 如果已经是 AsyncIterable，直接返回
    if (Symbol.asyncIterator in Object(input)) {
      return input as AsyncIterable<Buffer | Uint8Array>;
    }

    // 如果是 Readable 流
    if (input instanceof Readable) {
      return this.readableToAsyncIterable(input);
    }

    // 如果是 Buffer 或 Uint8Array，包装为单元素异步迭代器
    let buffer: Buffer;
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else {
      buffer = Buffer.from(input as unknown as Uint8Array);
    }
    return (async function* () {
      yield buffer;
    })();
  }

  /**
   * 将 Readable 流转换为异步可迭代对象
   */
  private async *readableToAsyncIterable(
    readable: Readable
  ): AsyncGenerator<Buffer> {
    for await (const chunk of readable) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
  }

  /**
   * 非流式识别
   */
  async execute(_audioData: Buffer): Promise<ListenResult> {
    const result = await this.asr.execute();
    // 转换为 ListenResult 格式
    return {
      text: result.result?.[0]?.text || "",
      isFinal: true,
      seq: result.sequence,
    };
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.asr.close();
  }
}
