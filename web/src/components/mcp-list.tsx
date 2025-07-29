import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Server,
  Play,
  Square,
  Settings,
  ChevronDown,
  ChevronRight,
  Activity,
  Clock,
  Users,
  Wrench,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

const McpServicesDisplay = () => {
  const [expandedService, setExpandedService] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // 'list' or 'table'

  // 模拟 MCP 服务数据
  const mcpServices = [
    {
      id: 1,
      name: "filesystem",
      displayName: "",
      status: "running",
      version: "1.2.0",
      uptime: "2天 14小时",
      description: "提供文件系统访问和操作功能",
      tools: ["read_file", "write_file", "list_directory", "create_directory"],
      resources: ["file://", "directory://"],
      lastActivity: "2分钟前",
      memoryUsage: "45MB",
      requestCount: 1247,
    },
    {
      id: 2,
      name: "web-search",
      displayName: "网络搜索服务",
      status: "running",
      version: "2.1.3",
      uptime: "1天 8小时",
      description: "提供网络搜索和内容抓取功能",
      tools: ["search_web", "fetch_url", "extract_content"],
      resources: ["https://", "http://"],
      lastActivity: "30秒前",
      memoryUsage: "78MB",
      requestCount: 892,
    },
    {
      id: 3,
      name: "database",
      displayName: "数据库服务",
      status: "error",
      version: "1.0.5",
      uptime: "0分钟",
      description: "提供数据库查询和操作功能",
      tools: ["query_db", "insert_data", "update_data", "delete_data"],
      resources: ["db://", "table://"],
      lastActivity: "5分钟前",
      memoryUsage: "0MB",
      requestCount: 0,
      error: "连接超时",
    },
    {
      id: 4,
      name: "email",
      displayName: "邮件服务",
      status: "stopped",
      version: "1.1.2",
      uptime: "0分钟",
      description: "提供邮件发送和接收功能",
      tools: ["send_email", "read_inbox", "search_emails"],
      resources: ["mailto://", "imap://"],
      lastActivity: "1小时前",
      memoryUsage: "0MB",
      requestCount: 156,
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "stopped":
        return <Square className="h-4 w-4 text-gray-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: {
        variant: "secondary",
        className: "bg-green-100 text-green-800",
        text: "运行中",
      },
      stopped: {
        variant: "secondary",
        className: "bg-gray-100 text-gray-800",
        text: "已停止",
      },
      error: { variant: "destructive", className: "", text: "错误" },
    };
    const config = variants[status] || variants.stopped;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  const toggleExpand = (serviceId) => {
    setExpandedService(expandedService === serviceId ? null : serviceId);
  };

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-2 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <div className="transition-all duration-200 gap-4 flex flex-col">
        {mcpServices.map((service) => (
          <Card
            key={service.id}
            className={`transition-all duration-200 ${
              service.status === "error" ? "border-red-200" : ""
            }`}
          >
            <CardContent className="p-0">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* <div className="mt-1">{getStatusIcon(service.status)}</div> */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">
                          {service.displayName || service.name}
                        </h3>
                        {/* <Badge variant="outline" className="text-xs">
                        {service.name}
                      </Badge> */}
                        <Badge variant="outline" className="text-xs">
                          v{service.version}
                        </Badge>
                        {getStatusBadge(service.status)}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="secondary" size="icon" className="size-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="transition-all duration-200">
        <CardContent className="p-0">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  可用工具 ({mcpServices[0].tools.length})
                </h4>
                <div className="space-y-1">
                  {mcpServices[0].tools.map((tool) => (
                    <div key={tool} className="flex items-center justify-between p-4 bg-gray-50 rounded-md font-mono">
                      <div
                        key={tool}
                        className="text-md flex flex-col gap-2"
                      >
                        {tool}
                        <p className="text-sm text-muted-foreground">
                          {mcpServices[0].description}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="airplane-mode" className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-input" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default McpServicesDisplay;
