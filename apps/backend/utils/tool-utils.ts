/**
 * 工具辅助函数
 *
 * 提供 MCP 工具处理中的通用辅助函数，包括：
 * - 工具名称处理和转换
 * - 中文到英文的映射转换
 * - 工具名称冲突解决
 * - 工具描述生成
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow } from "@/types/coze.js";
import { configManager } from "@xiaozhi-client/config";

/**
 * 预编译的正则表达式常量
 */
export const UNDERSCORE_TRIM_REGEX = /^_+|_+$/g;
export const LETTER_START_REGEX = /^[a-zA-Z]/;
export const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/;
export const ALPHANUMERIC_UNDERSCORE_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * 中文到英文的映射表
 */
const CHINESE_TO_ENGLISH_MAP: Record<string, string> = {
  工作流: "workflow",
  测试: "test",
  数据: "data",
  处理: "process",
  分析: "analysis",
  生成: "generate",
  查询: "query",
  搜索: "search",
  转换: "convert",
  计算: "calculate",
  统计: "statistics",
  报告: "report",
  文档: "document",
  图片: "image",
  视频: "video",
  音频: "audio",
  文本: "text",
  翻译: "translate",
  识别: "recognize",
  检测: "detect",
  监控: "monitor",
  管理: "manage",
  配置: "config",
  设置: "setting",
  用户: "user",
  系统: "system",
  服务: "service",
  接口: "api",
  数据库: "database",
  网络: "network",
  安全: "security",
  备份: "backup",
  恢复: "restore",
  同步: "sync",
  导入: "import",
  导出: "export",
  上传: "upload",
  下载: "download",
};

/**
 * 规范化工具名称
 *
 * 将工具名称转换为符合规范的格式：
 * - 去除首尾空格
 * - 转换中文为英文
 * - 移除特殊字符
 * - 确保以字母开头
 * - 限制长度
 *
 * @param name - 原始工具名称
 * @returns 规范化后的工具名称
 */
export function sanitizeToolName(name: string): string {
  if (!name || typeof name !== "string") {
    return "coze_workflow_unnamed";
  }

  // 去除首尾空格
  let sanitized = name.trim();

  if (!sanitized) {
    return "coze_workflow_empty";
  }

  // 将中文转换为拼音或英文描述
  sanitized = convertChineseToEnglish(sanitized);

  // 移除特殊字符，只保留字母、数字和下划线
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "_");

  // 移除连续的下划线
  sanitized = sanitized.replace(/_+/g, "_");

  // 移除开头和结尾的下划线
  sanitized = sanitized.replace(UNDERSCORE_TRIM_REGEX, "");

  // 确保以字母开头
  if (!LETTER_START_REGEX.test(sanitized)) {
    sanitized = `coze_workflow_${sanitized}`;
  }

  // 限制长度（保留足够空间给数字后缀）
  if (sanitized.length > 45) {
    sanitized = sanitized.substring(0, 45);
  }

  // 确保不为空
  if (!sanitized) {
    sanitized = "coze_workflow_tool";
  }

  return sanitized;
}

/**
 * 简单的中文到英文转换
 *
 * 将常见中文词汇转换为对应的英文单词
 *
 * @param text - 包含中文的文本
 * @returns 转换后的文本
 */
export function convertChineseToEnglish(text: string): string {
  let result = text;

  // 替换常见中文词汇
  for (const [chinese, english] of Object.entries(CHINESE_TO_ENGLISH_MAP)) {
    result = result.replace(new RegExp(chinese, "g"), english);
  }

  // 如果还有中文字符，用拼音前缀替代
  if (CHINESE_CHAR_REGEX.test(result)) {
    result = `chinese_${result}`;
  }

  return result;
}

/**
 * 解决工具名称冲突
 *
 * 当工具名称已存在时，自动添加数字后缀生成唯一名称
 *
 * @param baseName - 基础工具名称
 * @param existingNames - 已存在的工具名称集合
 * @returns 唯一的工具名称
 * @throws 当无法生成唯一名称时抛出错误
 */
export function resolveToolNameConflict(
  baseName: string,
  existingNames: Set<string>
): string {
  let finalName = baseName;
  let counter = 1;

  // 如果名称已存在，添加数字后缀
  while (existingNames.has(finalName)) {
    finalName = `${baseName}_${counter}`;
    counter++;

    // 防止无限循环
    if (counter > 999) {
      throw MCPError.operationError(
        MCPErrorCode.OPERATION_FAILED,
        `无法为工具生成唯一名称，基础名称: ${baseName}`
      );
    }
  }

  return finalName;
}

/**
 * 生成工具描述
 *
 * 根据工作流信息生成工具描述，优先使用自定义描述
 *
 * @param workflow - Coze 工作流对象
 * @param customDescription - 自定义描述（可选）
 * @returns 工具描述文本
 */
export function generateToolDescription(
  workflow: CozeWorkflow,
  customDescription?: string
): string {
  if (customDescription) {
    return customDescription;
  }

  if (workflow.description?.trim()) {
    return workflow.description.trim();
  }

  // 生成默认描述
  return `扣子工作流工具: ${workflow.workflow_name}`;
}

/**
 * 创建 HTTP 处理器配置
 *
 * 为 Coze 工作流创建代理处理器配置
 *
 * @param workflow - Coze 工作流对象
 * @returns HTTP 处理器配置
 */
export function createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
  return {
    type: "proxy",
    platform: "coze",
    config: {
      workflow_id: workflow.workflow_id,
    },
  };
}

/**
 * 获取现有工具名称集合
 *
 * 从配置管理器中获取所有现有工具的名称集合
 *
 * @returns 工具名称的 Set 集合
 */
export function getExistingToolNames(): Set<string> {
  const existingTools = configManager.getCustomMCPTools();
  return new Set(existingTools.map((tool) => tool.name));
}
