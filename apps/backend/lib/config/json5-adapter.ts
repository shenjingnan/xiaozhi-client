/**
 * JSON5 注释保留适配器
 * 使用 comment-json 实现 JSON5/JSONC 注释保留功能
 *
 * 注意：为了使用 comment-json 保留注释，JSON5 配置文件的键需要带引号。
 * 这与 JSON5 标准语法允许不带引号的键略有不同，但能实现注释保留功能。
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
  // 使用 comment-json 解析原始内容
  // comment-json 会保留注释信息在返回的对象中
  const parsedData = commentJson.parse(content) as Record<string, unknown>;

  return {
    write(data: unknown): void {
      // 通过 Object.assign 合并新数据
      if (parsedData && typeof parsedData === "object" && data) {
        Object.assign(parsedData, data);
      }
    },

    toSource(): string {
      // 使用 comment-json 序列化，保留注释和格式
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
  // 使用 comment-json 解析，支持注释保留
  return commentJson.parse(content);
}
