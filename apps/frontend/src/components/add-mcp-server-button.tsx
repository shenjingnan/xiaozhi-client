import { MCPConfigEditor } from "@/components/mcp-config-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { mcpFormSchema } from "@/schemas/mcp-form";
import { apiClient } from "@/services/api";
import { formToApiConfig } from "@/utils/mcpFormConverter";
import { validateMCPConfig } from "@/utils/mcpValidation";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

export function AddMcpServerButton() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 表单模式的表单实例
  const form = useForm<z.infer<typeof mcpFormSchema>>({
    resolver: zodResolver(mcpFormSchema),
    defaultValues: {
      type: "stdio",
      name: "",
      command: "",
      env: "",
    },
  });

  // 默认表单值（用于重置）
  const defaultFormValues: z.infer<typeof mcpFormSchema> = {
    type: "stdio",
    name: "",
    command: "",
    env: "",
  };

  // 表单模式提交处理
  const handleFormSubmit = useCallback(
    async (values: z.infer<typeof mcpFormSchema>) => {
      setIsLoading(true);
      try {
        // 转换表单数据为 API 配置
        const { name, config } = formToApiConfig(values);

        // 检查重名
        const existingServers = await apiClient.listMCPServers();
        if (existingServers.servers.some((server) => server.name === name)) {
          toast.error(`服务名称 "${name}" 已存在`);
          return;
        }

        // 调用API添加服务器
        const result = await apiClient.addMCPServer(name, config);
        if (!result) {
          throw new Error("添加服务器失败");
        }

        toast.success(`已添加 MCP 服务 "${name}"`);

        // 重置表单并关闭对话框
        form.reset();
        setOpen(false);
      } catch (error) {
        console.error("更新配置失败:", error);
        toast.error(error instanceof Error ? error.message : "更新配置失败");
      } finally {
        setIsLoading(false);
      }
    },
    [form]
  );

  // 高级模式提交处理
  const handleJsonSubmit = useCallback(async (values: { config: string }) => {
    setIsLoading(true);
    try {
      // 验证用户输入的配置
      const validation = validateMCPConfig(values.config);

      if (!validation.success) {
        toast.error(validation.error || "配置验证失败");
        return;
      }

      const parsedServers = validation.data!;

      // 检查重名
      const existingServers = await apiClient.listMCPServers();
      const existingNames = Object.keys(parsedServers).filter((name) =>
        existingServers.servers.some((server) => server.name === name)
      );
      if (existingNames.length > 0) {
        toast.error(
          `服务名称冲突: 以下服务已存在: ${existingNames.join(", ")}`
        );
        return;
      }

      // 调用API添加服务器
      for (const [serverName, serverConfig] of Object.entries(parsedServers)) {
        const result = await apiClient.addMCPServer(serverName, serverConfig);
        if (!result) {
          throw new Error("添加服务器失败");
        }
      }

      // 成功反馈
      const addedCount = Object.keys(parsedServers).length;
      toast.success(
        addedCount === 1
          ? `已添加 MCP 服务 "${Object.keys(parsedServers)[0]}"`
          : `已添加 ${addedCount} 个 MCP 服务`
      );

      // 重置表单并关闭对话框
      setOpen(false);
    } catch (error) {
      console.error("更新配置失败:", error);
      toast.error(error instanceof Error ? error.message : "更新配置失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 使用 MCPConfigEditor 组件
  const editor = MCPConfigEditor({
    form,
    defaultValues: defaultFormValues,
    onFormSubmit: handleFormSubmit,
    onJsonSubmit: handleJsonSubmit,
    disabled: isLoading,
    isLoading,
    submitText: "保存配置",
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
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          aria-label="添加MCP服务"
          title="添加MCP服务"
        >
          <PlusIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="mb-4">
          <DialogTitle>添加MCP服务</DialogTitle>
          <DialogDescription>添加后，需要重启服务才会生效。</DialogDescription>
        </DialogHeader>

        {/* 模式切换 */}
        {editor.renderTabs()}
      </DialogContent>
    </Dialog>
  );
}
