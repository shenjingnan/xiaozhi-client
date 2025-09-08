import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Workflow } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Mock 数据接口
interface CozeWorkflow {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// Mock 数据
const mockWorkflows: CozeWorkflow[] = [
  {
    id: "1",
    name: "test_coze_workflow",
    description: "测试扣子工作流，用于验证基本功能",
    icon: "🔧",
  },
  {
    id: "2",
    name: "chitChat_Machima_1_546",
    description: "和用户闲聊的智能对话工作流",
    icon: "💬",
  },
  {
    id: "3",
    name: "data_analysis_workflow",
    description: "数据分析和可视化工作流",
    icon: "📊",
  },
  {
    id: "4",
    name: "content_generation",
    description: "智能内容生成工作流",
    icon: "✍️",
  },
  {
    id: "5",
    name: "image_processing",
    description: "图像处理和优化工作流",
    icon: "🖼️",
  },
  {
    id: "6",
    name: "email_automation",
    description: "邮件自动化处理工作流",
    icon: "📧",
  },
  {
    id: "7",
    name: "document_parser",
    description: "文档解析和信息提取工作流",
    icon: "📄",
  },
  {
    id: "8",
    name: "social_media_monitor",
    description: "社交媒体监控和分析工作流",
    icon: "📱",
  },
  {
    id: "9",
    name: "task_scheduler",
    description: "任务调度和管理工作流",
    icon: "⏰",
  },
  {
    id: "10",
    name: "api_integration",
    description: "第三方API集成工作流",
    icon: "🔗",
  },
  {
    id: "11",
    name: "notification_system",
    description: "智能通知系统工作流",
    icon: "🔔",
  },
  {
    id: "12",
    name: "backup_automation",
    description: "自动备份和恢复工作流",
    icon: "💾",
  },
  {
    id: "13",
    name: "security_scanner",
    description: "安全扫描和监控工作流",
    icon: "🔒",
  },
  {
    id: "14",
    name: "performance_monitor",
    description: "性能监控和优化工作流",
    icon: "⚡",
  },
  {
    id: "15",
    name: "log_analyzer",
    description: "日志分析和异常检测工作流",
    icon: "📋",
  },
];

const ITEMS_PER_PAGE = 5;

export function CozeWorkflowIntegration() {
  const [open, setOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const totalPages = Math.ceil(mockWorkflows.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentWorkflows = mockWorkflows.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const handleAddWorkflow = async (workflow: CozeWorkflow) => {
    setIsLoading(true);
    try {
      // 模拟添加工作流的异步操作
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(`已添加工作流 "${workflow.name}" 为 MCP 工具`);
    } catch (error) {
      toast.error("添加工作流失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Workflow className="h-4 w-4 mr-2" />
          添加扣子工作流
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] h-[600px] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            添加扣子工作流为MCP工具
          </DialogTitle>
          <DialogDescription>
            选择要集成到MCP服务中的扣子工作流，添加后可以作为工具在对话中使用。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* 工作流列表 */}
          <div className="flex-1 space-y-3 overflow-y-auto min-h-[300px] pr-2">
            {currentWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                {/* 工作流图标 */}
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg">
                  {workflow.icon}
                </div>

                {/* 工作流信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">
                      {workflow.name}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      工作流
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {workflow.description}
                  </p>
                </div>

                {/* 添加按钮 */}
                <div className="flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleAddWorkflow(workflow)}
                    disabled={isLoading}
                    className="hover:bg-green-500 hover:text-white"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* 分页控件 */}
          <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
            <div className="text-sm text-muted-foreground">
              显示 {startIndex + 1}-
              {Math.min(startIndex + ITEMS_PER_PAGE, mockWorkflows.length)} 项，
              共 {mockWorkflows.length} 项
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>

              <div className="flex items-center gap-1">
                <span className="text-sm">
                  第 {currentPage} 页，共 {totalPages} 页
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
