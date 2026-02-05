import type { ConfigManager, MCPServerConfig } from "@xiaozhi-client/config";

/**
 * 配置验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MCP 服务配置验证工具命名空间
 */
export namespace MCPServerConfigValidator {
  /**
   * 验证服务配置
   */
  export function validateConfig(config: MCPServerConfig): ValidationResult {
    const errors: string[] = [];

    // 验证配置基本结构
    if (!config || typeof config !== "object") {
      errors.push("配置必须是一个对象");
      return { isValid: false, errors };
    }

    // 根据类型验证配置
    if ("command" in config) {
      // LocalMCPServerConfig
      if (!config.command || typeof config.command !== "string") {
        errors.push("本地服务必须提供有效的命令");
      }
      if (config.args && !Array.isArray(config.args)) {
        errors.push("参数必须是数组");
      }
      if (config.env && typeof config.env !== "object") {
        errors.push("环境变量必须是对象");
      }
    } else if ("url" in config) {
      // SSEMCPServerConfig 或 StreamableHTTPMCPServerConfig
      if (!config.url || typeof config.url !== "string") {
        errors.push("远程服务必须提供有效的 URL");
      }
      try {
        new URL(config.url);
      } catch {
        errors.push("URL 格式无效");
      }
    } else {
      errors.push("配置必须包含 command 或 url 字段");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 验证服务名称
   */
  export function validateServiceName(name: string): ValidationResult {
    const errors: string[] = [];

    if (!name || typeof name !== "string") {
      errors.push("服务名称必须是非空字符串");
      return { isValid: false, errors };
    }

    if (name.length < 1 || name.length > 50) {
      errors.push("服务名称长度必须在 1-50 个字符之间");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      errors.push("服务名称只能包含字母、数字、下划线和连字符");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 检查服务是否已存在
   */
  export function checkServiceExists(
    name: string,
    configManager: ConfigManager
  ): boolean {
    const config = configManager.getConfig();
    return config.mcpServers && name in config.mcpServers;
  }
}
