"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckIcon, Code, CopyIcon, Loader2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface ToolResultPanelProps {
  result: any;
  error: string | null;
  loading: boolean;
}

/**
 * 工具结果面板组件
 *
 * @description 负责工具调试对话框中的结果展示区域，包括加载状态、错误展示和结果复制功能。
 */
export function ToolResultPanel({
  result,
  error,
  loading,
}: ToolResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理定时器
  useMemo(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // 格式化结果显示
  const formatResult = useCallback((data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, []);

  // 复制结果
  const handleCopy = useCallback(async () => {
    const content = result ? JSON.stringify(result, null, 2) : error || "";
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("已复制到剪贴板");
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, [result, error]);

  return (
    <div className="w-1/2 flex flex-col gap-2 flex-shrink-0 overflow-hidden pl-0.5">
      <div className="flex items-center justify-between h-[40px]">
        <h3 className="text-sm font-medium">调用结果</h3>
        {(result || error) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-0"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 mr-1" />
                已复制
              </>
            ) : (
              <>
                <CopyIcon className="h-4 w-4 mr-1" />
                复制结果
              </>
            )}
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center border rounded-md">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm text-muted-foreground">
                正在调用工具...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="h-full">
            <Alert variant="destructive" className="h-full">
              <AlertDescription className="font-mono text-sm whitespace-pre-wrap break-words">
                {error}
              </AlertDescription>
            </Alert>
          </div>
        ) : result ? (
          <ScrollArea className="h-full border rounded-md">
            <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-words min-w-0">
              {formatResult(result)}
            </pre>
          </ScrollArea>
        ) : (
          <div className="h-full flex items-center justify-center border rounded-md">
            <div className="text-center text-muted-foreground">
              <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>等待调用工具...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
