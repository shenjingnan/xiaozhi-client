/**
 * Token 认证
 */

import type { AuthHeaders } from "@/auth/types.js";

/**
 * 生成 Token 认证请求头
 */
export class TokenAuth {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * 获取认证请求头
   */
  getHeaders(): AuthHeaders {
    return {
      Authorization: `Bearer; ${this.token}`,
    };
  }

  /**
   * 快速生成认证请求头的静态方法
   */
  static createHeaders(token: string): AuthHeaders {
    return {
      Authorization: `Bearer; ${token}`,
    };
  }
}
