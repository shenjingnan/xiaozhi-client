/**
 * 扣子 API 服务类
 * 负责与扣子 API 的交互，包括工作空间和工作流的获取
 */

import type { RunWorkflowData, WorkSpace } from "@/lib/coze";
import type {
  CozeWorkflowsData,
  CozeWorkflowsParams,
  CozeWorkflowsResponse,
} from "@/types/coze";
import NodeCache from "node-cache";
import { createCozeClient } from "./client";

/**
 * 扣子 API 服务类
 */
export class CozeApiService {
  private cache: NodeCache;
  private token: string; // 保留 token 字段用于可能的后续扩展（如 token 刷新）
  private client: ReturnType<typeof createCozeClient>;

  constructor(token: string) {
    this.token = token.trim();
    this.client = createCozeClient(this.token);

    // 初始化缓存
    this.cache = new NodeCache({
      stdTTL: 5 * 60, // 默认5分钟（工作流缓存使用此默认值）
    });
  }

  /**
   * 获取工作空间列表
   */
  async getWorkspaces(): Promise<WorkSpace[]> {
    const cacheKey = "workspaces";
    const cached = this.cache.get<WorkSpace[]>(cacheKey);
    if (cached) return cached;

    const { workspaces = [] } = await this.client.workspaces.list();

    // 设置缓存，过期时间30分钟
    this.cache.set(cacheKey, workspaces, 30 * 60);

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

    // 设置缓存，使用默认的5分钟过期时间
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * 运行工作流
   * @param workflowId - 工作流ID
   * @param parameters - 参数
   * @returns 运行工作流数据
   */
  callWorkflow(
    workflowId: string,
    parameters: Record<string, unknown>
  ): Promise<RunWorkflowData> {
    return this.client.workflows.runs.create({
      workflow_id: workflowId,
      parameters,
    });
  }

  /**
   * 清除缓存
   * @param pattern 可选的模式字符串，清除所有以该模式开头的缓存键
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      // 清除所有缓存
      this.cache.flushAll();
      return;
    }

    // node-cache 不支持模式匹配，需要手动实现
    // 使用前缀匹配，避免意外匹配
    const keys = this.cache.keys();
    const keysToDelete = keys.filter((key) => key.startsWith(pattern));
    this.cache.del(keysToDelete);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    hits: number;
    misses: number;
    hitRate: number;
    ksize: number;
    vsize: number;
  } {
    const stats = this.cache.getStats();
    const keys = this.cache.keys();
    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 ? stats.hits / totalRequests : 0;

    return {
      size: stats.keys,
      keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate,
      ksize: stats.ksize,
      vsize: stats.vsize,
    };
  }
}
