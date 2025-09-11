/**
 * CozeWorkflowIntegration 集成测试
 * 测试工作流添加功能的完整流程和API集成
 */

import { CozeWorkflowIntegration } from "@/components/CozeWorkflowIntegration";
import { toolsApiService } from "@/services/toolsApi";
import type { CozeWorkflow } from "@/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/services/toolsApi", () => ({
  toolsApiService: {
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
      vi.mocked(toolsApiService.addCustomTool).mockResolvedValue(mockAddedTool);
      vi.mocked(toolsApiService.getCustomTools).mockResolvedValue([]);

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

      // 确认对话框应该出现
      await waitFor(() => {
        expect(screen.getByText("确认添加工作流")).toBeInTheDocument();
      });

      // 点击确认添加
      const confirmButton = screen.getByRole("button", { name: "添加" });
      fireEvent.click(confirmButton);

      // 验证API调用
      await waitFor(() => {
        expect(toolsApiService.addCustomTool).toHaveBeenCalledWith(
          mockWorkflow
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
      vi.mocked(toolsApiService.addCustomTool).mockRejectedValue(
        new Error("工具名称已存在")
      );
      vi.mocked(toolsApiService.getCustomTools).mockResolvedValue([]);

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

      // 确认对话框应该出现
      await waitFor(() => {
        expect(screen.getByText("确认添加工作流")).toBeInTheDocument();
      });

      // 点击确认添加
      const confirmButton = screen.getByRole("button", { name: "添加" });
      fireEvent.click(confirmButton);

      // 验证错误提示
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("已存在")
        );
      });
    });

    it("应该在网络断开时阻止添加操作", async () => {
      // Mock 网络断开
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

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

      // 验证网络错误提示
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("网络连接已断开")
        );
      });

      // 确认对话框不应该出现
      expect(screen.queryByText("确认添加工作流")).not.toBeInTheDocument();
    });

    it("应该防止重复提交", async () => {
      vi.mocked(toolsApiService.addCustomTool).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockAddedTool), 1000)
          )
      );
      vi.mocked(toolsApiService.getCustomTools).mockResolvedValue([]);

      render(<CozeWorkflowIntegration />);

      // 打开对话框
      const triggerButton = screen.getByText("工作流集成");
      fireEvent.click(triggerButton);

      // 等待工作流列表加载
      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 第一次点击添加
      const addButton = screen.getByText("添加");
      fireEvent.click(addButton);

      // 确认添加
      await waitFor(() => {
        expect(screen.getByText("确认添加工作流")).toBeInTheDocument();
      });
      const confirmButton = screen.getByRole("button", { name: "添加" });
      fireEvent.click(confirmButton);

      // 立即再次尝试添加同一个工作流
      fireEvent.click(addButton);

      // 验证重复操作警告
      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith(
          expect.stringContaining("正在添加中")
        );
      });
    });
  });

  describe("错误处理", () => {
    it("应该处理各种API错误", async () => {
      const errorCases = [
        {
          error: new Error("HTTP 400: 请求参数错误"),
          expectedMessage: "请求参数错误",
        },
        { error: new Error("HTTP 401: 认证失败"), expectedMessage: "认证失败" },
        { error: new Error("HTTP 409: 资源冲突"), expectedMessage: "已存在" },
        {
          error: new Error("HTTP 500: 服务器内部错误"),
          expectedMessage: "服务器内部错误",
        },
      ];

      for (const { error, expectedMessage } of errorCases) {
        vi.clearAllMocks();
        vi.mocked(toolsApiService.addCustomTool).mockRejectedValue(error);
        vi.mocked(toolsApiService.getCustomTools).mockResolvedValue([]);

        render(<CozeWorkflowIntegration />);

        // 打开对话框并添加工作流
        const triggerButton = screen.getByText("工作流集成");
        fireEvent.click(triggerButton);

        await waitFor(() => {
          expect(screen.getByText("测试工作流")).toBeInTheDocument();
        });

        const addButton = screen.getByText("添加");
        fireEvent.click(addButton);

        await waitFor(() => {
          expect(screen.getByText("确认添加工作流")).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole("button", { name: "添加" });
        fireEvent.click(confirmButton);

        // 验证错误处理
        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith(
            expect.stringContaining(expectedMessage)
          );
        });
      }
    });
  });

  describe("用户体验", () => {
    it("应该显示加载状态", async () => {
      vi.mocked(toolsApiService.addCustomTool).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockAddedTool), 500)
          )
      );
      vi.mocked(toolsApiService.getCustomTools).mockResolvedValue([]);

      render(<CozeWorkflowIntegration />);

      // 打开对话框
      const triggerButton = screen.getByText("工作流集成");
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("测试工作流")).toBeInTheDocument();
      });

      // 点击添加并确认
      const addButton = screen.getByText("添加");
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("确认添加工作流")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: "添加" });
      fireEvent.click(confirmButton);

      // 验证加载状态
      await waitFor(() => {
        expect(screen.getByTestId("loader")).toBeInTheDocument();
      });
    });

    it("应该正确显示确认对话框内容", async () => {
      vi.mocked(toolsApiService.getCustomTools).mockResolvedValue([]);

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

      // 验证确认对话框内容
      await waitFor(() => {
        expect(screen.getByText("确认添加工作流")).toBeInTheDocument();
        expect(
          screen.getByText(/确定要将工作流.*测试工作流.*添加为 MCP 工具吗/)
        ).toBeInTheDocument();
      });
    });
  });
});
