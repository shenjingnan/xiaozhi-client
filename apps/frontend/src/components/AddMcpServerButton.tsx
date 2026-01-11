import { McpServerForm } from "@/components/McpServerForm";
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
import { mcpFormSchema } from "@/schemas/mcp-form";
import { mcpServerApi } from "@/services/api";
import {
  formToApiConfig,
  formToJson,
  jsonToFormData,
} from "@/utils/mcpFormConverter";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@ui/textarea";
import type { MCPServerConfig } from "@xiaozhi-client/shared-types";
import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

// 高级模式的 JSON 表单 schema
const jsonFormSchema = z.object({
  config: z.string().min(2, {
    message: "配置不能为空",
  }),
});

// 验证结果接口
interface ValidationResult {
  success: boolean;
  data?: Record<string, MCPServerConfig>;
  error?: string;
}

// 验证单个 MCP 服务配置
function validateSingleServerConfig(
  serverName: string,
  serverConfig: unknown
): { valid: boolean; error?: string } {
  if (!serverConfig || typeof serverConfig !== "object") {
    return {
      valid: false,
      error: `服务 "${serverName}" 的配置必须是一个对象`,
    };
  }

  const config = serverConfig as Record<string, unknown>;

  // 先进行基本字段检查
  const hasCommand = "command" in config;
  const hasType = "type" in config;
  const hasUrl = "url" in config;

  // 判断配置类型并验证相应字段
  if (hasCommand) {
    // stdio 类型
    if (!config.command || typeof config.command !== "string") {
      return {
        valid: false,
        error: `服务 "${serverName}" 缺少必需的 command 字段或字段类型不正确`,
      };
    }
    if (!Array.isArray(config.args)) {
      return {
        valid: false,
        error: `服务 "${serverName}" 的 args 字段必须是数组`,
      };
    }
  } else if (hasType && config.type === "sse") {
    // sse 类型
    if (!config.url || typeof config.url !== "string") {
      return {
        valid: false,
        error: `服务 "${serverName}" 缺少必需的 url 字段或字段类型不正确`,
      };
    }
  } else if (hasUrl) {
    // streamable-http 类型
    if (!config.url || typeof config.url !== "string") {
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

  return { valid: true };
}

// 验证 MCP 配置的函数（用于高级模式）
function validateMCPConfig(input: string): ValidationResult {
  try {
    const trimmed = input.trim();
    if (!trimmed) {
      return { success: false, error: "配置不能为空" };
    }

    const parsed = JSON.parse(trimmed);

    let mcpServers: Record<string, unknown>;

    // 检查是否包含 mcpServers 层
    if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
      mcpServers = parsed.mcpServers as Record<string, unknown>;
    } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
      // 检查是否是单个服务配置
      const hasCommand = "command" in parsed;
      const hasType = "type" in parsed;
      const hasUrl = "url" in parsed;

      if (hasCommand || hasType || hasUrl) {
        // 是单个服务配置，生成默认名称
        const defaultName = hasCommand
          ? String(parsed.command).split("/").pop() || "mcp-server"
          : hasType && parsed.type === "sse"
            ? "sse-server"
            : "http-server";
        mcpServers = { [defaultName]: parsed };
      } else {
        return { success: false, error: "配置格式错误: 必须是对象格式" };
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

    return {
      success: true,
      data: mcpServers as Record<string, MCPServerConfig>,
    };
  } catch (error) {
    return {
      success: false,
      error: `JSON 格式错误: ${
        error instanceof Error ? error.message : "无法解析 JSON"
      }`,
    };
  }
}

export function AddMcpServerButton() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState<string>("");

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

  // 高级模式的表单实例（保持原有验证逻辑）
  const advancedForm = useForm<z.infer<typeof jsonFormSchema>>({
    resolver: zodResolver(jsonFormSchema),
    defaultValues: {
      config: "",
    },
  });

  // 当弹窗关闭时重置状态
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // 重置表单和状态
        form.reset();
        advancedForm.reset();
        setJsonInput("");
        setInputMode("form");
      }
      setOpen(newOpen);
    },
    [form, advancedForm]
  );

  // 处理模式切换
  const handleModeChange = useCallback(
    (newMode: string) => {
      if (newMode !== "form" && newMode !== "json") {
        return; // 忽略无效值
      }

      if (newMode === "json" && inputMode === "form") {
        // 表单 → JSON
        const formValues = form.getValues();
        try {
          setJsonInput(formToJson(formValues));
        } catch {
          setJsonInput("");
        }
      } else if (newMode === "form" && inputMode === "json") {
        // JSON → 表单
        const formData = jsonToFormData(jsonInput);
        if (formData) {
          form.reset(formData);
        }
      }
      setInputMode(newMode);
    },
    [inputMode, form, jsonInput]
  );

  // 表单模式提交处理
  const handleFormSubmit = useCallback(
    async (values: z.infer<typeof mcpFormSchema>) => {
      setIsLoading(true);
      try {
        // 转换表单数据为 API 配置
        const { name, config } = formToApiConfig(values);

        // 检查重名
        const existingServers = await mcpServerApi.listServers();
        if (existingServers.servers.some((server) => server.name === name)) {
          toast.error(`服务名称 "${name}" 已存在`);
          return;
        }

        // 调用API添加服务器
        const result = await mcpServerApi.addServer(name, config);
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
        for (const [serverName, serverConfig] of Object.entries(
          parsedServers
        )) {
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
        advancedForm.reset();
        setOpen(false);
      } catch (error) {
        console.error("更新配置失败:", error);
        toast.error(error instanceof Error ? error.message : "更新配置失败");
      } finally {
        setIsLoading(false);
      }
    },
    [advancedForm]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" className="w-full">
          <PlusIcon className="h-4 w-4" />
          <span>添加MCP服务</span>
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
