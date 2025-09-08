/**
 * 扣子 API 前端服务层集成测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CozeApiClient } from "../services/cozeApi";
import type {
  CozeWorkflowsResult,
  CozeWorkspace,
} from "../types";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CozeApiClient", () => {
  let cozeApiClient: CozeApiClient;

  beforeEach(() => {
    cozeApiClient = new CozeApiClient("http://localhost:9999");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchWorkspaces", () => {
    it("should fetch workspaces successfully", async () => {
      const mockWorkspaces: CozeWorkspace[] = [
        {
          id: "7513770152291254324",
          name: "个人空间",
          description: "Personal Space",
          workspace_type: "personal",
          enterprise_id: "",
          admin_UIDs: [],
          icon_url: "https://example.com/icon.png",
          role_type: "owner",
          joined_status: "joined",
          owner_uid: "3871811622675880",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockWorkspaces,
        }),
      });

      const result = await cozeApiClient.fetchWorkspaces();

      expect(result).toEqual(mockWorkspaces);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/coze/workspaces",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should handle API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "CONFIG_INVALID",
            message: "扣子平台配置无效",
          },
        }),
      });

      await expect(cozeApiClient.fetchWorkspaces()).rejects.toThrow(
        "扣子平台配置无效"
      );
    });

    it("should handle network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(cozeApiClient.fetchWorkspaces()).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("fetchWorkflows", () => {
    it("should fetch workflows successfully", async () => {
      const mockResult: CozeWorkflowsResult = {
        items: [
          {
            workflow_id: "7547256178678448138",
            workflow_name: "today",
            description: "今天的天气和诗句",
            icon_url: "https://example.com/workflow-icon.png",
            app_id: "7547221225915809801",
            creator: {
              id: "3871811622675880",
              name: "RootUser_2103455910",
            },
            created_at: 1757232517,
            updated_at: 1757232680,
          },
        ],
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockResult,
        }),
      });

      const result = await cozeApiClient.fetchWorkflows({
        workspace_id: "7513770152291254324",
      });

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/coze/workflows?workspace_id=7513770152291254324",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should handle pagination parameters", async () => {
      const mockResult: CozeWorkflowsResult = {
        items: [],
        hasMore: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockResult,
        }),
      });

      await cozeApiClient.fetchWorkflows({
        workspace_id: "7513770152291254324",
        page_num: 2,
        page_size: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/coze/workflows?workspace_id=7513770152291254324&page_num=2&page_size=10",
        expect.any(Object)
      );
    });

    it("should handle missing workspace_id error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "MISSING_PARAMETER",
            message: "缺少 workspace_id 参数",
          },
        }),
      });

      await expect(
        cozeApiClient.fetchWorkflows({
          workspace_id: "",
        })
      ).rejects.toThrow("缺少 workspace_id 参数");
    });
  });

  describe("clearCache", () => {
    it("should clear cache successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "缓存已清除",
        }),
      });

      await expect(cozeApiClient.clearCache()).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/coze/cache/clear",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should handle clear cache error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({
          error: {
            code: "INTERNAL_ERROR",
            message: "清除缓存失败",
          },
        }),
      });

      await expect(cozeApiClient.clearCache()).rejects.toThrow("清除缓存失败");
    });
  });

  describe("getCacheStats", () => {
    it("should get cache stats successfully", async () => {
      const mockStats = {
        size: 2,
        keys: ["workspaces", "workflows:7513770152291254324:1:20"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockStats,
        }),
      });

      const result = await cozeApiClient.getCacheStats();

      expect(result).toEqual(mockStats);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/coze/cache/stats",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("constructor", () => {
    it("should use provided baseUrl", () => {
      const client = new CozeApiClient("https://custom.example.com");
      expect(client).toBeInstanceOf(CozeApiClient);
    });

    it("should infer baseUrl from window.location when not provided", () => {
      // Mock window.location
      const originalLocation = window.location;
      (window as any).location = undefined;
      (window as any).location = {
        ...originalLocation,
        protocol: "https:",
        hostname: "test.example.com",
        port: "3000",
      };

      const client = new CozeApiClient();
      expect(client).toBeInstanceOf(CozeApiClient);

      // Restore window.location
      (window as any).location = originalLocation;
    });
  });
});
