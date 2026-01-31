"use client";

import { ToolDebugDialog } from "@/components/ToolDebugDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api";
import type { CustomMCPToolWithStats } from "@xiaozhi-client/shared-types";
import {
  CoffeeIcon,
  Loader2,
  MinusIcon,
  PlusIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// 服务名称常量
const UNKNOWN_SERVICE_NAME = "未知服务";
const CUSTOM_SERVICE_NAME = "自定义服务";

interface ToolRowData {
  name: string;
  serverName: string;
  toolName: string;
  description: string;
  enabled: boolean;
  usageCount: number;
  lastUsedTime: string;
  inputSchema: any;
}

interface McpToolTableProps {
  initialStatus?: "enabled" | "disabled" | "all";
  showRefreshButton?: boolean;
  className?: string;
  variant?: "default" | "compact";
}

/**
 * 格式化时间显示
 */
function formatTime(timeStr?: string): string {
  if (!timeStr) return "-";

  try {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return `${Math.floor(diffMins / 1440)}天前`;
  } catch {
    return timeStr;
  }
}

/**
 * 截断描述文本
 */
function truncateDescription(text: string, maxLength = 50): string {
  if (!text) return "-";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function McpToolTable({
  initialStatus = "all",
  className,
}: McpToolTableProps) {
  const [tools, setTools] = useState<ToolRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_refreshing, setRefreshing] = useState(false);

  // Coze 工具确认对话框状态
  const [cozeToolToRemove, setCozeToolToRemove] = useState<string | null>(null);

  // 工具调试对话框状态
  const [debugDialog, setDebugDialog] = useState<{
    open: boolean;
    tool?: {
      name: string;
      serverName: string;
      toolName: string;
      description?: string;
      inputSchema?: any;
    };
  }>({ open: false });

  // 格式化工具信息的辅助函数
  const formatTool = useCallback(
    (tool: CustomMCPToolWithStats, enabled: boolean): ToolRowData => {
      const { serviceName, toolName } = (() => {
        if (!tool || !tool.handler) {
          return {
            serviceName: UNKNOWN_SERVICE_NAME,
            toolName: tool?.name || UNKNOWN_SERVICE_NAME,
          };
        }

        if (tool.handler.type === "mcp") {
          return {
            serviceName:
              tool.handler.config?.serviceName || UNKNOWN_SERVICE_NAME,
            toolName: tool.handler.config?.toolName || tool.name,
          };
        }
        if (tool.handler.type === "proxy" && tool.handler.platform === "coze") {
          return {
            serviceName: "customMCP",
            toolName: tool.name,
          };
        }
        return {
          serviceName: CUSTOM_SERVICE_NAME,
          toolName: tool.name,
        };
      })();

      return {
        name: tool.name,
        serverName: serviceName,
        toolName,
        description: tool.description || "",
        enabled,
        usageCount: tool.usageCount || 0,
        lastUsedTime: tool.lastUsedTime || "",
        inputSchema: tool.inputSchema,
      };
    },
    []
  );

  // 获取工具列表
  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [enabledToolsList, disabledToolsList] = await Promise.all([
        apiClient.getToolsList("enabled"),
        apiClient.getToolsList("disabled"),
      ]);

      // 根据初始状态过滤
      let allTools: CustomMCPToolWithStats[] = [];
      if (initialStatus === "enabled" || initialStatus === "all") {
        allTools = [...allTools, ...enabledToolsList];
      }
      if (initialStatus === "disabled" || initialStatus === "all") {
        allTools = [...allTools, ...disabledToolsList];
      }

      // 构建已启用工具的 Set 用于快速查找
      const enabledSet = new Set(enabledToolsList.map((t) => t.name));
      const formattedTools = allTools.map((tool) =>
        formatTool(tool, enabledSet.has(tool.name))
      );
      setTools(formattedTools);
    } catch (err) {
      console.error("获取工具列表失败:", err);
      setError(err instanceof Error ? err.message : "获取工具列表失败");
      toast.error("获取工具列表失败");
    } finally {
      setLoading(false);
    }
  }, [initialStatus, formatTool]);

  // 刷新工具列表（用于启用/禁用后更新）
  const refreshToolLists = useCallback(async () => {
    try {
      const [enabledToolsList, disabledToolsList] = await Promise.all([
        apiClient.getToolsList("enabled"),
        apiClient.getToolsList("disabled"),
      ]);

      let allTools: CustomMCPToolWithStats[] = [];
      if (initialStatus === "enabled" || initialStatus === "all") {
        allTools = [...allTools, ...enabledToolsList];
      }
      if (initialStatus === "disabled" || initialStatus === "all") {
        allTools = [...allTools, ...disabledToolsList];
      }

      const enabledSet = new Set(enabledToolsList.map((t) => t.name));
      const formattedTools = allTools.map((tool) =>
        formatTool(tool, enabledSet.has(tool.name))
      );
      setTools(formattedTools);
    } catch (err) {
      console.error("刷新工具列表失败:", err);
      toast.error("刷新工具列表失败");
    }
  }, [initialStatus, formatTool]);

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTools();
      toast.success("刷新成功");
    } catch {
      toast.error("刷新失败");
    } finally {
      setRefreshing(false);
    }
  }, [fetchTools]);

  // 启用/禁用工具
  const handleToggleTool = useCallback(
    async (name: string, currentEnable: boolean) => {
      try {
        const originalTool = tools.find((tool) => tool.name === name);

        if (!originalTool) {
          toast.error("找不到对应的工具信息");
          return;
        }

        // 检查是否为 Coze 工作流工具
        if (originalTool.serverName === "customMCP") {
          if (currentEnable) {
            // Coze 工作流工具需要确认对话框
            setCozeToolToRemove(name);
            return;
          }
          // 添加 Coze 工作流工具
          await apiClient.addCustomTool(
            {
              workflow_id: "",
              workflow_name: name,
              description: originalTool.description || "",
              icon_url: "",
              app_id: "",
            },
            name,
            originalTool.description || ""
          );
          toast.success(`添加工具 ${name} 成功`);
        } else {
          // 普通 MCP 工具
          const action = currentEnable ? "disable" : "enable";
          await apiClient.manageMCPTool({
            action,
            serverName: originalTool.serverName,
            toolName: originalTool.toolName,
            description: originalTool.description,
          });
          toast.success(`${currentEnable ? "禁用" : "启用"}工具 ${name} 成功`);
        }

        await refreshToolLists();
      } catch (err) {
        console.error("切换工具状态失败:", err);
        toast.error(err instanceof Error ? err.message : "切换工具状态失败");
      }
    },
    [tools, refreshToolLists]
  );

  // 确认移除 Coze 工具
  const handleConfirmRemoveCozeTool = useCallback(async () => {
    if (!cozeToolToRemove) return;

    try {
      await apiClient.removeCustomTool(cozeToolToRemove);
      toast.success(`删除工具 ${cozeToolToRemove} 成功`);
      await refreshToolLists();
    } catch (err) {
      console.error("删除 Coze 工具失败:", err);
      toast.error(err instanceof Error ? err.message : "删除 Coze 工具失败");
    } finally {
      setCozeToolToRemove(null);
    }
  }, [cozeToolToRemove, refreshToolLists]);

  // 取消移除 Coze 工具
  const handleCancelRemoveCozeTool = useCallback(() => {
    setCozeToolToRemove(null);
  }, []);

  // 打开工具调试对话框
  const handleDebugTool = useCallback((tool: ToolRowData) => {
    setDebugDialog({
      open: true,
      tool: {
        name: tool.name,
        serverName: tool.serverName,
        toolName: tool.toolName,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
    });
  }, []);

  // 组件挂载时获取工具列表
  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 表格容器 */}
      <div className="rounded-md border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                加载工具列表中...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-red-500 text-sm">{error}</div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              重试
            </Button>
          </div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CoffeeIcon className="h-12 w-12 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {initialStatus === "enabled"
                ? "没有已启用的工具"
                : initialStatus === "disabled"
                  ? "没有已禁用的工具"
                  : "暂无可用工具"}
            </span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>服务名</TableHead>
                <TableHead>工具名</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="text-right">使用次数</TableHead>
                <TableHead className="text-right">最近使用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => (
                <TableRow key={tool.name}>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-md">
                      {tool.serverName}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{tool.toolName}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {truncateDescription(tool.description)}
                  </TableCell>
                  <TableCell className="text-right">
                    {tool.usageCount}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatTime(tool.lastUsedTime)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDebugTool(tool)}
                        title="调试工具"
                      >
                        <ZapIcon className="h-4 w-4" />
                      </Button>
                      {tool.enabled ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleToggleTool(tool.name, true)}
                          title="禁用工具"
                        >
                          <MinusIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-500 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleToggleTool(tool.name, false)}
                          title="启用工具"
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Coze 工具移除确认对话框 */}
      <AlertDialog
        open={cozeToolToRemove !== null}
        onOpenChange={(open) => !open && setCozeToolToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除 Coze 工作流工具</AlertDialogTitle>
            <AlertDialogDescription>
              移除后需要通过【工作流集成】重新添加并配置入参，确定要移除工具 "
              {cozeToolToRemove}" 吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRemoveCozeTool}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveCozeTool}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 工具调试对话框 */}
      <ToolDebugDialog
        open={debugDialog.open}
        onOpenChange={(open) => setDebugDialog((prev) => ({ ...prev, open }))}
        tool={debugDialog.tool || null}
      />
    </div>
  );
}
