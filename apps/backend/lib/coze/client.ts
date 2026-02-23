/**
 * 扣子 API 客户端封装
 * 提供统一的客户端创建和配置
 */

import { CozeAPI } from "@/lib/coze/index.js";
import config from "./config";

export type Language = "zh" | "en";

/**
 * 创建 Coze API 客户端
 * @param token - API 访问令牌
 * @param language - API 环境语言，默认为 "zh"（中文），可选 "en"（英文）
 */
export function createCozeClient(
  token: string,
  language: Language = "zh"
): CozeAPI {
  if (!token || typeof token !== "string" || token.trim() === "") {
    throw new Error("扣子 API Token 不能为空");
  }

  const env = config[language] || config.zh;

  return new CozeAPI({
    baseURL: env.COZE_BASE_URL,
    token: token.trim(),
    baseWsURL: env.COZE_BASE_WS_URL,
    debug: false,
  });
}
