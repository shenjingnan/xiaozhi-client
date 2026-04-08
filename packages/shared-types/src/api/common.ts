/**
 * 通用 API 响应类型定义
 * 与 backend 的 response-enhancer.middleware.ts 保持一致
 */

/**
 * 成功响应格式
 */
export interface ApiSuccessResponse<T = unknown> {
  /** 操作是否成功 */
  success: true;
  /** 响应数据 */
  data?: T;
  /** 响应消息 */
  message?: string;
}

/**
 * 错误响应格式
 */
export interface ApiErrorResponse {
  /** 操作是否成功 */
  success: false;
  /** 错误信息 */
  error: {
    /** 错误码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 错误详情 */
    details?: unknown;
  };
}

/**
 * API 响应联合类型
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

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
