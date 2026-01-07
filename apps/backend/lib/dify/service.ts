/**
 * Dify API 服务类
 * 负责与 Dify API 的交互，主要是工作流的调用
 */

import { createDifyClient } from "./client";

/**
 * 运行工作流的参数
 */
export interface DifyWorkflowParams {
  inputs: Record<string, unknown>;
  user?: string;
  response_mode?: "blocking" | "streaming";
}

/**
 * Dify API 服务类
 */
export class DifyApiService {
  private client: ReturnType<typeof createDifyClient>;

  constructor(apiKey: string) {
    this.client = createDifyClient(apiKey);
  }

  /**
   * 运行工作流
   * @param inputs - 输入参数
   * @param user - 用户标识
   * @param responseMode - 响应模式，默认为 "blocking"
   */
  async runWorkflow(
    inputs: Record<string, unknown>,
    user = "xiaozhi-client",
    responseMode: "blocking" | "streaming" = "blocking"
  ) {
    return this.client.run({
      inputs,
      user,
      response_mode: responseMode,
    });
  }
}
