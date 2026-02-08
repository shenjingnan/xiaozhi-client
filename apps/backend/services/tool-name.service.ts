/**
 * 工具名称服务
 * 负责工具名称相关的操作，包括规范化、冲突解决、中文转英文等
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow } from "@/types/coze.js";
import type { ConfigManager } from "@xiaozhi-client/config";

/**
 * 工具名称服务
 */
export class ToolNameService {
  private logger: Logger;
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.logger = logger;
    this.configManager = configManager;
  }

  /**
   * 规范化工具名称
   * @param name 原始名称
   * @returns 规范化后的工具名称
   */
  sanitizeToolName(name: string): string {
    if (!name || typeof name !== "string") {
      return "coze_workflow_unnamed";
    }

    // 去除首尾空格
    let sanitized = name.trim();

    if (!sanitized) {
      return "coze_workflow_empty";
    }

    // 将中文转换为拼音或英文描述（简化处理）
    sanitized = this.convertChineseToEnglish(sanitized);

    // 移除特殊字符，只保留字母、数字和下划线
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "_");

    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, "_");

    // 移除开头和结尾的下划线
    sanitized = sanitized.replace(/^_+|_+$/g, "");

    // 确保以字母开头
    if (!/^[a-zA-Z]/.test(sanitized)) {
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
   * 解决工具名称冲突
   * @param baseName 基础名称
   * @returns 唯一的工具名称
   */
  resolveToolNameConflict(baseName: string): string {
    const existingTools = this.configManager.getCustomMCPTools();
    const existingNames = new Set(existingTools.map((tool) => tool.name));

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
   * @param workflow 工作流数据
   * @param customDescription 自定义描述
   * @returns 工具描述
   */
  generateToolDescription(
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
   * 简单的中文到英文转换
   * 注意：这是一个简化版本，只处理常见词汇
   * 生产环境建议使用专业的拼音转换库
   * @param text 中文文本
   * @returns 转换后的英文文本
   */
  private convertChineseToEnglish(text: string): string {
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
    if (/[\u4e00-\u9fa5]/.test(result)) {
      result = `chinese_${result}`;
    }

    return result;
  }
}
