/**
 * 提示词解析工具
 *
 * 支持三种格式的提示词配置：
 * 1. 绝对路径：如 `/Users/xxx/prompts/default.md`
 * 2. 相对路径：如 `./prompts/default.md`（相对于配置文件所在目录）
 * 3. 纯字符串：直接作为提示词内容
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { configManager } from "@xiaozhi-client/config";

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT =
  "你是一个友好的语音助手，请用简洁的中文回答用户的问题。";

/**
 * 判断配置值是否为路径格式
 *
 * 路径格式的判断规则：
 * - 相对路径：以 `./`、`../`、`.\` 或 `..\` 开头（支持 Windows 和 Unix 风格）
 * - 绝对路径：使用 path.isAbsolute() 判断
 * - 其他情况：视为纯字符串内容
 *
 * @param config - 提示词配置值
 * @returns 是否为路径格式
 */
function isPromptPath(config: string): boolean {
  // 将路径分隔符统一为正斜杠，便于跨平台判断
  const normalizedConfig = config.replace(/\\/g, "/");

  // 相对路径：以 ./ 或 ../ 开头
  if (normalizedConfig.startsWith("./") || normalizedConfig.startsWith("../")) {
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
    // 将 Windows 风格的反斜杠统一转换为正斜杠，便于跨平台解析
    const normalizedPath = promptPath.replace(/\\/g, "/");

    // 解析路径
    let resolvedPath: string;
    if (isAbsolute(normalizedPath)) {
      // 绝对路径直接使用
      resolvedPath = normalizedPath;
    } else {
      // 相对路径：相对于配置文件所在目录
      const configFilePath = configManager.getConfigPath();
      const configDir = dirname(configFilePath);
      resolvedPath = resolve(configDir, normalizedPath);
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

/**
 * 提示词文件信息
 */
export interface PromptFileInfo {
  /** 文件名 */
  fileName: string;
  /** 相对路径（相对于配置文件所在目录） */
  relativePath: string;
}

/**
 * 获取 prompts 目录下的所有 .md 文件列表
 *
 * @returns 提示词文件信息数组
 */
export function listPromptFiles(): PromptFileInfo[] {
  try {
    const configFilePath = configManager.getConfigPath();
    const configDir = dirname(configFilePath);
    const promptsDir = resolve(configDir, "prompts");

    // 检查 prompts 目录是否存在
    if (!existsSync(promptsDir)) {
      return [];
    }

    // 读取目录下的所有文件
    const files = readdirSync(promptsDir);

    // 过滤出 .md 文件并构建返回结果
    const promptFiles: PromptFileInfo[] = files
      .filter((file: string) => file.endsWith(".md"))
      .map((file: string) => ({
        fileName: file,
        relativePath: `./prompts/${file}`,
      }));

    return promptFiles;
  } catch (error) {
    console.error(
      "[prompt-utils] 获取提示词文件列表失败:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

// ==================== 提示词文件操作相关函数 ====================

/** 最大文件大小限制（100KB） */
const MAX_FILE_SIZE = 100 * 1024;

/** 文件名验证正则：允许字母、数字、下划线、中划线、中文 */
const FILE_NAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+\.md$/;

/**
 * 验证提示词文件路径是否安全
 *
 * 安全规则：
 * 1. 必须是相对路径格式（以 ./prompts/ 开头）
 * 2. 路径不能包含 ..（防止路径遍历攻击）
 * 3. 文件名必须符合规范
 *
 * @param relativePath - 相对路径
 * @returns 验证结果，包含是否有效和错误信息
 */
export function validatePromptPath(relativePath: string): {
  valid: boolean;
  error?: string;
} {
  // 检查路径格式
  if (!relativePath.startsWith("./prompts/")) {
    return {
      valid: false,
      error: "路径格式错误，必须以 ./prompts/ 开头",
    };
  }

  // 检查路径遍历攻击
  if (relativePath.includes("..")) {
    return {
      valid: false,
      error: "路径不能包含 ..",
    };
  }

  // 提取文件名并验证
  const fileName = relativePath.replace("./prompts/", "");
  if (!FILE_NAME_REGEX.test(fileName)) {
    return {
      valid: false,
      error:
        "文件名只能包含字母、数字、下划线、中划线、中文，且必须以 .md 结尾",
    };
  }

  return { valid: true };
}

/**
 * 验证提示词文件名是否合法
 *
 * @param fileName - 文件名
 * @returns 验证结果
 */
export function validatePromptFileName(fileName: string): {
  valid: boolean;
  error?: string;
} {
  if (!FILE_NAME_REGEX.test(fileName)) {
    return {
      valid: false,
      error:
        "文件名只能包含字母、数字、下划线、中划线、中文，且必须以 .md 结尾",
    };
  }
  return { valid: true };
}

/**
 * 获取 prompts 目录的绝对路径
 *
 * @returns prompts 目录的绝对路径
 */
export function getPromptsDir(): string {
  const configFilePath = configManager.getConfigPath();
  const configDir = dirname(configFilePath);
  return resolve(configDir, "prompts");
}

/**
 * 将相对路径解析为绝对路径
 *
 * @param relativePath - 相对路径（如 ./prompts/default.md）
 * @returns 绝对路径
 */
export function resolvePromptPath(relativePath: string): string {
  const promptsDir = getPromptsDir();
  const fileName = relativePath.replace("./prompts/", "");
  return resolve(promptsDir, fileName);
}

/**
 * 提示词文件内容信息
 */
export interface PromptFileContent {
  /** 文件名 */
  fileName: string;
  /** 相对路径（相对于配置文件所在目录） */
  relativePath: string;
  /** 文件内容 */
  content: string;
}

/**
 * 读取提示词文件内容
 *
 * @param relativePath - 相对路径（如 ./prompts/default.md）
 * @returns 文件内容信息
 * @throws 如果路径无效或文件不存在
 */
export function readPromptFile(relativePath: string): PromptFileContent {
  // 验证路径
  const validation = validatePromptPath(relativePath);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 解析绝对路径
  const absolutePath = resolvePromptPath(relativePath);

  // 检查文件是否存在
  if (!existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${relativePath}`);
  }

  // 检查文件大小
  const stats = statSync(absolutePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error("文件大小超过限制（最大 100KB）");
  }

  // 读取文件内容
  const content = readFileSync(absolutePath, "utf-8");

  return {
    fileName: relativePath.replace("./prompts/", ""),
    relativePath,
    content,
  };
}

/**
 * 更新提示词文件内容
 *
 * @param relativePath - 相对路径（如 ./prompts/default.md）
 * @param content - 新的文件内容
 * @throws 如果路径无效或文件不存在
 */
export function updatePromptFile(
  relativePath: string,
  content: string
): PromptFileContent {
  // 验证路径
  const validation = validatePromptPath(relativePath);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 验证内容大小
  if (content.length > MAX_FILE_SIZE) {
    throw new Error("内容大小超过限制（最大 100KB）");
  }

  // 解析绝对路径
  const absolutePath = resolvePromptPath(relativePath);

  // 检查文件是否存在
  if (!existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${relativePath}`);
  }

  // 写入文件
  writeFileSync(absolutePath, content, "utf-8");

  return {
    fileName: relativePath.replace("./prompts/", ""),
    relativePath,
    content,
  };
}

/**
 * 创建新的提示词文件
 *
 * @param fileName - 文件名（如 custom-prompt.md）
 * @param content - 文件内容
 * @returns 新创建的文件信息
 * @throws 如果文件名无效或文件已存在
 */
export function createPromptFile(
  fileName: string,
  content: string
): PromptFileContent {
  // 验证文件名
  const validation = validatePromptFileName(fileName);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 验证内容大小
  if (content.length > MAX_FILE_SIZE) {
    throw new Error("内容大小超过限制（最大 100KB）");
  }

  // 获取 prompts 目录
  const promptsDir = getPromptsDir();

  // 确保 prompts 目录存在
  if (!existsSync(promptsDir)) {
    mkdirSync(promptsDir, { recursive: true });
  }

  // 构建文件路径
  const absolutePath = resolve(promptsDir, fileName);
  const relativePath = `./prompts/${fileName}`;

  // 检查文件是否已存在
  if (existsSync(absolutePath)) {
    throw new Error(`文件已存在: ${fileName}`);
  }

  // 写入文件
  writeFileSync(absolutePath, content, "utf-8");

  return {
    fileName,
    relativePath,
    content,
  };
}

/**
 * 删除提示词文件
 *
 * @param relativePath - 相对路径（如 ./prompts/old-prompt.md）
 * @throws 如果路径无效或文件不存在
 */
export function deletePromptFile(relativePath: string): void {
  // 验证路径
  const validation = validatePromptPath(relativePath);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 解析绝对路径
  const absolutePath = resolvePromptPath(relativePath);

  // 检查文件是否存在
  if (!existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${relativePath}`);
  }

  // 删除文件
  rmSync(absolutePath);
}
