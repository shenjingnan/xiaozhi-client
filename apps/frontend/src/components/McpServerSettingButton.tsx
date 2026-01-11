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
import { useNetworkServiceActions } from "@/providers/WebSocketProvider";
import { mcpFormSchema } from "@/schemas/mcp-form";
import { useConfig } from "@/stores/config";
import {
  apiConfigToForm,
  formToApiConfig,
  formToJson,
  jsonToFormData,
} from "@/utils/mcpFormConverter";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@ui/textarea";
import type { MCPServerConfig } from "@xiaozhi-client/shared-types";
import { SettingsIcon } from "lucide-react";
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

export function McpServerSettingButton({
  mcpServer,
  mcpServerName,
}: {
  mcpServer: MCPServerConfig;
  mcpServerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState<string>("");
  const config = useConfig();
  const { updateConfig } = useNetworkServiceActions();

  // 将现有配置转换为表单数据
  const defaultFormValues = apiConfigToForm(mcpServerName, mcpServer);

  // 表单模式的表单实例
  const form = useForm<z.infer<typeof mcpFormSchema>>({
    resolver: zodResolver(mcpFormSchema),
    defaultValues: defaultFormValues,
  });

  // 高级模式的表单实例（保持原有验证逻辑）
  const advancedForm = useForm<z.infer<typeof jsonFormSchema>>({
    resolver: zodResolver(jsonFormSchema),
    defaultValues: {
      config: JSON.stringify(
        { mcpServers: { [mcpServerName]: mcpServer } },
        null,
        2
      ),
    },
  });

  // 当弹窗关闭时重置状态
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // 重置表单和状态
        form.reset(defaultFormValues);
        advancedForm.reset();
        setJsonInput("");
        setInputMode("form");
      }
      setOpen(newOpen);
    },
    [form, advancedForm, defaultFormValues]
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
      if (!config) {
        toast.error("配置数据未加载，请稍后重试");
        return;
      }

      setIsLoading(true);
      try {
        // 转换表单数据为 API 配置
        const { name, config: newServerConfig } = formToApiConfig(values);

        // 构建更新后的配置
        let updatedConfig = { ...config };

        // 如果名称改变，删除旧名称的配置
        if (name !== mcpServerName) {
          const { [mcpServerName]: _removed, ...remainingServers } =
            updatedConfig.mcpServers;
          updatedConfig.mcpServers = remainingServers;
        }

        // 添加新名称的配置
        updatedConfig = {
          ...updatedConfig,
          mcpServers: {
            ...updatedConfig.mcpServers,
            [name]: newServerConfig,
          },
        };

        await updateConfig(updatedConfig);

        const nameChanged = name !== mcpServerName;
        toast.success(
          nameChanged
            ? `MCP 服务 "${mcpServerName}" 已重命名为 "${name}"`
            : `MCP 服务 "${name}" 配置已更新`
        );

        setOpen(false);
      } catch (error) {
        console.error("更新配置失败:", error);
        toast.error(error instanceof Error ? error.message : "更新配置失败");
      } finally {
        setIsLoading(false);
      }
    },
    [config, mcpServerName, updateConfig]
  );

  // 高级模式提交处理
  const handleAdvancedSubmit = useCallback(
    async (values: z.infer<typeof jsonFormSchema>) => {
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

        // 高级模式只允许编辑单个服务
        const serverEntries = Object.entries(parsedServers);
        if (serverEntries.length !== 1) {
          toast.error("编辑模式只能修改单个 MCP 服务配置");
          return;
        }

        const [newName, newServerConfig] = serverEntries[0] as [
          string,
          MCPServerConfig,
        ];

        // 构建更新后的配置
        let updatedConfig = { ...config };

        // 如果名称改变，删除旧名称的配置
        if (newName !== mcpServerName) {
          const { [mcpServerName]: _removed, ...remainingServers } =
            updatedConfig.mcpServers;
          updatedConfig.mcpServers = remainingServers;
        }

        // 添加新名称的配置
        updatedConfig = {
          ...updatedConfig,
          mcpServers: {
            ...updatedConfig.mcpServers,
            [newName]: newServerConfig,
          },
        };

        await updateConfig(updatedConfig);

        const nameChanged = newName !== mcpServerName;
        toast.success(
          nameChanged
            ? `MCP 服务 "${mcpServerName}" 已重命名为 "${newName}"`
            : `MCP 服务 "${newName}" 配置已更新`
        );

        setOpen(false);
      } catch (error) {
        console.error("更新配置失败:", error);
        toast.error(error instanceof Error ? error.message : "更新配置失败");
      } finally {
        setIsLoading(false);
      }
    },
    [config, mcpServerName, updateConfig]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="size-8">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="mb-4">
          <DialogTitle>配置 {mcpServerName} MCP</DialogTitle>
          <DialogDescription>
            点击保存后，需要重启服务才会生效。
          </DialogDescription>
        </DialogHeader>

        {/* 模式切换 */}
        <Tabs value={inputMode} onValueChange={handleModeChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">表单模式</TabsTrigger>
            <TabsTrigger value="json">高级模式 (JSON)</TabsTrigger>
          </TabsList>

          {/* 表单模式 */}
          <TabsContent value="form" className="mt-4">
            <McpServerForm
              form={form}
              defaultValues={defaultFormValues}
              onSubmit={handleFormSubmit}
              disabled={isLoading}
              submitText={isLoading ? "保存中..." : "保存"}
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
