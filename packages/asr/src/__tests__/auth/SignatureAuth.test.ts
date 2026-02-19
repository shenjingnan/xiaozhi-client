/**
 * HMAC256 签名认证测试
 */

import { describe, expect, it } from "vitest";
import { SignatureAuth } from "../../auth/index.js";

describe("SignatureAuth", () => {
  const token = "test_token";
  const secret = "test_secret";
  const wsUrl = "wss://openspeech.bytedance.com/api/v2/asr";

  it("应正确生成认证头", () => {
    const auth = new SignatureAuth(token, secret, wsUrl);
    const headers = auth.getHeaders();

    expect(headers).toHaveProperty("Authorization");
    expect(headers).toHaveProperty("Custom");
    expect(headers.Custom).toBe("auth_custom");
    expect(headers.Authorization).toContain("HMAC256");
    expect(headers.Authorization).toContain(`access_token="${token}"`);
    expect(headers.Authorization).toContain('mac="');
    expect(headers.Authorization).toContain('h="auth_custom"');
  });

  it("应包含 HMAC256 签名", () => {
    const auth = new SignatureAuth(token, secret, wsUrl);
    const headers = auth.getHeaders();

    // 验证签名格式
    expect(headers.Authorization).toMatch(/mac="[^"]+"/);
  });

  it("应正确处理带路径的 WebSocket URL", () => {
    const auth = new SignatureAuth(token, secret, `${wsUrl}/stream`);
    const headers = auth.getHeaders();

    expect(headers.Authorization).toContain("HMAC256");
  });

  it("应正确处理空 token 和 secret", () => {
    const auth = new SignatureAuth("", "", wsUrl);
    const headers = auth.getHeaders();

    expect(headers.Authorization).toContain('access_token=""');
    expect(headers.Authorization).toContain('mac="');
  });

  it("静态方法 createHeaders 应正确生成认证头", () => {
    const headers = SignatureAuth.createHeaders(token, secret, wsUrl);

    expect(headers).toHaveProperty("Authorization");
    expect(headers).toHaveProperty("Custom");
    expect(headers.Authorization).toContain("HMAC256");
  });

  it("应正确处理带请求数据的认证", () => {
    const auth = new SignatureAuth(token, secret, wsUrl);
    const requestData = Buffer.from("test_request_data", "utf-8");

    const headers = auth.getHeaders(requestData);

    expect(headers.Authorization).toContain("HMAC256");
    // 不同的请求数据应产生不同的签名
    const headersWithoutData = auth.getHeaders();
    expect(headers.Authorization).not.toBe(headersWithoutData.Authorization);
  });

  it("不同 secret 应产生不同签名", () => {
    const auth1 = new SignatureAuth(token, "secret1", wsUrl);
    const auth2 = new SignatureAuth(token, "secret2", wsUrl);

    const headers1 = auth1.getHeaders();
    const headers2 = auth2.getHeaders();

    // 提取 mac 值进行比较
    const mac1 = headers1.Authorization.match(/mac="([^"]+)"/)?.[1];
    const mac2 = headers2.Authorization.match(/mac="([^"]+)"/)?.[1];

    expect(mac1).not.toBe(mac2);
  });

  it("应正确处理带查询参数的 WebSocket URL", () => {
    const urlWithQuery = "wss://example.com/ws?token=abc&cluster=volc";
    const auth = new SignatureAuth(token, secret, urlWithQuery);

    const headers = auth.getHeaders();

    expect(headers.Authorization).toContain("HMAC256");
  });
});
