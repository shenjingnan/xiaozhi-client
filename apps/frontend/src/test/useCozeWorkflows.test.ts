/**
 * useCozeWorkflows Hook 测试
 */

import { useCozeWorkflows } from "@hooks/useCozeWorkflows";
import { cozeApiClient } from "@services/cozeApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { CozeWorkflowsResult, CozeWorkspace } from "@xiaozhi/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock cozeApiClient
vi.mock("@services/cozeApi", () => {
  const mockCozeApiClient = {
    fetchWorkspaces: vi.fn(),
    fetchWorkflows: vi.fn(),
    clearCache: vi.fn(),
    getCacheStats: vi.fn(),
  };

  return {
    cozeApiClient: mockCozeApiClient,
    CozeApiClient: vi.fn(),
  };
});

describe("useCozeWorkflows", () => {
  // 辅助函数获取 mock 实例
  const getMockClient = () => vi.mocked(cozeApiClient);

  const mockWorkspaces: CozeWorkspace[] = [
    {
      id: "7513770152291254324",
      name: "个人空间",
      description: "Personal Space",
      workspace_type: "personal",
      enterprise_id: "",
      admin_uids: [],
      icon_url: "https://example.com/icon.png",
      role_type: "owner",
      joined_status: "joined",
      owner_uid: "3871811622675880",
    },
    {
      id: "7513770152291254325",
      name: "团队空间",
      description: "Team Space",
      workspace_type: "team",
      enterprise_id: "ent123",
      admin_uids: ["3871811622675880"],
      icon_url: "https://example.com/team-icon.png",
      role_type: "admin",
      joined_status: "joined",
      owner_uid: "3871811622675881",
    },
  ];

  const mockWorkflowsResult: CozeWorkflowsResult = {
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
        isAddedAsTool: false,
        toolName: null,
      },
    ],
    hasMore: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const mockClient = getMockClient();
    mockClient.fetchWorkspaces.mockResolvedValue({
      workspaces: mockWorkspaces,
    });
    mockClient.fetchWorkflows.mockResolvedValue(mockWorkflowsResult);
    mockClient.clearCache.mockResolvedValue(undefined);
    mockClient.getCacheStats.mockResolvedValue({ size: 0, keys: [] });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("初始化", () => {
    it("should initialize with default values", () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({ autoLoadWorkspaces: false })
      );

      expect(result.current.workspaces).toEqual([]);
      expect(result.current.workflows).toEqual([]);
      expect(result.current.selectedWorkspace).toBeNull();
      expect(result.current.workspacesLoading).toBe(false);
      expect(result.current.workflowsLoading).toBe(false);
      expect(result.current.workspacesError).toBeNull();
      expect(result.current.workflowsError).toBeNull();
      expect(result.current.hasMoreWorkflows).toBe(false);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.pageSize).toBe(20);
    });

    it("should auto-load workspaces by default", async () => {
      renderHook(() => useCozeWorkflows());

      await waitFor(() => {
        expect(getMockClient().fetchWorkspaces).toHaveBeenCalledTimes(1);
      });
    });

    it("should not auto-load workspaces when disabled", () => {
      renderHook(() => useCozeWorkflows({ autoLoadWorkspaces: false }));

      expect(getMockClient().fetchWorkspaces).not.toHaveBeenCalled();
    });

    it("should initialize with provided workspace ID", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          initialWorkspaceId: "7513770152291254324",
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      expect(result.current.selectedWorkspace).toBeNull(); // 因为还没有加载工作空间列表
    });
  });

  describe("工作空间管理", () => {
    it("should load workspaces successfully", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({ autoLoadWorkspaces: false })
      );

      await act(async () => {
        await result.current.refreshWorkspaces();
      });

      expect(result.current.workspaces).toEqual(mockWorkspaces);
      expect(result.current.workspacesLoading).toBe(false);
      expect(result.current.workspacesError).toBeNull();
    });

    it("should handle workspaces loading error", async () => {
      const errorMessage = "加载工作空间失败";
      getMockClient().fetchWorkspaces.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      const { result } = renderHook(() =>
        useCozeWorkflows({ autoLoadWorkspaces: false })
      );

      await act(async () => {
        await result.current.refreshWorkspaces();
      });

      expect(result.current.workspaces).toEqual([]);
      expect(result.current.workspacesLoading).toBe(false);
      expect(result.current.workspacesError).toBe(errorMessage);
    });

    it("should select workspace correctly", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      // 先加载工作空间
      await act(async () => {
        await result.current.refreshWorkspaces();
      });

      // 选择工作空间
      act(() => {
        result.current.selectWorkspace("7513770152291254324");
      });

      expect(result.current.selectedWorkspace).toEqual(mockWorkspaces[0]);
      expect(result.current.workflows).toEqual([]); // 应该重置工作流列表
      expect(result.current.currentPage).toBe(1); // 应该重置页码
    });
  });

  describe("工作流管理", () => {
    it("should load workflows successfully", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      await act(async () => {
        await result.current.loadWorkflows({
          workspace_id: "7513770152291254324",
        });
      });

      expect(result.current.workflows).toEqual(mockWorkflowsResult.items);
      expect(result.current.hasMoreWorkflows).toBe(mockWorkflowsResult.hasMore);
      expect(result.current.workflowsLoading).toBe(false);
      expect(result.current.workflowsError).toBeNull();
    });

    it("should handle workflows loading error", async () => {
      const errorMessage = "加载工作流失败";
      getMockClient().fetchWorkflows.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      await act(async () => {
        await result.current.loadWorkflows({
          workspace_id: "7513770152291254324",
        });
      });

      expect(result.current.workflows).toEqual([]);
      expect(result.current.workflowsLoading).toBe(false);
      expect(result.current.workflowsError).toBe(errorMessage);
    });

    it("should not load workflows without workspace ID", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      await act(async () => {
        await result.current.loadWorkflows();
      });

      expect(getMockClient().fetchWorkflows).not.toHaveBeenCalled();
    });
  });

  describe("分页功能", () => {
    it("should handle page change", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      // 先选择工作空间
      act(() => {
        result.current.selectWorkspace("7513770152291254324");
      });

      // 切换页码
      await act(async () => {
        result.current.setPage(2);
      });

      expect(result.current.currentPage).toBe(2);
      expect(getMockClient().fetchWorkflows).toHaveBeenCalledWith({
        workspace_id: "7513770152291254324",
        page_num: 2,
        page_size: 20,
      });
    });

    it("should handle page size change", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      // 先选择工作空间
      act(() => {
        result.current.selectWorkspace("7513770152291254324");
      });

      // 切换页面大小
      await act(async () => {
        result.current.setPageSize(10);
      });

      expect(result.current.pageSize).toBe(10);
      expect(result.current.currentPage).toBe(1); // 应该重置到第一页
      expect(getMockClient().fetchWorkflows).toHaveBeenCalledWith({
        workspace_id: "7513770152291254324",
        page_num: 1,
        page_size: 10,
      });
    });
  });

  describe("缓存管理", () => {
    it("should clear cache and reload data", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: false,
          autoLoadWorkflows: false,
        })
      );

      // 先选择工作空间
      act(() => {
        result.current.selectWorkspace("7513770152291254324");
      });

      await act(async () => {
        await result.current.clearCache();
      });

      expect(getMockClient().clearCache).toHaveBeenCalledTimes(1);
      // 注意：由于 autoLoadWorkspaces 和 autoLoadWorkflows 都是 false，
      // 所以不会自动重新加载数据
    });

    it("should clear cache and auto-reload when enabled", async () => {
      const { result } = renderHook(() =>
        useCozeWorkflows({
          autoLoadWorkspaces: true,
          autoLoadWorkflows: true,
          initialWorkspaceId: "7513770152291254324",
        })
      );

      // 等待初始加载完成
      await waitFor(() => {
        expect(getMockClient().fetchWorkspaces).toHaveBeenCalled();
      });

      // 清除 mock 调用记录
      vi.clearAllMocks();
      getMockClient().fetchWorkspaces.mockResolvedValue({
        workspaces: mockWorkspaces,
      });
      getMockClient().fetchWorkflows.mockResolvedValue(mockWorkflowsResult);

      await act(async () => {
        await result.current.clearCache();
      });

      expect(getMockClient().clearCache).toHaveBeenCalledTimes(1);
      expect(getMockClient().fetchWorkspaces).toHaveBeenCalledTimes(1);
      expect(getMockClient().fetchWorkflows).toHaveBeenCalledTimes(1);
    });
  });
});
