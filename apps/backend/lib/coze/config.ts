/**
 * 扣子 API 环境配置
 *
 * 提供扣子 API 的不同环境配置（中文环境和英文环境）
 *
 * @example
 * ```typescript
 * import config from "@/lib/coze/config";
 *
 * // 获取中文环境配置（默认）
 * const zhEnv = config.zh;
 * console.log(zhEnv.COZE_BASE_URL); // "https://api.coze.cn"
 *
 * // 获取英文环境配置
 * const enEnv = config.en;
 * console.log(enEnv.COZE_BASE_URL); // "https://api.coze.com"
 * ```
 *
 * @remarks
 * - 中文环境（zh）：适用于中国大陆用户，使用 .cn 域名
 * - 英文环境（en）：适用于国际用户，使用 .com 域名
 * - 该配置被 `@/lib/coze/client.ts` 中的 `createCozeClient` 函数使用
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
