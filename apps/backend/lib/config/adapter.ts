/**
 * 配置适配器
 * 将旧的配置格式转换为新的 MCPServiceConfig 格式，确保向后兼容性
 */

import { isAbsolute, resolve } from "node:path";
import type {
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
} from "@/lib/config/manager.js";
import type { MCPServiceConfig } from "@/lib/mcp/types";
import { MCPTransportType } from "@/lib/mcp/types";
import { inferTransportTypeFromUrl } from "@/lib/mcp/utils";
import { TypeFieldNormalizer } from "@utils/TypeFieldNormalizer.js";

/**
 * 配置验证错误类
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly configName?: string
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/**
 * 将旧的 MCPServerConfig 转换为新的 MCPServiceConfig
 */
export function convertLegacyToNew(
  serviceName: string,
  legacyConfig: MCPServerConfig
): MCPServiceConfig {
  console.log("转换配置", { serviceName, legacyConfig });

  try {
    // 验证输入参数
    if (!serviceName || typeof serviceName !== "string") {
      throw new ConfigValidationError("服务名称必须是非空字符串");
    }

    if (!legacyConfig || typeof legacyConfig !== "object") {
      throw new ConfigValidationError("配置对象不能为空", serviceName);
    }

    // 首先标准化配置中的 type 字段
    const normalizedConfig = TypeFieldNormalizer.normalizeTypeField(
      legacyConfig
    ) as MCPServerConfig;

    // 根据配置类型进行转换
    const newConfig = convertByConfigType(serviceName, normalizedConfig);

    // 验证转换后的配置
    validateNewConfig(newConfig);

    console.log("配置转换成功", { serviceName, type: newConfig.type });
    return newConfig;
  } catch (error) {
    console.error("配置转换失败", { serviceName, error });
    throw error instanceof ConfigValidationError
      ? error
      : new ConfigValidationError(
          `配置转换失败: ${error instanceof Error ? error.message : String(error)}`,
          serviceName
        );
  }
}

/**
 * 根据配置类型进行转换
 */
function convertByConfigType(
  serviceName: string,
  legacyConfig: MCPServerConfig
): MCPServiceConfig {
  // 检查是否为本地 stdio 配置（最高优先级）
  if (isLocalConfig(legacyConfig)) {
    return convertLocalConfig(serviceName, legacyConfig);
  }

  // 检查是否有显式指定的类型
  if ("type" in legacyConfig) {
    switch (legacyConfig.type) {
      case "sse":
        return convertSSEConfig(serviceName, legacyConfig);
      case "streamable-http":
        return convertStreamableHTTPConfig(serviceName, legacyConfig);
      default:
        throw new ConfigValidationError(
          `不支持的传输类型: ${legacyConfig.type}`,
          serviceName
        );
    }
  }

  // 检查是否为网络配置（自动推断类型）
  if ("url" in legacyConfig) {
    // 如果 URL 是 undefined 或 null，抛出错误
    if (legacyConfig.url === undefined || legacyConfig.url === null) {
      throw new ConfigValidationError(
        "网络配置必须包含有效的 url 字段",
        serviceName
      );
    }

    // 先推断类型，然后根据推断的类型选择正确的转换函数
    const inferredType = inferTransportTypeFromUrl(legacyConfig.url || "");

    if (inferredType === MCPTransportType.SSE) {
      // 为SSE类型添加显式type字段
      const sseConfig = { ...legacyConfig, type: "sse" as const };
      return convertSSEConfig(serviceName, sseConfig);
    }
    // 为STREAMABLE_HTTP类型添加显式type字段
    const httpConfig = { ...legacyConfig, type: "streamable-http" as const };
    return convertStreamableHTTPConfig(serviceName, httpConfig);
  }

  throw new ConfigValidationError("无法识别的配置类型", serviceName);
}

/** * 转换本地 stdio 配置 */
function convertLocalConfig(
  serviceName: string,
  config: LocalMCPServerConfig
): MCPServiceConfig {
  if (!config.command) {
    throw new ConfigValidationError(
      "本地配置必须包含 command 字段",
      serviceName
    );
  }

  // 获取用户的工作目录（优先使用环境变量，否则使用当前工作目录）
  const workingDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();

  // 解析 args 中的相对路径
  const resolvedArgs = (config.args || []).map((arg) => {
    // 检查是否为相对路径（以 ./ 开头或不以 / 开头且包含文件扩展名）
    if (isRelativePath(arg)) {
      const resolvedPath = resolve(workingDir, arg);
      console.log("解析相对路径", { arg, resolvedPath });
      return resolvedPath;
    }
    return arg;
  });

  return {
    name: serviceName,
    type: MCPTransportType.STDIO,
    command: config.command,
    args: resolvedArgs,
    env: config.env, // 传递环境变量
    timeout: 30000,
  };
}

/**
 * 转换 SSE 配置
 */
function convertSSEConfig(
  serviceName: string,
  config: SSEMCPServerConfig
): MCPServiceConfig {
  if (config.url === undefined || config.url === null) {
    throw new ConfigValidationError("SSE 配置必须包含 url 字段", serviceName);
  }

  // 优先使用显式指定的类型，如果没有则进行推断
  const inferredType =
    config.type === "sse"
      ? MCPTransportType.SSE
      : inferTransportTypeFromUrl(config.url || "");
  const isModelScope = config.url ? isModelScopeURL(config.url) : false;

  const baseConfig: MCPServiceConfig = {
    name: serviceName,
    type: inferredType,
    url: config.url,
    timeout: 30000,
    headers: config.headers,
  };

  // 如果是 ModelScope 服务，添加特殊配置
  if (isModelScope) {
    baseConfig.modelScopeAuth = true;
  }

  console.log("SSE配置转换", {
    serviceName,
    url: config.url,
    inferredType,
    isModelScope,
  });

  return baseConfig;
}

/**
 * 转换 Streamable HTTP 配置
 */
function convertStreamableHTTPConfig(
  serviceName: string,
  config: StreamableHTTPMCPServerConfig
): MCPServiceConfig {
  // 检查 URL 是否存在
  if (config.url === undefined || config.url === null) {
    throw new ConfigValidationError(
      "STREAMABLE_HTTP 配置必须包含 url 字段",
      serviceName
    );
  }

  const url = config.url || "";

  return {
    name: serviceName,
    type: MCPTransportType.STREAMABLE_HTTP,
    url,
    timeout: 30000,
    headers: config.headers,
  };
}

/**
 * 批量转换配置
 */
export function convertLegacyConfigBatch(
  legacyConfigs: Record<string, MCPServerConfig>
): Record<string, MCPServiceConfig> {
  const newConfigs: Record<string, MCPServiceConfig> = {};
  const errors: Array<{ serviceName: string; error: Error }> = [];

  for (const [serviceName, legacyConfig] of Object.entries(legacyConfigs)) {
    try {
      newConfigs[serviceName] = convertLegacyToNew(serviceName, legacyConfig);
    } catch (error) {
      errors.push({
        serviceName,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors
      .map(({ serviceName, error }) => `${serviceName}: ${error.message}`)
      .join("; ");
    throw new ConfigValidationError(`批量配置转换失败: ${errorMessages}`);
  }

  console.log("批量配置转换成功", { count: Object.keys(newConfigs).length });
  return newConfigs;
}

/**
 * 检查是否为相对路径
 */
function isRelativePath(path: string): boolean {
  // 使用 Node.js 的 path.isAbsolute() 来正确检测绝对路径
  // 这个方法能够正确处理 Windows、macOS、Linux 三个平台的路径格式
  if (isAbsolute(path)) {
    return false; // 绝对路径不是相对路径
  }

  // 检查是否为相对路径的条件：
  // 1. 以 ./ 或 ../ 开头
  // 2. 包含常见的脚本文件扩展名（且不是绝对路径）
  if (path.startsWith("./") || path.startsWith("../")) {
    return true;
  }

  // 如果包含文件扩展名且不是绝对路径，也认为是相对路径
  if (/\.(js|py|ts|mjs|cjs)$/i.test(path)) {
    return true;
  }

  return false;
}

/**
 * 检查是否为本地配置
 */
function isLocalConfig(
  config: MCPServerConfig
): config is LocalMCPServerConfig {
  return "command" in config && typeof config.command === "string";
}

/**
 * 检查是否为 ModelScope URL
 */
export function isModelScopeURL(url: string): boolean {
  return url.includes("modelscope.net") || url.includes("modelscope.cn");
}

/**
 * 验证新配置格式
 */
function validateNewConfig(config: MCPServiceConfig): void {
  if (!config.name || typeof config.name !== "string") {
    throw new ConfigValidationError("配置必须包含有效的 name 字段");
  }

  if (config.type && !Object.values(MCPTransportType).includes(config.type)) {
    throw new ConfigValidationError(`无效的传输类型: ${config.type}`);
  }

  // 根据传输类型验证必需字段
  if (!config.type) {
    throw new ConfigValidationError("传输类型未指定，请检查配置或启用自动推断");
  }

  switch (config.type) {
    case MCPTransportType.STDIO:
      if (!config.command) {
        throw new ConfigValidationError("STDIO 配置必须包含 command 字段");
      }
      break;

    case MCPTransportType.SSE:
      // SSE 配置必须有 URL（即使是空字符串也会被推断为 STREAMABLE_HTTP）
      if (config.url === undefined || config.url === null) {
        throw new ConfigValidationError("SSE 配置必须包含 url 字段");
      }
      break;

    case MCPTransportType.STREAMABLE_HTTP:
      // STREAMABLE_HTTP 配置允许空 URL，会在后续处理中设置默认值
      // 只有当 URL 完全不存在时才报错
      if (config.url === undefined || config.url === null) {
        throw new ConfigValidationError(
          "STREAMABLE_HTTP 配置必须包含 url 字段"
        );
      }
      break;

    default:
      throw new ConfigValidationError(`不支持的传输类型: ${config.type}`);
  }
}

/**
 * 获取配置类型描述
 */
export function getConfigTypeDescription(config: MCPServerConfig): string {
  if (isLocalConfig(config)) {
    return `本地进程 (${config.command})`;
  }

  if ("url" in config) {
    // 检查是否为显式 streamable-http 配置
    if ("type" in config && config.type === "streamable-http") {
      return `Streamable HTTP (${config.url})`;
    }

    // 检查是否为显式 sse 配置
    if ("type" in config && config.type === "sse") {
      const isModelScope = isModelScopeURL(config.url);
      return `SSE${isModelScope ? " (ModelScope)" : ""} (${config.url})`;
    }

    // 对于只有 url 的配置，根据路径推断类型
    const inferredType = inferTransportTypeFromUrl(config.url);
    const isModelScope = isModelScopeURL(config.url);

    if (inferredType === MCPTransportType.SSE) {
      return `SSE${isModelScope ? " (ModelScope)" : ""} (${config.url})`;
    }
    return `Streamable HTTP (${config.url})`;
  }

  return "未知类型";
}
