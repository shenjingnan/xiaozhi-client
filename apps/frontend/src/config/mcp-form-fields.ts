/**
 * MCP 服务表单字段配置
 * 定义所有表单字段的 UI 属性和验证规则
 */

import type { mcpFormSchema } from "@/schemas/mcp-form";
import type { FieldConfig } from "@/types/form-config";
import type { FieldPath } from "react-hook-form";
import type { z } from "zod";

type McpFormValues = z.infer<typeof mcpFormSchema>;

/**
 * MCP 服务表单字段配置数组
 * 使用 satisfies 进行类型验证，同时保持值的推断
 */
export const mcpFormFields = [
  {
    name: "type",
    type: "select",
    label: "MCP 类型",
    required: true,
    placeholder: "选择 MCP 类型",
    description: (form) => {
      const mcpType = form.watch("type");
      if (mcpType === "stdio") return "本地通过命令行启动的 MCP 服务";
      if (mcpType === "http") return "通过 HTTP 协议访问的远程 MCP 服务";
      if (mcpType === "sse") return "通过 SSE 协议访问的远程 MCP 服务";
      return "";
    },
    options: [
      { value: "stdio", label: "本地进程 (stdio)" },
      { value: "http", label: "远程服务 (HTTP)" },
      { value: "sse", label: "服务器推送 (SSE)" },
    ],
  },
  {
    name: "name",
    type: "text",
    label: "MCP 名称",
    required: true,
    placeholder: "例如: xxx-mcp",
    description: "服务的唯一标识符，建议使用小写字母和连字符",
  },
  {
    name: "command",
    type: "text",
    label: "启动命令",
    required: true,
    placeholder: "例如: npx -y xxx",
    description: "完整的启动命令，空格分隔命令和参数",
    condition: (form) => form.watch("type") === "stdio",
  },
  {
    name: "env",
    type: "textarea",
    label: "环境变量 (可选)",
    placeholder: "KEY1=value1\nKEY2=value2",
    description: "每行一个环境变量，支持 KEY=value 或 KEY: value 格式",
    className: "min-h-[100px] font-mono text-sm",
    condition: (form) => form.watch("type") === "stdio",
  },
  {
    name: "url",
    type: "text",
    label: "服务地址",
    required: true,
    inputType: "url",
    placeholder: "https://example.com/mcp",
    description: "MCP 服务的完整 URL 地址",
    condition: (form) => form.watch("type") === "http" || form.watch("type") === "sse",
  },
  {
    name: "headers",
    type: "textarea",
    label: "请求头 (可选)",
    placeholder:
      "Authorization: Bearer your-key\nContent-Type: application/json",
    description: "每行一个请求头，格式: Header-Name: value",
    className: "min-h-[100px] font-mono text-sm",
    condition: (form) => form.watch("type") === "http" || form.watch("type") === "sse",
  },
] satisfies FieldConfig<McpFormValues, FieldPath<McpFormValues>>[];
