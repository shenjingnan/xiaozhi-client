/**
 * SimplePlatformRegistryImpl 测试
 */

import { SimplePlatformRegistryImpl, type TTSPlatform } from "@/core/index.js";
import { describe, expect, it, vi } from "vitest";

describe("SimplePlatformRegistryImpl", () => {
  describe("构造函数", () => {
    it("应创建空的平台注册表", () => {
      const registry = new SimplePlatformRegistryImpl();
      expect(registry.list()).toEqual([]);
    });
  });

  describe("register 方法", () => {
    it("应注册平台", () => {
      const registry = new SimplePlatformRegistryImpl();

      const mockPlatform: TTSPlatform = {
        platform: "test-platform",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      registry.register(mockPlatform);

      expect(registry.list()).toContain("test-platform");
    });

    it("应允许注册多个平台", () => {
      const registry = new SimplePlatformRegistryImpl();

      const mockPlatform1: TTSPlatform = {
        platform: "platform-1",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      const mockPlatform2: TTSPlatform = {
        platform: "platform-2",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      registry.register(mockPlatform1);
      registry.register(mockPlatform2);

      expect(registry.list()).toHaveLength(2);
      expect(registry.list()).toContain("platform-1");
      expect(registry.list()).toContain("platform-2");
    });

    it("应覆盖已存在的平台", () => {
      const registry = new SimplePlatformRegistryImpl();

      const mockPlatform1: TTSPlatform = {
        platform: "duplicate-platform",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      const mockPlatform2: TTSPlatform = {
        platform: "duplicate-platform",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      registry.register(mockPlatform1);
      registry.register(mockPlatform2);

      expect(registry.list()).toHaveLength(1);
    });
  });

  describe("get 方法", () => {
    it("应返回已注册的平台", () => {
      const registry = new SimplePlatformRegistryImpl();

      const mockPlatform: TTSPlatform = {
        platform: "test-platform",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      registry.register(mockPlatform);

      const result = registry.get("test-platform");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("test-platform");
    });

    it("应返回 undefined 当平台不存在时", () => {
      const registry = new SimplePlatformRegistryImpl();

      const result = registry.get("non-existent");

      expect(result).toBeUndefined();
    });
  });

  describe("list 方法", () => {
    it("应返回空数组当没有注册平台时", () => {
      const registry = new SimplePlatformRegistryImpl();

      expect(registry.list()).toEqual([]);
    });

    it("应返回所有已注册的平台名称", () => {
      const registry = new SimplePlatformRegistryImpl();

      const mockPlatform1: TTSPlatform = {
        platform: "platform-a",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      const mockPlatform2: TTSPlatform = {
        platform: "platform-b",
        createController: vi.fn(),
        validateConfig: vi.fn(),
        getAuthHeaders: vi.fn(),
        getEndpoint: vi.fn(),
      };

      registry.register(mockPlatform1);
      registry.register(mockPlatform2);

      const platforms = registry.list();

      expect(platforms).toHaveLength(2);
      expect(platforms).toContain("platform-a");
      expect(platforms).toContain("platform-b");
    });
  });
});
