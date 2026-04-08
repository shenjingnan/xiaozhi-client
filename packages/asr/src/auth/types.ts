/**
 * 认证类型定义
 */

export enum AuthMethod {
  TOKEN = "token",
  SIGNATURE = "signature",
}

// 认证配置
export interface AuthConfig {
  method: AuthMethod;
  token: string;
  secret?: string;
}

// 认证结果（请求头）
export interface AuthHeaders {
  [key: string]: string;
}
