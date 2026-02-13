"use client";

/**
 * 服务器排序配置持久化 Hook
 *
 * 自动将用户选择的服务器排序方式保存到 localStorage，支持按名称、通信类型、工具数量等字段排序
 */

import type {
  ServerSortConfig,
  ServerSortField,
} from "@/components/mcp-server/server-sort-selector";
import { useSortPersistence } from "@/hooks/useSortPersistence";

/** 有效的排序字段列表 */
const VALID_SORT_FIELDS: ServerSortField[] = [
  "name",
  "communicationType",
  "toolCount",
];

/**
 * 服务器排序配置持久化 Hook
 * 自动将用户选择的排序方式保存到 localStorage
 */
export function useServerSortPersistence() {
  return useSortPersistence<ServerSortConfig>({
    storageKey: "mcp-server-sort-config",
    defaultConfig: { field: "name" },
    validFields: VALID_SORT_FIELDS,
    loggerName: "useServerSortPersistence",
  });
}
