import { MCPConfigEditor } from "@/components/mcp-config-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNetworkServiceActions } from "@/providers/NetworkServiceProvider";
import { mcpFormSchema } from "@/schemas/mcp-form";
import { useConfig } from "@/stores/config";
import { apiConfigToForm, formToApiConfig } from "@/utils/mcpFormConverter";
import { validateMCPConfig } from "@/utils/mcpValidation";
import { zodResolver } from "@hookform/resolvers/zod";
import type { MCPServerConfig } from "@xiaozhi-client/shared-types";
import { SettingsIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

export function McpServerSettingButton({
  mcpServer,
  mcpServerName,
}: {
  mcpServer: MCPServerConfig;
  mcpServerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const config = useConfig();
  const { updateConfig } = useNetworkServiceActions();

  // 将现有配置转换为表单数据
  const defaultFormValues = apiConfigToForm(mcpServerName, mcpServer);

  // 表单模式的表单实例
  const form = useForm<z.infer<typeof mcpFormSchema>>({
    resolver: zodResolver(mcpFormSchema),
    defaultValues: defaultFormValues,
  });

  // 初始 JSON 配置字符串
  const initialJsonConfig = JSON.stringify(
    { mcpServers: { [mcpServerName]: mcpServer } },
    null,
    2
  );

  // 表单模式提交处理
  const handleFormSubmit = useCallback(
    async (values: z.infer<typeof mcpFormSchema>) => {
      if (!config) {
        toast.error("配置数据未加载，请稍后重试");
        return;
      }

      setIsLoading(true);
      try {
        // 转换表单数据为 API 配置
        const { name, config: newServerConfig } = formToApiConfig(values);

        // 构建更新后的配置
        let updatedConfig = { ...config };

        // 如果名称改变，删除旧名称的配置
        if (name !== mcpServerName) {
          const { [mcpServerName]: _removed, ...remainingServers } =
            updatedConfig.mcpServers;
          updatedConfig.mcpServers = remainingServers;
        }

        // 添加新名称的配置
        updatedConfig = {
          ...updatedConfig,
          mcpServers: {
            ...updatedConfig.mcpServers,
            [name]: newServerConfig,
          },
        };

        await updateConfig(updatedConfig);

        const nameChanged = name !== mcpServerName;
        toast.success(
          nameChanged
            ? `MCP 服务 "${mcpServerName}" 已重命名为 "${name}"`
            : `MCP 服务 "${name}" 配置已更新`
        );

        setOpen(false);
      } catch (error) {
        console.error("更新配置失败:", error);
        toast.error(error instanceof Error ? error.message : "更新配置失败");
      } finally {
        setIsLoading(false);
      }
    },
    [config, mcpServerName, updateConfig]
  );

  // 高级模式提交处理
  const handleJsonSubmit = useCallback(
    async (values: { config: string }) => {
      if (!config) {
        toast.error("配置数据未加载，请稍后重试");
        return;
      }

      setIsLoading(true);
      try {
        // 验证用户输入的配置
        const validation = validateMCPConfig(values.config);

        if (!validation.success) {
          toast.error(validation.error || "配置验证失败");
          return;
        }

        const parsedServers = validation.data!;

        // 高级模式只允许编辑单个服务
        const serverEntries = Object.entries(parsedServers);
        if (serverEntries.length !== 1) {
          toast.error("编辑模式只能修改单个 MCP 服务配置");
          return;
        }

        const [newName, newServerConfig] = serverEntries[0] as [
          string,
          MCPServerConfig,
        ];

        // 构建更新后的配置
        let updatedConfig = { ...config };

        // 如果名称改变，删除旧名称的配置
        if (newName !== mcpServerName) {
          const { [mcpServerName]: _removed, ...remainingServers } =
            updatedConfig.mcpServers;
          updatedConfig.mcpServers = remainingServers;
        }

        // 添加新名称的配置
        updatedConfig = {
          ...updatedConfig,
          mcpServers: {
            ...updatedConfig.mcpServers,
            [newName]: newServerConfig,
          },
        };

        await updateConfig(updatedConfig);

        const nameChanged = newName !== mcpServerName;
        toast.success(
          nameChanged
            ? `MCP 服务 "${mcpServerName}" 已重命名为 "${newName}"`
            : `MCP 服务 "${newName}" 配置已更新`
        );

        setOpen(false);
      } catch (error) {
        console.error("更新配置失败:", error);
        toast.error(error instanceof Error ? error.message : "更新配置失败");
      } finally {
        setIsLoading(false);
      }
    },
    [config, mcpServerName, updateConfig]
  );

  // 使用 MCPConfigEditor 组件
  const editor = MCPConfigEditor({
    form,
    defaultValues: defaultFormValues,
    onFormSubmit: handleFormSubmit,
    onJsonSubmit: handleJsonSubmit,
    disabled: isLoading,
    isLoading,
    submitText: "保存",
    initialJsonConfig,
  });

  // 当弹窗关闭时重置状态
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        editor.resetState();
      }
      setOpen(newOpen);
    },
    [editor]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 hover:cursor-pointer hover:text-primary transition-all duration-100"
        >
          <SettingsIcon size={14} />
          <span>配置</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="mb-4">
          <DialogTitle>配置 {mcpServerName} MCP</DialogTitle>
          <DialogDescription>
            点击保存后，需要重启服务才会生效。
          </DialogDescription>
        </DialogHeader>

        {/* 模式切换 */}
        {editor.renderTabs()}
      </DialogContent>
    </Dialog>
  );
}
