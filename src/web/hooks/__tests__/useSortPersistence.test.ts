/**
 * useSortPersistence Hook 测试
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSortPersistence } from "../useSortPersistence";

describe("useSortPersistence", () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
      writable: true,
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("正常功能", () => {
    it("应该从 localStorage 读取有效配置", () => {
      const savedConfig = { field: "usageCount" };
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify(savedConfig)
      );

      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig: { field: "name" },
          validFields: ["name", "usageCount", "lastUsedTime"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(savedConfig);
      expect(window.localStorage.getItem).toHaveBeenCalledWith(
        "test-sort-config"
      );
    });

    it("当 localStorage 无数据时应使用默认配置", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);

      const defaultConfig = { field: "name" };
      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig,
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(defaultConfig);
    });

    it("setSortConfig 应该更新配置", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);

      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig: { field: "name" },
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      const newConfig = { field: "usageCount" };
      act(() => {
        result.current.setSortConfig(newConfig);
      });

      expect(result.current.sortConfig).toEqual(newConfig);
    });
  });

  describe("降级处理", () => {
    it("localStorage 中存在无效数据时应使用默认配置", () => {
      const invalidConfig = { field: "invalidField" };
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify(invalidConfig)
      );

      const defaultConfig = { field: "name" };
      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig,
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(defaultConfig);
      expect(console.warn).toHaveBeenCalledWith(
        "[test] 无效的排序字段，使用默认配置"
      );
    });

    it("localStorage 中数据格式错误时应使用默认配置", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify({ notField: "value" })
      );

      const defaultConfig = { field: "name" };
      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig,
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(defaultConfig);
    });

    it("localStorage 中数据为 null 时应使用默认配置", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify(null)
      );

      const defaultConfig = { field: "name" };
      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig,
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(defaultConfig);
    });
  });

  describe("错误处理", () => {
    it("JSON 解析失败时应使用默认配置", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        "invalid json content"
      );

      const defaultConfig = { field: "name" };
      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig,
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(defaultConfig);
      expect(console.warn).toHaveBeenCalledWith(
        "[test] 读取排序配置失败:",
        expect.any(SyntaxError)
      );
    });

    it("localStorage.setItem 失败时应输出警告", async () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);
      vi.mocked(window.localStorage.setItem).mockImplementation(() => {
        throw new Error("localStorage quota exceeded");
      });

      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig: { field: "name" },
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      // 触发保存
      act(() => {
        result.current.setSortConfig({ field: "usageCount" });
      });

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          "[test] 保存排序配置失败:",
          expect.any(Error)
        );
      });
    });
  });

  describe("字段验证", () => {
    it("应该验证 field 字段是否在有效字段列表中", () => {
      const configWithInvalidField = { field: "invalidField" };
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify(configWithInvalidField)
      );

      const defaultConfig = { field: "name" };
      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig,
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(defaultConfig);
    });

    it("应该接受有效字段", () => {
      const validConfig = { field: "usageCount" };
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify(validConfig)
      );

      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig: { field: "name" },
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(validConfig);
    });
  });

  describe("持久化功能", () => {
    it("配置变化时应正确保存到 localStorage", async () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);

      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig: { field: "name" },
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      const newConfig = { field: "usageCount" };
      act(() => {
        result.current.setSortConfig(newConfig);
      });

      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith(
          "test-sort-config",
          JSON.stringify(newConfig)
        );
      });
    });

    it("初始化时应从 localStorage 读取配置", () => {
      const savedConfig = { field: "usageCount" };
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify(savedConfig)
      );

      const { result } = renderHook(() =>
        useSortPersistence({
          storageKey: "test-sort-config",
          defaultConfig: { field: "name" },
          validFields: ["name", "usageCount"],
          loggerName: "test",
        })
      );

      expect(result.current.sortConfig).toEqual(savedConfig);
      expect(window.localStorage.getItem).toHaveBeenCalledWith(
        "test-sort-config"
      );
    });
  });
});
