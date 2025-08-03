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
import { useWebSocketConfig } from "@/stores/websocket";
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
  const config = useWebSocketConfig();
  const { updateConfig } = useWebSocket();

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

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsLoading(true);
    try {
      // 更新配置中的 webUI.port
      const updatedConfig = {
        ...config,
        webUI: {
          ...config.webUI,
          port: Number(values.port),
        },
      };

      await updateConfig(updatedConfig);
      toast.success("端口配置已更新");
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
      <DialogContent className="sm:max-w-[250px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="mb-4">
              <DialogTitle>配置服务端</DialogTitle>
              <DialogDescription>
                点击保存后，需要重启服务才会生效。
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <div>ws://localhost</div>
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
