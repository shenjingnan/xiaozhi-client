/**
 * Schema 模块导出
 */

// V2 Schema
export {
  ByteDanceV2ConfigSchema,
  ByteDanceV2AppSchema,
  ByteDanceV2UserSchema,
  ByteDanceV2AudioSchema,
  ByteDanceV2RequestSchema,
  BYTEDANCE_V2_DEFAULT_CLUSTER,
  type ByteDanceV2Config,
  type ByteDanceV2App,
  type ByteDanceV2User,
  type ByteDanceV2Audio,
  type ByteDanceV2Request,
} from "./v2.js";

// V3 Schema
export {
  ByteDanceV3ConfigSchema,
  ByteDanceV3AppSchema,
  ByteDanceV3UserSchema,
  ByteDanceV3AudioSchema,
  ByteDanceV3RequestSchema,
  type ByteDanceV3Config,
  type ByteDanceV3App,
  type ByteDanceV3User,
  type ByteDanceV3Audio,
  type ByteDanceV3Request,
} from "./v3.js";

// 统一 Schema
export {
  ByteDanceOptionSchema,
  ByteDanceV2OptionSchema,
  ByteDanceV3OptionSchema,
  isV2Config,
  isV3Config,
  parseByteDanceConfig,
  getApiVersion,
  type ByteDanceOption,
  type ByteDanceV2Option,
  type ByteDanceV3Option,
} from "./option.js";
