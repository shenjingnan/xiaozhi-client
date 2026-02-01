/**
 * McpServerTable 组件测试
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServerTable } from "../mcp-server-table";

// Mock stores
vi.mock("@/stores/config", () => ({
  useMcpServers: vi.fn(),
  useConfig: vi.fn(() => ({
    mcpServers: {},
    mcpEndpoint: [],
  })),
}));

// Mock WebSocketProvider
vi.mock("@/providers/WebSocketProvider", () => ({
  useNetworkServiceActions: () => ({
    updateConfig: vi.fn(),
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock 按钮组件
vi.mock("../../McpServerSettingButton", () => ({
  McpServerSettingButton: ({ mcpServerName }: { mcpServerName: string }) => (
    <button type="button" data-testid={`setting-${mcpServerName}`}>
      设置
    </button>
  ),
}));

vi.mock("../../RemoveMcpServerButton", () => ({
  RemoveMcpServerButton: ({ mcpServerName }: { mcpServerName: string }) => (
    <button type="button" data-testid={`remove-${mcpServerName}`}>
      删除
    </button>
  ),
}));

vi.mock("../../RestartButton", () => ({
  RestartButton: ({
    variant,
    className,
    defaultText,
  }: {
    variant?: string;
    className?: string;
    defaultText?: string;
  }) => (
    <button
      type="button"
      data-testid="restart-button"
      data-variant={variant}
      className={className}
    >
      {defaultText || "重启"}
    </button>
  ),
}));

import { useMcpServers } from "@/stores/config";

const mockServers = {
  "test-server-1": {
    command: "node",
    args: ["server.js"],
    env: {},
    tools: {
      tool1: { description: "测试工具1" },
      tool2: { description: "测试工具2" },
    },
  },
  "test-server-2": {
    type: "sse" as const,
    url: "https://example.com/sse",
    tools: {
      tool3: { description: "测试工具3" },
    },
  },
  "test-server-3": {
    url: "https://example.com/mcp",
    tools: {},
  },
};

describe("McpServerTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMcpServers).mockReturnValue(mockServers);
  });

  describe("组件加载和服务器列表显示", () => {
    it("应该正确渲染服务器列表", () => {
      render(<McpServerTable />);

      // 应该显示所有服务器名称
      expect(screen.getByText("test-server-1")).toBeInTheDocument();
      expect(screen.getByText("test-server-2")).toBeInTheDocument();
      expect(screen.getByText("test-server-3")).toBeInTheDocument();
    });

    it("应该正确显示通信类型", () => {
      render(<McpServerTable />);

      // 应该显示通信类型 Badge
      expect(screen.getByText("本地进程")).toBeInTheDocument();
      expect(screen.getByText("服务器推送")).toBeInTheDocument();
      expect(screen.getByText("流式 HTTP")).toBeInTheDocument();
    });

    it("应该正确显示工具数量", () => {
      render(<McpServerTable />);

      // test-server-1 有 2 个工具
      const tableCells = screen.getAllByRole("cell");
      const toolCountCell = tableCells.find((cell) => cell.textContent === "2");
      expect(toolCountCell).toBeInTheDocument();
    });

    it("应该显示操作按钮", () => {
      render(<McpServerTable />);

      // 应该有设置、删除、重启按钮
      expect(screen.getByTestId("setting-test-server-1")).toBeInTheDocument();
      expect(screen.getByTestId("remove-test-server-1")).toBeInTheDocument();
      // 每个服务器行都有一个重启按钮
      const restartButtons = screen.getAllByTestId("restart-button");
      expect(restartButtons.length).toBe(3);
    });

    it("没有服务器时应该显示空状态", () => {
      vi.mocked(useMcpServers).mockReturnValue({});

      render(<McpServerTable />);

      expect(screen.getByText(/暂无可用服务器/i)).toBeInTheDocument();
    });
  });

  describe("搜索功能", () => {
    it("输入搜索关键词应该过滤服务器列表", async () => {
      const user = userEvent.setup();
      render(<McpServerTable />);

      // 输入搜索关键词
      const searchInput = screen.getByPlaceholderText("搜索服务器名称、通信类型...");
      await user.type(searchInput, "server-1");

      // 应该显示搜索结果提示
      await waitFor(() => {
        expect(screen.getByText(/找到 1 个结果/)).toBeInTheDocument();
      });

      // 应该只显示匹配的服务器
      expect(screen.getByText("test-server-1")).toBeInTheDocument();
      expect(screen.queryByText("test-server-2")).not.toBeInTheDocument();
    });

    it("按通信类型搜索应该正确过滤", async () => {
      const user = userEvent.setup();
      render(<McpServerTable />);

      // 搜索通信类型
      const searchInput = screen.getByPlaceholderText("搜索服务器名称、通信类型...");
      await user.type(searchInput, "本地进程");

      // 应该显示搜索结果提示
      await waitFor(() => {
        expect(screen.getByText(/找到 \d+ 个结果/)).toBeInTheDocument();
      });

      // 应该只显示 stdio 类型的服务器
      expect(screen.getByText("test-server-1")).toBeInTheDocument();
    });

    it("清除搜索应该恢复完整列表", async () => {
      const user = userEvent.setup();
      render(<McpServerTable />);

      // 输入搜索关键词
      const searchInput = screen.getByPlaceholderText("搜索服务器名称、通信类型...");
      await user.type(searchInput, "server-1");

      await waitFor(() => {
        expect(screen.getByText(/找到 1 个结果/)).toBeInTheDocument();
      });

      // 点击清除按钮
      const clearButton = screen.getByText("清除搜索");
      await user.click(clearButton);

      // 搜索框应该为空
      await waitFor(() => {
        expect(searchInput).toHaveValue("");
      });

      // 应该显示所有服务器
      expect(screen.getByText("test-server-2")).toBeInTheDocument();
    });

    it("搜索无结果时应该显示无结果提示", async () => {
      const user = userEvent.setup();
      render(<McpServerTable />);

      // 输入不存在的搜索关键词
      const searchInput = screen.getByPlaceholderText("搜索服务器名称、通信类型...");
      await user.type(searchInput, "nonexistent-server");

      // 应该显示无结果提示
      await waitFor(() => {
        expect(screen.getByText(/没有找到匹配的服务器/i)).toBeInTheDocument();
      });
    });
  });

  describe("排序功能", () => {
    it("应该显示排序选择器", () => {
      render(<McpServerTable />);

      // 排序选择器应该存在
      const selectTrigger = document.querySelector('[role="combobox"]');
      expect(selectTrigger).toBeInTheDocument();
    });

    it("应该按名称排序服务器", async () => {
      const user = userEvent.setup();
      render(<McpServerTable />);

      // 打开排序选择器
      const selectTrigger = document.querySelector('[role="combobox"]');
      await user.click(selectTrigger!);

      // 点击"按名称排序"
      const options = document.querySelectorAll('[role="option"]');
      await user.click(options[0]!);

      // 应该显示服务器
      expect(screen.getByText("test-server-1")).toBeInTheDocument();
    });

    it("应该按通信类型排序服务器", async () => {
      const user = userEvent.setup();
      render(<McpServerTable />);

      // 打开排序选择器
      const selectTrigger = document.querySelector('[role="combobox"]');
      await user.click(selectTrigger!);

      // 点击"按通信类型排序"
      const options = document.querySelectorAll('[role="option"]');
      await user.click(options[1]!);

      // 应该仍然显示服务器
      expect(screen.getByText("test-server-1")).toBeInTheDocument();
    });

    it("应该按工具数量排序服务器", async () => {
      const user = userEvent.setup();
      render(<McpServerTable />);

      // 打开排序选择器
      const selectTrigger = document.querySelector('[role="combobox"]');
      await user.click(selectTrigger!);

      // 点击"按工具数量排序"
      const options = document.querySelectorAll('[role="option"]');
      await user.click(options[2]!);

      // 应该仍然显示服务器
      expect(screen.getByText("test-server-1")).toBeInTheDocument();
    });
  });

  describe("分页功能", () => {
    it("服务器数量少于每页数量时不显示分页", () => {
      render(<McpServerTable />);

      // 分页容器不应该存在
      const paginationContainer = document.querySelector(".flex.items-end");
      expect(paginationContainer).not.toBeInTheDocument();
    });
  });

  describe("表格结构", () => {
    it("应该正确渲染表格表头", () => {
      render(<McpServerTable />);

      expect(screen.getByText("服务器名称")).toBeInTheDocument();
      expect(screen.getByText("通信类型")).toBeInTheDocument();
      expect(screen.getByText("工具数量")).toBeInTheDocument();
      expect(screen.getByText("操作")).toBeInTheDocument();
    });

    it("应该正确渲染表格行", () => {
      render(<McpServerTable />);

      const tableRows = document.querySelectorAll("tbody tr");
      expect(tableRows.length).toBe(3);
    });
  });
});
