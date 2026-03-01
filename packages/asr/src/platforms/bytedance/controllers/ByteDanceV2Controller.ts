/**
 * ByteDance V2 流式 ASR 控制器
 */

import type { ASR as ASRClient } from "@/client";
import { ByteDanceController } from "@/platforms/bytedance/controllers/ByteDanceController.js";

/**
 * ByteDance V2 流式 ASR 控制器实现
 * V2 在 connect() 之前注册事件监听器，避免错过初始响应
 */
export class ByteDanceV2Controller extends ByteDanceController {
  private _asr: ASRClient;
  private _connected = false;

  constructor(asr: ASRClient) {
    super();
    this._asr = asr;
  }

  protected get asr(): ASRClient {
    return this._asr;
  }

  /**
   * 连接到服务器
   * V2 在注册事件监听器后连接
   */
  protected async connectIfNeeded(): Promise<void> {
    if (!this._connected) {
      await this.asr.connect();
      this._connected = true;
    }
  }

  /**
   * 监听音频流并返回识别结果（并行版本）
   * V2 在 connect() 之前注册事件监听器，避免错过初始响应
   */
  override async *listen(
    audioStream: import("@/types").AudioInput
  ): AsyncGenerator<import("@/types").ListenResult, void, unknown> {
    // V2 特性：在 connect() 之前注册事件监听器，避免错过初始响应
    const { resultQueue, resolveNextRef, settledRef, endCalledRef } =
      this.setupEventListeners();

    // 连接服务器（在事件监听器注册之后）
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
        const listenResult: import("@/types").ListenResult = {
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
}
