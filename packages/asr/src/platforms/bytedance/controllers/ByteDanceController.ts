/**
 * ByteDance 控制器基类
 */

import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import type { ASR as ASRClient } from "@/client";
import type { AudioInput, ListenResult } from "@/types";

/**
 * ByteDance 流式 ASR 控制器基类
 * 提供共享的流式识别逻辑，子类只需实现特定版本的行为
 */
export abstract class ByteDanceController {
  /**
   * 获取 ASR 客户端实例
   */
  protected abstract get asr(): ASRClient;

  /**
   * 监听音频流并返回识别结果（并行版本）
   * 发送音频帧时不等待服务器响应，结果通过事件异步返回
   * @param audioStream - 音频流输入
   */
  async *listen(
    audioStream: AudioInput
  ): AsyncGenerator<ListenResult, void, unknown> {
    // 子类通过钩子方法决定何时注册事件监听器
    // V2 在 connect() 之前注册，V3 在 connect() 之后注册
    const { resultQueue, resolveNextRef, settledRef, endCalledRef } =
      this.setupEventListeners();

    // 连接服务器（子类决定是否在注册监听器后连接）
    await this.connectIfNeeded();

    // 处理错误事件
    this.asr.on("error", (error) => {
      if (!settledRef.value) {
        settledRef.value = true;
        // 关闭连接
        this.asr.close();
        throw error;
      }
    });

    // 处理音频结束事件
    this.asr.on("audio_end", async () => {
      try {
        // 如果 end() 已经被调用过了，不需要再次调用
        if (endCalledRef.value) {
          return;
        }
        endCalledRef.value = true;

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
        if (resolveNextRef.value) {
          const resolve = resolveNextRef.value;
          resolveNextRef.value = null;
          resolve();
        }
      } catch (error) {
        if (!settledRef.value) {
          settledRef.value = true;
          throw error;
        }
      }
    });

    // 发送音频帧（并行版本）
    try {
      // 将输入转换为异步可迭代对象
      const asyncIterable = this.toAsyncIterable(audioStream);

      // 背压控制：最大并行发送的帧数
      const MAX_PENDING_FRAMES = 10;
      let pendingFrames = 0;

      // 并行发送音频帧
      for await (const chunk of asyncIterable) {
        // 背压控制：如果正在等待的帧数过多，等待一下
        while (pendingFrames >= MAX_PENDING_FRAMES) {
          // 等待一小段时间
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // 确保是 Buffer 类型
        const frame = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        // 增加待处理计数
        pendingFrames++;

        // 异步发送帧，不等待完成
        this.asr
          .sendFrame(frame)
          .then(() => {
            // 发送成功，减少待处理计数
            pendingFrames--;
          })
          .catch((error) => {
            // 发送失败，减少待处理计数
            pendingFrames--;
            if (!settledRef.value) {
              settledRef.value = true;
              this.asr.close();
              throw error;
            }
          });

        // 发送帧后立即检查并 yield 可用的结果（不等待帧发送完成）
        while (resultQueue.length > 0) {
          yield resultQueue.shift()!;
        }
      }
    } catch (error) {
      settledRef.value = true;
      this.asr.close();
      throw error;
    }

    // 发送结束信号
    endCalledRef.value = true;

    // 如果发送过程没有触发 audio_end（可能是短音频），手动调用 end
    if (!this.asr.isAudioEnded()) {
      try {
        await this.asr.end();
      } catch {
        // 可能已经结束，忽略错误
      }
    }

    // 监听连接关闭事件
    let connectionClosed = false;
    this.asr.on("close", () => {
      connectionClosed = true;
      // 唤醒等待的消费者
      if (resolveNextRef.value) {
        const resolve = resolveNextRef.value;
        resolveNextRef.value = null;
        resolve();
      }
    });

    // 现在持续 yield 所有结果，使用 resolveNext 等待新结果
    // 注意：并行发送时，发送完成不代表结果处理完成，需要等待连接关闭
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
        resolveNextRef.value = resolve;
      });

      // 如果连接已关闭，退出
      if (connectionClosed) {
        break;
      }

      // 被唤醒后继续循环
    }
  }

  /**
   * 设置事件监听器
   * 由子类在适当的时机调用（connect() 之前或之后）
   */
  protected setupEventListeners(): {
    resultQueue: ListenResult[];
    resolveNextRef: { value: (() => void) | null };
    settledRef: { value: boolean };
    endCalledRef: { value: boolean };
  } {
    const resultQueue: ListenResult[] = [];
    const resolveNextRef = { value: null as (() => void) | null };
    const settledRef = { value: false };
    const endCalledRef = { value: false };

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
      // sequence < 0 或 utterances 中 definite=true 或 termination=true 表示最终结果
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
      if (resolveNextRef.value) {
        const resolve = resolveNextRef.value;
        resolveNextRef.value = null;
        resolve();
      }
    });

    return { resultQueue, resolveNextRef, settledRef, endCalledRef };
  }

  /**
   * 连接到服务器（如果需要）
   * 由子类决定是否需要连接（V2 在事件注册后连接，V3 先连接）
   */
  protected abstract connectIfNeeded(): Promise<void>;

  /**
   * 将各种输入转换为异步可迭代对象
   */
  protected toAsyncIterable(
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
  protected async *readableToAsyncIterable(
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
