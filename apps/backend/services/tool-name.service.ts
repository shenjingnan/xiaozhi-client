/**
 * 工具名称处理服务
 * 负责工具名称处理、描述生成和输入模式生成
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { JSONSchema } from "@/types/toolApi.js";
import type { ProxyHandlerConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";

/**
 * 工具名称处理服务
 * 负责工具名称处理、描述生成和输入模式生成
 */
export class ToolNameService {
  // 预编译的正则表达式常量，避免在频繁调用时重复创建
  private static readonly UNDERSCORE_TRIM_REGEX = /^_+|_+$/g;
  private static readonly LETTER_START_REGEX = /^[a-zA-Z]/;
  private static readonly CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/;
  private static readonly DIGITS_ONLY_REGEX = /^\d+$/;
  private static readonly ALPHANUMERIC_UNDERSCORE_REGEX = /^[a-zA-Z0-9_-]+$/;
  private static readonly IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  /**
   * 清理工具名称
   * 移除非法字符，确保名称符合 JavaScript 标识符规范
   */
  sanitizeToolName(name: string, prefix = ""): string {
    if (!name) {
      return "unnamed_tool";
    }

    // 移除首尾空格
    let sanitized = name.trim();

    // 替换空格和特殊字符为下划线
    sanitized = sanitized.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_");

    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, "_");

    // 移除首尾下划线
    sanitized = sanitized.replace(ToolNameService.UNDERSCORE_TRIM_REGEX, "");

    // 如果名称为空，返回默认值
    if (!sanitized) {
      return prefix ? `${prefix}_tool` : "unnamed_tool";
    }

    // 确保以字母开头
    if (!ToolNameService.LETTER_START_REGEX.test(sanitized)) {
      sanitized = `tool_${sanitized}`;
    }

    // 限制长度
    if (sanitized.length > 50) {
      sanitized = sanitized.substring(0, 50);
    }

    return sanitized;
  }

  /**
   * 清理 Coze 工作流工具名称
   */
  sanitizeCozeToolName(name: string): string {
    let sanitized = this.sanitizeToolName(name);

    // 添加 coze 前缀（如果还没有）
    if (!sanitized.startsWith("coze_")) {
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
    if (ToolNameService.CHINESE_CHAR_REGEX.test(result)) {
      result = `chinese_${result}`;
    }

    return result;
  }

  /**
   * 解决工具名称冲突
   */
  resolveToolNameConflict(baseName: string): string {
    const existingTools = configManager.getCustomMCPTools();
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
   * 创建 HTTP 处理器配置
   */
  createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
    return {
      type: "proxy",
      platform: "coze",
      config: {
        workflow_id: workflow.workflow_id,
      },
    };
  }

  /**
   * 生成输入模式
   */
  generateInputSchema(
    workflow: CozeWorkflow,
    parameterConfig?: WorkflowParameterConfig | Record<string, unknown>
  ): JSONSchema {
    // 如果提供了参数配置，使用它
    if (parameterConfig) {
      // 检查是否是 WorkflowParameterConfig 格式（有 parameters 属性）
      if (
        "parameters" in parameterConfig &&
        Array.isArray(parameterConfig.parameters)
      ) {
        return this.generateInputSchemaFromWorkflowConfig(
          parameterConfig as WorkflowParameterConfig
        );
      }
      // 否则当作 Record<string, unknown> 处理
      return this.generateInputSchemaFromRecordConfig(
        parameterConfig as Record<string, unknown>
      );
    }

    // 否则生成默认模式
    return {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: workflow.description || "工作流输入参数",
        },
      },
      required: ["input"],
    };
  }

  /**
   * 从 WorkflowParameterConfig 生成输入模式
   */
  private generateInputSchemaFromWorkflowConfig(
    parameterConfig: WorkflowParameterConfig
  ): JSONSchema {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of parameterConfig.parameters) {
      properties[param.fieldName] = {
        type: param.type,
        description: param.description || `参数 ${param.fieldName}`,
      };

      if (param.required) {
        required.push(param.fieldName);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * 从 Record<string, unknown> 生成输入模式
   */
  private generateInputSchemaFromRecordConfig(
    parameterConfig: Record<string, unknown>
  ): JSONSchema {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, config] of Object.entries(parameterConfig)) {
      if (
        config &&
        typeof config === "object" &&
        !Array.isArray(config) &&
        "type" in config
      ) {
        const configObj = config as {
          type: string;
          description?: string;
          required?: boolean;
        };
        properties[key] = {
          type: configObj.type,
          description: configObj.description || `参数 ${key}`,
        };

        if (configObj.required) {
          required.push(key);
        }
      } else {
        // 默认字符串类型
        properties[key] = {
          type: "string",
          description: `参数 ${key}`,
        };
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
}
