/**
 * 配置适配器
 * 将旧的配置格式转换为新的 MCPServiceConfig 格式，确保向后兼容性
 */

import type {
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
} from "../configManager.js";
import { logger as globalLogger } from "../logger.js";
import type { MCPServiceConfig } from "../services/MCPService.js";
import { MCPTransportType } from "../services/MCPService.js";

// 为配置适配器创建带标签的 logger
const logger = globalLogger.withTag("ConfigAdapter");

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
  logger.debug(`转换配置: ${serviceName}`, legacyConfig);

  try {
    // 验证输入参数
    if (!serviceName || typeof serviceName !== "string") {
      throw new ConfigValidationError("服务名称必须是非空字符串");
    }

    if (!legacyConfig || typeof legacyConfig !== "object") {
      throw new ConfigValidationError("配置对象不能为空", serviceName);
    }

    // 根据配置类型进行转换
    const newConfig = convertByConfigType(serviceName, legacyConfig);

    // 验证转换后的配置
    validateNewConfig(newConfig);

    logger.info(`配置转换成功: ${serviceName} -> ${newConfig.type}`);
    return newConfig;
  } catch (error) {
    logger.error(`配置转换失败: ${serviceName}`, error);
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
  // 检查是否为本地 stdio 配置
  if (isLocalConfig(legacyConfig)) {
    return convertLocalConfig(serviceName, legacyConfig);
  }

  // 检查是否为 SSE 配置
  if (isSSEConfig(legacyConfig)) {
    return convertSSEConfig(serviceName, legacyConfig);
  }

  // 检查是否为 Streamable HTTP 配置
  if (isStreamableHTTPConfig(legacyConfig)) {
    return convertStreamableHTTPConfig(serviceName, legacyConfig);
  }

  throw new ConfigValidationError("无法识别的配置类型", serviceName);
}

/**
 * 转换本地 stdio 配置
 */
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

  return {
    name: serviceName,
    type: MCPTransportType.STDIO,
    command: config.command,
    args: config.args || [],
    // 默认重连配置
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      initialInterval: 3000,
      maxInterval: 30000,
      backoffStrategy: "exponential" as const,
      backoffMultiplier: 1.5,
      timeout: 10000,
      jitter: true,
    },
    // 默认 ping 配置
    ping: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      maxFailures: 3,
      startDelay: 5000,
    },
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
  if (!config.url) {
    throw new ConfigValidationError("SSE 配置必须包含 url 字段", serviceName);
  }

  // 检查是否为 ModelScope 服务
  const isModelScope = isModelScopeURL(config.url);

  const baseConfig: MCPServiceConfig = {
    name: serviceName,
    type: isModelScope ? MCPTransportType.MODELSCOPE_SSE : MCPTransportType.SSE,
    url: config.url,
    // 默认重连配置
    reconnect: {
      enabled: true,
      maxAttempts: 10,
      initialInterval: 3000,
      maxInterval: 30000,
      backoffStrategy: "exponential" as const,
      backoffMultiplier: 1.5,
      timeout: 15000,
      jitter: true,
    },
    // 默认 ping 配置
    ping: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      maxFailures: 3,
      startDelay: 5000,
    },
    timeout: 30000,
  };

  // 如果是 ModelScope 服务，添加特殊配置
  if (isModelScope) {
    baseConfig.modelScopeAuth = true;
  }

  return baseConfig;
}

/**
 * 转换 Streamable HTTP 配置
 */
function convertStreamableHTTPConfig(
  serviceName: string,
  config: StreamableHTTPMCPServerConfig
): MCPServiceConfig {
  if (!config.url) {
    throw new ConfigValidationError(
      "Streamable HTTP 配置必须包含 url 字段",
      serviceName
    );
  }

  return {
    name: serviceName,
    type: MCPTransportType.STREAMABLE_HTTP,
    url: config.url,
    // 默认重连配置
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      initialInterval: 3000,
      maxInterval: 30000,
      backoffStrategy: "exponential" as const,
      backoffMultiplier: 1.5,
      timeout: 15000,
      jitter: true,
    },
    // 默认 ping 配置
    ping: {
      enabled: false, // HTTP 连接通常不需要 ping
      interval: 60000,
      timeout: 10000,
      maxFailures: 3,
      startDelay: 10000,
    },
    timeout: 30000,
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

  logger.info(
    `批量配置转换成功，共转换 ${Object.keys(newConfigs).length} 个服务`
  );
  return newConfigs;
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
 * 检查是否为 SSE 配置
 */
function isSSEConfig(config: MCPServerConfig): config is SSEMCPServerConfig {
  return "type" in config && config.type === "sse" && "url" in config;
}

/**
 * 检查是否为 Streamable HTTP 配置
 */
function isStreamableHTTPConfig(
  config: MCPServerConfig
): config is StreamableHTTPMCPServerConfig {
  return (
    "url" in config &&
    (!("type" in config) || config.type === "streamable-http")
  );
}

/**
 * 检查是否为 ModelScope URL
 */
function isModelScopeURL(url: string): boolean {
  return url.includes("modelscope.net") || url.includes("modelscope.cn");
}

/**
 * 验证新配置格式
 */
function validateNewConfig(config: MCPServiceConfig): void {
  if (!config.name || typeof config.name !== "string") {
    throw new ConfigValidationError("配置必须包含有效的 name 字段");
  }

  if (!Object.values(MCPTransportType).includes(config.type)) {
    throw new ConfigValidationError(`无效的传输类型: ${config.type}`);
  }

  // 根据传输类型验证必需字段
  switch (config.type) {
    case MCPTransportType.STDIO:
      if (!config.command) {
        throw new ConfigValidationError("STDIO 配置必须包含 command 字段");
      }
      break;

    case MCPTransportType.SSE:
    case MCPTransportType.MODELSCOPE_SSE:
    case MCPTransportType.STREAMABLE_HTTP:
      if (!config.url) {
        throw new ConfigValidationError(`${config.type} 配置必须包含 url 字段`);
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
  if (isSSEConfig(config)) {
    const isModelScope = isModelScopeURL(config.url);
    return `SSE${isModelScope ? " (ModelScope)" : ""} (${config.url})`;
  }
  if (isStreamableHTTPConfig(config)) {
    return `Streamable HTTP (${config.url})`;
  }
  return "未知类型";
}
