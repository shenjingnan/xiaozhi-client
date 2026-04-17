/**
 * MCP 服务配置验证工具
 * 用于验证高级模式下的 JSON 配置
 */

import type { MCPServerConfig } from "@xiaozhi-client/shared-types";

// 验证结果接口
export interface ValidationResult {
  success: boolean;
  data?: Record<string, MCPServerConfig>;
  error?: string;
}

/**
 * 验证单个 MCP 服务配置
 * @param serverName - 服务名称
 * @param serverConfig - 服务配置对象
 * @returns 验证结果，包含是否有效和错误信息
 */
export function validateSingleServerConfig(
  serverName: string,
  serverConfig: unknown
): { valid: boolean; error?: string } {
  if (!serverConfig || typeof serverConfig !== "object") {
    return {
      valid: false,
      error: `服务 "${serverName}" 的配置必须是一个对象`,
    };
  }

  const config = serverConfig as Record<string, unknown>;

  // 先进行基本字段检查
  const hasCommand = "command" in config;
  const hasType = "type" in config;
  const hasUrl = "url" in config;

  // 判断配置类型并验证相应字段
  if (hasCommand) {
    // stdio 类型
    if (!config.command || typeof config.command !== "string") {
      return {
        valid: false,
        error: `服务 "${serverName}" 缺少必需的 command 字段或字段类型不正确`,
      };
    }
    if (!Array.isArray(config.args)) {
      return {
        valid: false,
        error: `服务 "${serverName}" 的 args 字段必须是数组`,
      };
    }
  } else if (hasType && config.type === "sse") {
    // sse 类型
    if (!config.url || typeof config.url !== "string") {
      return {
        valid: false,
        error: `服务 "${serverName}" 缺少必需的 url 字段或字段类型不正确`,
      };
    }
  } else if (hasUrl) {
    // streamable-http 类型
    if (!config.url || typeof config.url !== "string") {
      return {
        valid: false,
        error: `服务 "${serverName}" 缺少必需的 url 字段或字段类型不正确`,
      };
    }
  } else {
    // 无法识别的配置类型
    return {
      valid: false,
      error: `服务 "${serverName}" 的配置无效: 必须包含 command 字段（stdio）、type: 'sse' 字段（sse）或 url 字段（streamable-http）`,
    };
  }

  return { valid: true };
}

/**
 * 验证 MCP 配置的函数（用于高级模式）
 * @param input - JSON 字符串格式的配置
 * @returns 验证结果，包含是否成功、解析后的数据和错误信息
 */
export function validateMCPConfig(input: string): ValidationResult {
  try {
    const trimmed = input.trim();
    if (!trimmed) {
      return { success: false, error: "配置不能为空" };
    }

    const parsed = JSON.parse(trimmed);

    let mcpServers: Record<string, unknown>;

    // 检查是否包含 mcpServers 层
    if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
      mcpServers = parsed.mcpServers as Record<string, unknown>;
    } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
      // 检查是否是单个服务配置
      const hasCommand = "command" in parsed;
      const hasType = "type" in parsed;
      const hasUrl = "url" in parsed;

      if (hasCommand || hasType || hasUrl) {
        // 是单个服务配置，生成默认名称
        const defaultName = hasCommand
          ? String(parsed.command).split("/").pop() || "mcp-server"
          : hasType && parsed.type === "sse"
            ? "sse-server"
            : "http-server";
        mcpServers = { [defaultName]: parsed };
      } else {
        return { success: false, error: "配置格式错误: 必须是对象格式" };
      }
    } else {
      return { success: false, error: "配置格式错误: 必须是对象格式" };
    }

    // 验证每个服务配置
    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      const validation = validateSingleServerConfig(serverName, serverConfig);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    return {
      success: true,
      data: mcpServers as Record<string, MCPServerConfig>,
    };
  } catch (error) {
    return {
      success: false,
      error: `JSON 格式错误: ${
        error instanceof Error ? error.message : "无法解析 JSON"
      }`,
    };
  }
}
