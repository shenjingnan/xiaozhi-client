import { AppSidebar } from "@/components/AppSidebar";
import { RestartButton } from "@/components/RestartButton";
import { SiteHeader } from "@/components/SiteHeder";
import { VersionManager } from "@/components/VersionManager";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWebSocketActions } from "@/providers/WebSocketProvider";
import { useConfig } from "@/stores/config";
import type { AppConfig } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  modelscope: z.object({
    apiKey: z.string().optional(),
  }),
  platforms: z.object({
    coze: z.object({
      token: z.string().optional(),
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
  const config = useConfig();
  const { updateConfig } = useWebSocketActions();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platforms: {
        coze: {
          token: config?.platforms?.coze?.token || "",
        },
      },
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
        platforms: {
          ...(config?.platforms ?? {}),
          coze: {
            ...(config?.platforms?.coze ?? {}),
            token: values.platforms.coze.token,
          },
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
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 w-full max-w-4xl">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="general">常规设置</TabsTrigger>
                  <TabsTrigger value="version">版本管理</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-6">
                  <div className="w-[600px] mx-auto">
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
                                      autoComplete="off"
                                      data-1p-ignore
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
                            name="platforms.coze.token"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>扣子身份凭证</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <Input
                                      placeholder="扣子身份凭证"
                                      className="font-mono text-sm"
                                      type="password"
                                      autoComplete="off"
                                      data-1p-ignore
                                      disabled={isLoading}
                                      {...field}
                                    />
                                  </FormControl>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      window.open(
                                        "https://www.coze.cn/open/oauth/sats",
                                        "_blank"
                                      );
                                    }}
                                  >
                                    打开扣子平台
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
                  </div>
                </TabsContent>

                <TabsContent value="version" className="mt-6">
                  <div className="w-[600px] mx-auto">
                    <VersionManager />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
