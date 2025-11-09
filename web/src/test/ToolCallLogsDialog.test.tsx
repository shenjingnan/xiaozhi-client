import { ToolCallLogsDialog } from "@/components/ToolCallLogsDialog";
import type { ToolCallRecord } from "@/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch
global.fetch = vi.fn();

// Mock formatUtils
vi.mock("@/utils/formatUtils", () => ({
  formatTimestamp: vi.fn((timestamp) =>
    timestamp ? "2024-01-01 12:00:00" : "未知时间"
  ),
  formatDuration: vi.fn((duration) => (duration ? "100ms" : "-")),
  formatJson: vi.fn((data) => JSON.stringify(data, null, 2)),
  generateStableKey: vi.fn((log, index) => `${log.toolName}-${index}`),
}));

describe("ToolCallLogsDialog", () => {
  const mockLogs: ToolCallRecord[] = [
    {
      toolName: "test_tool",
      serverName: "test_server",
      success: true,
      duration: 100,
      timestamp: 1704067200000,
      arguments: { param1: "value1" },
      result: { output: "success" },
    },
    {
      toolName: "failed_tool",
      serverName: "test_server",
      success: false,
      duration: 200,
      timestamp: 1704067260000,
      arguments: { param1: "value2" },
      error: "Tool execution failed",
    },
  ];

  const mockSuccessResponse = {
    success: true,
    data: {
      records: mockLogs,
      total: 2,
      hasMore: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockSuccessResponse),
    });
  });

  it("应该正确渲染触发按钮", () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    expect(triggerButton).toBeInTheDocument();
    expect(triggerButton).toHaveClass("gap-2");
  });

  it("点击按钮应该打开对话框", async () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("MCP 工具调用日志")).toBeInTheDocument();
    });
  });

  it("打开对话框时应该自动加载日志", async () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tool-calls/logs?limit=50");
    });
  });

  it("应该正确显示加载状态", async () => {
    // 让fetch延迟返回以显示加载状态
    (fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                json: vi.fn().mockResolvedValue(mockSuccessResponse),
              }),
            100
          )
        )
    );

    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    // 检查加载状态
    expect(screen.getByText("正在加载日志数据")).toBeInTheDocument();
    expect(screen.getByText("请稍候片刻...")).toBeInTheDocument();
  });

  it("应该正确显示加载的日志数据", async () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("test_tool")).toBeInTheDocument();
      expect(screen.getByText("test_server")).toBeInTheDocument();
      expect(screen.getByText("成功")).toBeInTheDocument();
    });
  });

  it("应该正确显示总记录数", async () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("(共 2 条记录)")).toBeInTheDocument();
    });
  });

  it("应该正确处理错误状态", async () => {
    const mockErrorResponse = {
      success: false,
      error: {
        code: "FETCH_ERROR",
        message: "网络连接失败",
      },
    };

    (fetch as any).mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockErrorResponse),
    });

    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("加载失败")).toBeInTheDocument();
      expect(screen.getByText("网络连接失败")).toBeInTheDocument();
    });
  });

  it("应该正确处理空数据状态", async () => {
    const mockEmptyResponse = {
      success: true,
      data: {
        records: [],
        total: 0,
        hasMore: false,
      },
    };

    (fetch as any).mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockEmptyResponse),
    });

    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("暂无工具调用记录")).toBeInTheDocument();
      expect(
        screen.getByText(/当前还没有任何工具调用记录/)
      ).toBeInTheDocument();
    });
  });

  it("刷新按钮应该正常工作", async () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("刷新")).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: /刷新/ });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2); // 一次是初始加载，一次是刷新
    });
  });

  it("应该正确处理鼠标悬停事件", async () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("test_tool")).toBeInTheDocument();
    });

    // 找到包含test_tool的行
    const toolNameCell = screen.getByText("test_tool");
    const tableRow = toolNameCell.closest("tr");

    if (tableRow) {
      fireEvent.mouseEnter(tableRow);

      // 检查详情面板是否出现
      await waitFor(() => {
        expect(screen.getByText("入参")).toBeInTheDocument();
        expect(screen.getByText("出参")).toBeInTheDocument();
        expect(screen.getByText("原始数据")).toBeInTheDocument();
      });
    }
  });

  it("应该正确关闭对话框", async () => {
    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("MCP 工具调用日志")).toBeInTheDocument();
    });

    // 模拟按ESC键关闭对话框
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("MCP 工具调用日志")).not.toBeInTheDocument();
    });
  });

  it("重试按钮应该在错误状态下正常工作", async () => {
    (fetch as any)
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          success: false,
          error: {
            code: "FETCH_ERROR",
            message: "网络连接失败",
          },
        }),
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue(mockSuccessResponse),
      });

    render(<ToolCallLogsDialog />);

    const triggerButton = screen.getByRole("button", { name: /调用日志/ });
    fireEvent.click(triggerButton);

    // 等待错误状态显示
    await waitFor(() => {
      expect(screen.getByText("加载失败")).toBeInTheDocument();
    });

    // 点击重试按钮
    const retryButton = screen.getByRole("button", { name: /重试加载/ });
    fireEvent.click(retryButton);

    // 等待数据加载成功
    await waitFor(() => {
      expect(screen.getByText("test_tool")).toBeInTheDocument();
    });
  });
});
