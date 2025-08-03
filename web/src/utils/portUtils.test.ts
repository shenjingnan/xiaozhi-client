/**
 * 端口工具函数测试
 */

import { describe, expect, it, vi } from "vitest";
import {
  buildWebSocketUrl,
  checkPortAvailability,
  extractPortFromUrl,
  pollPortUntilAvailable,
} from "./portUtils";

// Mock fetch
global.fetch = vi.fn();

describe("portUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkPortAvailability", () => {
    it("应该在端口可用时返回 true", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      const result = await checkPortAvailability(9999);
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/status",
        expect.objectContaining({
          method: "GET",
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("应该在端口不可用时返回 false", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error("Connection failed"));

      const result = await checkPortAvailability(9999);
      expect(result).toBe(false);
    });

    it("应该在超时时返回 false", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true } as Response), 200);
          })
      );

      const result = await checkPortAvailability(9999, 100);
      expect(result).toBe(false);
    }, 1000);
  });

  describe("buildWebSocketUrl", () => {
    it("应该构建正确的 WebSocket URL", () => {
      // Mock window.location
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
        },
        writable: true,
      });

      const result = buildWebSocketUrl(9999);
      expect(result).toBe("ws://localhost:9999");
    });

    it("应该在 HTTPS 环境下使用 WSS", () => {
      Object.defineProperty(window, "location", {
        value: {
          protocol: "https:",
        },
        writable: true,
      });

      const result = buildWebSocketUrl(9999);
      expect(result).toBe("wss://localhost:9999");
    });

    it("应该支持自定义主机名", () => {
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
        },
        writable: true,
      });

      const result = buildWebSocketUrl(9999, "example.com");
      expect(result).toBe("ws://example.com:9999");
    });
  });

  describe("extractPortFromUrl", () => {
    it("应该从 URL 中提取端口号", () => {
      const result = extractPortFromUrl("ws://localhost:9999");
      expect(result).toBe(9999);
    });

    it("应该在无效 URL 时返回 null", () => {
      const result = extractPortFromUrl("invalid-url");
      expect(result).toBe(null);
    });

    it("应该在没有端口号时返回 null", () => {
      const result = extractPortFromUrl("ws://localhost");
      expect(result).toBe(null);
    });
  });

  describe("pollPortUntilAvailable", () => {
    it("应该在端口立即可用时返回 true", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
      } as Response);

      const onProgress = vi.fn();
      const result = await pollPortUntilAvailable(9999, 3, 100, onProgress);

      expect(result).toBe(true);
      expect(onProgress).toHaveBeenCalledWith(1, 3);
    });

    it("应该在超时后返回 false", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValue(new Error("Connection failed"));

      const result = await pollPortUntilAvailable(9999, 2, 50);
      expect(result).toBe(false);
    });
  });
});
