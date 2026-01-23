/**
 * 响应增强中间件
 * 为 Hono Context 添加便捷的响应方法：c.success、c.fail、c.paginate
 */

import type { PaginationInfo } from "../types/api.response.js";
import type { MiddlewareHandler } from "hono";

/**
 * 扩展 Hono Context 接口
 * 添加三个新的响应方法
 */
declare module "hono" {
  interface Context {
    /**
     * 返回成功响应
     * @param data - 响应数据
     * @param message - 响应消息
     * @param status - HTTP 状态码（默认 200）
     * @returns JSON 响应
     *
     * @example
     * ```typescript
     * // 简单成功响应
     * return c.success({ id: 1, name: "张三" });
     *
     * // 带消息的成功响应
     * return c.success({ id: 1 }, "获取用户成功");
     *
     * // 自定义状态码
     * return c.success({ id: 1 }, "创建成功", 201);
     *
     * // 无数据响应（如删除操作）
     * return c.success(undefined, "删除成功");
     * ```
     */
    success<T>(
      data?: T,
      message?: string,
      status?: number
    ): Response;

    /**
     * 返回失败响应
     * @param code - 错误码
     * @param message - 错误消息
     * @param details - 错误详情
     * @param status - HTTP 状态码（默认 400）
     * @returns JSON 响应
     *
     * @example
     * ```typescript
     * // 简单错误响应
     * return c.fail("USER_NOT_FOUND", "用户不存在");
     *
     * // 404 错误
     * return c.fail("NOT_FOUND", "资源不存在", undefined, 404);
     *
     * // 带详情的错误响应
     * return c.fail("VALIDATION_ERROR", "数据验证失败", {
     *   field: "email",
     *   message: "邮箱格式不正确"
     * });
     *
     * // 服务器错误
     * return c.fail("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
     * ```
     */
    fail(
      code: string,
      message: string,
      details?: unknown,
      status?: number
    ): Response;

    /**
     * 返回分页响应
     * @param data - 数据列表
     * @param pagination - 分页信息
     * @param message - 响应消息
     * @returns JSON 响应
     *
     * @example
     * ```typescript
     * const data = [{ id: 1 }, { id: 2 }];
     * const pagination = {
     *   page: 1,
     *   pageSize: 10,
     *   total: 100,
     *   totalPages: 10,
     *   hasNext: true,
     *   hasPrev: false
     * };
     * return c.paginate(data, pagination, "查询成功");
     * ```
     */
    paginate<T>(
      data: T[],
      pagination: PaginationInfo,
      message?: string
    ): Response;
  }
}

/**
 * 响应增强中间件
 * 为所有请求添加便捷的响应方法
 */
export const responseEnhancerMiddleware: MiddlewareHandler = async (c, next) => {
  // 成功响应方法
  c.success = <T>(data?: T, message?: string, status = 200) => {
    const response: {
      success: true;
      data?: T;
      message?: string;
    } = {
      success: true,
      message,
    };

    // 只有当 data 不是 undefined 时才添加 data 字段
    if (data !== undefined) {
      response.data = data;
    }

    return c.json(response, status as never);
  };

  // 失败响应方法
  c.fail = (
    code: string,
    message: string,
    details?: unknown,
    status = 400
  ) => {
    const response: {
      success: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    } = {
      success: false,
      error: {
        code,
        message,
      },
    };

    // 只有当 details 不是 undefined 时才添加 details 字段
    if (details !== undefined) {
      response.error.details = details;
    }

    return c.json(response, status as never);
  };

  // 分页响应方法
  c.paginate = <T>(data: T[], pagination: PaginationInfo, message?: string) => {
    const response: {
      success: true;
      data: T[];
      pagination: PaginationInfo;
      message?: string;
    } = {
      success: true,
      data,
      pagination,
      message,
    };

    return c.json(response, 200);
  };

  await next();
};
