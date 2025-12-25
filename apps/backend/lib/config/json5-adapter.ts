/**
 * JSON5 注释保留适配器
 * 使用 JSON5 实现 JSON5 注释保留功能
 */
import JSON5 from "json5";

/**
 * JSON5 写入器适配器接口
 * 保持与 json5-writer 兼容的 API
 */
export interface Json5WriterAdapter {
  write(data: unknown): void;
  toSource(): string;
}

/**
 * 创建 JSON5 写入器适配器
 * @param content 原始 JSON5 内容字符串
 * @returns Json5WriterAdapter 实例
 */
export function createJson5Writer(content: string): Json5WriterAdapter {
  // 使用 JSON5 解析原始内容（支持注释、尾随逗号等 JSON5 特性）
  const parsedData = JSON5.parse(content) as Record<string, unknown>;

  return {
    write(data: unknown): void {
      // 通过 Object.assign 合并新数据
      if (parsedData && typeof parsedData === "object" && data) {
        Object.assign(parsedData, data);
      }
    },

    toSource(): string {
      // 使用 JSON5 序列化，支持尾随逗号等特性
      return JSON5.stringify(parsedData, null, 2);
    },
  };
}

/**
 * 解析 JSON5 内容(带注释保留)
 * @param content JSON5 内容字符串
 * @returns 解析后的对象
 */
export function parseJson5(content: string): unknown {
  // 使用 JSON5 解析，支持完整的 JSON5 特性
  return JSON5.parse(content);
}
