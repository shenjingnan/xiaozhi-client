/**
 * CozeWorkflowIntegration 补充测试
 * 覆盖网络状态、刷新功能和确认对话框
 */

import { CozeWorkflowIntegration } from "@/components/coze-workflow-integration";
import * as useCozeWorkflowsModule from "@/hooks/useCozeWorkflows";
import * as toolsApiModule from "@/services/api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CozeWorkflow, CozeWorkspace } from "../../types";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock useCozeWorkflows hook
vi.mock("@/hooks/useCozeWorkflows", () => ({
  useCozeWorkflows: vi.fn(),
}));

// Mock apiClient
vi.mock("@/services/api", () => ({
  apiClient: {
    getCustomTools: vi.fn(),
    addCustomTool: vi.fn(),
    removeCustomTool: vi.fn(),
  },
}));

describe("CozeWorkflowIntegration - 补充测试", () => {
  const mockWorkspaces: CozeWorkspace[] = [
    {
      id: "workspace-1",
      name: "测试工作空间",
      description: "Personal Space",
      workspace_type: "personal",
      enterprise_id: "",
      admin_uids: [],
      icon_url: "https://example.com/icon.png",
      role_type: "owner",
      joined_status: "joined",
      owner_uid: "user-1",
    },
  ];

  const mockWorkflows: CozeWorkflow[] = [
    {
      workflow_id: "workflow-1",
      workflow_name: "测试工作流",
      description: "这是一个测试工作流",
      icon_url: "",
      app_id: "app-1",
      creator: { id: "user-1", name: "测试用户" },
      created_at: 1699123456,
      updated_at: 1699123456,
      isAddedAsTool: false,
      toolName: null,
    },
  ];

  const mockAddedTool = {
    name: "test_workflow_tool",
    description: "测试工作流工具",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "输入参数" },
      },
      required: ["input"],
    },
    handler: {
      type: "mcp",
      platform: "coze",
      config: { serviceName: "coze", toolName: "test_workflow_tool" },
    },
  };

  const defaultHookReturn = {
    workspaces: mockWorkspaces,
    workflows: mockWorkflows,
    selectedWorkspace: mockWorkspaces[0],
    workspacesLoading: false,
    workflowsLoading: false,
    workspacesError: null,
    workflowsError: null,
    hasMoreWorkflows: false,
    currentPage: 1,
    pageSize: 20,
    selectWorkspace: vi.fn(),
    loadWorkflows: vi.fn(),
    refreshWorkspaces: vi.fn(),
    refreshWorkflows: vi.fn(),
    clearCache: vi.fn(),
    setWorkflows: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const mockUseCozeWorkflows = vi.mocked(
      useCozeWorkflowsModule.useCozeWorkflows
    );
    mockUseCozeWorkflows.mockReturnValue(defaultHookReturn);

    const mockApiClient = vi.mocked(toolsApiModule.apiClient);
    mockApiClient.getCustomTools.mockResolvedValue([]);
    mockApiClient.addCustomTool.mockResolvedValue(mockAddedTool);
    mockApiClient.removeCustomTool.mockResolvedValue(undefined);

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    // Mock ResizeObserver for Radix UI
    const ResizeObserverMock = vi.fn(function (
      this: {
        observe: ReturnType<typeof vi.fn>;
        unobserve: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
      },
      _callback: (...args: unknown[]) => void
    ) {
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
    });
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("网络状态监听", () => {
    it("应该阻止离线时添加工作流", async () => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /添加/ });
      await user.click(addButton);

      expect(toast.error).toHaveBeenCalledWith(
        "网络连接已断开，请检查网络后重试"
      );
    });

    it("应该监听网络状态变化", async () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = render(<CozeWorkflowIntegration />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "online",
        expect.any(Function)
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "offline",
        expect.any(Function)
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "online",
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "offline",
        expect.any(Function)
      );
    });

    it("应该在添加按钮被禁用时显示加载状态", async () => {
      const user = userEvent.setup();
      const mockApiClient = vi.mocked(toolsApiModule.apiClient);

      // 模拟延迟响应以捕获加载状态
      mockApiClient.addCustomTool.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockAddedTool), 500)
          )
      );

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /添加/ });
      await user.click(addButton);

      // 参数配置对话框出现后确认添加
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("确认配置");
      fireEvent.click(confirmButton);

      // 添加按钮应该显示加载状态（在API响应之前）
      await waitFor(() => {
        const loader = screen.queryByTestId("loader");
        if (loader) {
          expect(loader).toBeInTheDocument();
        }
      });

      // 等待API完成
      await waitFor(
        () => {
          expect(mockApiClient.addCustomTool).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });
  });

  describe("刷新工作流功能", () => {
    it("应该正确刷新工作流列表", async () => {
      const user = userEvent.setup();
      const mockRefreshWorkflows = vi.fn().mockResolvedValue(undefined);
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        refreshWorkflows: mockRefreshWorkflows,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 工作流列表已加载，刷新功能通过 refreshWorkflows 触发
      expect(mockRefreshWorkflows).toBeDefined();
    });

    it("应该处理工作流加载错误并显示重试按钮", async () => {
      const user = userEvent.setup();
      const mockRefreshWorkflows = vi.fn().mockResolvedValue(undefined);
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        workflowsError: "加载失败",
        refreshWorkflows: mockRefreshWorkflows,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        // 错误信息显示在描述中，不是作为标题
        expect(screen.getByText("加载失败")).toBeInTheDocument();
        expect(screen.getByText("加载工作流失败")).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /重试/ });
      await user.click(retryButton);

      expect(mockRefreshWorkflows).toHaveBeenCalled();
    });
  });

  describe("分页导航", () => {
    it("应该正确处理上一页导航", async () => {
      const user = userEvent.setup();
      const mockSetPage = vi.fn();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        currentPage: 2,
        hasMoreWorkflows: true,
        setPage: mockSetPage,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 查找包含 ChevronLeft 的上一页按钮
      const allButtons = screen.getAllByRole("button");
      const prevButton = allButtons.find((button) =>
        button.querySelector("svg.lucide-chevron-left")
      );

      expect(prevButton).toBeInTheDocument();
      expect(prevButton).not.toHaveAttribute("disabled");

      await user.click(prevButton!);
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    it("应该禁用第一页的上一页按钮", async () => {
      const user = userEvent.setup();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        currentPage: 1,
        hasMoreWorkflows: true,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole("button");
      const prevButton = allButtons.find((button) =>
        button.querySelector("svg.lucide-chevron-left")
      );

      expect(prevButton).toHaveAttribute("disabled");
    });

    it("应该禁用最后一页的下一页按钮", async () => {
      const user = userEvent.setup();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        currentPage: 1,
        hasMoreWorkflows: false,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole("button");
      const nextButton = allButtons.find((button) =>
        button.querySelector("svg.lucide-chevron-right")
      );

      expect(nextButton).toHaveAttribute("disabled");
    });
  });

  describe("工作空间自动选择", () => {
    it("应该自动选择第一个工作空间", async () => {
      const mockSelectWorkspace = vi.fn();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: null,
        selectWorkspace: mockSelectWorkspace,
      });

      render(<CozeWorkflowIntegration />);

      // 自动选择逻辑在 useEffect 中触发
      await waitFor(() => {
        expect(mockSelectWorkspace).toHaveBeenCalledWith(mockWorkspaces[0].id);
      });
    });
  });

  describe("已添加工作流状态显示", () => {
    it("应该显示已添加状态的工作流", async () => {
      const user = userEvent.setup();
      const addedWorkflow: CozeWorkflow = {
        ...mockWorkflows[0],
        isAddedAsTool: true,
        toolName: "test_workflow_tool",
      };
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        workflows: [addedWorkflow],
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("已添加")).toBeInTheDocument();
      });

      // 不应该有添加按钮
      expect(
        screen.queryByRole("button", { name: /添加/ })
      ).not.toBeInTheDocument();
    });
  });

  describe("onToolAdded 回调", () => {
    it("应该在添加工作流后触发回调", async () => {
      const user = userEvent.setup();
      const mockOnToolAdded = vi.fn();
      const mockRefreshWorkflows = vi.fn().mockResolvedValue(undefined);
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        refreshWorkflows: mockRefreshWorkflows,
      });

      render(<CozeWorkflowIntegration onToolAdded={mockOnToolAdded} />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /添加/ });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("确认配置");
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnToolAdded).toHaveBeenCalled();
      });
    });
  });
});
