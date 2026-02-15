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
import { useServerSearch } from "@/hooks/useServerSearch";
import { useServerSortPersistence } from "@/hooks/useServerSortPersistence";
import { useToolPagination } from "@/hooks/useToolPagination";
import { cn } from "@/lib/utils";
import { useMcpServersWithStatus } from "@/stores/config";
import type { MCPServerConfig } from "@xiaozhi-client/shared-types";
import { CoffeeIcon } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { McpServerSettingButton } from "@components/mcp-server-setting-button";
import { RemoveMcpServerButton } from "@components/remove-mcp-server-button";
import { ServerPagination } from "./server-pagination";
import { ServerSearchInput } from "./server-search-input";
import { ServerSortSelector } from "./server-sort-selector";
import { StatusBadge } from "./status-badge";

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
  /** 服务器状态 */
  status?: "connected" | "disconnected" | "connecting" | "error";
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
  toolCount?: number,
  status?: "connected" | "disconnected" | "connecting" | "error"
): ServerRowData {
  return {
    name,
    config,
    communicationType,
    toolCount,
    status,
  };
}

/**
 * 获取通信类型
 */
function getCommunicationType(
  config: MCPServerConfig
): "stdio" | "sse" | "streamable-http" {
  if ("command" in config && typeof config.command === "string") {
    return "stdio";
  }
  if ("type" in config && config.type === "sse") {
    return "sse";
  }
  return "streamable-http";
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
  const { servers, loading, refresh } = useMcpServersWithStatus();

  // 使用持久化排序 Hook
  const { sortConfig, setSortConfig } = useServerSortPersistence();

  // 组件挂载时刷新服务器状态
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 格式化服务器数据
  const serverList = useMemo(() => {
    return servers.map((server) =>
      formatServer(
        server.name,
        server.config,
        getCommunicationType(server.config),
        server.tools.length,
        server.status
      )
    );
  }, [servers]);

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
  const { currentPage, totalPages, paginatedTools, setPage } =
    useToolPagination(filteredServers as unknown as any, 10);

  const paginatedServers = paginatedTools as unknown as ServerRowData[];

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      toast.success("刷新成功");
    } catch {
      toast.error("刷新失败");
    }
  }, [refresh]);

  // 搜索条件变化时重置分页
  // biome-ignore lint/correctness/useExhaustiveDependencies: 需要在搜索值变化时重置分页
  useEffect(() => {
    setPage(1);
  }, [searchValue, setPage]);

  return (
    <div className={cn("flex flex-col gap-4 w-full", className)}>
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
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[120px]">通信类型</TableHead>
                  <TableHead className="w-[100px] text-right">
                    工具数量
                  </TableHead>
                  <TableHead className="w-[220px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedServers.map((server) => (
                  <TableRow key={server.name}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell>
                      {server.status ? (
                        <StatusBadge status={server.status} />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-md">
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
                          disabled={loading}
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
