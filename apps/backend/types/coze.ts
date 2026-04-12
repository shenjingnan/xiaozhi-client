/**
 * 扣子 API 相关类型定义
 * 基于 docs/coze-api.md 中的 API 文档
 *
 * 注意：此文件从 @xiaozhi-client/shared-types/coze 重新导出类型，
 * 以保持向后兼容性并遵循 DRY 原则。
 */

// 从 shared-types/coze 导入所有类型并重新导出
export type {
  CozeWorkspace,
  CozeWorkspacesData,
  CozeWorkflowCreator,
  CozeWorkflow,
  CozeWorkflowsData,
  CozeWorkflowsParams,
  WorkflowParameter,
  WorkflowParameterConfig,
  CozeApiDetail,
  CozeApiResponse,
  CozeWorkspacesResponse,
  CozeWorkflowsResponse,
  CozeApiError,
  CacheItem,
  CozePlatformConfig,
  CozeApiServiceConfig,
} from "@xiaozhi-client/shared-types/coze";
