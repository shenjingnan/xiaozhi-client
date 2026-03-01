/**
 * 扣子（Coze）API 集成模块
 *
 * 提供与扣子平台集成的完整功能，包括：
 * - config: 扣子 API 环境配置（中英文环境）
 * - @coze/api: 扣子官方 SDK 的完整导出
 * - createCozeClient: 创建扣子 API 客户端的工厂函数
 * - CozeApiService: 扣子 API 服务的封装类
 *
 * @example
 * ```typescript
 * import { CozeApiService, createCozeClient, config } from '@/lib/coze';
 *
 * // 使用预配置的服务
 * const service = new CozeApiService('your-token');
 *
 * // 或者创建自定义客户端
 * const client = createCozeClient('your-token', 'zh');
 * ```
 */

export * from "@coze/api";
export { createCozeClient } from "./client";
export { default as config } from "./config";
export { CozeApiService } from "./service";
