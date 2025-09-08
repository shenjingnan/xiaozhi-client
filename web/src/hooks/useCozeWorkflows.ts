/**
 * 扣子工作流相关的 React Hook
 * 提供工作空间和工作流数据的状态管理
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cozeApiClient } from "../services/cozeApi";
import type {
  CozeUIState,
  CozeWorkflow,
  CozeWorkflowsParams,
  CozeWorkspace,
} from "../types";

/**
 * Hook 返回值类型
 */
export interface UseCozeWorkflowsReturn {
  // 数据状态
  workspaces: CozeWorkspace[];
  workflows: CozeWorkflow[];
  selectedWorkspace: CozeWorkspace | null;

  // UI 状态
  workspacesLoading: boolean;
  workflowsLoading: boolean;
  workspacesError: string | null;
  workflowsError: string | null;
  hasMoreWorkflows: boolean;

  // 操作方法
  selectWorkspace: (workspaceId: string | null) => void;
  loadWorkflows: (params?: Partial<CozeWorkflowsParams>) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  clearCache: () => Promise<void>;

  // 分页相关
  currentPage: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Hook 配置选项
 */
export interface UseCozeWorkflowsOptions {
  /** 是否自动加载工作空间列表 */
  autoLoadWorkspaces?: boolean;
  /** 是否在选择工作空间后自动加载工作流 */
  autoLoadWorkflows?: boolean;
  /** 默认页面大小 */
  defaultPageSize?: number;
  /** 初始选中的工作空间ID */
  initialWorkspaceId?: string;
}

/**
 * 扣子工作流 Hook
 */
export function useCozeWorkflows(
  options: UseCozeWorkflowsOptions = {}
): UseCozeWorkflowsReturn {
  const {
    autoLoadWorkspaces = true,
    autoLoadWorkflows = true,
    defaultPageSize = 20,
    initialWorkspaceId,
  } = options;

  // 数据状态
  const [workspaces, setWorkspaces] = useState<CozeWorkspace[]>([]);
  const [workflows, setWorkflows] = useState<CozeWorkflow[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    initialWorkspaceId || null
  );

  // UI 状态
  const [uiState, setUiState] = useState<CozeUIState>({
    selectedWorkspaceId: initialWorkspaceId || null,
    workspacesLoading: false,
    workflowsLoading: false,
    workspacesError: null,
    workflowsError: null,
  });

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [hasMoreWorkflows, setHasMoreWorkflows] = useState(false);

  // 计算选中的工作空间
  const selectedWorkspace = useMemo(() => {
    return workspaces.find((ws) => ws.id === selectedWorkspaceId) || null;
  }, [workspaces, selectedWorkspaceId]);

  /**
   * 加载工作空间列表
   */
  const loadWorkspaces = useCallback(async () => {
    setUiState((prev) => ({
      ...prev,
      workspacesLoading: true,
      workspacesError: null,
    }));

    try {
      const data = await cozeApiClient.fetchWorkspaces();
      setWorkspaces(data.workspaces);
      setUiState((prev) => ({ ...prev, workspacesLoading: false }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "加载工作空间失败";
      setUiState((prev) => ({
        ...prev,
        workspacesLoading: false,
        workspacesError: errorMessage,
      }));
      console.error("加载工作空间失败:", error);
    }
  }, []);

  /**
   * 加载工作流列表
   */
  const loadWorkflows = useCallback(
    async (params: Partial<CozeWorkflowsParams> = {}) => {
      const workspaceId = params.workspace_id || selectedWorkspaceId;

      if (!workspaceId) {
        console.warn("无法加载工作流：未选择工作空间");
        return;
      }

      setUiState((prev) => ({
        ...prev,
        workflowsLoading: true,
        workflowsError: null,
      }));

      try {
        const requestParams: CozeWorkflowsParams = {
          workspace_id: workspaceId,
          page_num: params.page_num || currentPage,
          page_size: params.page_size || pageSize,
        };

        const result = await cozeApiClient.fetchWorkflows(requestParams);
        setWorkflows(result.items);
        setHasMoreWorkflows(result.hasMore);
        setUiState((prev) => ({ ...prev, workflowsLoading: false }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "加载工作流失败";
        setUiState((prev) => ({
          ...prev,
          workflowsLoading: false,
          workflowsError: errorMessage,
        }));
        console.error("加载工作流失败:", error);
      }
    },
    [selectedWorkspaceId, currentPage, pageSize]
  );

  /**
   * 选择工作空间
   */
  const selectWorkspace = useCallback(
    (workspaceId: string | null) => {
      debugger;
      setSelectedWorkspaceId(workspaceId);
      setUiState((prev) => ({ ...prev, selectedWorkspaceId: workspaceId }));

      // 重置工作流相关状态
      setWorkflows([]);
      setCurrentPage(1);
      setHasMoreWorkflows(false);

      // 如果启用自动加载且选择了工作空间，则加载工作流
      if (autoLoadWorkflows && workspaceId) {
        loadWorkflows({ workspace_id: workspaceId, page_num: 1 });
      }
    },
    [autoLoadWorkflows, loadWorkflows]
  );

  /**
   * 刷新工作空间列表
   */
  const refreshWorkspaces = useCallback(async () => {
    await loadWorkspaces();
  }, [loadWorkspaces]);

  /**
   * 刷新工作流列表
   */
  const refreshWorkflows = useCallback(async () => {
    if (selectedWorkspaceId) {
      await loadWorkflows({
        workspace_id: selectedWorkspaceId,
        page_num: currentPage,
      });
    }
  }, [loadWorkflows, selectedWorkspaceId, currentPage]);

  /**
   * 清除缓存
   */
  const clearCache = useCallback(async () => {
    try {
      await cozeApiClient.clearCache();
      // 清除缓存后重新加载数据
      if (autoLoadWorkspaces) {
        await loadWorkspaces();
      }
      if (autoLoadWorkflows && selectedWorkspaceId) {
        await loadWorkflows({ workspace_id: selectedWorkspaceId, page_num: 1 });
      }
    } catch (error) {
      console.error("清除缓存失败:", error);
      throw error;
    }
  }, [
    autoLoadWorkspaces,
    autoLoadWorkflows,
    selectedWorkspaceId,
    loadWorkspaces,
    loadWorkflows,
  ]);

  /**
   * 设置页码
   */
  const setPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      if (selectedWorkspaceId) {
        loadWorkflows({ workspace_id: selectedWorkspaceId, page_num: page });
      }
    },
    [selectedWorkspaceId, loadWorkflows]
  );

  /**
   * 设置页面大小
   */
  const setPageSizeCallback = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1); // 重置到第一页
      if (selectedWorkspaceId) {
        loadWorkflows({
          workspace_id: selectedWorkspaceId,
          page_num: 1,
          page_size: size,
        });
      }
    },
    [selectedWorkspaceId, loadWorkflows]
  );

  // 初始化加载工作空间
  useEffect(() => {
    if (autoLoadWorkspaces) {
      loadWorkspaces();
    }
  }, [autoLoadWorkspaces, loadWorkspaces]);

  // 当选择工作空间变化时，如果启用自动加载则加载工作流
  useEffect(() => {
    if (autoLoadWorkflows && selectedWorkspaceId) {
      // 直接调用 API 而不是使用 loadWorkflows 回调，避免依赖循环
      const loadInitialWorkflows = async () => {
        setUiState((prev) => ({
          ...prev,
          workflowsLoading: true,
          workflowsError: null,
        }));

        try {
          const requestParams = {
            workspace_id: selectedWorkspaceId,
            page_num: 1,
            page_size: pageSize,
          };

          const result = await cozeApiClient.fetchWorkflows(requestParams);
          setWorkflows(result.items);
          setHasMoreWorkflows(result.hasMore);
          setUiState((prev) => ({ ...prev, workflowsLoading: false }));
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "加载工作流失败";
          setUiState((prev) => ({
            ...prev,
            workflowsLoading: false,
            workflowsError: errorMessage,
          }));
          console.error("加载工作流失败:", error);
        }
      };

      loadInitialWorkflows();
    }
  }, [autoLoadWorkflows, selectedWorkspaceId, pageSize]);

  return {
    // 数据状态
    workspaces,
    workflows,
    selectedWorkspace,

    // UI 状态
    workspacesLoading: uiState.workspacesLoading,
    workflowsLoading: uiState.workflowsLoading,
    workspacesError: uiState.workspacesError,
    workflowsError: uiState.workflowsError,
    hasMoreWorkflows,

    // 操作方法
    selectWorkspace,
    loadWorkflows,
    refreshWorkspaces,
    refreshWorkflows,
    clearCache,

    // 分页相关
    currentPage,
    pageSize,
    setPage,
    setPageSize: setPageSizeCallback,
  };
}
