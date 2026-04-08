import { apiClient } from "@/services/api";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface Tool {
  name: string;
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema?: any;
}

interface UseToolCallResult {
  result: any;
  loading: boolean;
  error: string | null;
  callTool: (args: any) => Promise<void>;
}

/**
 * 工具调用逻辑的自定义 Hook
 *
 * @description 封装工具调用的状态管理和 API 调用逻辑，包括加载状态、错误处理和结果管理。
 */
export function useToolCall(tool: Tool | null): UseToolCallResult {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callTool = useCallback(
    async (args: any) => {
      if (!tool) return;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await apiClient.callTool(
          tool.serverName,
          tool.toolName,
          args
        );
        setResult(response);
        toast.success("工具调用成功");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "调用工具失败";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [tool]
  );

  return { result, loading, error, callTool };
}
