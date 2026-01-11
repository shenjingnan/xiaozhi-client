/**
 * MCP 服务器配置 Type 字段标准化工具
 * 支持将各种 type 字段格式转换为标准的中划线格式
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
   * 标准化type字段格式
   * 支持将各种格式转换为标准的中划线格式
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

    // 创建配置的深拷贝以避免修改原始对象
    const normalizedConfig = JSON.parse(JSON.stringify(config));

    // 如果配置中没有type字段，直接返回
    if (!("type" in normalizedConfig)) {
      return normalizedConfig;
    }

    const originalType = normalizedConfig.type;

    // 如果已经是标准格式，直接返回
    if (originalType === "sse" || originalType === "streamable-http") {
      return normalizedConfig;
    }

    // 转换为标准格式
    let normalizedType: string;

    if (
      originalType === "streamableHttp" ||
      originalType === "streamable_http"
    ) {
      normalizedType = "streamable-http";
    } else if (originalType === "s_se" || originalType === "s-se") {
      normalizedType = "sse";
    } else {
      // 对于其他格式，尝试智能转换
      normalizedType = convertToKebabCase(originalType);
    }

    // 验证转换后的类型是否有效
    if (normalizedType === "sse" || normalizedType === "streamable-http") {
      normalizedConfig.type = normalizedType;
      // 记录转换日志（如果有的话）
      if (originalType !== normalizedType) {
        // 可以在需要时添加日志记录
      }
    }

    return normalizedConfig;
  }

  /**
   * 将字符串转换为kebab-case格式
   */
  function convertToKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2") // 驼峰转中划线
      .replace(/_/g, "-") // 下划线转中划线
      .toLowerCase(); // 转小写
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
