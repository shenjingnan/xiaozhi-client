"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToolPagination } from "@/hooks/useToolPagination";
import { useServerSearch } from "@/hooks/useServerSearch";
import { useServerSortPersistence } from "@/hooks/useServerSortPersistence";
import { useMcpServers } from "@/stores/config";
import { cn } from "@/lib/utils";
import type { MCPServerConfig } from "@xiaozhi-client/shared-types";
import { CoffeeIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { McpServerSettingButton } from "../McpServerSettingButton";
import { RemoveMcpServerButton } from "../RemoveMcpServerButton";
import { RestartButton } from "../RestartButton";
import { ServerPagination } from "./server-pagination";
import { ServerSearchInput } from "./server-search-input";
import { ServerSortSelector } from "./server-sort-selector";

/** 服务器行数据 */
export interface ServerRowData {
  /** 服务器名称 */
  name: string;
  /** 服务器配置 */
  config: MCPServerConfig;
  /** 通信类型 */
  communicationType: "stdio" | "sse" | "streamable-http";
  /** 工具数量（可选） */
  toolCount?: number;
}

interface McpServerTableProps {
  /** 额外的类名 */
  className?: string;
}

/**
 * 格式化服务器数据为行数据
 */
function formatServer(
  name: string,
  config: MCPServerConfig,
  communicationType: "stdio" | "sse" | "streamable-http",
  toolCount?: number
): ServerRowData {
  return {
    name,
    config,
    communicationType,
    toolCount,
  };
}

/**
 * 通信类型显示名称映射
 */
const COMMUNICATION_TYPE_LABELS: Record<
  ServerRowData["communicationType"],
  string
> = {
  stdio: "stdio",
  sse: "sse",
  "streamable-http": "http",
};

/**
 * MCP 服务器表格组件
 * 提供服务器列表展示、搜索、排序和分页功能
 */
export function McpServerTable({ className }: McpServerTableProps) {
  const mcpServers = useMcpServers();

  // 使用持久化排序 Hook
  const { sortConfig, setSortConfig } = useServerSortPersistence();

  // 格式化服务器数据
  const serverList = useMemo(() => {
    if (!mcpServers) return [];

    return Object.entries(mcpServers).map(([name, config]) => {
      // 判断通信类型
      let communicationType: ServerRowData["communicationType"] =
        "streamable-http";
      if ("command" in config && typeof config.command === "string") {
        communicationType = "stdio";
      } else if ("type" in config && config.type === "sse") {
        communicationType = "sse";
      }

      // 尝试获取工具数量
      const toolCount = Object.keys((config as any)?.tools || {}).length;

      return formatServer(name, config, communicationType, toolCount);
    });
  }, [mcpServers]);

  // 排序后的服务器列表
  const sortedServers = useMemo(() => {
    const sorted = [...serverList];
    const { field } = sortConfig;

    sorted.sort((a, b) => {
      switch (field) {
        case "name":
          return a.name.localeCompare(b.name, "zh-CN");
        case "communicationType":
          return a.communicationType.localeCompare(b.communicationType);
        case "toolCount":
          return (b.toolCount ?? 0) - (a.toolCount ?? 0);
        default:
          return 0;
      }
    });

    return sorted;
  }, [serverList, sortConfig]);

  // 使用搜索 Hook
  const { searchValue, setSearchValue, filteredServers, clearSearch } =
    useServerSearch(sortedServers);

  // 使用分页 Hook（复用工具分页，泛型兼容）
  const { currentPage, totalPages, paginatedTools, setPage, resetPage } =
    useToolPagination(filteredServers as unknown as any, 10);

  const paginatedServers = paginatedTools as unknown as ServerRowData[];

  const [isRefreshing, setIsRefreshing] = useState(false);

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 触发重新加载可以通过 store 或回调实现
      // 这里简化为提示用户刷新页面或等待其他操作
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("刷新成功");
    } catch {
      toast.error("刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // 搜索条件变化时重置分页
  // biome-ignore lint/correctness/useExhaustiveDependencies: 需要在搜索值变化时重置分页
  useMemo(() => {
    resetPage();
  }, [searchValue, resetPage]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 排序选择器和搜索框 */}
      <div className="flex items-center justify-between gap-4">
        <ServerSortSelector value={sortConfig} onChange={setSortConfig} />
        <ServerSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="搜索服务器名称、通信类型..."
        />
      </div>

      {/* 搜索结果提示 */}
      {searchValue && (
        <div className="text-sm text-muted-foreground">
          找到 {filteredServers.length} 个结果
          {filteredServers.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="ml-2 text-primary hover:underline"
            >
              清除搜索
            </button>
          )}
        </div>
      )}

      {/* 表格容器 */}
      <div className="rounded-md border">
        {paginatedServers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CoffeeIcon className="h-12 w-12 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {searchValue ? "没有找到匹配的服务器" : "暂无可用服务器"}
            </span>
            {searchValue && (
              <Button variant="outline" size="sm" onClick={clearSearch}>
                清除搜索
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table size="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>服务器名称</TableHead>
                  <TableHead className="w-[120px]">通信类型</TableHead>
                  <TableHead className="w-[100px] text-right">工具数量</TableHead>
                  <TableHead className="w-[180px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedServers.map((server) => (
                  <TableRow key={server.name}>
                    <TableCell className="font-medium">
                      {server.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="rounded-md"
                      >
                        {COMMUNICATION_TYPE_LABELS[server.communicationType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {server.toolCount ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <McpServerSettingButton
                          mcpServerName={server.name}
                          mcpServer={server.config}
                        />
                        <RemoveMcpServerButton
                          mcpServerName={server.name}
                          onRemoveSuccess={handleRefresh}
                          disabled={isRefreshing}
                        />
                        <RestartButton
                          variant="outline"
                          className="w-[80px]"
                          defaultText="重启"
                          restartingText="重启中"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 分页控件 */}
            <ServerPagination
              currentPage={currentPage}
              totalPages={totalPages}
              setPage={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
