/**
 * 通用 API 响应类型定义
 */

/**
 * 通用 API 响应接口
 */
export interface ApiResponse<T = unknown> {
  /** 响应状态码，0表示成功 */
  code: number;
  /** 响应数据 */
  data: T;
  /** 响应消息 */
  message: string;
  /** 请求时间戳 */
  timestamp: number;
}

/**
 * 成功响应接口
 */
export interface ApiSuccessResponse<T = unknown> {
  /** 响应状态码，固定为0 */
  code: 0;
  /** 响应数据 */
  data: T;
  /** 响应消息 */
  message: string;
  /** 请求时间戳 */
  timestamp: number;
}

/**
 * 错误响应接口
 */
export interface ApiErrorResponse {
  /** 响应状态码，非0值 */
  code: number;
  /** 错误数据 */
  data: null;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  error?: string;
  /** 请求时间戳 */
  timestamp: number;
}

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
