"use client";

import type {
  ServerSortConfig,
  ServerSortField,
} from "@/components/mcp-server/server-sort-selector";
import { useSortPersistence } from "./useSortPersistence";

/**
 * 服务器排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 */
export function useServerSortPersistence() {
  return useSortPersistence<ServerSortConfig, ServerSortField>({
    storageKey: "mcp-server-sort-config",
    defaultConfig: { field: "name" },
    validFields: ["name", "communicationType", "toolCount"],
    logPrefix: "useServerSortPersistence",
  });
}
