"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/services/api";
import {
  AlertCircle,
  CheckIcon,
  Code,
  CopyIcon,
  Loader2,
  PlayIcon,
  RotateCcwIcon,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface ToolDebugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: {
    name: string;
    serverName: string;
    toolName: string;
    description?: string;
    inputSchema?: any;
  } | null;
}

export function ToolDebugDialog({
  open,
  onOpenChange,
  tool,
}: ToolDebugDialogProps) {
  const [inputParams, setInputParams] = useState<string>("{\n  \n}");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 重置状态
  const resetState = useCallback(() => {
    setInputParams("{\n  \n}");
    setResult(null);
    setError(null);
    setCopied(false);
  }, []);

  // 当弹窗关闭时重置状态
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetState();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetState]
  );

  // 验证JSON格式
  const validateJSON = useCallback((jsonString: string) => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }, []);

  // 调用工具
  const handleCallTool = useCallback(async () => {
    if (!tool) return;

    // 验证JSON格式
    if (!validateJSON(inputParams)) {
      toast.error("输入参数不是有效的JSON格式");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const args = JSON.parse(inputParams);
      const response = await apiClient.callTool(
        tool.serverName,
        tool.toolName,
        args
      );

      setResult(response);
      toast.success("工具调用成功");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "调用工具失败";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tool, inputParams, validateJSON]);

  // 复制结果
  const handleCopy = useCallback(async () => {
    const content = result ? JSON.stringify(result, null, 2) : error || "";
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, [result, error]);

  // 清空输入
  const handleClear = useCallback(() => {
    setInputParams("{\n  \n}");
    setResult(null);
    setError(null);
  }, []);

  // 格式化结果显示
  const formatResult = useCallback((data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            工具调试
          </DialogTitle>
        </DialogHeader>

        {tool && (
          <div className="flex flex-col gap-4 h-[80vh]">
            {/* 工具信息 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  {tool.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">服务器:</span>
                  <Badge variant="secondary">{tool.serverName}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">工具:</span>
                  <Badge variant="outline">{tool.toolName}</Badge>
                </div>
                {tool.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {tool.description}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 输入参数 */}
            <div className="flex-1 flex gap-4 min-h-0">
              <div className="w-1/2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">输入参数 (JSON)</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      disabled={loading}
                    >
                      <RotateCcwIcon className="h-4 w-4 mr-1" />
                      清空
                    </Button>
                    <Button
                      onClick={handleCallTool}
                      disabled={loading || !validateJSON(inputParams)}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          调用中...
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-4 w-4 mr-1" />
                          调用工具
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <Textarea
                    value={inputParams}
                    onChange={(e) => setInputParams(e.target.value)}
                    placeholder="请输入JSON格式的参数..."
                    className="h-full font-mono text-sm resize-none"
                    disabled={loading}
                  />
                  {!validateJSON(inputParams) &&
                    inputParams.trim() !== "{\n  \n}" && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          JSON格式错误，请检查输入
                        </AlertDescription>
                      </Alert>
                    )}
                </div>
              </div>

              {/* 结果显示 */}
              <div className="w-1/2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">调用结果</h3>
                  {(result || error) && (
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <CheckIcon className="h-4 w-4 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <CopyIcon className="h-4 w-4 mr-1" />
                          复制
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
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-mono text-sm">
                          {error}
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : result ? (
                    <ScrollArea className="h-full border rounded-md">
                      <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-words">
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
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
