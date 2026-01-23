/**
 * API 响应类型定义
 * 定义了项目中所有 API 响应的统一格式
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
 * 分页响应格式
 */
export interface ApiPaginatedResponse<T = unknown> {
  /** 操作是否成功 */
  success: true;
  /** 响应数据列表 */
  data: T[];
  /** 分页信息 */
  pagination: PaginationInfo;
  /** 响应消息 */
  message?: string;
}

/**
 * 分页信息
 */
export interface PaginationInfo {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总记录数 */
  total: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * API 响应联合类型
 */
export type ApiResponse<T = unknown> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse
  | ApiPaginatedResponse<T>;
