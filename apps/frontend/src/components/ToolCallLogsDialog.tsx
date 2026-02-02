"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDuration,
  formatJson,
  formatTimestamp,
  generateStableKey,
} from "@/utils/formatUtils";
import type {
  ApiResponse,
  ToolCallLogsResponse,
  ToolCallRecord,
} from "@xiaozhi-client/shared-types";
import {
  CheckCircle,
  CheckIcon,
  Code,
  CopyIcon,
  FileText,
  Loader2,
  RefreshCw,
  RotateCwIcon,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function ToolCallLogsDialog() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ToolCallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ToolCallRecord | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const response = await fetch(`/api/tool-calls/logs?limit=${limit}`);
        const data: ApiResponse<ToolCallLogsResponse> = await response.json();

        if (data.success && data.data) {
          setLogs(data.data.records);
          setTotal(data.data.total);
        } else {
          setError(data.error?.message || "获取日志失败");
        }
      } catch (err) {
        setError("网络请求失败");
        console.error("Failed to fetch tool call logs:", err);
      } finally {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [limit]
  );

  useEffect(() => {
    if (open) {
      fetchLogs();
    } else {
      // 关闭弹窗时清空选中状态
      setSelectedLog(null);
      setHoveredIndex(null);
    }
  }, [open, fetchLogs]);

  // 处理数据行悬停
  const handleRowMouseEnter = (log: ToolCallRecord, index: number) => {
    if (hoveredIndex !== index) {
      setSelectedLog(log);
      setHoveredIndex(index);
    }
  };

  // 处理详情面板鼠标进入
  const handleDetailMouseEnter = () => {
    // 确保鼠标在详情面板时保持显示状态
    // 不需要做任何操作，保持当前状态
  };

  // 处理弹窗容器鼠标离开
  const handleDialogMouseLeave = () => {
    // 只有当鼠标完全离开弹窗时才清空状态
    setSelectedLog(null);
    setHoveredIndex(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          aria-label="MCP工具调用日志"
          title="MCP工具调用日志"
        >
          <FileText className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-6xl max-h-[80vh]"
        onMouseLeave={handleDialogMouseLeave}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              MCP 工具调用日志
              {total > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (共 {total} 条记录)
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchLogs(true)}
                disabled={refreshing}
              >
                <RotateCwIcon
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 flex gap-4">
          {/* 左侧表格区域 */}
          <div className="flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-muted-foreground font-medium">
                    正在加载日志数据
                  </p>
                  <p className="text-muted-foreground/70 text-sm mt-1">
                    请稍候片刻...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md mx-auto">
                  <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-destructive font-semibold text-lg mb-2">
                    加载失败
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                    {error}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => fetchLogs()}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      重试加载
                    </Button>
                    <Button
                      onClick={() => fetchLogs(true)}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                    >
                      强制刷新
                    </Button>
                  </div>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-muted/30 border border-muted rounded-lg p-6 max-w-md mx-auto">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-lg mb-2">暂无工具调用记录</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    当前还没有任何工具调用记录。当您开始使用工具时，相关的调用信息会在这里显示。
                  </p>
                  <Button
                    onClick={() => fetchLogs(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    检查更新
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>工具名称</TableHead>
                      <TableHead>服务器</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>耗时</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log, index) => (
                      <TableRow
                        key={generateStableKey(log, index)}
                        className={`cursor-pointer transition-colors ${
                          hoveredIndex === index
                            ? "bg-muted/50"
                            : "hover:bg-muted/30"
                        }`}
                        onMouseEnter={() => handleRowMouseEnter(log, index)}
                      >
                        <TableCell className="font-medium">
                          <div>
                            <div>{log.toolName}</div>
                            {log.originalToolName &&
                              log.originalToolName !== log.toolName && (
                                <div className="text-xs text-muted-foreground">
                                  原始: {log.originalToolName}
                                </div>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.serverName || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.success ? undefined : "destructive"}
                            className={`gap-1 w-[50px] text-center ${
                              log.success
                                ? "bg-green-600 hover:bg-green-600"
                                : "bg-red-600 hover:bg-red-600"
                            }`}
                          >
                            {log.success ? "成功" : "失败"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDuration(log.duration)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>

          {/* 右侧详情面板 */}
          {selectedLog && (
            <div
              className="w-96 border-l pl-4"
              onMouseEnter={handleDetailMouseEnter}
            >
              <CallLogDetail log={selectedLog} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 复制按钮组件
interface CopyButtonProps {
  size?: "sm" | "default" | "lg";
  copyContent: string;
  className?: string;
}

function CopyButton({
  size = "sm",
  copyContent,
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyContent);
      setCopied(true);

      // 3秒后自动恢复状态
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      className={`${className} ${
        copied ? "text-green-600 hover:text-green-700" : ""
      }`}
      onClick={handleCopy}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

// 详情展示组件
interface CallLogDetailProps {
  log: ToolCallRecord;
}

function CallLogDetail({ log }: CallLogDetailProps) {
  const formatRawData = (log: ToolCallRecord) => {
    try {
      return JSON.stringify(log, null, 2);
    } catch (error) {
      return String(log);
    }
  };

  return (
    <Card className="h-[60vh]">
      <div className="p-4 h-full flex flex-col">
        {/* 详情内容 */}
        <Tabs defaultValue="arguments" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="arguments">入参</TabsTrigger>
            <TabsTrigger value="result">出参</TabsTrigger>
            <TabsTrigger value="raw">原始数据</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            <TabsContent
              value="arguments"
              className="h-full data-[state=active]:flex data-[state=active]:flex-col"
            >
              <ScrollArea className="h-full">
                {log.arguments ? (
                  <div className="relative">
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto text-wrap break-words">
                      {formatJson(log.arguments)}
                    </pre>
                    <CopyButton
                      copyContent={formatJson(log.arguments) || ""}
                      className="absolute top-2 right-2 hover:bg-slate-200 w-[30px] h-[30px]"
                    />
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>无入参</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="result"
              className="h-full data-[state=active]:flex data-[state=active]:flex-col"
            >
              <ScrollArea className="h-full">
                {log.success ? (
                  log.result ? (
                    <div className="relative">
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto text-wrap break-words">
                        {formatJson(log.result)}
                      </pre>
                      <CopyButton
                        copyContent={formatJson(log.result) || ""}
                        className="absolute top-2 right-2 hover:bg-slate-200 w-[30px] h-[30px]"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>无出参</p>
                    </div>
                  )
                ) : (
                  <div className="relative">
                    <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">
                          调用失败
                        </span>
                      </div>
                      {log.error && (
                        <pre className="text-xs text-destructive/80 whitespace-pre-wrap">
                          {log.error}
                        </pre>
                      )}
                    </div>
                    {log.error && (
                      <CopyButton
                        copyContent={log.error || ""}
                        className="absolute top-2 right-2"
                      />
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="raw"
              className="h-full data-[state=active]:flex data-[state=active]:flex-col"
            >
              <ScrollArea className="h-full">
                <div className="relative">
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto text-wrap break-words">
                    {formatRawData(log)}
                  </pre>
                  <CopyButton
                    copyContent={formatRawData(log)}
                    className="absolute top-2 right-2 hover:bg-slate-200 w-[30px] h-[30px]"
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <Separator className="my-4 flex-shrink-0" />
        <div className="text-xs text-muted-foreground flex justify-between flex-shrink-0">
          <span>耗时: {formatDuration(log.duration)}</span>
          <span>{formatTimestamp(log.timestamp)}</span>
        </div>
      </div>
    </Card>
  );
}
