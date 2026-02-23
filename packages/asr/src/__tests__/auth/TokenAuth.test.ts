/**
 * Token 认证测试
 */

import { TokenAuth } from "@/auth/index.js";
import { describe, expect, it } from "vitest";

describe("TokenAuth", () => {
  it("应正确生成认证头", () => {
    const token = "test_token_12345";
    const auth = new TokenAuth(token);

    const headers = auth.getHeaders();

    expect(headers).toHaveProperty("Authorization");
    expect(headers.Authorization).toBe(`Bearer; ${token}`);
  });

  it("应正确处理空 token", () => {
    const auth = new TokenAuth("");
    const headers = auth.getHeaders();

    expect(headers.Authorization).toBe("Bearer; ");
  });

  it("静态方法 createHeaders 应正确生成认证头", () => {
    const token = "static_token_67890";
    const headers = TokenAuth.createHeaders(token);

    expect(headers).toHaveProperty("Authorization");
    expect(headers.Authorization).toBe(`Bearer; ${token}`);
  });

  it("应正确处理特殊字符的 token", () => {
    const token = "token_with_special_chars!@#$%^&*()";
    const auth = new TokenAuth(token);

    const headers = auth.getHeaders();

    expect(headers.Authorization).toBe(`Bearer; ${token}`);
  });

  it("应正确处理长 token", () => {
    const token = "a".repeat(1000);
    const auth = new TokenAuth(token);

    const headers = auth.getHeaders();

    expect(headers.Authorization).toBe(`Bearer; ${token}`);
    expect(headers.Authorization.length).toBe(8 + 1000); // "Bearer; " (8) + token
  });
});
