/**
 * ByteDance Schema 模块导出
 */

// V2 Schema
export {
  BYTEDANCE_V2_DEFAULT_CLUSTER,
  type ByteDanceV2App,
  ByteDanceV2AppSchema,
  type ByteDanceV2Audio,
  ByteDanceV2AudioSchema,
  type ByteDanceV2Config,
  ByteDanceV2ConfigSchema,
  type ByteDanceV2Request,
  ByteDanceV2RequestSchema,
  type ByteDanceV2User,
  ByteDanceV2UserSchema,
} from "./api-v2.js";

// V3 Schema
export {
  type ByteDanceV3App,
  ByteDanceV3AppSchema,
  type ByteDanceV3Audio,
  ByteDanceV3AudioSchema,
  type ByteDanceV3Config,
  ByteDanceV3ConfigSchema,
  type ByteDanceV3Request,
  ByteDanceV3RequestSchema,
  type ByteDanceV3User,
  ByteDanceV3UserSchema,
} from "./api-v3.js";

// 统一 Schema
export {
  type ByteDanceOption,
  ByteDanceOptionSchema,
  type ByteDanceV2Option,
  ByteDanceV2OptionSchema,
  type ByteDanceV3Option,
  ByteDanceV3OptionSchema,
  getApiVersion,
  isV2Config,
  isV3Config,
  parseByteDanceConfig,
} from "./option.js";
