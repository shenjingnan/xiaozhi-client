/**
 * Dify API 客户端封装
 * 提供统一的客户端创建和配置
 */

import { WorkflowClient } from "dify-client";

/**
 * 创建 Dify Workflow 客户端
 * @param apiKey - API 访问密钥
 */
export function createDifyClient(apiKey: string): WorkflowClient {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("Dify API Key 不能为空");
  }

  return new WorkflowClient(apiKey.trim());
}
