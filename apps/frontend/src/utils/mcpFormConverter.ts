/**
 * MCP 服务表单数据与 API 配置的双向转换工具
 */

import type { MCPServerConfig } from "@xiaozhi-client/shared-types";
import type {
  HttpFormData,
  McpServerFormData,
  McpServiceType,
  SseFormData,
  StdioFormData,
} from "@/types/mcp-form";

// ============ 表单 → API 配置 ============

/**
 * 解析命令字符串为 {command, args} 结构
 * 支持带引号的参数，可以处理包含空格的路径
 * @example "npx -y @z_ai/mcp-server" → {command: "npx", args: ["-y", "@z_ai/mcp-server"]}
 * @example "/usr/local/bin/mcp --config /etc/mcp.json" → {command: "/usr/local/bin/mcp", args: ["--config", "/etc/mcp.json"]}
 * @example "node \"/path with spaces/server.js\" --arg" → {command: "node", args: ["/path with spaces/server.js", "--arg"]}
 */
export function parseCommandString(commandStr: string): {
  command: string;
  args: string[];
} {
  const trimmed = commandStr.trim();
  if (!trimmed) {
    throw new Error("命令不能为空");
  }

  const result: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    // 处理引号（支持单引号和双引号）
    if (
      (char === '"' || char === "'") &&
      (i === 0 || trimmed[i - 1] !== "\\")
    ) {
      if (inQuote && char === quoteChar) {
        // 结束引号
        inQuote = false;
        quoteChar = "";
      } else if (!inQuote) {
        // 开始引号
        inQuote = true;
        quoteChar = char;
      } else {
        // 引号内不同类型的引号，作为普通字符
        current += char;
      }
    } else if (char === " " && !inQuote) {
      // 空格且不在引号内，分割参数
      if (current) {
        result.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  // 添加最后一个参数
  if (current) {
    result.push(current);
  }

  if (result.length === 0) {
    throw new Error("命令不能为空");
  }

  return { command: result[0], args: result.slice(1) };
}

/**
 * 去除字符串两端的配对引号（单引号或双引号）
 * @example '"hello"' → 'hello'
 * @example "'world'" → 'world'
 * @example '"unclosed' → '"unclosed' (不匹配，不处理)
 */
function stripQuotes(str: string): string {
  if (str.length >= 2) {
    const firstChar = str[0];
    const lastChar = str[str.length - 1];
    if (
      (firstChar === '"' && lastChar === '"') ||
      (firstChar === "'" && lastChar === "'")
    ) {
      return str.slice(1, -1);
    }
  }
  return str;
}

/**
 * 解析多行键值对文本为对象
 * 支持格式: KEY=value 或 KEY: value
 * 支持注释行 (# 开头)
 * 支持值使用引号包裹（引号会被自动去除）
 * @example
 * ACCESS_TOKEN=xxx
 * BASE_URL=yyy
 * # 这是注释
 * ANOTHER: value
 * PATH="C:\Program Files\app"
 * → {ACCESS_TOKEN: "xxx", BASE_URL: "yyy", ANOTHER: "value", PATH: "C:\Program Files\app"}
 */
export function parseKeyValuePairs(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // 尝试 KEY=value 格式
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // 去除值两端的配对引号
      value = stripQuotes(value);
      result[key] = value;
      continue;
    }

    // 尝试 KEY: value 格式
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();
      // 去除值两端的配对引号
      value = stripQuotes(value);
      result[key] = value;
    }
  }

  return result;
}

/**
 * 将 stdio 类型表单数据转换为 API 配置
 */
function stdioFormToApiConfig(formData: StdioFormData): MCPServerConfig {
  const { command, args } = parseCommandString(formData.command);
  const env = parseKeyValuePairs(formData.env);

  const config: MCPServerConfig = {
    command,
    args,
  };

  // 只有在有环境变量时才添加 env 字段
  if (Object.keys(env).length > 0) {
    config.env = env;
  }

  return config;
}

/**
 * 将 http 类型表单数据转换为 API 配置
 */
function httpFormToApiConfig(formData: HttpFormData): MCPServerConfig {
  const headers = parseKeyValuePairs(formData.headers);

  const config: MCPServerConfig = {
    type: "streamable-http", // http 类型转换为 streamable-http
    url: formData.url,
  };

  // 只有在有请求头时才添加 headers 字段
  if (Object.keys(headers).length > 0) {
    config.headers = headers;
  }

  return config;
}

/**
 * 将 sse 类型表单数据转换为 API 配置
 */
function sseFormToApiConfig(formData: SseFormData): MCPServerConfig {
  const headers = parseKeyValuePairs(formData.headers);

  const config: MCPServerConfig = {
    type: "sse",
    url: formData.url,
  };

  // 只有在有请求头时才添加 headers 字段
  if (Object.keys(headers).length > 0) {
    config.headers = headers;
  }

  return config;
}

/**
 * 将表单数据转换为 API 配置
 * @returns 包含服务名称和配置的对象
 */
export function formToApiConfig(formData: McpServerFormData): {
  name: string;
  config: MCPServerConfig;
} {
  const { name, type } = formData;

  let config: MCPServerConfig;
  switch (type) {
    case "stdio":
      config = stdioFormToApiConfig(formData);
      break;
    case "http":
      config = httpFormToApiConfig(formData);
      break;
    case "sse":
      config = sseFormToApiConfig(formData);
      break;
    default: {
      // TypeScript 的类型保护确保这里永远不会到达
      throw new Error("不支持的 MCP 类型");
    }
  }

  return { name, config };
}

// ============ API 配置 → 表单 ============

/**
 * 从 API 配置推断 MCP 服务类型
 */
export function inferMcpType(config: MCPServerConfig): McpServiceType {
  if ("command" in config) {
    return "stdio";
  }
  if ("type" in config && config.type === "sse") {
    return "sse";
  }
  // 默认为 http (streamable-http)
  return "http";
}

/**
 * 将 {command, args} 结构转换为命令字符串
 */
function buildCommandString(config: {
  command: string;
  args?: string[];
}): string {
  const parts = [config.command];
  if (config.args && config.args.length > 0) {
    parts.push(...config.args);
  }
  return parts.join(" ");
}

/**
 * 将键值对对象转换为多行文本 (KEY: value 格式)
 */
export function keyValuePairsToMultilineText(
  obj: Record<string, string> | undefined
): string {
  if (!obj || Object.keys(obj).length === 0) {
    return "";
  }
  return Object.entries(obj)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

/**
 * 将 stdio 类型 API 配置转换为表单数据
 */
function stdioApiConfigToForm(
  name: string,
  config: MCPServerConfig
): StdioFormData {
  const stdioConfig = config as {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  return {
    type: "stdio",
    name,
    command: buildCommandString(stdioConfig),
    env: keyValuePairsToMultilineText(stdioConfig.env),
  };
}

/**
 * 将 http 类型 API 配置转换为表单数据
 */
function httpApiConfigToForm(
  name: string,
  config: MCPServerConfig
): HttpFormData {
  const httpConfig = config as {
    type?: string;
    url: string;
    headers?: Record<string, string>;
  };
  return {
    type: "http",
    name,
    url: httpConfig.url,
    headers: keyValuePairsToMultilineText(httpConfig.headers),
  };
}

/**
 * 将 sse 类型 API 配置转换为表单数据
 */
function sseApiConfigToForm(
  name: string,
  config: MCPServerConfig
): SseFormData {
  const sseConfig = config as {
    type: string;
    url: string;
    headers?: Record<string, string>;
  };
  return {
    type: "sse",
    name,
    url: sseConfig.url,
    headers: keyValuePairsToMultilineText(sseConfig.headers),
  };
}

/**
 * 将 API 配置转换为表单数据
 */
export function apiConfigToForm(
  name: string,
  config: MCPServerConfig
): McpServerFormData {
  const type = inferMcpType(config);

  switch (type) {
    case "stdio":
      return stdioApiConfigToForm(name, config);
    case "http":
      return httpApiConfigToForm(name, config);
    case "sse":
      return sseApiConfigToForm(name, config);
    default: {
      // TypeScript 的类型保护确保这里永远不会到达
      throw new Error("无法识别的 MCP 类型");
    }
  }
}

/**
 * 验证 JSON 并转换为表单数据
 * 用于高级模式 → 表单模式的数据转换
 * @returns 转换后的表单数据，如果解析失败则返回 null
 */
export function jsonToFormData(jsonString: string): McpServerFormData | null {
  try {
    const parsed = JSON.parse(jsonString);

    // 尝试解析为包含 mcpServers 的格式
    if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
      const entries = Object.entries(parsed.mcpServers);
      if (entries.length === 0) {
        return null;
      }
      // 取第一个服务配置
      const [name, config] = entries[0];
      return apiConfigToForm(name, config as MCPServerConfig);
    }

    // 尝试解析为单个服务配置
    // 检查是否是有效的 MCP 配置（有 command、type 或 url 字段）
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      ("command" in parsed || "type" in parsed || "url" in parsed)
    ) {
      // 生成默认名称
      let defaultName: string;
      if ("command" in parsed && parsed.command) {
        defaultName = parsed.command.split("/").pop() || "mcp-server";
      } else if ("type" in parsed && parsed.type === "sse") {
        defaultName = "sse-server";
      } else {
        defaultName = "http-server";
      }
      return apiConfigToForm(defaultName, parsed as MCPServerConfig);
    }

    return null;
  } catch (error) {
    // 仅在非生产环境下输出详细错误日志
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      console.error("[jsonToFormData] JSON 解析或转换失败:", error);
    }
    return null;
  }
}

/**
 * 将表单数据转换为 JSON 字符串
 * 用于表单模式 → 高级模式的数据转换
 */
export function formToJson(formData: McpServerFormData): string {
  const { name, config } = formToApiConfig(formData);
  return JSON.stringify(
    {
      mcpServers: {
        [name]: config,
      },
    },
    null,
    2
  );
}
