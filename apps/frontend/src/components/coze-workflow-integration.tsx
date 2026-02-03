import { WorkflowParameterConfigDialog } from "@/components/common/workflow-parameter-config-dialog";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCozeWorkflows } from "@/hooks/useCozeWorkflows";
import { apiClient } from "@/services/api";
import type {
  CozeWorkflow,
  WorkflowParameter,
} from "@xiaozhi-client/shared-types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CozeWorkflowIntegrationProps {
  onToolAdded?: () => void;
}

export function CozeWorkflowIntegration({
  onToolAdded,
}: CozeWorkflowIntegrationProps) {
  const [open, setOpen] = useState(false);
  const [isAddingWorkflow, setIsAddingWorkflow] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    workflow?: CozeWorkflow;
    toolName?: string;
    action: "add" | "remove";
  }>({ open: false, action: "add" });
  const [parameterConfigDialog, setParameterConfigDialog] = useState<{
    open: boolean;
    workflow?: CozeWorkflow;
  }>({ open: false });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(
    new Set()
  );
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // 使用 useCozeWorkflows Hook 获取数据和状态
  const {
    workspaces,
    workflows,
    selectedWorkspace,
    workspacesLoading,
    workflowsLoading,
    workspacesError,
    workflowsError,
    hasMoreWorkflows,
    currentPage,
    selectWorkspace,
    refreshWorkflows,
    setPage,
    setWorkflows,
  } = useCozeWorkflows({
    autoLoadWorkspaces: true,
    autoLoadWorkflows: true,
  });

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 自动选择第一个工作空间
  useEffect(() => {
    // 当工作空间加载完成且不为空，且尚未进行过自动选择时
    if (
      !workspacesLoading &&
      workspaces.length > 0 &&
      !selectedWorkspace &&
      !hasAutoSelected
    ) {
      const firstWorkspace = workspaces[0];
      console.log(`自动选择第一个工作空间: ${firstWorkspace.name}`);
      selectWorkspace(firstWorkspace.id);
      setHasAutoSelected(true);
    }

    // 如果工作空间列表被清空或重新加载，重置自动选择状态
    if (workspacesLoading && hasAutoSelected) {
      setHasAutoSelected(false);
    }
  }, [
    workspaces,
    workspacesLoading,
    selectedWorkspace,
    hasAutoSelected,
    selectWorkspace,
  ]);

  const handleWorkspaceChange = (workspaceId: string) => {
    // 用户手动选择工作空间时，标记为已进行手动选择
    // 这样自动选择逻辑就不会再次触发
    setHasAutoSelected(true);
    selectWorkspace(workspaceId);
  };

  const handleAddWorkflow = (workflow: CozeWorkflow) => {
    // 检查网络状态
    if (!isOnline) {
      toast.error("网络连接已断开，请检查网络后重试");
      return;
    }

    // 检查是否已有相同操作在进行
    const operationKey = `add_${workflow.workflow_id}`;
    if (pendingOperations.has(operationKey)) {
      toast.warning("该工作流正在添加中，请勿重复操作");
      return;
    }

    // 显示参数配置对话框
    setParameterConfigDialog({
      open: true,
      workflow,
    });
  };

  // 处理参数配置确认
  const handleParameterConfigConfirm = async (
    workflow: CozeWorkflow,
    parameters: WorkflowParameter[]
  ) => {
    const operationKey = `add_${workflow.workflow_id}`;

    setIsAddingWorkflow(true);
    setPendingOperations((prev) => new Set(prev).add(operationKey));

    try {
      // 验证工作流数据完整性
      if (
        !workflow.workflow_id ||
        !workflow.workflow_name ||
        !workflow.app_id
      ) {
        throw new Error("工作流数据不完整，缺少必要字段");
      }

      // 再次检查网络状态
      if (!isOnline) {
        throw new Error("网络连接已断开，请检查网络后重试");
      }

      // 构建参数配置
      const parameterConfig =
        parameters.length > 0 ? { parameters } : undefined;

      const request = {
        type: "coze" as const,
        data: {
          workflow,
          customName: undefined,
          customDescription: undefined,
          parameterConfig,
        },
      };
      const addedTool = await apiClient.addCustomTool(request);

      toast.success(
        `已添加工作流 "${workflow.workflow_name}" 为 MCP 工具 "${
          addedTool.name
        }"${
          parameters.length > 0 ? `，配置了 ${parameters.length} 个参数` : ""
        }`
      );

      // 立即更新本地工作流状态，标记为已添加
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((w) =>
          w.workflow_id === workflow.workflow_id
            ? {
                ...w,
                isAddedAsTool: true,
                toolName: addedTool.name,
              }
            : w
        )
      );

      // 通知父组件工具已添加，触发工具列表刷新
      onToolAdded?.();

      // 刷新工作流列表以确保状态同步
      await refreshWorkflows();
    } catch (error) {
      console.error("添加工作流失败:", error);

      // 根据错误类型显示不同的错误信息
      let errorMessage = "添加工作流失败，请重试";

      if (error instanceof Error) {
        if (
          error.message.includes("已存在") ||
          error.message.includes("冲突")
        ) {
          errorMessage = `工作流 "${workflow.workflow_name}" 已存在，请勿重复添加`;
        } else if (
          error.message.includes("配置") ||
          error.message.includes("token")
        ) {
          errorMessage = "系统配置错误，请检查扣子API配置";
        } else if (
          error.message.includes("验证失败") ||
          error.message.includes("格式")
        ) {
          errorMessage = "工作流数据格式错误，请联系管理员";
        } else if (
          error.message.includes("网络") ||
          error.message.includes("超时") ||
          error.message.includes("连接")
        ) {
          errorMessage = "网络连接失败，请检查网络后重试";
        } else if (error.message.includes("权限")) {
          errorMessage = "权限不足，请检查API权限配置";
        } else if (error.message.includes("频繁")) {
          errorMessage = "操作过于频繁，请稍后重试";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsAddingWorkflow(false);
      setPendingOperations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(operationKey);
        return newSet;
      });
      setParameterConfigDialog({ open: false });
    }
  };

  // 处理参数配置取消
  const handleParameterConfigCancel = () => {
    setParameterConfigDialog({ open: false });
  };

  const handleConfirmAddWorkflow = async (workflow: CozeWorkflow) => {
    const operationKey = `add_${workflow.workflow_id}`;

    setIsAddingWorkflow(true);
    setPendingOperations((prev) => new Set(prev).add(operationKey));

    try {
      // 验证工作流数据完整性
      if (
        !workflow.workflow_id ||
        !workflow.workflow_name ||
        !workflow.app_id
      ) {
        throw new Error("工作流数据不完整，缺少必要字段");
      }

      // 再次检查网络状态
      if (!isOnline) {
        throw new Error("网络连接已断开，请检查网络后重试");
      }

      // 使用新的统一数据格式添加工具
      const request = {
        type: "coze" as const,
        data: {
          workflow,
          customName: undefined,
          customDescription: undefined,
          parameterConfig: undefined,
        },
      };
      const addedTool = await apiClient.addCustomTool(request);

      toast.success(
        `已添加工作流 "${workflow.workflow_name}" 为 MCP 工具 "${addedTool.name}"`
      );

      // 立即更新本地工作流状态，标记为已添加
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((w) =>
          w.workflow_id === workflow.workflow_id
            ? {
                ...w,
                isAddedAsTool: true,
                toolName: addedTool.name,
              }
            : w
        )
      );

      // 通知父组件工具已添加，触发工具列表刷新
      onToolAdded?.();

      // 刷新工作流列表以确保状态同步
      await refreshWorkflows();
    } catch (error) {
      console.error("添加工作流失败:", error);

      // 根据错误类型显示不同的错误信息
      let errorMessage = "添加工作流失败，请重试";

      if (error instanceof Error) {
        if (
          error.message.includes("已存在") ||
          error.message.includes("冲突")
        ) {
          errorMessage = `工作流 "${workflow.workflow_name}" 已存在，请勿重复添加`;
        } else if (
          error.message.includes("配置") ||
          error.message.includes("token")
        ) {
          errorMessage = "系统配置错误，请检查扣子API配置";
        } else if (
          error.message.includes("验证失败") ||
          error.message.includes("格式")
        ) {
          errorMessage = "工作流数据格式错误，请联系管理员";
        } else if (
          error.message.includes("网络") ||
          error.message.includes("超时") ||
          error.message.includes("连接")
        ) {
          errorMessage = "网络连接失败，请检查网络后重试";
        } else if (error.message.includes("权限")) {
          errorMessage = "权限不足，请检查API权限配置";
        } else if (error.message.includes("频繁")) {
          errorMessage = "操作过于频繁，请稍后重试";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsAddingWorkflow(false);
      setPendingOperations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(operationKey);
        return newSet;
      });
      setConfirmDialog({ open: false, action: "add" });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasMoreWorkflows) {
      setPage(currentPage + 1);
    }
  };

  const handleRefreshWorkflows = () => {
    if (selectedWorkspace) {
      refreshWorkflows();
    }
  };

  // 渲染工作空间选择器
  const renderWorkspaceSelector = () => (
    <div className="space-y-2">
      {workspacesError ? (
        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>加载工作空间失败: {workspacesError}</span>
        </div>
      ) : (
        <Select
          value={selectedWorkspace?.id || ""}
          onValueChange={handleWorkspaceChange}
          disabled={workspacesLoading}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={workspacesLoading ? "加载中..." : "请选择工作空间"}
            />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                <div className="flex items-center gap-2">
                  <span>{workspace.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  // 渲染工作流列表
  const renderWorkflowList = () => {
    if (!selectedWorkspace) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">请先选择工作空间</h3>
          <p className="text-sm text-muted-foreground">
            选择一个工作空间后，将显示该空间下的工作流列表
          </p>
        </div>
      );
    }

    if (workflowsError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium mb-2">加载工作流失败</h3>
          <p className="text-sm text-muted-foreground mb-4">{workflowsError}</p>
          <Button onClick={handleRefreshWorkflows} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        </div>
      );
    }

    if (workflowsLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => i).map((index) => (
            <div
              key={`skeleton-${index}`}
              className="flex items-center gap-4 p-4 border rounded-lg"
            >
              <Skeleton
                className="w-10 h-10 rounded-lg"
                data-testid="skeleton"
              />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" data-testid="skeleton" />
                <Skeleton className="h-3 w-2/3" data-testid="skeleton" />
              </div>
              <Skeleton className="w-16 h-8" data-testid="skeleton" />
            </div>
          ))}
        </div>
      );
    }

    if (workflows.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无工作流</h3>
          <p className="text-sm text-muted-foreground">
            当前工作空间下没有可用的工作流
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[500px] overflow-auto">
        {workflows.map((workflow) => (
          <div
            key={workflow.workflow_id}
            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
          >
            {/* 工作流图标 */}
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg">
              <Workflow className="h-5 w-5 text-green-600" />
            </div>

            {/* 工作流信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">
                  {workflow.workflow_name}
                </h4>
                <Badge variant="secondary" className="text-xs">
                  工作流
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {workflow.description || "暂无描述"}
              </p>
            </div>

            {/* 添加按钮 */}
            <div className="flex-shrink-0">
              {workflow.isAddedAsTool ? (
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-800"
                >
                  已添加
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleAddWorkflow(workflow)}
                  disabled={isAddingWorkflow}
                >
                  {isAddingWorkflow ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      data-testid="loader"
                    />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  添加
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染分页控件
  const renderPagination = () => {
    if (!selectedWorkspace || workflows.length === 0) {
      return null;
    }

    return (
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button
            variant="link"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            <span className="text-sm">{currentPage}</span>
          </div>

          <Button
            variant="link"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasMoreWorkflows}
            className="text-muted-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Workflow className="h-4 w-4 mr-2" />
            工作流集成
          </Button>
        </DialogTrigger>
        <DialogContent className="flex flex-col max-w-full w-[1000px]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              工作流集成
            </DialogTitle>
          </DialogHeader>

          {/* 工作空间选择器 */}
          <div className="w-[120px]">{renderWorkspaceSelector()}</div>

          {/* 工作流列表 */}
          <div className="flex-1 pr-2 w-full">{renderWorkflowList()}</div>

          {/* 分页控件 */}
          {renderPagination()}
        </DialogContent>
      </Dialog>

      {/* 参数配置对话框 */}
      {parameterConfigDialog.workflow && (
        <WorkflowParameterConfigDialog
          open={parameterConfigDialog.open}
          onOpenChange={(open) =>
            setParameterConfigDialog((prev) => ({ ...prev, open }))
          }
          workflow={parameterConfigDialog.workflow}
          onConfirm={handleParameterConfigConfirm}
          onCancel={handleParameterConfigCancel}
          title="配置工作流参数"
        />
      )}

      {/* 确认对话框 */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认添加工作流</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将工作流 "{confirmDialog.workflow?.workflow_name}" 添加为
              MCP 工具吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.workflow) {
                  handleConfirmAddWorkflow(confirmDialog.workflow);
                }
              }}
            >
              添加
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
