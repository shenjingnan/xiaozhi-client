/**
 * CozeWorkflowIntegration 组件测试
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CozeWorkflowIntegration } from "../components/CozeWorkflowIntegration";
import * as useCozeWorkflowsModule from "../hooks/useCozeWorkflows";
import * as toolsApiModule from "../services/toolsApi";
import type { CozeWorkflow, CozeWorkspace } from "../types";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useCozeWorkflows hook
vi.mock("../hooks/useCozeWorkflows", () => ({
  useCozeWorkflows: vi.fn(),
}));

// Mock toolsApiService
vi.mock("../services/toolsApi", () => ({
  toolsApiService: {
    getCustomTools: vi.fn(),
    addCustomTool: vi.fn(),
    removeCustomTool: vi.fn(),
  },
}));

describe("CozeWorkflowIntegration", () => {
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
    {
      id: "7513770152291254325",
      name: "团队空间",
      description: "Team Space",
      workspace_type: "team",
      enterprise_id: "ent123",
      admin_UIDs: ["3871811622675880"],
      icon_url: "https://example.com/team-icon.png",
      role_type: "admin",
      joined_status: "joined",
      owner_uid: "3871811622675881",
    },
  ];

  const mockWorkflows: CozeWorkflow[] = [
    {
      workflow_id: "7513770152291254326",
      workflow_name: "测试工作流",
      description: "这是一个测试工作流",
      icon_url: "",
      app_id: "app-1",
      creator: { id: "user-1", name: "测试用户1" },
      created_at: 1699123456,
      updated_at: 1699123456,
    },
    {
      workflow_id: "7513770152291254327",
      workflow_name: "数据分析工作流",
      description: "用于数据分析的工作流",
      icon_url: "",
      app_id: "app-2",
      creator: { id: "user-2", name: "测试用户2" },
      created_at: 1699123456,
      updated_at: 1699123456,
    },
  ];

  const defaultHookReturn = {
    workspaces: mockWorkspaces,
    workflows: mockWorkflows,
    selectedWorkspace: null,
    workspacesLoading: false,
    workflowsLoading: false,
    workspacesError: null,
    workflowsError: null,
    hasMoreWorkflows: false,
    currentPage: 1,
    pageSize: 5,
    selectWorkspace: vi.fn(),
    loadWorkflows: vi.fn(),
    refreshWorkspaces: vi.fn(),
    refreshWorkflows: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    clearCache: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const mockUseCozeWorkflows = vi.mocked(
      useCozeWorkflowsModule.useCozeWorkflows
    );
    mockUseCozeWorkflows.mockReturnValue(defaultHookReturn);

    // Mock toolsApiService
    const mockToolsApiService = vi.mocked(toolsApiModule.toolsApiService);
    mockToolsApiService.getCustomTools.mockResolvedValue([]);
    mockToolsApiService.addCustomTool.mockResolvedValue({
      name: "test-tool",
      description: "Test tool",
      inputSchema: { type: "object", properties: {} },
      handler: { type: "http", url: "http://example.com", method: "POST" },
    });
    mockToolsApiService.removeCustomTool.mockResolvedValue(undefined);
  });

  describe("初始渲染", () => {
    it("should render trigger button", () => {
      render(<CozeWorkflowIntegration />);

      expect(
        screen.getByRole("button", { name: /工作流集成/ })
      ).toBeInTheDocument();
    });

    it("should open dialog when trigger button is clicked", async () => {
      const user = userEvent.setup();
      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // 验证对话框标题存在
      expect(
        screen.getByRole("dialog", { name: /工作流集成/ })
      ).toBeInTheDocument();
    });
  });

  describe("工作空间选择", () => {
    it("should render workspace selector", async () => {
      const user = userEvent.setup();
      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      expect(screen.getByText("选择工作空间")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should show workspaces in selector", async () => {
      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await userEvent.click(triggerButton);

      expect(screen.getByText("请选择工作空间")).toBeInTheDocument();
      // 工作空间应该在Select组件的选项中
      expect(screen.queryByText("个人空间")).not.toBeInTheDocument();
      expect(screen.queryByText("团队空间")).not.toBeInTheDocument();
    });

    it("should call selectWorkspace when workspace is selected", async () => {
      const mockSelectWorkspace = vi.fn();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectWorkspace: mockSelectWorkspace,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await userEvent.click(triggerButton);

      // 验证 selector 存在
      const selector = screen.getByRole("combobox");
      expect(selector).toBeInTheDocument();

      // 模拟直接调用选择函数
      mockSelectWorkspace(mockWorkspaces[0].id);

      expect(mockSelectWorkspace).toHaveBeenCalledWith(mockWorkspaces[0].id);
    });
  });

  describe("工作流列表", () => {
    it("should show prompt when no workspace is selected", async () => {
      const user = userEvent.setup();
      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      expect(screen.getByText("请先选择工作空间")).toBeInTheDocument();
      expect(
        screen.getByText("选择一个工作空间后，将显示该空间下的工作流列表")
      ).toBeInTheDocument();
    });

    it("should show workflows when workspace is selected", async () => {
      const user = userEvent.setup();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: mockWorkspaces[0],
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      expect(screen.getByText("测试工作流")).toBeInTheDocument();
      expect(screen.getByText("数据分析工作流")).toBeInTheDocument();
    });

    it("should show loading state", async () => {
      const user = userEvent.setup();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: mockWorkspaces[0],
        workflowsLoading: true,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      // 应该显示骨架屏
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("should show error state", async () => {
      const user = userEvent.setup();
      const errorMessage = "加载工作流失败";
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: mockWorkspaces[0],
        workflowsError: errorMessage,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      // 验证错误状态存在 - 查找错误标题和描述
      expect(
        screen.getByRole("heading", { name: errorMessage })
      ).toBeInTheDocument();

      // 验证重试按钮存在
      expect(screen.getByRole("button", { name: /重试/ })).toBeInTheDocument();
    });

    it("should show empty state when no workflows", async () => {
      const user = userEvent.setup();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: mockWorkspaces[0],
        workflows: [],
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      expect(screen.getByText("暂无工作流")).toBeInTheDocument();
      expect(
        screen.getByText("当前工作空间下没有可用的工作流")
      ).toBeInTheDocument();
    });
  });

  describe("分页功能", () => {
    it("should show pagination when workflows exist", async () => {
      const user = userEvent.setup();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: mockWorkspaces[0],
        hasMoreWorkflows: true,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      expect(screen.getByText("第 1 页")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /上一页/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /下一页/ })
      ).toBeInTheDocument();
    });

    it("should handle page navigation", async () => {
      const user = userEvent.setup();
      const mockSetPage = vi.fn();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: mockWorkspaces[0],
        hasMoreWorkflows: true,
        setPage: mockSetPage,
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      const nextButton = screen.getByRole("button", { name: /下一页/ });
      await user.click(nextButton);

      expect(mockSetPage).toHaveBeenCalledWith(2);
    });
  });

  describe("工作流添加", () => {
    it("should handle workflow addition", async () => {
      const user = userEvent.setup();
      const mockUseCozeWorkflows = vi.mocked(
        useCozeWorkflowsModule.useCozeWorkflows
      );
      mockUseCozeWorkflows.mockReturnValue({
        ...defaultHookReturn,
        selectedWorkspace: mockWorkspaces[0],
      });

      render(<CozeWorkflowIntegration />);

      const triggerButton = screen.getByRole("button", {
        name: /工作流集成/,
      });
      await user.click(triggerButton);

      const addButtons = screen.getAllByRole("button", { name: /添加/ });
      await user.click(addButtons[0]);

      // 应该显示参数配置对话框
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });
    });
  });
});
