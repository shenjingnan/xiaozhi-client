/**
 * 工具 Schema 生成服务
 * 负责生成工具的输入参数结构（JSON Schema）
 */

import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/coze.js";
import type { JSONSchema } from "@/types/toolApi.js";

/**
 * 工具 Schema 生成服务
 */
export class ToolSchemaGenerator {
  /**
   * 生成输入参数结构
   * @param workflow 工作流数据
   * @param parameterConfig 参数配置
   * @returns JSON Schema 格式的输入参数结构
   */
  generateInputSchema(
    workflow: CozeWorkflow,
    parameterConfig?: WorkflowParameterConfig
  ): JSONSchema {
    // 如果提供了参数配置，使用参数配置生成schema
    if (parameterConfig && parameterConfig.parameters.length > 0) {
      return this.generateInputSchemaFromConfig(parameterConfig);
    }

    // 否则使用默认的基础参数结构
    const baseSchema: JSONSchema = {
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
   * @param parameterConfig 参数配置
   * @returns JSON Schema 格式的输入参数结构
   */
  generateInputSchemaFromConfig(parameterConfig: WorkflowParameterConfig): JSONSchema {
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
}
