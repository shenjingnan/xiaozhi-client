import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type EndpointStatusResponse, apiClient } from "@/services/api";
import { webSocketManager } from "@/services/websocket";
import { useConfig, useConfigActions, useMcpEndpoint } from "@/stores/config";
import {
  BadgeInfoIcon,
  CopyIcon,
  Loader2Icon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// 接入点状态接口
interface EndpointState {
  connected: boolean;
  isOperating: boolean;
  lastOperation: {
    type: "connect" | "disconnect" | "reconnect" | null;
    success: boolean;
    message: string;
    timestamp: number;
  };
}

const sliceEndpoint = (endpoint: string) => {
  return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
};

// 验证接入点格式
const validateEndpoint = (endpoint: string): string | null => {
  if (!endpoint.trim()) {
    return "请输入接入点地址";
  }

  // 检查是否是有效的 WebSocket URL
  if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
    return "接入点格式无效，请输入正确的WebSocket URL (ws:// 或 wss://)";
  }

  // 检查是否是有效的 URL
  try {
    new URL(endpoint);
  } catch {
    return "接入点格式无效，请输入正确的URL格式";
  }

  return null; // 验证通过
};

export function McpEndpointSettingButton() {
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [validationError, setValidationError] = useState("");

  // 接入点状态管理
  const [endpointStates, setEndpointStates] = useState<
    Record<string, EndpointState>
  >({});

  const config = useConfig();
  const mcpEndpoint = useMcpEndpoint();
  const { refreshConfig } = useConfigActions();

  // 获取接入点状态
  const fetchEndpointStatus = useCallback(
    async (endpoint: string): Promise<EndpointStatusResponse> => {
      try {
        return await apiClient.getEndpointStatus(endpoint);
      } catch (error) {
        console.error(`[McpEndpointSettingButton] 获取接入点状态失败: ${endpoint}`, error);
        // 返回默认状态
        return {
          endpoint,
          connected: false,
          initialized: false,
          isReconnecting: false,
          reconnectAttempts: 0,
          reconnectDelay: 0,
        };
      }
    },
    []
  );

  // 更新接入点状态
  const updateEndpointState = useCallback(
    (endpoint: string, updates: Partial<EndpointState>) => {
      setEndpointStates((prev) => ({
        ...prev,
        [endpoint]: {
          ...prev[endpoint],
          ...updates,
        },
      }));
    },
    []
  );

  // 初始化接入点状态
  const initializeEndpointStates = useCallback(
    async (endpoints: string[]) => {
      const states: Record<string, EndpointState> = {};

      for (const endpoint of endpoints) {
        try {
          const status = await fetchEndpointStatus(endpoint);
          states[endpoint] = {
            connected: status.connected,
            isOperating: false,
            lastOperation: {
              type: null,
              success: false,
              message: "",
              timestamp: 0,
            },
          };
        } catch (error) {
          states[endpoint] = {
            connected: false,
            isOperating: false,
            lastOperation: {
              type: null,
              success: false,
              message: "",
              timestamp: 0,
            },
          };
        }
      }

      setEndpointStates(states);
    },
    [fetchEndpointStatus]
  );

  // 连接接入点
  const handleConnect = async (endpoint: string) => {
    updateEndpointState(endpoint, { isOperating: true });

    try {
      await apiClient.connectEndpoint(endpoint);
      updateEndpointState(endpoint, {
        connected: true,
        isOperating: false,
        lastOperation: {
          type: "connect",
          success: true,
          message: "连接成功",
          timestamp: Date.now(),
        },
      });
      toast.success("接入点连接成功");
    } catch (error) {
      updateEndpointState(endpoint, {
        isOperating: false,
        lastOperation: {
          type: "connect",
          success: false,
          message: error instanceof Error ? error.message : "连接失败",
          timestamp: Date.now(),
        },
      });
      toast.error(error instanceof Error ? error.message : "接入点连接失败");
    }
  };

  // 断开接入点
  const handleDisconnect = async (endpoint: string) => {
    updateEndpointState(endpoint, { isOperating: true });

    try {
      await apiClient.disconnectEndpoint(endpoint);
      updateEndpointState(endpoint, {
        connected: false,
        isOperating: false,
        lastOperation: {
          type: "disconnect",
          success: true,
          message: "断开成功",
          timestamp: Date.now(),
        },
      });
      toast.success("接入点断开成功");
    } catch (error) {
      updateEndpointState(endpoint, {
        isOperating: false,
        lastOperation: {
          type: "disconnect",
          success: false,
          message: error instanceof Error ? error.message : "断开失败",
          timestamp: Date.now(),
        },
      });
      toast.error(error instanceof Error ? error.message : "接入点断开失败");
    }
  };

  // 复制接入点地址到剪贴板
  const handleCopy = async (endpoint: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(endpoint);
        toast.success("接入点地址已复制到剪贴板");
      } else {
        // 降级方案：使用传统的复制方法
        const textArea = document.createElement("textarea");
        textArea.value = endpoint;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          toast.success("接入点地址已复制到剪贴板");
        } else {
          throw new Error("复制命令执行失败");
        }
      }
    } catch (error) {
      console.error("[McpEndpointSettingButton] 复制失败:", error);
      toast.error("复制失败，请手动复制");
    }
  };

  // 删除接入点
  const handleDeleteEndpoint = async () => {
    setIsDeleting(true);
    try {
      // 调用后端 API 删除接入点
      await apiClient.removeEndpoint(endpointToDelete);

      // 刷新配置数据以更新 mcpEndpoints 列表
      await refreshConfig();

      // 从本地状态中移除该接入点
      setEndpointStates((prev) => {
        const newStates = { ...prev };
        delete newStates[endpointToDelete];
        return newStates;
      });

      toast.success("接入点已删除");
      setDeleteConfirmOpen(false);
      setEndpointToDelete("");
    } catch (error) {
      console.error("[McpEndpointSettingButton] 删除接入点失败:", error);
      toast.error(error instanceof Error ? error.message : "删除接入点失败");
    } finally {
      setIsDeleting(false);
    }
  };

  // 添加新接入点
  const handleAddEndpoint = async () => {
    const error = validateEndpoint(newEndpoint);
    if (error) {
      setValidationError(error);
      return;
    }

    // 检查是否与现有接入点重复
    const currentEndpoints = Array.isArray(mcpEndpoint)
      ? mcpEndpoint
      : [mcpEndpoint];
    if (currentEndpoints.includes(newEndpoint)) {
      setValidationError("该接入点已存在");
      return;
    }

    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsAdding(true);
    try {
      // 调用后端 API 添加接入点
      const endpointStatus = await apiClient.addEndpoint(newEndpoint);

      // 刷新配置数据以更新 mcpEndpoints 列表
      await refreshConfig();

      // 初始化新接入点的状态
      setEndpointStates((prev) => ({
        ...prev,
        [newEndpoint]: {
          connected: endpointStatus.connected,
          isOperating: false,
          lastOperation: {
            type: null,
            success: false,
            message: "",
            timestamp: 0,
          },
        },
      }));

      toast.success("接入点添加成功");
      setAddDialogOpen(false);
      setNewEndpoint("");
      setValidationError("");
    } catch (error) {
      console.error("[McpEndpointSettingButton] 添加接入点失败:", error);
      toast.error(error instanceof Error ? error.message : "添加接入点失败");
    } finally {
      setIsAdding(false);
    }
  };

  // 打开添加接入点对话框
  const openAddDialog = () => {
    setNewEndpoint("");
    setValidationError("");
    setAddDialogOpen(true);
  };

  // 处理输入变化
  const handleInputChange = (value: string) => {
    setNewEndpoint(value);
    if (validationError) {
      setValidationError("");
    }
  };

  // 打开删除确认对话框
  const openDeleteConfirm = (endpoint: string) => {
    setEndpointToDelete(endpoint);
    setDeleteConfirmOpen(true);
  };

  const mcpEndpoints = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(mcpEndpoint)) list = mcpEndpoint;
    if (typeof mcpEndpoint === "string" && mcpEndpoint.length) {
      list.push(mcpEndpoint);
    }
    return list;
  }, [mcpEndpoint]);

  // 当对话框打开时，初始化接入点状态
  useEffect(() => {
    if (open && mcpEndpoints.length > 0) {
      initializeEndpointStates(mcpEndpoints);
    }
  }, [open, mcpEndpoints, initializeEndpointStates]);

  // 实时状态同步 - 处理端点状态变更事件
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
          {mcpEndpoints.map((item) => {
            const endpointState = endpointStates[item];
            const isConnected = endpointState?.connected || false;
            const isOperating = endpointState?.isOperating || false;

            return (
              <div
                key={item}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-md font-mono gap-3 transition-all duration-200 hover:bg-slate-100"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <span className="flex-1 text-ellipsis overflow-hidden whitespace-nowrap text-sm sm:text-base">
                    {sliceEndpoint(item)}
                  </span>
                  {/* 连接状态显示 */}
                  <Badge
                    className={`flex items-center gap-1 transition-all duration-200 text-xs sm:text-sm ${
                      isConnected
                        ? "bg-green-100 text-green-800 border-green-200 hover:text-green-800 hover:border-green-200 hover:bg-green-100"
                        : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-600 hover:border-gray-200"
                    }`}
                  >
                    {isOperating ? (
                      <Loader2Icon className="size-3 animate-spin" />
                    ) : isConnected ? (
                      <WifiIcon className="size-3" />
                    ) : (
                      <WifiOffIcon className="size-3" />
                    )}
                    {isOperating ? "操作中" : isConnected ? "已连接" : "未连接"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(item)}
                    title="复制完整地址"
                    className="transition-all duration-200 hover:scale-105"
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                  {/* 连接/断开按钮 */}
                  {isConnected ? (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDisconnect(item)}
                      title="断开连接"
                      disabled={isOperating}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-50"
                    >
                      {isOperating ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <WifiOffIcon className="size-4" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleConnect(item)}
                      title="连接"
                      disabled={isOperating}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-50"
                    >
                      {isOperating ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <WifiIcon className="size-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openDeleteConfirm(item)}
                    title="删除此接入点"
                    className="transition-all duration-200 hover:scale-105 hover:text-red-600"
                  >
                    <TrashIcon className="size-4 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
          {mcpEndpoints.length === 0 && (
            <div className="flex flex-col items-center flex-1 text-sm text-muted-foreground text-center justify-center gap-2">
              <BadgeInfoIcon />
              <span>暂无接入点，请添加</span>
            </div>
          )}
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
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除接入点</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除接入点 "{sliceEndpoint(endpointToDelete)}"
              吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEndpoint}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "确定删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加接入点对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>添加新的接入点</DialogTitle>
            <DialogDescription>请输入小智服务端接入点地址</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Input
                placeholder="请输入接入点地址，例如：wss://api.xiaozhi.me/mcp/?token=... 或 ws(s)://<hostname>:<port>"
                value={newEndpoint}
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={isAdding}
                className="font-mono text-sm"
              />
              {validationError && (
                <p className="text-sm text-red-500">{validationError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isAdding}>
                取消
              </Button>
            </DialogClose>
            <Button
              onClick={handleAddEndpoint}
              disabled={isAdding || !newEndpoint.trim()}
            >
              {isAdding ? "添加中..." : "确定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
