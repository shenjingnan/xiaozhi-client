import { WorkflowParameterConfigDialog } from "@/components/common/WorkflowParameterConfigDialog";
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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { apiClient } from "@/services/api";
import {
  useConfigActions,
  useMcpServerConfig,
  useMcpServers,
} from "@/stores/config";
import { getMcpServerCommunicationType } from "@/utils/mcpServerUtils";
import type {
  CozeWorkflow,
  MCPServerConfig,
  WorkflowParameter,
} from "@xiaozhi-client/shared-types";
import {
  CoffeeIcon,
  MinusIcon,
  PlusIcon,
  Settings,
  Wrench,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AddMcpServerButton } from "./AddMcpServerButton";
import { CozeWorkflowIntegration } from "./CozeWorkflowIntegration";
import { McpServerSettingButton } from "./McpServerSettingButton";
import { RemoveMcpServerButton } from "./RemoveMcpServerButton";
import { RestartButton } from "./RestartButton";
import { ToolDebugDialog } from "./ToolDebugDialog";

// 服务名称常量
const UNKNOWN_SERVICE_NAME = "未知服务";
const CUSTOM_SERVICE_NAME = "自定义服务";

interface McpServerListProps {
  updateConfig?: (config: any) => Promise<void>;
}

export function McpServerList({
  updateConfig: _updateConfig,
}: McpServerListProps) {
  const mcpServerConfig = useMcpServerConfig();
  const mcpServers = useMcpServers();
  const { refreshConfig } = useConfigActions();
  // const config = useConfig(); // 不再使用配置更新，改为使用 API

  // 添加工具列表状态管理
  const [enabledTools, setEnabledTools] = useState<
    Array<{
      name: string;
      serverName: string;
      handler?: {
        type: string;
        platform: string;
      };
      toolName: string;
      enable: boolean;
      description?: string;
      usageCount?: number;
      lastUsedTime?: string;
      inputSchema?: any;
    }>
  >([]);
  const [disabledTools, setDisabledTools] = useState<
    Array<{
      name: string;
      serverName: string;
      toolName: string;
      enable: boolean;
      description?: string;
      usageCount?: number;
      lastUsedTime?: string;
      inputSchema?: any;
    }>
  >([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);

  // 格式化工具信息的辅助函数
  const formatTool = useCallback((tool: any, enable: boolean) => {
    const { serviceName, toolName } = (() => {
      // 安全检查：确保 handler 存在
      if (!tool || !tool.handler) {
        return {
          serviceName: UNKNOWN_SERVICE_NAME,
          toolName: tool?.name || UNKNOWN_SERVICE_NAME,
        };
      }

      if (tool.handler.type === "mcp") {
        return {
          serviceName: tool.handler.config?.serviceName || UNKNOWN_SERVICE_NAME,
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
      serverName: serviceName,
      toolName,
      enable,
      name: tool.name,
      description: tool.description,
      usageCount: tool.stats?.usageCount,
      lastUsedTime: tool.stats?.lastUsedTime,
      inputSchema: tool.inputSchema,
    };
  }, []);

  // 获取工具列表
  const fetchTools = useCallback(async () => {
    setIsLoadingTools(true);
    setToolsError(null);

    try {
      // 并行获取已启用和未启用的工具列表
      const [enabledToolsList, disabledToolsList] = await Promise.all([
        apiClient.getToolsList("enabled"),
        apiClient.getToolsList("disabled"),
      ]);

      // 格式化已启用的工具
      const formattedEnabledTools = enabledToolsList.map((tool) =>
        formatTool(tool, true)
      );

      // 格式化未启用的工具
      const formattedDisabledTools = disabledToolsList.map((tool) =>
        formatTool(tool, false)
      );

      setEnabledTools(formattedEnabledTools);
      setDisabledTools(formattedDisabledTools);
    } catch (error) {
      console.error("获取工具列表失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "获取工具列表失败";
      setToolsError(errorMessage);
      toast.error(errorMessage);

      // 发生错误时回退到使用 mcpServerConfig
      if (mcpServerConfig) {
        const fallbackTools = Object.entries(mcpServerConfig).flatMap(
          ([serverName, value]) => {
            return Object.entries(value?.tools || {}).map(
              ([toolName, tool]) => ({
                serverName,
                toolName,
                ...(tool as any),
              })
            );
          }
        );

        const enabled = fallbackTools.filter((tool) => tool.enable !== false);
        const disabled = fallbackTools.filter((tool) => tool.enable === false);

        setEnabledTools(enabled);
        setDisabledTools(disabled);
      }
    } finally {
      setIsLoadingTools(false);
    }
  }, [mcpServerConfig, formatTool]);

  // 添加刷新状态管理
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 数据刷新处理函数 - 用于删除MCP服务后的状态同步
  const handleRefreshData = useCallback(async () => {
    if (isRefreshing) return; // 防止重复刷新

    try {
      setIsRefreshing(true);
      // 并行刷新配置数据和工具列表
      await Promise.all([refreshConfig(), fetchTools()]);
    } catch (error) {
      console.error("刷新数据失败:", error);
      toast.error("刷新数据失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshConfig, fetchTools, isRefreshing]);

  // 更新工具列表状态（用于启用/禁用后刷新）
  const refreshToolLists = useCallback(async () => {
    try {
      const [enabledToolsList, disabledToolsList] = await Promise.all([
        apiClient.getToolsList("enabled"),
        apiClient.getToolsList("disabled"),
      ]);

      // 格式化已启用的工具
      const formattedEnabledTools = enabledToolsList.map((tool) =>
        formatTool(tool, true)
      );

      // 格式化未启用的工具
      const formattedDisabledTools = disabledToolsList.map((tool) =>
        formatTool(tool, false)
      );

      setEnabledTools(formattedEnabledTools);
      setDisabledTools(formattedDisabledTools);
    } catch (error) {
      console.error("刷新工具列表失败:", error);
      toast.error("刷新工具列表失败");
    }
  }, [formatTool]);

  // 组件加载时获取工具列表
  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  // 添加状态来管理 Coze 工具确认对话框
  const [cozeToolToRemove, setCozeToolToRemove] = useState<string | null>(null);

  // 添加状态来管理参数配置对话框
  const [parameterConfigDialog, setParameterConfigDialog] = useState<{
    open: boolean;
    tool?: any;
  }>({ open: false });

  // 添加状态来管理工具调试对话框
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

  const handleToggleTool = async (name: string, currentEnable: boolean) => {
    try {
      // 首先找到对应的原始工具信息
      const originalTool = [...enabledTools, ...disabledTools].find(
        (tool) => tool.name === name
      );

      if (!originalTool) {
        toast.error("找不到对应的工具信息");
        return;
      }

      // 检查是否为 Coze 工作流工具
      if (originalTool.serverName === "coze") {
        if (currentEnable) {
          // Coze 工作流工具需要确认对话框
          setCozeToolToRemove(name);
          return; // 等待用户确认
        }
        // 添加 Coze 工作流工具
        await apiClient.addCustomTool(
          {
            workflow_id: "", // Coze 工具不需要 workflow_id
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
        // 普通 MCP 工具 - 使用新的 MCP 工具管理 API
        const action = currentEnable ? "disable" : "enable";
        await apiClient.manageMCPTool({
          action,
          serverName: originalTool.serverName,
          toolName: originalTool.toolName,
          description: originalTool.description,
        });
        toast.success(`${currentEnable ? "禁用" : "启用"}工具 ${name} 成功`);
      }

      // 重新获取工具列表以更新状态
      await refreshToolLists();
    } catch (error) {
      console.error("切换工具状态失败:", error);
      toast.error(error instanceof Error ? error.message : "切换工具状态失败");
    }
  };

  // 确认移除 Coze 工具的处理函数
  const handleConfirmRemoveCozeTool = async () => {
    if (!cozeToolToRemove) return;

    try {
      await apiClient.removeCustomTool(cozeToolToRemove);
      toast.success(`删除工具 ${cozeToolToRemove} 成功`);
      await refreshToolLists();
    } catch (error) {
      console.error("删除 Coze 工具失败:", error);
      toast.error(
        error instanceof Error ? error.message : "删除 Coze 工具失败"
      );
    } finally {
      setCozeToolToRemove(null);
    }
  };

  // 取消移除 Coze 工具的处理函数
  const handleCancelRemoveCozeTool = () => {
    setCozeToolToRemove(null);
  };

  // 处理打开参数配置对话框
  const handleConfigureTool = (tool: any) => {
    // 检查是否为 coze 工具
    if (tool.serverName === "coze") {
      setParameterConfigDialog({
        open: true,
        tool,
      });
    }
  };

  // 处理打开工具调试对话框
  const handleDebugTool = (tool: any) => {
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
  };

  // 从工具对象构建 CozeWorkflow 对象
  const buildCozeWorkflowFromTool = (tool: any): CozeWorkflow => {
    // 如果是 coze 工具，尝试从 handler 中提取信息
    if (tool.serverName === "coze" && tool.handler?.type === "proxy") {
      return {
        workflow_id: tool.handler.config?.workflow_id || "",
        workflow_name: tool.toolName,
        description: tool.description || "",
        icon_url: "",
        app_id: tool.handler.config?.app_id || "",
        creator: { id: "", name: "" },
        created_at: 0,
        updated_at: 0,
        isAddedAsTool: true,
        toolName: tool.name,
        inputSchema: tool.inputSchema,
      };
    }

    // 默认的工作流对象
    return {
      workflow_id: "",
      workflow_name: tool.toolName,
      description: tool.description || "",
      icon_url: "",
      app_id: "",
      creator: { id: "", name: "" },
      created_at: 0,
      updated_at: 0,
      isAddedAsTool: true,
      toolName: tool.name,
      inputSchema: tool.inputSchema,
    };
  };

  // 处理参数配置确认
  const handleParameterConfigConfirm = async (
    workflow: CozeWorkflow,
    parameters: WorkflowParameter[]
  ) => {
    if (!parameterConfigDialog.tool) return;

    try {
      // 构建参数配置
      const parameterConfig =
        parameters.length > 0 ? { parameters } : undefined;

      // 从工具对象构建正确的 CozeWorkflow 对象，确保包含必需的字段
      const cozeWorkflow = buildCozeWorkflowFromTool(
        parameterConfigDialog.tool
      );

      // 更新 workflow_id 和其他必需字段（如果传入的 workflow 有这些字段的话）
      if (workflow.workflow_id) {
        cozeWorkflow.workflow_id = workflow.workflow_id;
      }
      if (workflow.app_id) {
        cozeWorkflow.app_id = workflow.app_id;
      }

      // 构建更新请求
      const updateRequest = {
        type: "coze" as const,
        data: {
          workflow: cozeWorkflow,
          customName: undefined,
          customDescription: undefined,
          parameterConfig,
        },
      };

      // 调用API更新工具配置
      await apiClient.updateCustomTool(
        parameterConfigDialog.tool.name,
        updateRequest
      );

      toast.success(`工具 "${cozeWorkflow.workflow_name}" 参数配置更新成功`);

      // 刷新工具列表
      await refreshToolLists();
    } catch (error) {
      console.error("更新工具参数配置失败:", error);

      let errorMessage = "更新工具参数配置失败，请重试";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setParameterConfigDialog({ open: false });
    }
  };

  // 处理参数配置取消
  const handleParameterConfigCancel = () => {
    setParameterConfigDialog({ open: false });
  };

  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex items-center justify-between px-4 lg:px-6">
            <div>
              <h2 className="text-lg font-semibold">你的聚合 MCP 服务</h2>
              <p className="text-sm text-muted-foreground">
                在这里管理你的 MCP 服务器和工具。
              </p>
            </div>
            {/* <AddMcpServerButton /> */}
          </div>

          <div className="px-4 lg:px-6">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CoffeeIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">还没有 MCP 服务</h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  添加你的第一个 MCP 服务器来开始使用强大的工具集成功能。
                </p>
                <AddMcpServerButton />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">你的聚合 MCP 服务</h2>
          <p className="text-sm text-muted-foreground">
            你可以在这里管理你的 MCP
            服务，包括启用/禁用工具，以及查看工具的详细信息。
          </p>
        </div>
        {isRefreshing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            刷新中...
          </div>
        )}
      </div>
      <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-8 @5xl/main:grid-cols-8 grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
        {/* <div>{JSON.stringify(enabledTools, null, 2)}</div> */}
        <Card className="transition-all duration-200 col-span-3">
          <CardContent className="p-4">
            <div className="flex-col">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                使用中的工具 ({enabledTools.length})
                {isLoadingTools && (
                  <span className="text-xs text-muted-foreground">
                    (加载中...)
                  </span>
                )}
              </h4>
              <div className="flex-1 space-y-2">
                {isLoadingTools ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">
                      加载工具列表中...
                    </div>
                  </div>
                ) : toolsError ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <div className="text-sm text-red-500 mb-2">
                      {toolsError}
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchTools}>
                      重试
                    </Button>
                  </div>
                ) : (
                  enabledTools.map((tool) => (
                    <div
                      key={tool.toolName}
                      className="flex items-start justify-between p-4 bg-slate-50 rounded-md font-mono"
                    >
                      <div className="text-md flex flex-col gap-2">
                        <div className="flex items-center gap-2 justify-start">
                          <Badge variant="secondary" className="rounded-md">
                            {tool.serverName}
                          </Badge>
                          <span>{tool.toolName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground my-2">
                          {tool.description}
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            <span className="text-muted-foreground">
                              使用次数:
                            </span>{" "}
                            <span className="text-primary font-bold">
                              {tool.usageCount || 0}
                            </span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            <span className="text-muted-foreground">
                              最后使用:
                            </span>{" "}
                            <span className="text-primary font-bold">
                              {tool.lastUsedTime || "-"}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {tool.serverName === "customMCP" && (
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8 hover:bg-blue-500 hover:text-white"
                            onClick={() => handleConfigureTool(tool)}
                            title="配置参数"
                          >
                            <Settings size={16} />
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-8 hover:bg-blue-500 hover:text-white"
                          onClick={() => handleDebugTool(tool)}
                          title="调试工具"
                        >
                          <ZapIcon size={18} />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-8 hover:bg-red-500 hover:text-white"
                          onClick={() => handleToggleTool(tool.name, true)}
                        >
                          <MinusIcon size={18} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 col-span-3">
          <CardContent className="p-4">
            <div className="flex-col">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                未使用的工具 ({disabledTools.length})
                {isLoadingTools && (
                  <span className="text-xs text-muted-foreground">
                    (加载中...)
                  </span>
                )}
              </h4>
              <div className="flex-1 space-y-2">
                {isLoadingTools ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">
                      加载工具列表中...
                    </div>
                  </div>
                ) : toolsError ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <div className="text-sm text-red-500 mb-2">
                      {toolsError}
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchTools}>
                      重试
                    </Button>
                  </div>
                ) : disabledTools.length === 0 ? (
                  // 保持原有的空状态显示
                  <div className="flex-1 flex flex-col items-center gap-4 py-20 px-4 bg-slate-50 rounded-md font-mono h-full">
                    <CoffeeIcon
                      strokeWidth={1.5}
                      size={48}
                      className="text-muted-foreground"
                    />
                    <span className="text-sm text-muted-foreground">
                      全部工具都已经启用
                    </span>
                  </div>
                ) : (
                  disabledTools.map((tool) => (
                    <div
                      key={tool.toolName}
                      className="flex items-start justify-between p-4 bg-slate-50 rounded-md font-mono"
                    >
                      <div className="text-md flex flex-col gap-2">
                        <div className="flex items-center gap-2 justify-start">
                          <Badge variant="secondary" className="rounded-md">
                            {tool.serverName}
                          </Badge>
                          <span>{tool.toolName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            <span className="text-muted-foreground">
                              使用次数:
                            </span>{" "}
                            <span className="text-primary font-bold">
                              {tool.usageCount || 0}
                            </span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            <span className="text-muted-foreground">
                              最后使用:
                            </span>{" "}
                            <span className="text-primary font-bold">
                              {tool.lastUsedTime || "-"}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-8 hover:bg-green-500 hover:text-white"
                          onClick={() => handleToggleTool(tool.name, false)}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="transition-all duration-200 gap-4 flex flex-col col-span-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AddMcpServerButton />
              <RestartButton />
            </div>
            <CozeWorkflowIntegration onToolAdded={refreshToolLists} />
          </div>
          {Object.entries(mcpServers || {}).map(
            ([mcpServerName, mcpServer]) => (
              <Card
                key={mcpServerName}
                className={"transition-all duration-200"}
              >
                <CardContent className="p-0">
                  <div className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        {/* <div className="mt-1">{getStatusIcon(service.status)}</div> */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold">
                              {mcpServerName}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <McpServerSettingButton
                          mcpServerName={mcpServerName}
                          mcpServer={mcpServer as MCPServerConfig}
                        />
                        <RemoveMcpServerButton
                          mcpServerName={mcpServerName}
                          onRemoveSuccess={handleRefreshData}
                          disabled={isRefreshing}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-2">
                  <Badge variant="outline" className="text-xs">
                    {getMcpServerCommunicationType(mcpServer)}
                  </Badge>
                </CardFooter>
              </Card>
            )
          )}
        </div>
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

      {/* 参数配置对话框 */}
      {parameterConfigDialog.tool && (
        <WorkflowParameterConfigDialog
          open={parameterConfigDialog.open}
          onOpenChange={(open) =>
            setParameterConfigDialog((prev) => ({ ...prev, open }))
          }
          workflow={parameterConfigDialog.tool}
          onConfirm={handleParameterConfigConfirm}
          onCancel={handleParameterConfigCancel}
          title="配置工作流参数"
        />
      )}

      {/* 工具调试对话框 */}
      <ToolDebugDialog
        open={debugDialog.open}
        onOpenChange={(open) => setDebugDialog((prev) => ({ ...prev, open }))}
        tool={debugDialog.tool || null}
      />
    </div>
  );
}
