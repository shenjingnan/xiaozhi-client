/**
 * 扣子 API 服务类
 * 负责与扣子 API 的交互，包括工作空间和工作流的获取
 */

import type { WorkSpace } from "@/lib/coze";
import type {
  CozeWorkflowsData,
  CozeWorkflowsParams,
  CozeWorkflowsResponse,
} from "@root/types/coze";
import { CozeApiCache } from "./cache";
import { createCozeClient } from "./client";

/**
 * 扣子 API 服务类
 */
export class CozeApiService {
  private cache = new CozeApiCache();
  private token: string; // 保留 token 字段用于可能的后续扩展（如 token 刷新）
  private client: ReturnType<typeof createCozeClient>;

  constructor(token: string) {
    this.token = token.trim();
    this.client = createCozeClient(this.token);
  }

  /**
   * 获取工作空间列表
   */
  async getWorkspaces(): Promise<WorkSpace[]> {
    const cacheKey = "workspaces";
    const cached = this.cache.get<WorkSpace[]>(cacheKey);
    if (cached) return cached;

    const { workspaces = [] } = await this.client.workspaces.list();

    this.cache.set(cacheKey, workspaces, "workspaces");

    return workspaces;
  }

  /**
   * 获取工作流列表
   */
  async getWorkflows(params: CozeWorkflowsParams): Promise<CozeWorkflowsData> {
    const { workspace_id, page_num = 1, page_size = 20 } = params;

    if (!workspace_id || typeof workspace_id !== "string") {
      throw new Error("工作空间ID不能为空");
    }

    const cacheKey = `workflows:${workspace_id}:${page_num}:${page_size}`;
    const cached = this.cache.get<CozeWorkflowsData>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<
      CozeWorkflowsParams,
      CozeWorkflowsResponse
    >("/v1/workflows", {
      workspace_id,
      page_num: page_num,
      page_size: page_size,
      workflow_mode: "workflow",
    });

    const result = response.data;

    this.cache.set(cacheKey, result, "workflows");

    return result;
  }

  /**
   * 清除缓存
   */
  clearCache(pattern?: string): void {
    this.cache.clear(pattern);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return this.cache.getStats();
  }
}
