/**
 * CozeWorkflowIntegration 参数配置功能集成测试
 * 测试第三阶段新增的参数配置功能集成
 */

import { CozeWorkflowIntegration } from "@/components/coze-workflow-integration";
import * as toolsApiModule from "@/services/api";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as sonner from "sonner";
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
    getCustomTools: vi.fn(),
    addCustomTool: vi.fn(),
    removeCustomTool: vi.fn(),
  },
}));

vi.mock("@/hooks/useCozeWorkflows", () => ({
  useCozeWorkflows: () => ({
    workspaces: [
      {
        id: "workspace-1",
        name: "测试工作空间",
        workspace_type: "personal",
      },
    ],
    workflows: [
      {
        workflow_id: "workflow-1",
        workflow_name: "测试工作流",
        description: "这是一个测试工作流",
        icon_url: "https://example.com/icon.png",
        app_id: "app-1",
        creator: { id: "creator-1", name: "创建者" },
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ],
    selectedWorkspace: {
      id: "workspace-1",
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

describe("CozeWorkflowIntegration - 参数配置功能", () => {
  const mockAddedTool = {
    name: "test_workflow_tool",
    description: "测试工作流工具",
    inputSchema: {
      type: "object",
      properties: {
        userName: { type: "string", description: "用户名称" },
        age: { type: "number", description: "用户年龄" },
      },
      required: ["userName"],
    },
    handler: {
      type: "mcp",
      platform: "coze",
      config: { serviceName: "coze", toolName: "test_workflow_tool" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const mockApiClient = vi.mocked(toolsApiModule.apiClient);
    mockApiClient.getCustomTools.mockResolvedValue([]);

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("参数配置对话框集成", () => {
    it("应该在点击添加按钮时显示参数配置对话框", async () => {
      const user = userEvent.setup();
      render(<CozeWorkflowIntegration />);

      // 打开工作流集成对话框
      const triggerButton = screen.getByText("工作流集成");
      await user.click(triggerButton);

      // 等待工作流列表加载
      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加");
      await user.click(addButton);

      // 参数配置对话框应该出现
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      // 应该显示工作流信息
      expect(screen.getByText("测试工作流")).toBeInTheDocument();
      expect(screen.getByText("这是一个测试工作流")).toBeInTheDocument();
    });

    it("应该支持添加参数并提交", async () => {
      const user = userEvent.setup();
      const mockApiClient = vi.mocked(toolsApiModule.apiClient);
      mockApiClient.addCustomTool.mockResolvedValue(mockAddedTool);

      render(<CozeWorkflowIntegration />);

      // 打开工作流集成对话框
      const triggerButton = screen.getByText("工作流集成");
      await user.click(triggerButton);

      // 点击添加按钮
      const addButton = screen.getByText("添加");
      await user.click(addButton);

      // 等待参数配置对话框出现
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      // 添加第一个参数
      const addParamButton = screen.getByText("添加参数");
      await user.click(addParamButton);

      // 填写参数信息
      const fieldNameInput = screen.getByPlaceholderText("例如: userName");
      const descriptionInput = screen.getByPlaceholderText("例如: 用户名称");

      await user.type(fieldNameInput, "userName");
      await user.type(descriptionInput, "用户名称");

      // 设置为必填
      const requiredCheckbox = screen.getByRole("checkbox");
      await user.click(requiredCheckbox);

      // 确认添加
      const confirmButton = screen.getByText("确认配置");
      await user.click(confirmButton);

      // 验证API调用
      await waitFor(() => {
        expect(mockApiClient.addCustomTool).toHaveBeenCalledWith({
          type: "coze",
          data: {
            workflow: expect.objectContaining({
              workflow_id: "workflow-1",
              workflow_name: "测试工作流",
              description: "这是一个测试工作流",
              icon_url: "https://example.com/icon.png",
              app_id: "app-1",
              creator: { id: "creator-1", name: "创建者" },
            }),
            customName: undefined,
            customDescription: undefined,
            parameterConfig: {
              parameters: [
                {
                  fieldName: "userName",
                  description: "用户名称",
                  type: "string",
                  required: true,
                },
              ],
            },
          },
        });
      });

      // 验证成功提示
      expect(sonner.toast.success).toHaveBeenCalledWith(
        expect.stringContaining("已添加工作流")
      );
    });

    it("应该支持不配置参数直接添加", async () => {
      const user = userEvent.setup();
      const mockApiClient = vi.mocked(toolsApiModule.apiClient);
      mockApiClient.addCustomTool.mockResolvedValue(mockAddedTool);

      render(<CozeWorkflowIntegration />);

      // 打开工作流集成对话框
      const triggerButton = screen.getByText("工作流集成");
      await user.click(triggerButton);

      // 点击添加按钮
      const addButton = screen.getByText("添加");
      await user.click(addButton);

      // 等待参数配置对话框出现
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      // 直接确认添加（不添加参数）
      const confirmButton = screen.getByText("确认配置");
      await user.click(confirmButton);

      // 验证API调用（不传递参数配置）
      await waitFor(() => {
        expect(mockApiClient.addCustomTool).toHaveBeenCalledWith({
          type: "coze",
          data: {
            workflow: expect.objectContaining({
              workflow_id: "workflow-1",
              workflow_name: "测试工作流",
              description: "这是一个测试工作流",
              icon_url: "https://example.com/icon.png",
              app_id: "app-1",
              creator: { id: "creator-1", name: "创建者" },
            }),
            customName: undefined,
            customDescription: undefined,
            parameterConfig: undefined,
          },
        });
      });
    });

    it("应该支持取消参数配置", async () => {
      const user = userEvent.setup();
      const mockApiClient = vi.mocked(toolsApiModule.apiClient);
      render(<CozeWorkflowIntegration />);

      // 打开工作流集成对话框
      const triggerButton = screen.getByText("工作流集成");
      await user.click(triggerButton);

      // 点击添加按钮
      const addButton = screen.getByText("添加");
      await user.click(addButton);

      // 等待参数配置对话框出现
      await waitFor(() => {
        expect(screen.getByText("配置工作流参数")).toBeInTheDocument();
      });

      // 点击取消
      const cancelButton = screen.getByText("取消");
      await user.click(cancelButton);

      // 对话框应该关闭
      await waitFor(() => {
        expect(screen.queryByText("配置工作流参数")).not.toBeInTheDocument();
      });

      // API不应该被调用
      expect(mockApiClient.addCustomTool).not.toHaveBeenCalled();
    });
  });
});
