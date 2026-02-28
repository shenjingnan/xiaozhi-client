/**
 * 音频缓冲区
 *
 * 实现 FIFO（先进先出）的音频数据缓冲区，用于在 ASR 连接建立前缓存音频数据。
 *
 * @example
 * ```typescript
 * const buffer = new AudioBuffer();
 *
 * // 生产者：推入音频数据
 * buffer.push(audioChunk1);
 * buffer.push(audioChunk2);
 *
 * // 消费者：等待并获取数据
 * while (true) {
 *   await buffer.waitForData();
 *   if (buffer.isEmpty() && buffer.isEnded()) break;
 *   const chunk = buffer.shift();
 *   if (chunk) await sendToASR(chunk);
 * }
 * ```
 */

/**
 * 音频缓冲区配置选项
 */
export interface AudioBufferOptions {
  /** 最大缓冲区大小（字节），默认 10MB */
  maxBufferSize?: number;
}

/**
 * 音频缓冲区状态
 */
export interface AudioBufferState {
  /** 当前缓冲区大小（字节） */
  currentSize: number;
  /** 缓冲的数据块数量 */
  chunkCount: number;
  /** 是否已结束 */
  ended: boolean;
  /** 是否已满 */
  full: boolean;
}

/**
 * 缓冲区已满错误
 */
export class BufferFullError extends Error {
  constructor(
    public readonly currentSize: number,
    public readonly maxSize: number
  ) {
    super(`缓冲区已满: 当前大小 ${currentSize} 字节，最大 ${maxSize} 字节`);
    this.name = "BufferFullError";
  }
}

/**
 * 音频缓冲区类
 *
 * 提供线程安全的音频数据缓冲功能，支持：
 * - FIFO 顺序的数据存取
 * - 异步等待数据可用
 * - 最大容量限制
 * - 结束标记
 */
export class AudioBuffer {
  /** 数据块队列 */
  private readonly chunks: Buffer[] = [];

  /** 当前缓冲区大小（字节） */
  private currentSize = 0;

  /** 是否已结束 */
  private ended = false;

  /** 等待数据的 Promise 解析器 */
  private readonly waitResolvers: (() => void)[] = [];

  /** 最大缓冲区大小（字节） */
  private readonly maxBufferSize: number;

  constructor(options: AudioBufferOptions = {}) {
    this.maxBufferSize = options.maxBufferSize ?? 10 * 1024 * 1024; // 默认 10MB
  }

  /**
   * 推入音频数据
   *
   * @param data 音频数据块
   * @throws {BufferFullError} 如果缓冲区已满
   */
  push(data: Buffer): void {
    if (this.ended) {
      throw new Error("缓冲区已结束，无法推入更多数据");
    }

    const newSize = this.currentSize + data.length;
    if (newSize > this.maxBufferSize) {
      throw new BufferFullError(this.currentSize, this.maxBufferSize);
    }

    this.chunks.push(data);
    this.currentSize = newSize;
    this.notifyWaiters();
  }

  /**
   * 取出最早的数据块
   *
   * @returns 最早的数据块，如果缓冲区为空则返回 undefined
   */
  shift(): Buffer | undefined {
    const chunk = this.chunks.shift();
    if (chunk) {
      this.currentSize -= chunk.length;
    }
    return chunk;
  }

  /**
   * 查看最早的数据块（不移除）
   *
   * @returns 最早的数据块，如果缓冲区为空则返回 undefined
   */
  peek(): Buffer | undefined {
    return this.chunks[0];
  }

  /**
   * 等待数据可用
   *
   * 如果缓冲区已有数据或已结束，立即返回。
   * 否则等待直到有数据被推入或缓冲区结束。
   */
  async waitForData(): Promise<void> {
    if (this.chunks.length > 0 || this.ended) {
      return;
    }

    return new Promise((resolve) => {
      this.waitResolvers.push(resolve);
    });
  }

  /**
   * 标记缓冲区结束
   *
   * 调用后不能再推入数据，但可以继续消费已有数据。
   */
  end(): void {
    this.ended = true;
    this.notifyWaiters();
  }

  /**
   * 检查缓冲区是否为空
   */
  isEmpty(): boolean {
    return this.chunks.length === 0;
  }

  /**
   * 检查缓冲区是否已结束
   */
  isEnded(): boolean {
    return this.ended;
  }

  /**
   * 检查缓冲区是否已满
   */
  isFull(): boolean {
    return this.currentSize >= this.maxBufferSize;
  }

  /**
   * 获取当前缓冲区大小（字节）
   */
  size(): number {
    return this.currentSize;
  }

  /**
   * 获取缓冲的数据块数量
   */
  length(): number {
    return this.chunks.length;
  }

  /**
   * 获取缓冲区状态
   */
  getState(): AudioBufferState {
    return {
      currentSize: this.currentSize,
      chunkCount: this.chunks.length,
      ended: this.ended,
      full: this.isFull(),
    };
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.chunks.length = 0;
    this.currentSize = 0;
    this.notifyWaiters();
  }

  /**
   * 重置缓冲区状态（包括结束标记）
   */
  reset(): void {
    this.clear();
    this.ended = false;
  }

  /**
   * 通知所有等待者
   */
  private notifyWaiters(): void {
    const resolvers = this.waitResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }
}
