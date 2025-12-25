/**
 * JSON5 注释保留适配器
 * 使用 comment-json 实现类似 json5-writer 的 API
 */
import * as commentJson from "comment-json";

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
  // 解析原始内容，保留注释信息
  const parsedData = commentJson.parse(content) as Record<string, unknown>;

  return {
    write(data: unknown): void {
      // comment-json 通过直接修改对象来更新数据
      // 使用 Object.assign 进行合并
      if (parsedData && typeof parsedData === "object" && data) {
        Object.assign(parsedData, data);
      }
    },

    toSource(): string {
      // 使用 comment-json 序列化，保留注释
      return commentJson.stringify(parsedData, null, 2);
    },
  };
}

/**
 * 解析 JSON5 内容(带注释保留)
 * @param content JSON5 内容字符串
 * @returns 解析后的对象
 */
export function parseJson5(content: string): unknown {
  return commentJson.parse(content);
}
