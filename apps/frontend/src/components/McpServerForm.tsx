/**
 * MCP 服务表单组件
 * 用于可视化添加 MCP 服务配置
 */

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mcpFormSchema } from "@/schemas/mcp-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type UseFormReturn, useForm } from "react-hook-form";
import type { z } from "zod";

interface McpServerFormProps {
  /** 表单实例（可选，如果不提供则内部创建） */
  form?: UseFormReturn<z.infer<typeof mcpFormSchema>>;
  /** 表单默认值 */
  defaultValues?: z.infer<typeof mcpFormSchema>;
  /** 表单提交回调 */
  onSubmit: (values: z.infer<typeof mcpFormSchema>) => void;
  /** 是否禁用表单 */
  disabled?: boolean;
  /** 提交按钮文本 */
  submitText?: string;
}

export function McpServerForm({
  form: externalForm,
  defaultValues,
  onSubmit,
  disabled = false,
  submitText = "保存配置",
}: McpServerFormProps) {
  // 使用外部传入的 form 实例，或者内部创建
  const form: UseFormReturn<z.infer<typeof mcpFormSchema>> =
    externalForm ||
    useForm<z.infer<typeof mcpFormSchema>>({
      resolver: zodResolver(mcpFormSchema),
      defaultValues: defaultValues || {
        type: "stdio",
        name: "",
        command: "",
        env: "",
      },
    });

  // 监听 MCP 类型变化，用于动态显示说明
  const mcpType = form.watch("type");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
        {/* MCP 类型选择 */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>MCP 类型</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value: "stdio" | "http" | "sse") => {
                  field.onChange(value);
                  // 切换类型时重置部分字段
                  if (value === "stdio") {
                    form.setValue("url", "");
                    form.setValue("headers", "");
                  } else {
                    form.setValue("command", "");
                    form.setValue("env", "");
                  }
                }}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择 MCP 类型" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="stdio">本地进程 (stdio)</SelectItem>
                  <SelectItem value="http">远程服务 (HTTP)</SelectItem>
                  <SelectItem value="sse">服务器推送 (SSE)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {mcpType === "stdio" && "本地通过命令行启动的 MCP 服务"}
                {mcpType === "http" && "通过 HTTP 协议访问的远程 MCP 服务"}
                {mcpType === "sse" && "通过 SSE 协议访问的远程 MCP 服务"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* MCP 名称 */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>MCP 名称</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="例如: xxx-mcp"
                  disabled={disabled}
                />
              </FormControl>
              <FormDescription>
                服务的唯一标识符，建议使用小写字母和连字符
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* stdio 类型专用字段 */}
        {mcpType === "stdio" && (
          <>
            <FormField
              control={form.control}
              name="command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>启动命令</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例如: npx -y xxx"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    完整的启动命令，空格分隔命令和参数
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="env"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>环境变量 (可选)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="KEY1=value1&#10;KEY2=value2"
                      className="min-h-[100px] font-mono text-sm"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    每行一个环境变量，支持 KEY=value 或 KEY: value 格式
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* http/sse 类型专用字段 */}
        {(mcpType === "http" || mcpType === "sse") && (
          <>
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>服务地址</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://example.com/mcp"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>MCP 服务的完整 URL 地址</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="headers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>请求头 (可选)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Authorization: Bearer your-key&#10;Content-Type: application/json"
                      className="min-h-[100px] font-mono text-sm"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    每行一个请求头，格式: Header-Name: value
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <Button type="submit" className="w-full" disabled={disabled}>
          {submitText}
        </Button>
      </form>
    </Form>
  );
}
