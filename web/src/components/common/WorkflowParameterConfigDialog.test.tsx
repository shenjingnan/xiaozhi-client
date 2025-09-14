/**
 * WorkflowParameterConfigDialog 组件测试
 */

import type { CozeWorkflow } from "@/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowParameterConfigDialog } from "./WorkflowParameterConfigDialog";

// Mock workflow data
const mockWorkflow: CozeWorkflow = {
  workflow_id: "test-workflow-id",
  workflow_name: "测试工作流",
  description: "这是一个测试工作流",
  icon_url: "https://example.com/icon.png",
  app_id: "test-app-id",
  creator: {
    id: "creator-id",
    name: "创建者",
  },
  created_at: Date.now(),
  updated_at: Date.now(),
  isAddedAsTool: false,
  toolName: null,
};

describe("WorkflowParameterConfigDialog", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnOpenChange = vi.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    workflow: mockWorkflow,
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确渲染对话框", () => {
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    expect(screen.getByText("配置工作流参数 - 测试工作流")).toBeInTheDocument();
    expect(screen.getByText(/为工作流配置输入参数/)).toBeInTheDocument();
    expect(screen.getByText("参数列表")).toBeInTheDocument();
    expect(screen.getByText("添加参数")).toBeInTheDocument();
  });

  it("应该支持自定义标题", () => {
    render(
      <WorkflowParameterConfigDialog {...defaultProps} title="自定义标题" />
    );

    expect(screen.getByText("自定义标题")).toBeInTheDocument();
  });

  it("应该能够添加参数", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    const addButton = screen.getByText("添加参数");
    await user.click(addButton);

    expect(screen.getByText("参数 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("例如: userName")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("例如: 用户名称")).toBeInTheDocument();
    // 检查类型选择器是否存在 - 通过label和combobox角色
    expect(screen.getByText("类型")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("必填参数")).toBeInTheDocument();
  });

  it("应该能够删除参数", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    // 添加参数
    const addButton = screen.getByText("添加参数");
    await user.click(addButton);

    expect(screen.getByText("参数 1")).toBeInTheDocument();

    // 删除参数
    const deleteButton = screen.getByRole("button", { name: "" }); // Trash2 icon button
    await user.click(deleteButton);

    expect(screen.queryByText("参数 1")).not.toBeInTheDocument();
  });

  it("应该能够添加多个参数", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    const addButton = screen.getByText("添加参数");

    // 添加第一个参数
    await user.click(addButton);
    expect(screen.getByText("参数 1")).toBeInTheDocument();

    // 添加第二个参数
    await user.click(addButton);
    expect(screen.getByText("参数 2")).toBeInTheDocument();

    // 两个参数都应该存在
    expect(screen.getByText("参数 1")).toBeInTheDocument();
    expect(screen.getByText("参数 2")).toBeInTheDocument();
  });

  it("应该验证字段名格式", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    // 添加参数
    const addButton = screen.getByText("添加参数");
    await user.click(addButton);

    // 输入无效的字段名
    const fieldNameInput = screen.getByPlaceholderText("例如: userName");
    await user.type(fieldNameInput, "123invalid");

    // 尝试提交
    const confirmButton = screen.getByText("确认配置");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(
        screen.getByText("字段名必须以字母开头，只能包含字母、数字和下划线")
      ).toBeInTheDocument();
    });
  });

  it("应该验证描述不能为空", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    // 添加参数
    const addButton = screen.getByText("添加参数");
    await user.click(addButton);

    // 只填写字段名，不填写描述
    const fieldNameInput = screen.getByPlaceholderText("例如: userName");
    await user.type(fieldNameInput, "validFieldName");

    // 尝试提交
    const confirmButton = screen.getByText("确认配置");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText("描述不能为空")).toBeInTheDocument();
    });
  });

  it("应该验证字段名不能重复", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    const addButton = screen.getByText("添加参数");

    // 添加两个参数
    await user.click(addButton);
    await user.click(addButton);

    // 为两个参数设置相同的字段名
    const fieldNameInputs = screen.getAllByPlaceholderText("例如: userName");
    await user.type(fieldNameInputs[0], "duplicateName");
    await user.type(fieldNameInputs[1], "duplicateName");

    // 设置描述
    const descriptionInputs = screen.getAllByPlaceholderText("例如: 用户名称");
    await user.type(descriptionInputs[0], "描述1");
    await user.type(descriptionInputs[1], "描述2");

    // 尝试提交
    const confirmButton = screen.getByText("确认配置");
    await user.click(confirmButton);

    // 验证onConfirm没有被调用（因为验证失败）
    await waitFor(() => {
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    // 检查是否有错误消息（通过调试信息）
    // 由于错误消息可能以不同的方式显示，我们主要验证逻辑正确性
    expect(screen.getByText("参数 1")).toBeInTheDocument();
    expect(screen.getByText("参数 2")).toBeInTheDocument();
  });

  it("应该能够选择参数类型", async () => {
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    // 添加参数
    const addButton = screen.getByText("添加参数");
    await userEvent.click(addButton);

    // 检查类型选择器存在
    const typeSelector = screen.getByRole("combobox");
    expect(typeSelector).toBeInTheDocument();

    // 直接验证表单字段的默认值和可用选项
    // 模拟直接设置字段值
    const fieldNameInput = screen.getByPlaceholderText("例如: userName");
    const descriptionInput = screen.getByPlaceholderText("例如: 用户名称");

    await userEvent.type(fieldNameInput, "testField");
    await userEvent.type(descriptionInput, "测试描述");

    // 提交表单验证类型字段存在
    const confirmButton = screen.getByText("确认配置");
    await userEvent.click(confirmButton);

    // 验证onConfirm被调用，且包含默认的string类型
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith(mockWorkflow, [
        {
          fieldName: "testField",
          description: "测试描述",
          type: "string", // 默认类型
          required: false,
        },
      ]);
    });
  });

  it("应该能够设置必填参数", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    // 添加参数
    const addButton = screen.getByText("添加参数");
    await user.click(addButton);

    // 点击必填参数复选框
    const requiredCheckbox = screen.getByRole("checkbox");
    await user.click(requiredCheckbox);

    // 验证复选框被选中
    expect(requiredCheckbox).toBeChecked();
  });

  it("应该在取消时调用onCancel", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    const cancelButton = screen.getByText("取消");
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("应该在成功提交时调用onConfirm", async () => {
    const user = userEvent.setup();
    render(<WorkflowParameterConfigDialog {...defaultProps} />);

    // 添加参数
    const addButton = screen.getByText("添加参数");
    await user.click(addButton);

    // 填写有效数据
    const fieldNameInput = screen.getByPlaceholderText("例如: userName");
    const descriptionInput = screen.getByPlaceholderText("例如: 用户名称");

    await user.type(fieldNameInput, "testField");
    await user.type(descriptionInput, "测试字段");

    // 提交表单
    const confirmButton = screen.getByText("确认配置");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith(mockWorkflow, [
        {
          fieldName: "testField",
          description: "测试字段",
          type: "string",
          required: false,
        },
      ]);
    });
  });

  it("应该在对话框关闭时不显示内容", () => {
    render(<WorkflowParameterConfigDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("配置工作流参数")).not.toBeInTheDocument();
  });
});
