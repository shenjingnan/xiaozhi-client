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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCozeWorkflows } from "@/hooks/useCozeWorkflows";
import type { CozeWorkflow } from "@/types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 5;

export function CozeWorkflowIntegration() {
  const [open, setOpen] = useState(false);
  const [isAddingWorkflow, setIsAddingWorkflow] = useState(false);

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

  const handleWorkspaceChange = (workspaceId: string) => {
    selectWorkspace(workspaceId);
  };

  const handleAddWorkflow = async (workflow: CozeWorkflow) => {
    setIsAddingWorkflow(true);
    try {
      // 模拟添加工作流的异步操作
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(`已添加工作流 "${workflow.workflow_name}" 为 MCP 工具`);
    } catch (error) {
      toast.error("添加工作流失败，请重试");
    } finally {
      setIsAddingWorkflow(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Workflow className="h-4 w-4 mr-2" />
          添加扣子工作流
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] h-[600px] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            添加扣子工作流为MCP工具
          </DialogTitle>
          <DialogDescription>
            选择要集成到MCP服务中的扣子工作流，添加后可以作为工具在对话中使用。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* 工作空间选择器 */}
          {renderWorkspaceSelector()}

          {/* 工作流列表 */}
          <div className="flex-1 overflow-y-auto min-h-[300px] pr-2">
            {renderWorkflowList()}
          </div>

          {/* 分页控件 */}
          {renderPagination()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
