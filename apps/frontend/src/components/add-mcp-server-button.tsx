import { McpServerForm } from "@/components/mcp-server-form";
import { Button } from "@/components/ui/button";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMcpFormDialog, type jsonFormSchema } from "@/hooks/useMcpFormDialog";
import type { mcpFormSchema } from "@/schemas/mcp-form";
import { apiClient } from "@/services/api";
import { formToApiConfig } from "@/utils/mcpFormConverter";
import { validateMCPConfig } from "@/utils/mcpValidation";
import { PlusIcon } from "lucide-react";
import { useCallback } from "react";
import type { z } from "zod";
import { toast } from "sonner";

export function AddMcpServerButton() {
  const {
    open,
    setOpen,
    isLoading,
    setIsLoading,
    inputMode,
    setJsonInput,
    form,
    advancedForm,
    handleOpenChange,
    handleModeChange,
  } = useMcpFormDialog({
    defaultFormValues: {
      type: "stdio",
      name: "",
      command: "",
      env: "",
    },
  });

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
    [form, setIsLoading, setOpen]
  );

  // 高级模式提交处理
  const handleAdvancedSubmit = useCallback(
    async (values: z.infer<typeof jsonFormSchema>) => {
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
        for (const [serverName, serverConfig] of Object.entries(
          parsedServers
        )) {
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
        advancedForm.reset();
        setOpen(false);
      } catch (error) {
        console.error("更新配置失败:", error);
        toast.error(error instanceof Error ? error.message : "更新配置失败");
      } finally {
        setIsLoading(false);
      }
    },
    [advancedForm, setIsLoading, setOpen]
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
        <Tabs value={inputMode} onValueChange={handleModeChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">表单模式</TabsTrigger>
            <TabsTrigger value="json">高级模式</TabsTrigger>
          </TabsList>

          {/* 表单模式 */}
          <TabsContent value="form" className="mt-4">
            <McpServerForm
              form={form}
              onSubmit={handleFormSubmit}
              disabled={isLoading}
              submitText={isLoading ? "保存中..." : "保存配置"}
            />
          </TabsContent>

          {/* 高级模式 */}
          <TabsContent value="json" className="mt-4">
            <Form {...advancedForm}>
              <form onSubmit={advancedForm.handleSubmit(handleAdvancedSubmit)}>
                <div className="grid gap-4">
                  <FormField
                    control={advancedForm.control}
                    name="config"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            className="resize-none h-[300px] font-mono text-sm"
                            disabled={isLoading}
                            placeholder={`支持三种通信方式：

1. 本地进程 (stdio):
{
  "mcpServers": {
    "local-server": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"]
    }
  }
}

2. 服务器推送 (SSE):
{
  "mcpServers": {
    "sse-server": {
      "type": "sse",
      "url": "https://example.com/sse"
    }
  }
}

3. 流式 HTTP:
{
  "mcpServers": {
    "http-server": {
      "url": "https://example.com/mcp"
    }
  }
}`}
                            {...field}
                            onChange={(event) => {
                              field.onChange(event);
                              setJsonInput(event.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="outline" disabled={isLoading}>
                      取消
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "保存中..." : "保存"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
