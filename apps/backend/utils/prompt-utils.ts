/**
 * 提示词解析工具
 *
 * 支持三种格式的提示词配置：
 * 1. 绝对路径：如 `/Users/xxx/prompts/default.md`
 * 2. 相对路径：如 `./prompts/default.md`（相对于配置文件所在目录）
 * 3. 纯字符串：直接作为提示词内容
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { configManager } from "@xiaozhi-client/config";

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT =
  "你是一个友好的语音助手，请用简洁的中文回答用户的问题。";

/**
 * 判断配置值是否为路径格式
 *
 * 路径格式的判断规则：
 * - 相对路径：以 `./` 或 `../` 开头
 * - 绝对路径：使用 path.isAbsolute() 判断
 * - 其他情况：视为纯字符串内容
 *
 * @param config - 提示词配置值
 * @returns 是否为路径格式
 */
function isPromptPath(config: string): boolean {
  // 相对路径：必须以 ./ 或 ../ 开头
  if (config.startsWith("./") || config.startsWith("../")) {
    return true;
  }
  // 绝对路径
  if (isAbsolute(config)) {
    return true;
  }
  return false;
}

/**
 * 从文件路径读取提示词内容
 *
 * @param promptPath - 提示词文件路径（绝对路径或相对路径）
 * @returns 提示词内容，如果读取失败则返回 null
 */
function resolvePromptFromPath(promptPath: string): string | null {
  try {
    // 解析路径
    let resolvedPath: string;
    if (isAbsolute(promptPath)) {
      // 绝对路径直接使用
      resolvedPath = promptPath;
    } else {
      // 相对路径：相对于配置文件所在目录
      const configFilePath = configManager.getConfigPath();
      const configDir = dirname(configFilePath);
      resolvedPath = resolve(configDir, promptPath);
    }

    // 检查文件是否存在
    if (!existsSync(resolvedPath)) {
      console.warn(
        `[prompt-utils] 提示词文件不存在: ${resolvedPath}，将使用默认提示词`
      );
      return null;
    }

    // 读取文件内容
    const content = readFileSync(resolvedPath, "utf-8").trim();

    // 检查文件内容是否为空
    if (!content) {
      console.warn(
        `[prompt-utils] 提示词文件内容为空: ${resolvedPath}，将使用默认提示词`
      );
      return null;
    }

    console.info(`[prompt-utils] 成功从文件加载提示词: ${resolvedPath}`);
    return content;
  } catch (error) {
    console.error(
      `[prompt-utils] 读取提示词文件失败: ${promptPath}`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * 解析提示词配置
 *
 * 处理逻辑：
 * 1. 未配置或空字符串 → 返回默认提示词
 * 2. 是路径格式 → 尝试读取文件内容
 * 3. 不是路径格式 → 直接返回作为纯字符串
 *
 * @param promptConfig - 提示词配置值（可选）
 * @returns 解析后的提示词内容
 */
export function resolvePrompt(promptConfig?: string): string {
  // 未配置或空字符串，返回默认提示词
  if (!promptConfig || promptConfig.trim() === "") {
    return DEFAULT_SYSTEM_PROMPT;
  }

  // 判断是否为路径格式
  if (isPromptPath(promptConfig)) {
    // 尝试从路径读取
    const content = resolvePromptFromPath(promptConfig);
    // 读取失败返回默认提示词
    return content || DEFAULT_SYSTEM_PROMPT;
  }

  // 不是路径格式，直接作为纯字符串返回
  return promptConfig;
}

/**
 * 获取默认系统提示词
 *
 * @returns 默认系统提示词
 */
export function getDefaultSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}
