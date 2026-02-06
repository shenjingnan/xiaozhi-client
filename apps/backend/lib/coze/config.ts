/**
 * 扣子 API 环境配置
 *
 * 提供扣子平台的中英文环境 API 端点配置
 *
 * @example
 * ```typescript
 * import config from '@/lib/coze/config';
 * const zhConfig = config.zh;
 * const enConfig = config.en;
 * ```
 */
export default {
  zh: {
    COZE_BASE_URL: "https://api.coze.cn",
    COZE_BASE_WS_URL: "wss://ws.coze.cn",
  },
  en: {
    COZE_BASE_URL: "https://api.coze.com",
    COZE_BASE_WS_URL: "wss://ws.coze.com",
  },
};
