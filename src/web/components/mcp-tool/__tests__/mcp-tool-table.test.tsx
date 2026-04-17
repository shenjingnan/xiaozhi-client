/**
 * McpToolTable 组件测试
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpToolTable } from "../mcp-tool-table";

// Mock API client
vi.mock("@/services/api", () => ({
  apiClient: {
    getToolsList: vi.fn(),
    manageMCPTool: vi.fn(),
    addCustomTool: vi.fn(),
    removeCustomTool: vi.fn(),
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { apiClient } from "@/services/api";

const mockTools = [
  {
    name: "server1__tool1",
    description: "测试工具1",
    inputSchema: { type: "object" },
    handler: {
      type: "mcp" as const,
      config: {
        serviceName: "server1",
        toolName: "tool1",
      },
    },
    enabled: true,
    usageCount: 5,
    lastUsedTime: "2024-01-01 00:00:00",
  },
  {
    name: "server1__tool2",
    description: "测试工具2",
    inputSchema: { type: "object" },
    handler: {
      type: "mcp" as const,
      config: {
        serviceName: "server1",
        toolName: "tool2",
      },
    },
    enabled: false,
    usageCount: 0,
    lastUsedTime: "",
  },
];

describe("McpToolTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 API 返回 - 直接返回数组
    vi.mocked(apiClient.getToolsList).mockResolvedValue(mockTools as never);
  });

  describe("组件加载和工具列表获取", () => {
    it("应该显示加载状态", () => {
      vi.mocked(apiClient.getToolsList).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockTools as never), 100);
          })
      );

      render(<McpToolTable initialStatus="all" />);

      // 应该显示加载状态
      expect(screen.getByText(/加载工具列表中/i)).toBeInTheDocument();
    });

    it("加载完成后应该显示工具列表", async () => {
      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        // 使用 getAllByText 因为有多个工具属于同一个服务
        expect(screen.getAllByText("server1").length).toBeGreaterThan(0);
      });
    });

    it("应该根据 initialStatus 正确获取工具", async () => {
      render(<McpToolTable initialStatus="enabled" />);

      await waitFor(() => {
        expect(apiClient.getToolsList).toHaveBeenCalledWith(
          "enabled",
          expect.any(Object)
        );
      });
    });
  });

  describe("搜索功能", () => {
    it("输入搜索关键词应该过滤工具列表", async () => {
      const user = userEvent.setup();
      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        expect(screen.getAllByText("server1").length).toBeGreaterThan(0);
      });

      // 输入搜索关键词
      const searchInput = screen.getByPlaceholderText("搜索服务名、工具名...");
      await user.type(searchInput, "tool1");

      // 应该显示搜索结果提示
      await waitFor(() => {
        expect(screen.getByText(/找到 \d+ 个结果/)).toBeInTheDocument();
      });
    });

    it("清除搜索应该恢复完整列表", async () => {
      const user = userEvent.setup();
      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        expect(screen.getAllByText("server1").length).toBeGreaterThan(0);
      });

      // 输入搜索关键词
      const searchInput = screen.getByPlaceholderText("搜索服务名、工具名...");
      await user.type(searchInput, "tool1");

      // 点击清除按钮
      const clearButton = screen.getByText("清除搜索");
      await user.click(clearButton);

      // 搜索框应该为空
      await waitFor(() => {
        expect(searchInput).toHaveValue("");
      });
    });
  });

  describe("排序功能", () => {
    it("应该显示排序选择器", async () => {
      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        expect(screen.getAllByText("server1").length).toBeGreaterThan(0);
      });

      // 排序选择器应该存在
      const selectTrigger = document.querySelector('[role="combobox"]');
      expect(selectTrigger).toBeInTheDocument();
    });
  });

  describe("分页功能", () => {
    it("工具数量少于每页数量时不显示分页", async () => {
      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        expect(screen.getAllByText("server1").length).toBeGreaterThan(0);
      });

      // 分页容器不应该存在
      const paginationContainer = document.querySelector(".flex.items-end");
      expect(paginationContainer).not.toBeInTheDocument();
    });
  });

  describe("工具启用/禁用功能", () => {
    it("应该显示工具的启用/禁用开关", async () => {
      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        expect(screen.getAllByText("server1").length).toBeGreaterThan(0);
      });

      // 应该有开关控件
      const switches = document.querySelectorAll('[role="switch"]');
      expect(switches.length).toBeGreaterThan(0);
    });
  });

  describe("空状态处理", () => {
    it("没有工具时应该显示空状态提示", async () => {
      vi.mocked(apiClient.getToolsList).mockResolvedValue([] as never);

      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        expect(screen.getByText(/暂无可用工具/i)).toBeInTheDocument();
      });
    });

    it("搜索无结果时应该显示无结果提示", async () => {
      const user = userEvent.setup();

      // 使用有数据的返回
      render(<McpToolTable initialStatus="all" />);

      await waitFor(() => {
        expect(screen.getAllByText("server1").length).toBeGreaterThan(0);
      });

      // 输入不存在的搜索关键词
      const searchInput = screen.getByPlaceholderText("搜索服务名、工具名...");
      await user.type(searchInput, "nonexistenttool123");

      // 应该显示无结果提示
      await waitFor(() => {
        expect(screen.getByText(/没有找到匹配的工具/i)).toBeInTheDocument();
      });
    });
  });
});
