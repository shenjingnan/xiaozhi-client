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
import type { MCPServerConfig } from "@/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebSocketConfig } from "@/stores/websocket";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "./ui/textarea";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  config: z.string().min(2, {
    message: "配置不能为空",
  }),
});

export function AddMcpServerButton() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { updateConfig } = useWebSocket();
  const config = useWebSocketConfig();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      config: "",
    },
  });

  // 解析 MCP 配置的函数，复制自 MCPServerList.tsx
  const parseMCPConfig = (
    input: string
  ): Record<string, MCPServerConfig> | null => {
    try {
      const trimmed = input.trim();
      if (!trimmed) return null;

      const parsed = JSON.parse(trimmed);

      // 检查是否包含 mcpServers 层
      if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
        return parsed.mcpServers;
      }

      // 检查是否是直接的服务配置对象
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        // 判断是否是单个服务配置（有 command 或 type 字段）
        if (
          "command" in parsed ||
          ("type" in parsed && parsed.type === "sse")
        ) {
          // 生成一个默认名称
          const defaultName = parsed.command
            ? parsed.command.split("/").pop() || "mcp-server"
            : "sse-server";
          return { [defaultName]: parsed };
        }

        // 否则认为是多个服务的配置对象
        return parsed;
      }

      return null;
    } catch (error) {
      console.error("解析配置失败:", error);
      return null;
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsLoading(true);
    try {
      // 解析用户输入的配置
      const parsedServers = parseMCPConfig(values.config);

      if (!parsedServers) {
        toast.error("配置格式错误: 请输入有效的 JSON 配置");
        return;
      }

      // 检查是否有重名的服务
      const existingNames = Object.keys(parsedServers).filter(
        (name) => name in (config.mcpServers || {})
      );
      if (existingNames.length > 0) {
        toast.error(
          `服务名称冲突: 以下服务已存在: ${existingNames.join(", ")}`
        );
        return;
      }

      // 更新配置
      const updatedConfig = {
        ...config,
        mcpServers: {
          ...parsedServers,
          ...config.mcpServers,
        },
      };

      await updateConfig(updatedConfig);

      // 成功反馈
      const addedCount = Object.keys(parsedServers).length;
      toast.success(
        addedCount === 1
          ? `已添加 MCP 服务 "${Object.keys(parsedServers)[0]}"`
          : `已添加 ${addedCount} 个 MCP 服务`
      );

      // 重置表单并关闭对话框
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("更新配置失败:", error);
      toast.error(error instanceof Error ? error.message : "更新配置失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" className="w-full">
          <PlusIcon className="h-4 w-4" />
          <span>添加MCP服务</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="mb-4">
              <DialogTitle>添加MCP服务</DialogTitle>
              <DialogDescription>
                添加后，需要重启服务才会生效。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="config"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        className="resize-none h-[300px] font-mono text-sm"
                        disabled={isLoading}
                        placeholder={`例如：
{
  "mcpServers": {
    "example-server": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"]
    }
  }
}`}
                        {...field}
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
      </DialogContent>
    </Dialog>
  );
}
