import type { ToolRowData } from "@/components/mcp-tool/mcp-tool-table";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useToolSearch } from "../useToolSearch";

describe("useToolSearch", () => {
  const mockTools: ToolRowData[] = [
    {
      name: "tool1",
      serverName: "server1",
      toolName: "search",
      description: "搜索功能",
      enabled: true,
      usageCount: 10,
      lastUsedTime: "2024-01-01T00:00:00Z",
      inputSchema: null,
    },
    {
      name: "tool2",
      serverName: "server2",
      toolName: "calculate",
      description: "计算功能",
      enabled: false,
      usageCount: 5,
      lastUsedTime: "2024-01-02T00:00:00Z",
      inputSchema: null,
    },
    {
      name: "tool3",
      serverName: "server1",
      toolName: "translate",
      description: "翻译功能",
      enabled: true,
      usageCount: 3,
      lastUsedTime: "2024-01-03T00:00:00Z",
      inputSchema: null,
    },
  ];

  it("应该返回初始状态", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    expect(result.current.searchValue).toBe("");
    expect(result.current.filteredTools).toEqual(mockTools);
  });

  it("空工具列表应该返回空结果", () => {
    const { result } = renderHook(() => useToolSearch([]));

    expect(result.current.searchValue).toBe("");
    expect(result.current.filteredTools).toEqual([]);
  });

  it("应该根据服务名筛选工具", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    act(() => {
      result.current.setSearchValue("server1");
    });

    expect(result.current.searchValue).toBe("server1");
    expect(result.current.filteredTools).toHaveLength(2);
    expect(result.current.filteredTools[0].serverName).toBe("server1");
    expect(result.current.filteredTools[1].serverName).toBe("server1");
  });

  it("应该根据工具名筛选工具", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    act(() => {
      result.current.setSearchValue("search");
    });

    expect(result.current.searchValue).toBe("search");
    expect(result.current.filteredTools).toHaveLength(1);
    expect(result.current.filteredTools[0].toolName).toBe("search");
  });

  it("应该根据描述筛选工具", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    act(() => {
      result.current.setSearchValue("计算");
    });

    expect(result.current.searchValue).toBe("计算");
    expect(result.current.filteredTools).toHaveLength(1);
    expect(result.current.filteredTools[0].toolName).toBe("calculate");
  });

  it("搜索应该是大小写不敏感的", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    act(() => {
      result.current.setSearchValue("SERVER1");
    });

    expect(result.current.filteredTools).toHaveLength(2);
  });

  it("应该支持部分匹配", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    act(() => {
      result.current.setSearchValue("ser");
    });

    // server1 和 server2 都应该匹配
    expect(result.current.filteredTools).toHaveLength(3);
  });

  it("没有匹配结果时应该返回空数组", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    act(() => {
      result.current.setSearchValue("nonexistent");
    });

    expect(result.current.filteredTools).toEqual([]);
  });

  it("空字符串或仅空白字符应该返回所有工具", () => {
    const { result } = renderHook(() => useToolSearch(mockTools));

    act(() => {
      result.current.setSearchValue("");
    });
    expect(result.current.filteredTools).toEqual(mockTools);

    act(() => {
      result.current.setSearchValue("   ");
    });
    expect(result.current.filteredTools).toEqual(mockTools);
  });

  describe("clearSearch 功能", () => {
    it("应该清除搜索值", () => {
      const { result } = renderHook(() => useToolSearch(mockTools));

      act(() => {
        result.current.setSearchValue("server1");
      });

      expect(result.current.searchValue).toBe("server1");

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.searchValue).toBe("");
      expect(result.current.filteredTools).toEqual(mockTools);
    });
  });

  describe("响应式更新", () => {
    it("工具列表更新后应该重新计算筛选结果", () => {
      const { result, rerender } = renderHook(
        ({ tools }) => useToolSearch(tools),
        { initialProps: { tools: mockTools } }
      );

      act(() => {
        result.current.setSearchValue("server1");
      });

      expect(result.current.filteredTools).toHaveLength(2);

      // 更新工具列表
      const newTools: ToolRowData[] = [
        ...mockTools,
        {
          name: "tool4",
          serverName: "server1",
          toolName: "newTool",
          description: "新工具",
          enabled: true,
          usageCount: 0,
          lastUsedTime: "",
          inputSchema: null,
        },
      ];

      rerender({ tools: newTools });

      expect(result.current.filteredTools).toHaveLength(3);
    });
  });

  describe("边界情况", () => {
    it("应该处理工具列表为 undefined 的情况", () => {
      const { result } = renderHook(() =>
        useToolSearch(undefined as unknown as ToolRowData[])
      );

      // 应该返回空数组而不是抛出错误
      expect(result.current.filteredTools).toEqual([]);
    });

    it("应该处理工具对象字段缺失的情况", () => {
      const incompleteTools = [
        {
          name: "tool1",
          serverName: "",
          toolName: "",
          description: "",
          enabled: true,
          usageCount: 0,
          lastUsedTime: "",
          inputSchema: null,
        },
        {
          name: "tool2",
          serverName: null as unknown as string,
          toolName: null as unknown as string,
          description: null as unknown as string,
          enabled: true,
          usageCount: 0,
          lastUsedTime: "",
          inputSchema: null,
        },
      ] as ToolRowData[];

      const { result } = renderHook(() => useToolSearch(incompleteTools));

      // 不应该抛出错误
      expect(() => {
        act(() => {
          result.current.setSearchValue("test");
        });
      }).not.toThrow();

      // 应该返回空结果（因为无法匹配）
      expect(result.current.filteredTools).toEqual([]);
    });
  });
});
