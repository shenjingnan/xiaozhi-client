/**
 * API 通用类型定义
 * 注意：ApiResponse、ApiSuccessResponse、ApiErrorResponse 已移除
 * 实际使用的 API 响应类型请参考：
 * - 前端：packages/shared-types/src/frontend/api.ts
 * - 后端：apps/backend/types/api.response.ts
 */

/**
 * 分页请求参数
 */
export interface PaginationParams {
  /** 页码，从1开始 */
  page: number;
  /** 每页数量 */
  pageSize: number;
}

/**
 * 分页响应数据
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总数量 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
}
