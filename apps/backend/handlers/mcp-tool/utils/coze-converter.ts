/**
 * Coze 工作流转换工具模块
 * 提供将 Coze 工作流转换为自定义 MCP 工具的功能
 */

import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { JSONSchema } from "@/types/toolApi.js";
import type { CustomMCPTool, ProxyHandlerConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import dayjs from "dayjs";
import { resolveToolNameConflict, sanitizeToolName } from "./normalization.js";
import {
  validateCozeApiConfig,
  validateGeneratedTool,
  validateWorkflowData,
  validateWorkflowUpdateData,
} from "./validation.js";

/**
 * 将扣子工作流转换为自定义 MCP 工具
 */
export function convertWorkflowToTool(
  workflow: CozeWorkflow,
  customName?: string,
  customDescription?: string,
  parameterConfig?: WorkflowParameterConfig
): CustomMCPTool {
  // 验证工作流数据完整性
  validateWorkflowData(workflow);

  // 生成工具名称（处理冲突）
  const baseName = customName || sanitizeToolName(workflow.workflow_name);
  const existingTools = configManager.getCustomMCPTools();
  const existingNames = new Set(existingTools.map((tool) => tool.name));
  const toolName = resolveToolNameConflict(baseName, existingNames);

  // 生成工具描述
  const description = generateToolDescription(workflow, customDescription);

  // 生成输入参数结构
  const inputSchema = generateInputSchema(workflow, parameterConfig);

  // 配置 HTTP 处理器
  const handler = createHttpHandler(workflow);

  // 创建工具配置
  const tool: CustomMCPTool = {
    name: toolName,
    description,
    inputSchema,
    handler,
  };

  // 添加统计信息
  tool.stats = {
    usageCount: 0,
    lastUsedTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
  };

  // 验证生成的工具配置
  validateGeneratedTool(tool);

  return tool;
}

/**
 * 更新 Coze 工具的配置
 */
export function updateCozeToolConfig(
  existingTool: CustomMCPTool,
  workflow: Partial<CozeWorkflow>,
  customDescription?: string,
  parameterConfig?: WorkflowParameterConfig
): CustomMCPTool {
  // 验证工作流更新数据完整性
  validateWorkflowUpdateData(workflow);

  // 如果前端提供的 workflow 中没有 workflow_id，尝试从现有工具中获取
  if (
    workflow.workflow_id === undefined &&
    existingTool.handler &&
    existingTool.handler.type === "proxy" &&
    existingTool.handler.platform === "coze" &&
    "config" in existingTool.handler
  ) {
    const handlerConfig = existingTool.handler as {
      type: "proxy";
      platform: "coze";
      config: { workflow_id?: string };
    };
    if (handlerConfig.config.workflow_id) {
      workflow.workflow_id = handlerConfig.config.workflow_id;
    }
  }

  // 更新工具的 inputSchema
  const updatedInputSchema = generateInputSchema(
    workflow as CozeWorkflow,
    parameterConfig
  );

  // 构建更新后的工具配置
  const updatedTool: CustomMCPTool = {
    ...existingTool,
    description: customDescription || existingTool.description,
    inputSchema: updatedInputSchema,
  };

  return updatedTool;
}

/**
 * 生成工具描述
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
 * 创建HTTP处理器配置
 */
export function createHttpHandler(workflow: CozeWorkflow): ProxyHandlerConfig {
  // 验证扣子API配置
  validateCozeApiConfig();

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
export function generateInputSchema(
  workflow: CozeWorkflow,
  parameterConfig?: WorkflowParameterConfig
): JSONSchema {
  // 如果提供了参数配置，使用参数配置生成schema
  if (parameterConfig && parameterConfig.parameters.length > 0) {
    return generateInputSchemaFromConfig(parameterConfig);
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
function generateInputSchemaFromConfig(
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
