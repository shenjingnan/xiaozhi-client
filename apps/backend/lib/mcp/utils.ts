import { TypeFieldNormalizer } from "@utils/type-field-normalizer.js";
import { MCPTransportType, ToolCallError, ToolCallErrorCode } from "./types.js";
import type {
  MCPServiceConfig,
  ToolCallParams,
  ToolCallValidationOptions,
  ValidatedToolCallParams,
} from "./types.js";

/**
 * 根据 URL 路径推断传输类型
 * 基于路径末尾推断，支持包含多个 / 的复杂路径
 *
 * @param url - 要推断的 URL
 * @param options - 可选配置项
 * @returns 推断出的传输类型
 */
export function inferTransportTypeFromUrl(
  url: string,
  options?: {
    serviceName?: string;
  }
): MCPTransportType {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;

    // 检查路径末尾
    if (pathname.endsWith("/sse")) {
      return MCPTransportType.SSE;
    }
    if (pathname.endsWith("/mcp")) {
      return MCPTransportType.HTTP;
    }

    // 默认类型 - 使用 console 输出
    if (options?.serviceName) {
      console.info(
        `[MCP-${options.serviceName}] URL 路径 ${pathname} 不匹配特定规则，默认推断为 http 类型`
      );
    }
    return MCPTransportType.HTTP;
  } catch (error) {
    if (options?.serviceName) {
      console.warn(
        `[MCP-${options.serviceName}] URL 解析失败，默认推断为 http 类型`,
        error
      );
    }
    return MCPTransportType.HTTP;
  }
}

/**
 * 完整的配置类型推断（包括 command 字段）
 *
 * @param config - MCP 服务配置
 * @param serviceName - 服务名称（用于错误信息）
 * @returns 完整的配置对象，包含推断出的类型
 */
export function inferTransportTypeFromConfig(
  config: MCPServiceConfig,
  serviceName: string
): MCPServiceConfig {
  // 如果已显式指定类型，先标准化然后返回
  if (config.type) {
    const normalizedConfig = TypeFieldNormalizer.normalizeTypeField(config);
    return normalizedConfig as MCPServiceConfig;
  }

  // 基于 command 字段推断
  if (config.command) {
    return {
      ...config,
      type: MCPTransportType.STDIO,
    };
  }

  // 基于 URL 字段推断（排除 null 和 undefined）
  if (config.url !== undefined && config.url !== null) {
    const inferredType = inferTransportTypeFromUrl(config.url, {
      serviceName,
    });
    return {
      ...config,
      type: inferredType,
    };
  }

  throw new Error(
    `无法为服务 ${serviceName} 推断传输类型。请显式指定 type 字段，或提供 command/url 配置`
  );
}

// =========================
// 参数校验工具函数
// =========================

/**
 * 验证工具调用参数
 * 对传入的参数进行完整性和格式验证
 *
 * @param params 待验证的参数
 * @param options 验证选项
 * @returns 验证后的参数
 * @throws ToolCallError 验证失败时抛出
 */
export function validateToolCallParams(
  params: unknown,
  options?: ToolCallValidationOptions
): ValidatedToolCallParams {
  const opts = {
    validateName: true,
    validateArguments: true,
    allowEmptyArguments: true,
    ...options,
  };

  // 1. 验证参数必须是对象
  if (!params || typeof params !== "object") {
    throw new ToolCallError(
      ToolCallErrorCode.INVALID_PARAMS,
      "请求参数必须是对象"
    );
  }

  const paramsObj = params as Record<string, unknown>;

  // 2. 验证工具名称
  if (opts.validateName) {
    if (!paramsObj.name || typeof paramsObj.name !== "string") {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "工具名称必须是非空字符串"
      );
    }
  }

  // 3. 验证工具参数格式
  if (
    opts.validateArguments &&
    paramsObj.arguments !== undefined &&
    paramsObj.arguments !== null
  ) {
    if (
      typeof paramsObj.arguments !== "object" ||
      Array.isArray(paramsObj.arguments)
    ) {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "工具参数必须是对象"
      );
    }
  }

  // 4. 验证是否允许空参数
  if (
    !opts.allowEmptyArguments &&
    paramsObj.arguments !== undefined &&
    paramsObj.arguments !== null
  ) {
    const argsObj = paramsObj.arguments as Record<string, unknown>;
    if (Object.keys(argsObj).length === 0) {
      throw new ToolCallError(
        ToolCallErrorCode.INVALID_PARAMS,
        "工具参数不能为空"
      );
    }
  }

  // 5. 执行自定义验证
  if (opts.customValidator) {
    const error = opts.customValidator(paramsObj as unknown as ToolCallParams);
    if (error) {
      throw new ToolCallError(ToolCallErrorCode.INVALID_PARAMS, error);
    }
  }

  return {
    name: paramsObj.name as string,
    arguments: paramsObj.arguments as Record<string, unknown>,
  };
}
