/**
 * 工具转换器
 * 负责将不同格式的数据转换为统一的工具格式
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import type { JSONSchema } from "@/types/toolApi.js";

/**
 * 工具转换器类
 */
export class ToolConverter {
  // 预编译的正则表达式常量
  private static readonly UNDERSCORE_TRIM_REGEX = /^_+|_+$/g;
  private static readonly LETTER_START_REGEX = /^[a-zA-Z]/;
  private static readonly CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/;

  private existingTools: CustomMCPTool[];

  constructor(existingTools: CustomMCPTool[]) {
    this.existingTools = existingTools;
  }

  /**
   * 将扣子工作流转换为自定义 MCP 工具
   */
  convertWorkflowToTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool {
    // 生成工具名称（处理冲突）
    const baseName = customName || this.sanitizeToolName(workflow.workflow_name);
    const toolName = this.resolveToolNameConflict(baseName);

    // 生成工具描述
    const description = this.generateToolDescription(workflow, customDescription);

    // 生成输入参数结构
    const inputSchema = this.generateInputSchema(workflow, parameterConfig);

    // 配置 HTTP 处理器
    const handler = this.createHttpHandler(workflow);

    // 创建工具配置
    const tool: CustomMCPTool = {
      name: toolName,
      description,
      inputSchema,
      handler,
    };

    return tool;
  }

  /**
   * 规范化工具名称
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
    sanitized = sanitized.replace(
      ToolConverter.UNDERSCORE_TRIM_REGEX,
      ""
    );

    // 确保以字母开头
    if (!ToolConverter.LETTER_START_REGEX.test(sanitized)) {
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
   * 简单的中文到英文转换（可以扩展为更复杂的拼音转换）
   */
  convertChineseToEnglish(text: string): string {
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
    if (ToolConverter.CHINESE_CHAR_REGEX.test(result)) {
      result = `chinese_${result}`;
    }

    return result;
  }

  /**
   * 解决工具名称冲突
   */
  resolveToolNameConflict(baseName: string): string {
    const existingNames = new Set(this.existingTools.map((tool) => tool.name));

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
   * 生成输入参数结构
   */
  generateInputSchema(
    workflow: CozeWorkflow,
    parameterConfig?: WorkflowParameterConfig
  ): JSONSchema {
    // 如果提供了参数配置，使用参数配置生成 schema
    if (parameterConfig && parameterConfig.parameters.length > 0) {
      return this.generateInputSchemaFromConfig(parameterConfig);
    }

    // 否则使用默认的基础参数结构
    const baseSchema = {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "输入内容",
        },
      },
      required: ["input"],
      additionalProperties: false,
    };

    return baseSchema;
  }

  /**
   * 根据参数配置生成输入参数结构
   */
  generateInputSchemaFromConfig(
    parameterConfig: WorkflowParameterConfig
  ): JSONSchema {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of parameterConfig.parameters) {
      properties[param.fieldName] = {
        type: param.type,
        description: param.description,
      };

      if (param.required) {
        required.push(param.fieldName);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    };
  }

  /**
   * 更新现有工具列表（用于解决名称冲突）
   */
  updateExistingTools(existingTools: CustomMCPTool[]): void {
    this.existingTools = existingTools;
  }
}
