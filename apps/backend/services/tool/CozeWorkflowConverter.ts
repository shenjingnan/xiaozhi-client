/**
 * Coze Workflow 转换服务
 * 提供工作流到工具配置的转换功能
 */

import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { ProxyHandlerConfig } from "@/types/toolApi.js";
import { configManager } from "@xiaozhi-client/config";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import { ToolSchemaGenerator } from "./ToolSchemaGenerator.js";
import { ToolValidator, VALIDATION_REGEX } from "./ToolValidator.js";

/**
 * 中文到英文映射表
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
 * Coze Workflow 转换服务
 */
export class CozeWorkflowConverter {
  private validator: ToolValidator;
  private schemaGenerator: ToolSchemaGenerator;

  constructor() {
    this.validator = new ToolValidator();
    this.schemaGenerator = new ToolSchemaGenerator();
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
    // 验证工作流数据完整性
    this.validator.validateWorkflowData(workflow);

    // 验证扣子 API 配置
    this.validateCozeApiConfig();

    // 生成工具名称（处理冲突）
    const baseName =
      customName || this.sanitizeToolName(workflow.workflow_name);
    const toolName = this.resolveToolNameConflict(baseName);

    // 生成工具描述
    const description = this.schemaGenerator.generateToolDescription(
      workflow,
      customDescription
    );

    // 生成输入参数结构
    const inputSchema = this.schemaGenerator.generateInputSchema(
      workflow,
      parameterConfig
    );

    // 配置 HTTP 处理器
    const handler = this.createHttpHandler(workflow);

    // 创建工具配置
    const tool: CustomMCPTool = {
      name: toolName,
      description,
      inputSchema,
      handler,
    };

    // 验证生成的工具配置
    this.validator.validateGeneratedTool(tool);

    return tool;
  }

  /**
   * 规范化工具名称
   */
  sanitizeToolName(name: string): string {
    if (!name || typeof name !== "string") {
      return "coze_workflow_unnamed";
    }

    let sanitized = name.trim();

    if (!sanitized) {
      return "coze_workflow_empty";
    }

    // 将中文转换为英文
    sanitized = this.convertChineseToEnglish(sanitized);

    // 移除特殊字符
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "_");

    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, "_");

    // 移除开头和结尾的下划线
    sanitized = sanitized.replace(VALIDATION_REGEX.UNDERSCORE_TRIM, "");

    // 确保以字母开头
    if (!VALIDATION_REGEX.LETTER_START.test(sanitized)) {
      sanitized = `coze_workflow_${sanitized}`;
    }

    // 限制长度
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
    let result = text;

    // 替换常见中文词汇
    for (const [chinese, english] of Object.entries(CHINESE_TO_ENGLISH_MAP)) {
      result = result.replace(new RegExp(chinese, "g"), english);
    }

    // 如果还有中文字符，用拼音前缀替代
    if (VALIDATION_REGEX.CHINESE_CHAR.test(result)) {
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

    while (existingNames.has(finalName)) {
      finalName = `${baseName}_${counter}`;
      counter++;

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
   * 创建HTTP处理器配置
   */
  private createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
    return {
      type: "proxy",
      platform: "coze",
      config: {
        workflow_id: workflow.workflow_id,
      },
    };
  }

  /**
   * 验证扣子API配置
   */
  private validateCozeApiConfig(): void {
    const cozeConfig = configManager.getCozePlatformConfig();
    if (!cozeConfig || !cozeConfig.token) {
      throw MCPError.configError(
        MCPErrorCode.INVALID_CONFIG,
        "未配置扣子API Token，请先在配置中设置 platforms.coze.token"
      );
    }
  }
}
