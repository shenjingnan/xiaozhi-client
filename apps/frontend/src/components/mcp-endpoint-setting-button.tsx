import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEndpointState } from "@/hooks/useEndpointState";
import { useEndpointActions } from "@/hooks/useEndpointActions";
import { useEndpointStatus } from "@/hooks/useEndpointStatus";
import { useConfig, useMcpEndpoint } from "@/stores/config";
import {
  EndpointList,
  DeleteConfirmDialog,
  AddEndpointDialog,
  validateEndpoint,
} from "@/components/mcp-endpoint";
import { PlusIcon, SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * MCP 接入点设置按钮组件
 * 用于配置小智服务端接入点
 */
export function McpEndpointSettingButton() {
  // 对话框状态
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // 添加对话框状态
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [validationError, setValidationError] = useState("");

  // 配置数据
  const config = useConfig();
  const mcpEndpoint = useMcpEndpoint();

  // 使用提取的 hooks
  const {
    endpointStates,
    updateEndpointState,
    initializeEndpointStates,
    removeEndpointState,
    addEndpointState,
  } = useEndpointState();

  const { handleConnect, handleDisconnect, handleCopy, handleDeleteEndpoint, handleAddEndpoint } =
    useEndpointActions(updateEndpointState, removeEndpointState, addEndpointState);

  // 处理端点列表（需要在使用前定义）
  const mcpEndpoints = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(mcpEndpoint)) list = mcpEndpoint;
    if (typeof mcpEndpoint === "string" && mcpEndpoint.length) {
      list.push(mcpEndpoint);
    }
    return list;
  }, [mcpEndpoint]);

  // 处理 WebSocket 状态变更事件（仅在对话框打开时处理）
  const handleEndpointStatusChanged = useCallback(
    (event: {
      endpoint: string;
      connected: boolean;
      operation: "connect" | "disconnect" | "reconnect";
      success: boolean;
      message?: string;
      timestamp: number;
    }) => {
      // 仅在对话框打开时处理事件
      if (!open) {
        return;
      }

      // 只处理当前端点列表中的事件
      if (!mcpEndpoints.includes(event.endpoint)) {
        return;
      }

      console.log(
        `[McpEndpointSettingButton] 接收到端点 ${event.endpoint} 状态变更:`,
        event
      );

      // 更新端点状态
      updateEndpointState(event.endpoint, {
        connected: event.connected,
        isOperating: false, // 接收到事件说明操作已完成
        lastOperation: {
          type: event.operation,
          success: event.success,
          message: event.message || (event.connected ? "连接成功" : "断开成功"),
          timestamp: event.timestamp,
        },
      });

      // 显示通知
      if (event.success) {
        toast.success(
          `端点 ${event.operation === "connect" ? "连接" : event.operation === "disconnect" ? "断开" : "重连"}成功`
        );
      } else {
        toast.error(
          `端点 ${event.operation === "connect" ? "连接" : event.operation === "disconnect" ? "断开" : "重连"}失败: ${event.message || "未知错误"}`
        );
      }
    },
    [open, mcpEndpoints, updateEndpointState]
  );

  // WebSocket 状态同步（仅在对话框打开时订阅）
  useEndpointStatus(handleEndpointStatusChanged);

  // 当对话框打开时，初始化接入点状态
  useEffect(() => {
    if (open && mcpEndpoints.length > 0) {
      initializeEndpointStates(mcpEndpoints);
    }
  }, [open, mcpEndpoints, initializeEndpointStates]);

  // 打开删除确认对话框
  const openDeleteConfirm = useCallback((endpoint: string) => {
    setEndpointToDelete(endpoint);
    setDeleteConfirmOpen(true);
  }, []);

  // 确认删除
  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true);
    const success = await handleDeleteEndpoint(endpointToDelete);
    if (success) {
      setDeleteConfirmOpen(false);
      setEndpointToDelete("");
    }
    setIsDeleting(false);
  }, [endpointToDelete, handleDeleteEndpoint]);

  // 打开添加接入点对话框
  const openAddDialog = useCallback(() => {
    setNewEndpoint("");
    setValidationError("");
    setAddDialogOpen(true);
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((value: string) => {
    setNewEndpoint(value);
    if (validationError) {
      setValidationError("");
    }
  }, [validationError]);

  // 确认添加
  const handleConfirmAdd = useCallback(async () => {
    const error = validateEndpoint(newEndpoint);
    if (error) {
      setValidationError(error);
      return;
    }

    // 检查是否与现有接入点重复
    const currentEndpoints = Array.isArray(mcpEndpoint)
      ? mcpEndpoint
      : mcpEndpoint
        ? [mcpEndpoint]
        : [];
    if (currentEndpoints.includes(newEndpoint)) {
      setValidationError("该接入点已存在");
      return;
    }

    setIsAdding(true);
    const success = await handleAddEndpoint(newEndpoint, config, () => {
      setAddDialogOpen(false);
      setNewEndpoint("");
      setValidationError("");
    });
    if (success) {
      setAddDialogOpen(false);
      setNewEndpoint("");
      setValidationError("");
    }
    setIsAdding(false);
  }, [newEndpoint, mcpEndpoint, config, handleAddEndpoint]);

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
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onCopy={handleCopy}
            onDelete={openDeleteConfirm}
          />
          <div className="flex flex-col sm:flex-row items-center gap-2 mt-4">
            <Button
              className="flex-1 flex items-center gap-2"
              onClick={openAddDialog}
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
        endpointToDelete={endpointToDelete}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      {/* 添加接入点对话框 */}
      <AddEndpointDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        newEndpoint={newEndpoint}
        validationError={validationError}
        isAdding={isAdding}
        onInputChange={handleInputChange}
        onAdd={handleConfirmAdd}
      />
    </Dialog>
  );
}