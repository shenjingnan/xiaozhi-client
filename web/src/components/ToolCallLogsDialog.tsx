"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, Clock, FileText, Loader2, XCircle } from "lucide-react";
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
    if (!duration) "-";
    if (duration! < 1000) return `${duration}ms`;
    return `${(duration! / 1000).toFixed(1)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          调用日志
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            MCP 工具调用日志
          </DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
