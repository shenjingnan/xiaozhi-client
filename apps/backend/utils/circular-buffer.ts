/**
 * 环形缓冲区
 *
 * 高性能固定大小队列，使用环形数组实现：
 * - O(1) push 操作
 * - O(1) popFirst 操作
 * - 固定内存占用
 * - 自动处理队列满的情况（覆盖最旧元素）
 *
 * 相比普通数组的 shift() 操作，避免了 O(n) 的数组重新索引开销。
 */

/**
 * 环形缓冲区类
 * @template T - 缓冲区元素类型
 */
export class CircularBuffer<T> {
  /** 固定大小的缓冲区数组 */
  private buffer: T[];

  /** 头部指针（指向最旧元素） */
  private head = 0;

  /** 尾部指针（指向下一个写入位置） */
  private tail = 0;

  /** 当前元素数量 */
  private size = 0;

  /** 缓冲区容量 */
  private readonly capacity: number;

  /**
   * 构造函数
   * @param capacity - 缓冲区容量
   */
  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * 添加元素到缓冲区尾部
   * 如果缓冲区已满，自动覆盖最旧的元素
   * @param item - 要添加的元素
   */
  push(item: T): void {
    if (this.size === this.capacity) {
      // 缓冲区已满，移动头部指针以覆盖最旧元素
      this.head = (this.head + 1) % this.capacity;
    } else {
      this.size++;
    }

    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
  }

  /**
   * 移除并返回最旧的元素
   * @returns 最旧的元素，如果缓冲区为空则返回 undefined
   */
  popFirst(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined as T; // 清理引用
    this.head = (this.head + 1) % this.capacity;
    this.size--;

    return item;
  }

  /**
   * 获取当前元素数量
   * @returns 元素数量
   */
  getSize(): number {
    return this.size;
  }

  /**
   * 检查缓冲区是否为空
   * @returns 如果为空返回 true
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * 检查缓冲区是否已满
   * @returns 如果已满返回 true
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * 获取最旧的元素（不移除）
   * @returns 最旧的元素，如果缓冲区为空则返回 undefined
   */
  peekFirst(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    return this.buffer[this.head];
  }

  /**
   * 获取最新的元素（不移除）
   * @returns 最新的元素，如果缓冲区为空则返回 undefined
   */
  peekLast(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    // tail 指向下一个写入位置，所以最新元素在 tail - 1
    const lastIndex = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIndex];
  }

  /**
   * 将缓冲区内容转换为数组（按顺序从旧到新）
   * @returns 包含所有元素的数组
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]);
    }
    return result;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * 迭代器支持 - 按顺序从旧到新迭代
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      yield this.buffer[index];
    }
  }

  /**
   * 获取缓冲区容量
   * @returns 缓冲区容量
   */
  getCapacity(): number {
    return this.capacity;
  }
}
