/**
 * 统一配置校验 Schema
 */

import { z } from "zod";
import { type ByteDanceV2Config, ByteDanceV2ConfigSchema } from "./v2.js";
import { type ByteDanceV3Config, ByteDanceV3ConfigSchema } from "./v3.js";

/**
 * 字节跳动 V2 配置
 */
export const ByteDanceV2OptionSchema = z.object({
  v2: ByteDanceV2ConfigSchema,
});

export type ByteDanceV2Option = z.infer<typeof ByteDanceV2OptionSchema>;

/**
 * 字节跳动 V3 配置
 */
export const ByteDanceV3OptionSchema = z.object({
  v3: ByteDanceV3ConfigSchema,
});

export type ByteDanceV3Option = z.infer<typeof ByteDanceV3OptionSchema>;

/**
 * 字节跳动配置（V2 或 V3）
 */
export const ByteDanceOptionSchema = z.union([
  ByteDanceV2OptionSchema,
  ByteDanceV3OptionSchema,
]);

export type ByteDanceOption = ByteDanceV2Option | ByteDanceV3Option;

/**
 * 判断是否为 V2 配置
 */
export function isV2Config(
  config: ByteDanceOption
): config is ByteDanceV2Option {
  return "v2" in config;
}

/**
 * 判断是否为 V3 配置
 */
export function isV3Config(
  config: ByteDanceOption
): config is ByteDanceV3Option {
  return "v3" in config;
}

/**
 * 解析并校验字节跳动配置
 */
export function parseByteDanceConfig(
  config: unknown
): ByteDanceV2Config | ByteDanceV3Config {
  const parsed = ByteDanceOptionSchema.parse(config);

  if (isV2Config(parsed)) {
    return parsed.v2;
  }

  return parsed.v3;
}

/**
 * 获取 API 版本
 */
export function getApiVersion(config: ByteDanceOption): "v2" | "v3" {
  if (isV2Config(config)) {
    return "v2";
  }
  return "v3";
}

export { ByteDanceV2ConfigSchema, ByteDanceV3ConfigSchema };
export type { ByteDanceV2Config, ByteDanceV3Config };
