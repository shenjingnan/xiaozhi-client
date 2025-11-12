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
import { mcpServerApi } from "@/services/api";
import { useConfig } from "@/stores/config";
import type { MCPServerConfig } from "@/types/index";
import { getMcpServerCommunicationType } from "@/utils/mcpServerUtils";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
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

export function AddMcpServerButton() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const config = useConfig();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      config: "",
    },
  });

  // 验证结果接口
  interface ValidationResult {
    success: boolean;
    data?: Record<string, MCPServerConfig>;
    error?: string;
  }

  // 验证单个 MCP 服务配置
  const validateSingleServerConfig = (
    serverName: string,
    serverConfig: any
  ): { valid: boolean; error?: string } => {
    if (!serverConfig || typeof serverConfig !== "object") {
      return {
        valid: false,
        error: `服务 "${serverName}" 的配置必须是一个对象`,
      };
    }

    // 先进行基本字段检查，避免 getMcpServerCommunicationType 抛出错误
    const hasCommand = "command" in serverConfig;
    const hasType = "type" in serverConfig;
    const hasUrl = "url" in serverConfig;

    // 判断配置类型并验证相应字段
    if (hasCommand) {
      // stdio 类型
      if (!serverConfig.command || typeof serverConfig.command !== "string") {
        return {
          valid: false,
          error: `服务 "${serverName}" 缺少必需的 command 字段或字段类型不正确`,
        };
      }
      if (!Array.isArray(serverConfig.args)) {
        return {
          valid: false,
          error: `服务 "${serverName}" 的 args 字段必须是数组`,
        };
      }
    } else if (hasType && serverConfig.type === "sse") {
      // sse 类型
      if (!serverConfig.url || typeof serverConfig.url !== "string") {
        return {
          valid: false,
          error: `服务 "${serverName}" 缺少必需的 url 字段或字段类型不正确`,
        };
      }
    } else if (hasUrl) {
      // streamable-http 类型
      if (!serverConfig.url || typeof serverConfig.url !== "string") {
        return {
          valid: false,
          error: `服务 "${serverName}" 缺少必需的 url 字段或字段类型不正确`,
        };
      }
    } else {
      // 无法识别的配置类型
      return {
        valid: false,
        error: `服务 "${serverName}" 的配置无效: 必须包含 command 字段（stdio）、type: 'sse' 字段（sse）或 url 字段（streamable-http）`,
      };
    }

    // 最后用工具函数验证配置是否完整
    try {
      getMcpServerCommunicationType(serverConfig);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `服务 "${serverName}" 的配置无效: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
      };
    }
  };

  // 验证 MCP 配置的函数
  const validateMCPConfig = (input: string): ValidationResult => {
    try {
      const trimmed = input.trim();
      if (!trimmed) {
        return { success: false, error: "配置不能为空" };
      }

      const parsed = JSON.parse(trimmed);

      let mcpServers: Record<string, any>;

      // 检查是否包含 mcpServers 层
      if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
        mcpServers = parsed.mcpServers;
      } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
        // 检查是否是单个服务配置
        try {
          getMcpServerCommunicationType(parsed);
          // 如果能识别类型，说明是单个服务配置，生成默认名称
          const defaultName = parsed.command
            ? parsed.command.split("/").pop() || "mcp-server"
            : parsed.type === "sse"
              ? "sse-server"
              : "http-server";
          mcpServers = { [defaultName]: parsed };
        } catch {
          // 无法识别为单个服务配置，认为是多个服务的配置对象
          mcpServers = parsed;
        }
      } else {
        return { success: false, error: "配置格式错误: 必须是对象格式" };
      }

      // 验证每个服务配置
      for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
        const validation = validateSingleServerConfig(serverName, serverConfig);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }

      return { success: true, data: mcpServers };
    } catch (error) {
      return {
        success: false,
        error: `JSON 格式错误: ${
          error instanceof Error ? error.message : "无法解析 JSON"
        }`,
      };
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
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

      // 检查重名 - 需要调用API获取当前服务器列表
      const existingServers = await mcpServerApi.listServers();
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
        const result = await mcpServerApi.addServer(serverName, serverConfig);
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
