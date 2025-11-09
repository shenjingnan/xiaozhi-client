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
  CheckCircle,
  Clock,
  Code,
  CopyIcon,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ToolCallRecord {
  toolName: string;
  originalToolName?: string;
  serverName?: string;
  arguments?: any;
  result?: any;
  success: boolean;
  duration?: number;
  error?: string;
  timestamp?: number;
}

interface ToolCallLogsResponse {
  records: ToolCallRecord[];
  total: number;
  hasMore: boolean;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export function ToolCallLogsDialog() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ToolCallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ToolCallRecord | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tool-calls/logs?limit=50");
      const data: ApiResponse<ToolCallLogsResponse> = await response.json();

      if (data.success && data.data) {
        setLogs(data.data.records);
      } else {
        setError(data.error?.message || "获取日志失败");
      }
    } catch (err) {
      setError("网络请求失败");
      console.error("Failed to fetch tool call logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchLogs();
    } else {
      // 关闭弹窗时清空选中状态
      setSelectedLog(null);
      setHoveredIndex(null);
    }
  }, [open, fetchLogs]);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "未知时间";
    return new Date(timestamp).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "-";
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

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
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          调用日志
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-6xl max-h-[80vh]"
        onMouseLeave={handleDialogMouseLeave}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            MCP 工具调用日志
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4">
          {/* 左侧表格区域 */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">加载中...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-medium">加载失败</p>
                <p className="text-muted-foreground text-sm mt-1">{error}</p>
                <Button
                  onClick={fetchLogs}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  重试
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无工具调用记录</p>
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
                        key={`${log.toolName}-${log.timestamp || index}-${index}`}
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
                            variant={log.success ? "default" : "destructive"}
                            className="gap-1"
                          >
                            {log.success ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {log.success ? "成功" : "失败"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDuration(log.duration)}
                          </div>
                        </TableCell>
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

// 详情展示组件
interface CallLogDetailProps {
  log: ToolCallRecord;
}

function CallLogDetail({ log }: CallLogDetailProps) {
  const formatJson = (data: any) => {
    if (!data) return null;
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return String(data);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "未知时间";
    return new Date(timestamp).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "-";
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <Card className="h-[60vh]">
      <div className="p-4 h-full flex flex-col">
        {/* 详情内容 */}
        <Tabs defaultValue="arguments" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="arguments">入参</TabsTrigger>
            <TabsTrigger value="result">出参</TabsTrigger>
          </TabsList>

          <TabsContent value="arguments" className="flex-1 mt-4">
            <ScrollArea className="h-full">
              {log.arguments ? (
                <div className="relative">
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto text-wrap break-words">
                    {formatJson(log.arguments)}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 hover:bg-slate-200 w-[30px] h-[30px]"
                    onClick={() =>
                      copyToClipboard(formatJson(log.arguments) || "")
                    }
                  >
                    <CopyIcon />
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>无入参</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="result" className="flex-1 mt-4">
            <ScrollArea>
              {log.success ? (
                log.result ? (
                  <div className="relative">
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto text-wrap break-words">
                      {formatJson(log.result)}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() =>
                        copyToClipboard(formatJson(log.result) || "")
                      }
                    >
                      复制
                    </Button>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(log.error || "")}
                    >
                      复制
                    </Button>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>耗时: {formatDuration(log.duration)}</span>
          <span>{formatTimestamp(log.timestamp)}</span>
        </div>
      </div>
    </Card>
  );
}
