/**
 * 配置适配器
 * 将旧的配置格式转换为新的 MCPServiceConfig 格式，确保向后兼容性
 */

import { dirname, isAbsolute, resolve } from "node:path";
import type {
  HTTPMCPServerConfig,
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
} from "./manager.js";
import { ConfigResolver } from "./resolver.js";

// 从外部导入 MCP 类型（这些类型将在运行时从 backend 包解析）
// 为了避免循环依赖，这里使用动态导入的方式
// 在实际使用时，adapter 将作为 config 包的一部分被使用

/**
 * 轻量级日志记录器
 * 为了避免循环依赖，在 config 包内部实现简单的日志功能
 */
const logger = {
  /**
   * 记录调试级别的日志
   */
  debug: (message: string, meta?: unknown) => {
    if (process.env.XIAOZHI_DEBUG === "true") {
      console.log(`[ConfigAdapter] ${message}`, meta || "");
    }
  },
  /**
   * 记录信息级别的日志
   */
  info: (message: string, meta?: unknown) => {
    console.log(`[ConfigAdapter] ${message}`, meta || "");
  },
  /**
   * 记录错误级别的日志
   */
  error: (message: string, meta?: unknown) => {
    console.error(`[ConfigAdapter] ${message}`, meta || "");
  },
};

/**
 * 配置验证错误类
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

// 定义简化的 MCP 传输类型
export enum MCPTransportType {
  STDIO = "stdio",
  SSE = "sse",
  HTTP = "http",
}

// 定义简化的 MCPServiceConfig 接口
export interface MCPServiceConfig {
  type: MCPTransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

/**
 * URL 类型推断函数
 * 基于 URL 路径末尾推断传输类型
 */
function inferTransportTypeFromUrl(url: string): MCPTransportType {
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

    // 默认类型
    return MCPTransportType.HTTP;
  } catch (error) {
    // URL 解析失败时使用默认类型
    return MCPTransportType.HTTP;
  }
}

/**
 * 将各种配置格式标准化为统一的服务配置格式
 */
export function normalizeServiceConfig(
  config: MCPServerConfig
): MCPServiceConfig {
  logger.debug("转换配置", { config });

  try {
    // 验证输入参数
    if (!config || typeof config !== "object") {
      throw new ConfigValidationError("配置对象不能为空");
    }

    // 根据配置类型进行转换
    const newConfig = convertByConfigType(config);

    // 验证转换后的配置
    validateNewConfig(newConfig);

    logger.debug("配置转换成功", { type: newConfig.type });
    return newConfig;
  } catch (error) {
    logger.error("配置转换失败", { error });
    throw error instanceof ConfigValidationError
      ? error
      : new ConfigValidationError(
          `配置转换失败: ${error instanceof Error ? error.message : String(error)}`
        );
  }
}

/**
 * 根据配置类型进行转换
 */
function convertByConfigType(config: MCPServerConfig): MCPServiceConfig {
  // 检查是否为本地 stdio 配置（最高优先级）
  if (isLocalConfig(config)) {
    return convertLocalConfig(config);
  }

  // 检查是否有显式指定的类型
  if ("type" in config) {
    switch (config.type) {
      case "sse":
        return convertSSEConfig(config);
      case "http":
      case "streamable-http": // 向后兼容
        return convertHTTPConfig(config);
      default:
        throw new ConfigValidationError(`不支持的传输类型: ${config.type}`);
    }
  }

  // 检查是否为网络配置（自动推断类型）
  if ("url" in config) {
    // 如果 URL 是 undefined 或 null，抛出错误
    if (config.url === undefined || config.url === null) {
      throw new ConfigValidationError("网络配置必须包含有效的 url 字段");
    }

    // 先推断类型，然后根据推断的类型选择正确的转换函数
    const inferredType = inferTransportTypeFromUrl(config.url || "");

    if (inferredType === MCPTransportType.SSE) {
      // 为SSE类型添加显式type字段
      const sseConfig = { ...config, type: "sse" as const };
      return convertSSEConfig(sseConfig);
    }
    // 为HTTP类型添加显式type字段
    const httpConfig = { ...config, type: "http" as const };
    return convertHTTPConfig(httpConfig);
  }

  throw new ConfigValidationError("无法识别的配置类型");
}

/**
 * 转换本地 stdio 配置
 */
function convertLocalConfig(config: MCPServerConfig): MCPServiceConfig {
  // 类型守卫：确保是 LocalMCPServerConfig
  if (!isLocalConfig(config)) {
    throw new ConfigValidationError("无效的本地配置类型");
  }

  const { command, args, env } = config;

  if (!command) {
    throw new ConfigValidationError("本地配置必须包含 command 字段");
  }

  // 获取配置文件所在目录作为工作目录
  // 优先使用环境变量，否则查找配置文件所在目录，最后回退到当前工作目录
  let workingDir: string;
  if (process.env.XIAOZHI_CONFIG_DIR) {
    workingDir = process.env.XIAOZHI_CONFIG_DIR;
  } else {
    // 使用 ConfigResolver 查找配置文件路径
    const configPath = ConfigResolver.resolveConfigPath();
    if (configPath) {
      // 获取配置文件所在目录
      workingDir = dirname(configPath);
    } else {
      // 回退到当前工作目录
      workingDir = process.cwd();
    }
  }

  // 解析 command 中的相对路径
  let resolvedCommand = command;
  if (isRelativePath(command)) {
    resolvedCommand = resolve(workingDir, command);
    logger.debug("解析 command 相对路径", {
      command,
      resolvedCommand,
      workingDir,
    });
  }

  // 解析 args 中的相对路径
  const resolvedArgs = (args || []).map((arg: string) => {
    // 检查是否为相对路径（以 ./ 开头或不以 / 开头且包含文件扩展名）
    if (isRelativePath(arg)) {
      const resolvedPath = resolve(workingDir, arg);
      logger.debug("解析相对路径", { arg, resolvedPath, workingDir });
      return resolvedPath;
    }
    return arg;
  });

  return {
    type: MCPTransportType.STDIO,
    command: resolvedCommand,
    args: resolvedArgs,
    ...(env !== undefined && { env }), // 只在 env 存在时添加该字段
  };
}

/**
 * 转换 SSE 配置
 */
function convertSSEConfig(config: MCPServerConfig): MCPServiceConfig {
  // 使用类型守卫确保 config 包含必要的属性
  if (!isURLConfig(config)) {
    throw new ConfigValidationError("SSE 配置必须包含 url 字段");
  }

  const url = config.url;
  const type = "type" in config ? config.type : undefined;
  const headers = "headers" in config ? config.headers : undefined;

  // 优先使用显式指定的类型，如果没有则进行推断
  const inferredType =
    type === "sse"
      ? MCPTransportType.SSE
      : inferTransportTypeFromUrl(url || "");
  const isModelScope = url ? isModelScopeURL(url) : false;

  logger.debug("SSE配置转换", {
    url,
    inferredType,
    isModelScope,
  });

  return {
    type: inferredType,
    url,
    headers,
  };
}

/**
 * 转换 HTTP 配置
 */
function convertHTTPConfig(config: MCPServerConfig): MCPServiceConfig {
  // 使用类型守卫确保 config 包含必要的属性
  if (!isURLConfig(config)) {
    throw new ConfigValidationError("HTTP 配置必须包含 url 字段");
  }

  const url = config.url;
  const headers = "headers" in config ? config.headers : undefined;

  return {
    type: MCPTransportType.HTTP,
    url: url || "",
    headers,
  };
}

/**
 * 批量标准化配置
 */
export function normalizeServiceConfigBatch(
  legacyConfigs: Record<string, MCPServerConfig>
): Record<string, MCPServiceConfig> {
  const newConfigs: Record<string, MCPServiceConfig> = {};
  const errors: Array<{ error: Error }> = [];

  for (const [name, config] of Object.entries(legacyConfigs)) {
    try {
      newConfigs[name] = normalizeServiceConfig(config);
    } catch (error) {
      errors.push({
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors
      .map(({ error }, index) => `[${index}]: ${error.message}`)
      .join("; ");
    throw new ConfigValidationError(`批量配置转换失败: ${errorMessages}`);
  }

  logger.debug("批量配置转换成功", { count: Object.keys(newConfigs).length });
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
 * 检查是否为 URL 配置（SSE 或 HTTP）
 * 类型守卫函数，用于验证配置包含 url 属性
 */
function isURLConfig(
  config: MCPServerConfig
): config is (SSEMCPServerConfig | HTTPMCPServerConfig) & { url: string } {
  return "url" in config && typeof config.url === "string";
}

/**
 * 检查是否为 ModelScope URL
 * 使用 URL hostname 检查而非简单的字符串包含检查，防止安全绕过
 */
export function isModelScopeURL(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return (
      hostname.endsWith(".modelscope.net") ||
      hostname.endsWith(".modelscope.cn") ||
      hostname === "modelscope.net" ||
      hostname === "modelscope.cn"
    );
  } catch {
    return false;
  }
}

/**
 * 验证新配置格式
 */
function validateNewConfig(config: MCPServiceConfig): void {
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
      // SSE 配置必须有 URL（即使是空字符串也会被推断为 HTTP）
      if (config.url === undefined || config.url === null) {
        throw new ConfigValidationError("SSE 配置必须包含 url 字段");
      }
      break;

    case MCPTransportType.HTTP:
      // HTTP 配置允许空 URL，会在后续处理中设置默认值
      // 只有当 URL 完全不存在时才报错
      if (config.url === undefined || config.url === null) {
        throw new ConfigValidationError("HTTP 配置必须包含 url 字段");
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
    // 检查是否为显式 http 配置
    if (
      "type" in config &&
      (config.type === "http" || config.type === "streamable-http")
    ) {
      return `HTTP (${config.url})`;
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
    return `HTTP (${config.url})`;
  }

  return "未知类型";
}
