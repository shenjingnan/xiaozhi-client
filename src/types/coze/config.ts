/**
 * 扣子平台配置相关类型定义
 */

/**
 * 扣子平台配置接口
 */
export interface CozePlatformConfig {
  /** 扣子 API Token */
  token: string;
}

/**
 * 扣子 API 服务配置
 */
export interface CozeApiServiceConfig {
  /** API Token */
  token: string;
  /** API 基础URL，默认 https://api.coze.cn */
  apiBaseUrl?: string;
  /** 请求超时时间，默认 10000ms */
  timeout?: number;
  /** 重试次数，默认 3 次 */
  retryAttempts?: number;
  /** 是否启用缓存，默认 true */
  cacheEnabled?: boolean;
}
