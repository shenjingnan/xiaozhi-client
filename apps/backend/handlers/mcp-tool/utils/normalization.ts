/**
 * 工具名称规范化工具模块
 * 提供工具名称的规范化、中英文转换等功能
 */

/**
 * 预编译的正则表达式常量，避免在频繁调用时重复创建
 */
export const UNDERSCORE_TRIM_REGEX = /^_+|_+$/g;
export const LETTER_START_REGEX = /^[a-zA-Z]/;
export const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/;
export const DIGITS_ONLY_REGEX = /^\d+$/;
export const ALPHANUMERIC_UNDERSCORE_REGEX = /^[a-zA-Z0-9_-]+$/;
export const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * 规范化工具名称
 * 将工作流名称转换为合法的工具名称格式
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

  // 将中文转换为拼音或英文描述（简化处理）
  sanitized = convertChineseToEnglish(sanitized);

  // 移除特殊字符，只保留字母、数字和下划线
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "_");

  // 移除连续的下划线
  sanitized = sanitized.replace(/_+/g, "_");

  // 移除开头和结尾的下划线
  sanitized = sanitized.replace(UNDERSCORE_TRIM_REGEX, "");

  // 确保以字母开头
  if (!LETTER_START_REGEX.test(sanitized)) {
    sanitized = `tool_${sanitized}`;
  }

  // 如果结果为空，使用默认名称
  if (!sanitized) {
    return "coze_workflow_tool";
  }

  return sanitized;
}

/**
 * 简单的中文到英文转换（可以扩展为更复杂的拼音转换）
 */
export function convertChineseToEnglish(text: string): string {
  // 常见中文词汇的映射
  const chineseToEnglishMap: Record<string, string> = {
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

  let result = text;

  // 替换常见中文词汇
  for (const [chinese, english] of Object.entries(chineseToEnglishMap)) {
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
 * 如果名称已存在，添加数字后缀
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
      throw new Error(`无法为工具生成唯一名称，基础名称: ${baseName}`);
    }
  }

  return finalName;
}
