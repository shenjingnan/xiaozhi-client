/**
 * MCP 服务器配置 Type 字段标准化工具
 * 支持将各种 type 字段格式转换为 MCP 官方标准格式
 *
 * @description
 * 标准格式与 MCP 官方保持一致：
 * - stdio: 本地进程通信
 * - sse: Server-Sent Events
 * - http: Streamable HTTP（推荐使用 http 而非 streamable-http）
 *
 * 向后兼容：自动转换各种变体格式
 */

/**
 * MCP 服务器配置的基础接口
 * 定义包含可选 type 字段的配置对象结构
 */
export interface MCPBaseConfig {
  type?: string;
  [key: string]: unknown; // 允许其他配置属性
}

/**
 * MCP 服务器配置 Type 字段标准化工具类
 */
export namespace TypeFieldNormalizer {
  /**
   * 标准化 type 字段格式
   *
   * 支持的转换：
   * - http 变体：http → http（标准值）
   * - streamable-http → http
   * - streamable_http → http
   * - streamableHttp → http
   * - sse 变体：sse → sse（标准值）
   * - s_se → sse
   * - s-se → sse
   * - stdio 变体：stdio → stdio（标准值）
   */
  // 函数重载：泛型版本，用于类型安全的调用
  export function normalizeTypeField<T extends MCPBaseConfig>(config: T): T;

  // 函数重载：向后兼容版本，用于 unknown 类型输入
  export function normalizeTypeField(config: unknown): unknown;

  // 统一实现
  export function normalizeTypeField<T extends MCPBaseConfig>(
    config: T | unknown
  ): T | unknown {
    if (!config || typeof config !== "object") {
      return config;
    }

    // 如果配置中没有 type 字段，直接返回原始对象
    if (!("type" in config)) {
      return config;
    }

    const originalType = (config as { type?: string }).type;

    // 如果已经是标准格式，直接返回原始对象
    if (
      typeof originalType === "string" &&
      (originalType === "stdio" || originalType === "sse" || originalType === "http")
    ) {
      return config;
    }

    // 只有在需要修改 type 字段时才进行深拷贝
    const normalizedConfig = JSON.parse(JSON.stringify(config)) as T;
    const normalizedType = normalizeTypeValue(originalType as string);

    // 验证转换后的类型是否有效
    if (normalizedType === "stdio" || normalizedType === "sse" || normalizedType === "http") {
      normalizedConfig.type = normalizedType as T["type"];
    }

    return normalizedConfig;
  }

  /**
   * 标准化单个 type 值
   */
  export function normalizeTypeValue(type: string): string {
    // http 相关的变体全部转为 http
    if (
      type === "http" ||
      type === "streamable-http" ||
      type === "streamable_http" ||
      type === "streamableHttp"
    ) {
      return "http";
    }

    // sse 相关的变体转为 sse
    if (type === "sse" || type === "s_se" || type === "s-se") {
      return "sse";
    }

    // stdio 相关的变体转为 stdio
    if (type === "stdio") {
      return "stdio";
    }

    // 对于其他格式，尝试智能转换（转小写、下划线转中划线等）
    return convertToStandardFormat(type);
  }

  /**
   * 将字符串转换为标准格式
   */
  function convertToStandardFormat(str: string): string {
    const lowered = str.toLowerCase();

    // 处理 http 相关的变体
    if (lowered.includes("http") || lowered.includes("streamable")) {
      return "http";
    }

    // 处理 sse 相关的变体
    if (lowered.includes("sse")) {
      return "sse";
    }

    // 处理 stdio 相关的变体
    if (lowered.includes("stdio")) {
      return "stdio";
    }

    // 无法识别的格式，返回原值
    return str;
  }
}

/**
 * 导出便捷函数
 */
export function normalizeTypeField<T extends MCPBaseConfig>(
  config: T
): T;
export function normalizeTypeField(config: unknown): unknown;
export function normalizeTypeField<T extends MCPBaseConfig>(
  config: T | unknown
): T | unknown {
  return TypeFieldNormalizer.normalizeTypeField(config);
}
