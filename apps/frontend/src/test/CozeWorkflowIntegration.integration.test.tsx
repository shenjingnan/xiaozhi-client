/**
 * CozeWorkflowIntegration 集成测试
 * 测试工作流添加功能的完整流程和API集成
 */

import { CozeWorkflowIntegration } from "@/components/CozeWorkflowIntegration";
import { apiClient } from "@/services/api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CozeWorkflow } from "@xiaozhi-client/shared-types";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  apiClient: {
    addCustomTool: vi.fn(),
    removeCustomTool: vi.fn(),
    getCustomTools: vi.fn(),
  },
}));

vi.mock("@/hooks/useCozeWorkflows", () => ({
  useCozeWorkflows: () => ({
    workspaces: [
      {
        id: "workspace_1",
        name: "测试工作空间",
        workspace_type: "personal",
      },
    ],
    workflows: [mockWorkflow],
    selectedWorkspace: {
      id: "workspace_1",
      name: "测试工作空间",
      workspace_type: "personal",
    },
    workspacesLoading: false,
    workflowsLoading: false,
    workspacesError: null,
    workflowsError: null,
    hasMoreWorkflows: false,
    currentPage: 1,
    selectWorkspace: vi.fn(),
    refreshWorkspaces: vi.fn(),
    refreshWorkflows: vi.fn(),
    setPage: vi.fn(),
    setWorkflows: vi.fn(),
  }),
}));

const mockWorkflow: CozeWorkflow = {
  workflow_id: "123456",
  workflow_name: "测试工作流",
  description: "这是一个测试工作流",
  icon_url: "https://example.com/icon.png",
  app_id: "app_123",
  creator: {
    id: "user_123",
    name: "测试用户",
  },
  created_at: 1699123456,
  updated_at: 1699123456,
  isAddedAsTool: false,
  toolName: null,
};

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
    type: "http",
    url: "https://api.coze.cn/v1/workflow/run",
    method: "POST",
  },
};

describe("CozeWorkflowIntegration - 集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("工作流添加功能", () => {
    it("应该成功添加工作流", async () => {
      // Mock API 成功响应
      vi.mocked(apiClient.addCustomTool).mockResolvedValue(mockAddedTool);
      vi.mocked(apiClient.getCustomTools).mockResolvedValue([]);

      render(<CozeWorkflowIntegration />);

      // 打开对话框
      const triggerButton = screen.getByText("工作流集成");
      fireEvent.click(triggerButton);

      // 等待工作流列表加载
      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加");
      fireEvent.click(addButton);

      // 参数配置对话框应该出现
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      // 添加一个参数以满足表单验证
      const addParamButton = screen.getByText("添加参数");
      fireEvent.click(addParamButton);

      // 填写参数字段
      const fieldNameInput = screen.getByPlaceholderText("例如: userName");
      const descriptionInput = screen.getByPlaceholderText("例如: 用户名称");

      await fireEvent.change(fieldNameInput, {
        target: { value: "testParam" },
      });
      await fireEvent.change(descriptionInput, {
        target: { value: "测试参数" },
      });

      // 点击确认配置
      const confirmConfigButton = screen.getByText("确认配置");
      fireEvent.click(confirmConfigButton);

      // 验证API调用
      await waitFor(() => {
        expect(apiClient.addCustomTool).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "coze",
            data: expect.objectContaining({
              workflow: mockWorkflow,
              customName: undefined,
              customDescription: undefined,
              parameterConfig: expect.objectContaining({
                parameters: expect.arrayContaining([
                  expect.objectContaining({
                    fieldName: "testParam",
                    description: "测试参数",
                    type: "string",
                    required: false,
                  }),
                ]),
              }),
            }),
          })
        );
      });

      // 验证成功提示
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("已添加工作流")
        );
      });
    });

    it("应该处理添加工作流失败的情况", async () => {
      // Mock API 失败响应
      vi.mocked(apiClient.addCustomTool).mockRejectedValue(
        new Error("工具名称已存在")
      );
      vi.mocked(apiClient.getCustomTools).mockResolvedValue([]);

      render(<CozeWorkflowIntegration />);

      // 打开对话框
      const triggerButton = screen.getByText("工作流集成");
      fireEvent.click(triggerButton);

      // 等待工作流列表加载
      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加");
      fireEvent.click(addButton);

      // 参数配置对话框应该出现
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      // 添加一个参数以满足表单验证
      const addParamButton = screen.getByText("添加参数");
      fireEvent.click(addParamButton);

      // 填写参数字段
      const fieldNameInput = screen.getByPlaceholderText("例如: userName");
      const descriptionInput = screen.getByPlaceholderText("例如: 用户名称");

      await fireEvent.change(fieldNameInput, {
        target: { value: "testParam" },
      });
      await fireEvent.change(descriptionInput, {
        target: { value: "测试参数" },
      });

      // 点击确认配置，触发API调用
      const confirmConfigButton = screen.getByText("确认配置");
      fireEvent.click(confirmConfigButton);

      // 验证错误提示
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("已存在")
        );
      });
    });
  });

  describe("用户体验", () => {
    it("应该显示加载状态", async () => {
      vi.mocked(apiClient.addCustomTool).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockAddedTool), 500)
          )
      );
      vi.mocked(apiClient.getCustomTools).mockResolvedValue([]);

      render(<CozeWorkflowIntegration />);

      // 打开对话框
      const triggerButton = screen.getByText("工作流集成");
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 点击添加并确认配置
      const addButton = screen.getByText("添加");
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      const confirmConfigButton = screen.getByText("确认配置");
      fireEvent.click(confirmConfigButton);

      // 验证加载状态（在添加按钮上）
      await waitFor(() => {
        const loader = screen.getByTestId("loader");
        expect(loader).toBeInTheDocument();
        // 验证加载器确实在添加按钮内
        const addButton = screen
          .getAllByText("添加")
          .find((button) => button.closest("button")?.contains(loader));
        expect(addButton).toBeDefined();
      });
    });

    it("应该正确显示参数配置对话框内容", async () => {
      vi.mocked(apiClient.getCustomTools).mockResolvedValue([]);

      render(<CozeWorkflowIntegration />);

      // 打开对话框
      const triggerButton = screen.getByText("工作流集成");
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加");
      fireEvent.click(addButton);

      // 验证参数配置对话框内容
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
        expect(screen.getByText(/为工作流配置输入参数/)).toBeInTheDocument();
        expect(
          screen.getByText(mockWorkflow.workflow_name)
        ).toBeInTheDocument();
      });
    });
  });
});
