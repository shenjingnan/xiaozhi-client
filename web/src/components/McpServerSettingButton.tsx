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

import { useWebSocketContext } from "@/providers/WebSocketProvider";
import { useWebSocketConfig } from "@/stores/websocket";
import type { MCPServerConfig } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { Textarea } from "./ui/textarea";

const formSchema = z.object({
  config: z.string().min(2, {
    message: "配置不能为空",
  }),
});

export function McpServerSettingButton({
  mcpServer,
  mcpServerName,
}: {
  mcpServer: MCPServerConfig;
  mcpServerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const config = useWebSocketConfig();
  const { websocket } = useWebSocketContext();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      config: JSON.stringify(mcpServer, null, 2),
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsLoading(true);
    try {
      // 解析用户输入的JSON配置
      let newMcpServerConfig: MCPServerConfig;
      try {
        newMcpServerConfig = JSON.parse(values.config);
      } catch (error) {
        toast.error("JSON格式错误，请检查配置格式");
        return;
      }

      // 验证配置格式
      if (!newMcpServerConfig || typeof newMcpServerConfig !== "object") {
        toast.error("配置格式无效");
        return;
      }

      // 更新配置
      const updatedConfig = {
        ...config,
        mcpServers: {
          ...config.mcpServers,
          [mcpServerName]: newMcpServerConfig,
        },
      };

      await websocket.sendUpdateConfig(updatedConfig);
      toast.success("MCP服务器配置已更新");
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
        <Button variant="secondary" size="icon" className="size-8">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="mb-4">
              <DialogTitle>配置 {mcpServerName} MCP</DialogTitle>
              <DialogDescription>
                点击保存后，需要重启服务才会生效。
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
                        placeholder="MCP服务配置"
                        className="resize-none h-[300px] font-mono text-sm"
                        disabled={isLoading}
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
