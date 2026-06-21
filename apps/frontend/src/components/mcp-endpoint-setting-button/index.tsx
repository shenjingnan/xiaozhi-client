import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { webSocketManager } from "@/services/websocket";
import { useConfig, useMcpEndpoint } from "@/stores/config";
import { PlusIcon, SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useEndpointState, useEndpointOperations } from "./hooks";
import { AddEndpointDialog } from "./AddEndpointDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { EndpointList } from "./EndpointList";
import type { EndpointState } from "./types";

/**
 * McpEndpointSettingButton 组件
 * 用于管理小智服务端接入点的设置按钮
 */
export function McpEndpointSettingButton() {
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pendingDeleteEndpoint, setPendingDeleteEndpoint] = useState<string | null>(null);

  const config = useConfig();
  const mcpEndpoint = useMcpEndpoint();

  // 接入点状态管理
  const { endpointStates, updateEndpointState, removeEndpointState } =
    useEndpointState(
      open,
      useMemo(() => {
        let list: string[] = [];
        if (Array.isArray(mcpEndpoint)) list = mcpEndpoint;
        if (typeof mcpEndpoint === "string" && mcpEndpoint.length) {
          list.push(mcpEndpoint);
        }
        // 过滤掉空字符串
        return list.filter((endpoint) => endpoint.length > 0);
      }, [mcpEndpoint])
    );

  // 接入点操作
  const {
    handleConnect,
    handleDisconnect,
    handleCopy,
    handleDeleteEndpoint,
    handleAddEndpoint,
  } = useEndpointOperations(updateEndpointState, removeEndpointState);

  // 打开删除确认对话框
  const openDeleteConfirm = useCallback((endpoint: string) => {
    setPendingDeleteEndpoint(endpoint);
    setDeleteConfirmOpen(true);
  }, []);

  // 确认删除接入点
  const confirmDelete = useCallback(async () => {
    if (pendingDeleteEndpoint) {
      await handleDeleteEndpoint(pendingDeleteEndpoint);
      setPendingDeleteEndpoint(null);
    }
  }, [pendingDeleteEndpoint, handleDeleteEndpoint]);

  // 添加新接入点
  const addEndpoint = useCallback(
    async (endpoint: string) => {
      if (!config) {
        toast.error("配置数据未加载，请稍后重试");
        throw new Error("配置数据未加载，请稍后重试");
      }

      const state = await handleAddEndpoint(endpoint);

      // 初始化新接入点的状态
      updateEndpointState(endpoint, state);
    },
    [config, handleAddEndpoint, updateEndpointState]
  );

  // 实时状态同步 - 处理端点状态变更事件
  const mcpEndpoints = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(mcpEndpoint)) list = mcpEndpoint;
    if (typeof mcpEndpoint === "string" && mcpEndpoint.length) {
      list.push(mcpEndpoint);
    }
    // 过滤掉空字符串
    return list.filter((endpoint) => endpoint.length > 0);
  }, [mcpEndpoint]);

  useEffect(() => {
    if (!open || mcpEndpoints.length === 0) return;

    // 为每个端点订阅状态变更事件
    const unsubscribers = mcpEndpoints.map((endpoint) => {
      const unsubscribe = webSocketManager.subscribe(
        "data:endpointStatusChanged",
        (event: any) => {
          // 只处理当前端点的事件
          if (event.endpoint === endpoint) {
            console.log(
              `[McpEndpointSettingButton] 接收到端点 ${endpoint} 状态变更:`,
              event
            );

            // 更新端点状态
            updateEndpointState(endpoint, {
              connected: event.connected,
              isOperating: false, // 接收到事件说明操作已完成
              lastOperation: {
                type: event.operation,
                success: event.success,
                message:
                  event.message || (event.connected ? "连接成功" : "断开成功"),
                timestamp: event.timestamp,
              },
            } as Partial<EndpointState>);

            // 显示通知
            if (event.success) {
              // toast 已在 hook 中处理
            } else {
              // toast 已在 hook 中处理
            }
          }
        }
      );

      return unsubscribe;
    });

    // 清理函数
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [open, mcpEndpoints, updateEndpointState]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="size-8">
          <SettingsIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-[600px] max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle>配置小智服务端接入点</DialogTitle>
          <DialogDescription>
            点击保存后，需要重启服务才会生效。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <EndpointList
            endpoints={mcpEndpoints}
            endpointStates={endpointStates}
            callbacks={{
              onConnect: handleConnect,
              onDisconnect: handleDisconnect,
              onCopy: handleCopy,
              onDelete: openDeleteConfirm,
            }}
          />
          <div className="flex flex-col sm:flex-row items-center gap-2 mt-4">
            <Button
              className="flex-1 flex items-center gap-2"
              onClick={() => setAddDialogOpen(true)}
            >
              <PlusIcon className="size-4" />
              <span className="text-sm sm:text-base">添加小智服务端接入点</span>
            </Button>
            <Button
              variant="outline"
              className="flex-1 flex items-center gap-2"
              onClick={() =>
                window.open("https://xiaozhi.me/console/agents", "_blank")
              }
            >
              <span className="text-sm sm:text-base">打开小智服务端</span>
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
      />

      {/* 添加接入点对话框 */}
      <AddEndpointDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={addEndpoint}
      />
    </Dialog>
  );
}
