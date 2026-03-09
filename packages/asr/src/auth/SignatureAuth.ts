/**
 * HMAC256 签名认证
 */

import { createHmac } from "node:crypto";
import { URL } from "node:url";
import type { AuthHeaders } from "@/auth/types.js";

/**
 * 生成 HMAC256 签名认证请求头
 */
export class SignatureAuth {
  private token: string;
  private secret: string;
  private wsUrl: string;

  constructor(token: string, secret: string, wsUrl: string) {
    this.token = token;
    this.secret = secret;
    this.wsUrl = wsUrl;
  }

  /**
   * 获取认证请求头
   */
  getHeaders(requestData?: Buffer): AuthHeaders {
    const url = new URL(this.wsUrl);
    const path = url.pathname || "/";

    // 构建签名字符串
    let inputStr = `GET ${path} HTTP/1.1\n`;

    // 自定义请求头（与 Python 代码保持一致，使用 "Custom"）
    const headerValue = "auth_custom";
    inputStr += `${headerValue}\n`;

    // 如果提供了请求数据，则追加
    if (requestData) {
      inputStr += requestData.toString("latin1");
    }

    // 计算 HMAC256 签名
    const hmac = createHmac("sha256", this.secret);
    hmac.update(inputStr, "latin1");
    const mac = hmac.digest("base64").replace(/\+/g, "-").replace(/\//g, "_");

    // 构建认证请求头
    const authHeader = `HMAC256; access_token="${this.token}"; mac="${mac}"; h="${headerValue}"`;

    return {
      Custom: headerValue,
      Authorization: authHeader,
    };
  }

  /**
   * 快速生成认证请求头的静态方法
   */
  static createHeaders(
    token: string,
    secret: string,
    wsUrl: string,
    requestData?: Buffer
  ): AuthHeaders {
    const auth = new SignatureAuth(token, secret, wsUrl);
    return auth.getHeaders(requestData);
  }
}
