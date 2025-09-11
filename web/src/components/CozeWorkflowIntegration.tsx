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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCozeWorkflows } from "@/hooks/useCozeWorkflows";
import { toolsApiService } from "@/services/toolsApi";
import type { CozeWorkflow } from "@/types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 5;

export function CozeWorkflowIntegration() {
  const [open, setOpen] = useState(false);
  const [isAddingWorkflow, setIsAddingWorkflow] = useState(false);
  const [customTools, setCustomTools] = useState<any[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    workflow?: CozeWorkflow;
    toolName?: string;
    action: "add" | "remove";
  }>({ open: false, action: "add" });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(
    new Set()
  );

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
    refreshWorkspaces,
    refreshWorkflows,
    setPage,
  } = useCozeWorkflows({
    autoLoadWorkspaces: true,
    autoLoadWorkflows: true,
  });

  // 加载自定义工具列表
  const loadCustomTools = useCallback(async () => {
    setIsLoadingTools(true);
    try {
      const tools = await toolsApiService.getCustomTools();
      setCustomTools(tools);
    } catch (error) {
      console.error("加载工具列表失败:", error);
      // 不显示错误toast，避免干扰用户
    } finally {
      setIsLoadingTools(false);
    }
  }, []);

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

  // 组件挂载时加载工具列表
  useEffect(() => {
    if (open) {
      loadCustomTools();
    }
  }, [open, loadCustomTools]);

  const handleWorkspaceChange = (workspaceId: string) => {
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

    // 显示确认对话框
    setConfirmDialog({
      open: true,
      workflow,
      action: "add",
    });
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

      // 调用后端API添加工具
      const addedTool = await toolsApiService.addCustomTool(workflow);

      toast.success(
        `已添加工作流 "${workflow.workflow_name}" 为 MCP 工具 "${addedTool.name}"`
      );

      // 重新加载工具列表
      await loadCustomTools();
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

  const handleRemoveTool = (toolName: string) => {
    // 显示确认对话框
    setConfirmDialog({
      open: true,
      toolName,
      action: "remove",
    });
  };

  const handleConfirmRemoveTool = async (toolName: string) => {
    const operationKey = `remove_${toolName}`;

    setPendingOperations((prev) => new Set(prev).add(operationKey));

    try {
      // 检查网络状态
      if (!isOnline) {
        throw new Error("网络连接已断开，请检查网络后重试");
      }

      await toolsApiService.removeCustomTool(toolName);
      toast.success(`已删除工具 "${toolName}"`);

      // 重新加载工具列表
      await loadCustomTools();
    } catch (error) {
      console.error("删除工具失败:", error);

      let errorMessage = "删除工具失败，请重试";
      if (error instanceof Error) {
        if (error.message.includes("不存在") || error.message.includes("404")) {
          errorMessage = `工具 "${toolName}" 不存在或已被删除`;
        } else if (
          error.message.includes("网络") ||
          error.message.includes("超时") ||
          error.message.includes("连接")
        ) {
          errorMessage = "网络连接失败，请检查网络后重试";
        } else if (error.message.includes("权限")) {
          errorMessage = "权限不足，无法删除该工具";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setPendingOperations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(operationKey);
        return newSet;
      });
      setConfirmDialog({ open: false, action: "remove" });
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

  const handleRefreshWorkspaces = () => {
    refreshWorkspaces();
  };

  const handleRefreshWorkflows = () => {
    if (selectedWorkspace) {
      refreshWorkflows();
    }
  };

  const renderPlatformSelector = () => {
    return (
      <Select>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="选择平台" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="coze">coze</SelectItem>
            <SelectItem value="dify">dify</SelectItem>
            <SelectItem value="n8n">n8n</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  };

  // 渲染工作空间选择器
  const renderWorkspaceSelector = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">选择工作空间</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshWorkspaces}
          disabled={workspacesLoading}
        >
          <RefreshCw
            className={`h-4 w-4 ${workspacesLoading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

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
                  <Badge variant="outline" className="text-xs">
                    {workspace.workspace_type === "personal" ? "个人" : "团队"}
                  </Badge>
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
      <div className="space-y-3">
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
              <Button
                size="sm"
                onClick={() => handleAddWorkflow(workflow)}
                disabled={isAddingWorkflow}
                className="hover:bg-green-500 hover:text-white"
              >
                {isAddingWorkflow ? (
                  <Loader2
                    className="h-4 w-4 mr-1 animate-spin"
                    data-testid="loader"
                  />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                添加
              </Button>
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

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(
      startIndex + ITEMS_PER_PAGE,
      startIndex + workflows.length
    );

    return (
      <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
        <div className="text-sm text-muted-foreground">
          显示 {startIndex + 1}-{endIndex} 项{hasMoreWorkflows && "，还有更多"}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>

          <div className="flex items-center gap-1">
            <span className="text-sm">第 {currentPage} 页</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasMoreWorkflows}
          >
            下一页
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
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] h-[600px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              工作流集成
            </DialogTitle>
            {/* <DialogDescription>
              选择要集成到MCP服务中的扣子工作流，添加后可以作为工具在对话中使用。
            </DialogDescription> */}
          </DialogHeader>

          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* 工作空间选择器 */}
            {renderWorkspaceSelector()}

            {/* 平台选择器 */}
            {/* {renderPlatformSelector()} */}

            {/* 工作流列表 */}
            <div className="flex-1 overflow-y-auto min-h-[300px] pr-2">
              {renderWorkflowList()}
            </div>

            {/* 分页控件 */}
            {renderPagination()}
          </div>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "add"
                ? "确认添加工作流"
                : "确认删除工具"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "add"
                ? `确定要将工作流 "${confirmDialog.workflow?.workflow_name}" 添加为 MCP 工具吗？`
                : `确定要删除工具 "${confirmDialog.toolName}" 吗？此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.action === "add" && confirmDialog.workflow) {
                  handleConfirmAddWorkflow(confirmDialog.workflow);
                } else if (
                  confirmDialog.action === "remove" &&
                  confirmDialog.toolName
                ) {
                  handleConfirmRemoveTool(confirmDialog.toolName);
                }
              }}
              className={
                confirmDialog.action === "remove"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
              }
            >
              {confirmDialog.action === "add" ? "添加" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
