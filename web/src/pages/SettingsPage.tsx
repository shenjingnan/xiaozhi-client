import { AppSidebar } from "@/components/AppSidebar";
import { RestartButton } from "@/components/RestartButton";
import { SiteHeader } from "@/components/SiteHeder";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebSocketConfig } from "@/stores/websocket";
import type { AppConfig } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  modelscope: z.object({
    apiKey: z.string().min(2, {
      message: "API Key不能为空",
    }),
  }),
  connection: z.object({
    heartbeatInterval: z.number().min(1000, {
      message: "心跳间隔不能小于1000毫秒",
    }),
    heartbeatTimeout: z.number().min(1000, {
      message: "心跳超时不能小于1000毫秒",
    }),
    reconnectInterval: z.number().min(1000, {
      message: "重连间隔不能小于1000毫秒",
    }),
  }),
});

export default function SettingsPage() {
  const config = useWebSocketConfig();
  const { updateConfig } = useWebSocket();
  console.log(config);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      modelscope: {
        apiKey: config?.modelscope?.apiKey || "",
      },
      connection: {
        heartbeatInterval: config?.connection?.heartbeatInterval || 30000,
        heartbeatTimeout: config?.connection?.heartbeatTimeout || 10000,
        reconnectInterval: config?.connection?.reconnectInterval || 5000,
      },
    },
  });

  useEffect(() => {
    form.reset({
      modelscope: {
        apiKey: config?.modelscope?.apiKey || "",
      },
      connection: {
        heartbeatInterval: config?.connection?.heartbeatInterval || 30000,
        heartbeatTimeout: config?.connection?.heartbeatTimeout || 10000,
        reconnectInterval: config?.connection?.reconnectInterval || 5000,
      },
    });
  }, [config, form.reset]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsLoading(true);
    try {
      const newConfig: AppConfig = {
        ...config,
        modelscope: {
          apiKey: values.modelscope.apiKey,
        },
        connection: {
          heartbeatInterval: values.connection.heartbeatInterval,
          heartbeatTimeout: values.connection.heartbeatTimeout,
          reconnectInterval: values.connection.reconnectInterval,
        },
      };

      await updateConfig(newConfig);
      toast.success("配置已更新");
    } catch (error) {
      console.error("更新配置失败:", error);
      toast.error(error instanceof Error ? error.message : "更新配置失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="设置" />
        <div className="flex flex-1 flex-col p-4">
          <div className="@container/main flex flex-1 flex-col gap-2 items-center">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 w-[600px]">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="modelscope.apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>魔搭社区 API Key</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="魔搭社区 API Key"
                                className="font-mono text-sm"
                                type="password"
                                disabled={isLoading}
                                {...field}
                              />
                            </FormControl>
                            <Button
                              variant="outline"
                              onClick={() => {
                                window.open(
                                  "https://www.modelscope.cn/my/myaccesstoken",
                                  "_blank"
                                );
                              }}
                            >
                              打开魔搭社区
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="connection.heartbeatInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>心跳间隔（毫秒）</FormLabel>
                          <div className="flex gap-2 items-center">
                            <FormControl>
                              <Input
                                placeholder="心跳间隔（毫秒）"
                                className="font-mono text-sm"
                                type="number"
                                disabled={isLoading}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(
                                    value === "" ? "" : Number(value)
                                  );
                                }}
                              />
                            </FormControl>
                            <span className="text-sm text-muted-foreground w-[50px]">
                              毫秒
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="connection.heartbeatTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>心跳超时（毫秒）</FormLabel>
                          <div className="flex gap-2 items-center">
                            <FormControl>
                              <Input
                                placeholder="心跳超时（毫秒）"
                                className="font-mono text-sm"
                                type="number"
                                disabled={isLoading}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(
                                    value === "" ? "" : Number(value)
                                  );
                                }}
                              />
                            </FormControl>
                            <span className="text-sm text-muted-foreground w-[50px]">
                              毫秒
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="connection.reconnectInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>重连间隔（毫秒）</FormLabel>
                          <div className="flex gap-2 items-center">
                            <FormControl>
                              <Input
                                placeholder="重连间隔（毫秒）"
                                className="font-mono text-sm"
                                type="number"
                                disabled={isLoading}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(
                                    value === "" ? "" : Number(value)
                                  );
                                }}
                              />
                            </FormControl>
                            <span className="text-sm text-muted-foreground w-[50px]">
                              毫秒
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1"
                      >
                        {isLoading ? "保存中..." : "保存"}
                      </Button>
                      <RestartButton />
                    </div>
                  </div>
                </form>
              </Form>
              {/* <DashboardWithStore /> */}
              {/* ModelScope APIKey */}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
