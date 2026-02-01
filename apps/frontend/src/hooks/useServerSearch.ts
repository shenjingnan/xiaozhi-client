import type { ServerRowData } from "@/components/mcp-server/mcp-server-table";
import { useCallback, useMemo, useState } from "react";

interface UseServerSearchResult {
  /** 搜索关键词 */
  searchValue: string;
  /** 设置搜索关键词 */
  setSearchValue: (value: string) => void;
  /** 筛选后的服务器列表 */
  filteredServers: ServerRowData[];
  /** 清除搜索 */
  clearSearch: () => void;
}

/** 通信类型显示名称映射 */
const COMMUNICATION_TYPE_LABELS: Record<
  ServerRowData["communicationType"],
  string
> = {
  stdio: "本地进程",
  sse: "服务器推送",
  "streamable-http": "流式 HTTP",
};

/**
 * 获取通信类型的显示名称
 */
function getCommunicationTypeLabel(
  type: ServerRowData["communicationType"]
): string {
  return COMMUNICATION_TYPE_LABELS[type];
}

/**
 * 服务器搜索状态管理 Hook
 * 提供搜索功能，根据服务器名称和通信类型进行筛选
 */
export function useServerSearch(
  servers: ServerRowData[]
): UseServerSearchResult {
  const [searchValue, setSearchValue] = useState("");

  // 确保 servers 是有效数组
  const safeServers = Array.isArray(servers) ? servers : [];

  // 筛选匹配的服务器
  const filteredServers = useMemo(() => {
    if (!searchValue.trim()) return safeServers;
    const keyword = searchValue.toLowerCase();
    return safeServers.filter((server) => {
      const nameMatch = (server?.name?.toLowerCase() || "").includes(keyword);
      const typeMatch = (
        server?.communicationType?.toLowerCase() || ""
      ).includes(keyword);
      const typeLabelMatch = server?.communicationType
        ? getCommunicationTypeLabel(server.communicationType)
            .toLowerCase()
            .includes(keyword)
        : false;
      return nameMatch || typeMatch || typeLabelMatch;
    });
  }, [safeServers, searchValue]);

  const clearSearch = useCallback(() => {
    setSearchValue("");
  }, []);

  return {
    searchValue,
    setSearchValue,
    filteredServers,
    clearSearch,
  };
}
