/**
 * Coze 工作流服务
 * 负责处理 Coze 工作流相关的逻辑，包括转换为工具配置、创建处理器等
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import type { ConfigManager } from "@xiaozhi-client/config";
import { ToolNameService } from "./tool-name.service.js";
import { ToolSchemaGenerator } from "./tool-schema-generator.service.js";
import { ToolValidationService } from "./tool-validation.service.js";

/**
 * Coze 工作流服务
 */
export class CozeWorkflowService {
  private logger: Logger;
  private configManager: ConfigManager;
  private toolNameService: ToolNameService;
  private schemaGenerator: ToolSchemaGenerator;
  private validationService: ToolValidationService;

  constructor(configManager: ConfigManager) {
    this.logger = logger;
    this.configManager = configManager;
    this.toolNameService = new ToolNameService(configManager);
    this.schemaGenerator = new ToolSchemaGenerator();
    this.validationService = new ToolValidationService();
  }

  /**
   * 将扣子工作流转换为自定义 MCP 工具
   * @param workflow 工作流数据
   * @param customName 自定义名称
   * @param customDescription 自定义描述
   * @param parameterConfig 参数配置
   * @returns 自定义 MCP 工具配置
   */
  convertWorkflowToTool(
    workflow: CozeWorkflow,
    customName?: string,
    customDescription?: string,
    parameterConfig?: WorkflowParameterConfig
  ): CustomMCPTool {
    // 验证工作流数据完整性
    this.validationService.validateWorkflowData(workflow);

    // 生成工具名称（处理冲突）
    const baseName =
      customName || this.toolNameService.sanitizeToolName(workflow.workflow_name);
    const toolName = this.toolNameService.resolveToolNameConflict(baseName);

    // 生成工具描述
    const description = this.toolNameService.generateToolDescription(
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
    this.validationService.validateGeneratedTool(tool);

    return tool;
  }

  /**
   * 创建 HTTP 处理器配置
   * @param workflow 工作流数据
   * @returns HTTP 处理器配置
   */
  private createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
    // 验证扣子API配置
    this.validateCozeApiConfig();

    return {
      type: "proxy",
      platform: "coze",
      config: {
        workflow_id: workflow.workflow_id,
      },
    };
  }

  /**
   * 验证扣子 API 配置
   * @throws {MCPError} 当配置无效时
   * @private
   */
  private validateCozeApiConfig(): void {
    // 检查是否配置了扣子token
    const cozeConfig = this.configManager.getCozePlatformConfig();
    if (!cozeConfig || !cozeConfig.token) {
      throw MCPError.configError(
        MCPErrorCode.INVALID_CONFIG,
        "未配置扣子API Token，请先在配置中设置 platforms.coze.token"
      );
    }
  }

  /**
   * 获取工具名称服务实例
   * 用于外部直接访问工具名称相关功能
   */
  getToolNameService(): ToolNameService {
    return this.toolNameService;
  }

  /**
   * 获取 Schema 生成器实例
   * 用于外部直接访问 Schema 生成功能
   */
  getSchemaGenerator(): ToolSchemaGenerator {
    return this.schemaGenerator;
  }

  /**
   * 获取验证服务实例
   * 用于外部直接访问验证功能
   */
  getValidationService(): ToolValidationService {
    return this.validationService;
  }
}
