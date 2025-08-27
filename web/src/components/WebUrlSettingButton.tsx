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
import { Input } from "@/components/ui/input";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConfig } from "@/stores/config";
import {
  useWebSocketConnected,
  useWebSocketPortChangeStatus,
} from "@/stores/websocket";
import { zodResolver } from "@hookform/resolvers/zod";
import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  port: z
    .string()
    .min(1, { message: "端口号不能为空" })
    .refine((val) => !Number.isNaN(Number(val)), {
      message: "请输入有效的数字",
    })
    .refine((val) => Number(val) >= 1 && Number(val) <= 65535, {
      message: "端口号必须在 1-65535 之间",
    })
    .refine((val) => Number.isInteger(Number(val)), {
      message: "端口号必须是整数",
    }),
});

export function WebUrlSettingButton() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const config = useConfig();
  const connected = useWebSocketConnected();
  const portChangeStatus = useWebSocketPortChangeStatus();
  const { changePort } = useWebSocket();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      port: "9999",
    },
  });

  // 当配置加载后，更新表单默认值
  useEffect(() => {
    if (config?.webUI?.port) {
      form.reset({
        port: config.webUI.port.toString(),
      });
    }
  }, [config, form]);

  // 获取按钮文本
  const getButtonText = () => {
    if (isLoading) {
      return "处理中...";
    }

    if (portChangeStatus?.status === "checking") {
      return "检测端口...";
    }

    if (portChangeStatus?.status === "polling") {
      const { currentAttempt, maxAttempts } = portChangeStatus;
      return `等待服务重启 (${currentAttempt || 0}/${maxAttempts || 45})`;
    }

    if (portChangeStatus?.status === "connecting") {
      return "连接中...";
    }

    return connected ? "保存并重启" : "保存并连接";
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const newPort = Number(values.port);
    const currentPort = config?.webUI?.port;

    // 如果端口号没有变化，直接关闭对话框
    if (newPort === currentPort) {
      setOpen(false);
      return;
    }

    console.log(
      `[WebUrlSettingButton] 开始端口切换: ${currentPort} -> ${newPort}`
    );
    setIsLoading(true);

    try {
      // 显示开始处理的提示
      toast.info(
        connected
          ? `正在将端口从 ${currentPort} 切换到 ${newPort}...`
          : `正在连接到端口 ${newPort}...`
      );

      await changePort(newPort);

      // 成功提示
      toast.success(
        connected
          ? `端口已成功切换到 ${newPort}，页面即将刷新...`
          : `已成功连接到端口 ${newPort}，页面即将刷新...`
      );
      setOpen(false);
    } catch (error) {
      console.error("端口切换失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "端口切换失败";
      toast.error(`端口切换失败: ${errorMessage}`);
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
      <DialogContent className="sm:max-w-[250px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="mb-4">
              <DialogTitle>配置服务端端口</DialogTitle>
              <DialogDescription>
                {connected
                  ? "修改端口后将自动重启服务并重新连接。"
                  : "请输入服务端端口号，系统将尝试连接。"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <div>ws://{window.location.hostname}:</div>
              <div className="w-[100px]">
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="服务端端口，默认9999"
                          className="font-mono text-sm"
                          disabled={isLoading}
                          type="number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button variant="outline" disabled={isLoading}>
                  取消
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isLoading || portChangeStatus?.status === "polling"}
              >
                {getButtonText()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
