/**
 * WorkflowParameterConfigDialog 使用示例
 *
 * 这个文件展示了如何在实际项目中使用 WorkflowParameterConfigDialog 组件
 */

import { Button } from "@/components/ui/button";
import type { CozeWorkflow, WorkflowParameter } from "@/types";
import { useState } from "react";
import { toast } from "sonner";
import { WorkflowParameterConfigDialog } from "./WorkflowParameterConfigDialog";

// 示例工作流数据
const exampleWorkflow: CozeWorkflow = {
  workflow_id: "example-workflow-123",
  workflow_name: "用户信息处理工作流",
  description: "处理用户信息并生成报告的工作流",
  icon_url: "https://example.com/workflow-icon.png",
  app_id: "example-app-456",
  creator: {
    id: "creator-789",
    name: "张三",
  },
  created_at: Date.now() - 86400000, // 1天前
  updated_at: Date.now() - 3600000, // 1小时前
};

/**
 * 基础使用示例
 */
export function BasicExample() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleConfirm = (
    workflow: CozeWorkflow,
    parameters: WorkflowParameter[]
  ) => {
    console.log("配置的工作流:", workflow);
    console.log("配置的参数:", parameters);

    // 显示成功消息
    toast.success(`已配置 ${parameters.length} 个参数`);

    // 关闭对话框
    setDialogOpen(false);
  };

  const handleCancel = () => {
    console.log("用户取消了参数配置");
    setDialogOpen(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">基础使用示例</h2>

      <Button onClick={() => setDialogOpen(true)}>配置工作流参数</Button>

      <WorkflowParameterConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflow={exampleWorkflow}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}

/**
 * 自定义标题示例
 */
export function CustomTitleExample() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleConfirm = (
    workflow: CozeWorkflow,
    parameters: WorkflowParameter[]
  ) => {
    toast.success("参数配置完成！");
    setDialogOpen(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">自定义标题示例</h2>

      <Button onClick={() => setDialogOpen(true)}>打开自定义标题对话框</Button>

      <WorkflowParameterConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflow={exampleWorkflow}
        onConfirm={handleConfirm}
        onCancel={() => setDialogOpen(false)}
        title="🔧 高级参数配置"
      />
    </div>
  );
}

/**
 * 集成到工作流添加流程的示例
 */
export function WorkflowIntegrationExample() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddWorkflow = async (
    workflow: CozeWorkflow,
    parameters: WorkflowParameter[]
  ) => {
    setIsLoading(true);

    try {
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 这里应该调用实际的 API
      // await toolsApiService.addCustomTool({
      //   workflow,
      //   parameterConfig: { parameters }
      // });

      toast.success("工作流添加成功！");
      console.log("添加的工作流:", workflow);
      console.log("配置的参数:", parameters);
    } catch (error) {
      toast.error("添加工作流失败");
      console.error("添加失败:", error);
    } finally {
      setIsLoading(false);
      setDialogOpen(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">工作流集成示例</h2>

      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium">{exampleWorkflow.workflow_name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {exampleWorkflow.description}
          </p>
          <Button
            className="mt-3"
            onClick={() => setDialogOpen(true)}
            disabled={isLoading}
          >
            {isLoading ? "添加中..." : "添加到工具箱"}
          </Button>
        </div>
      </div>

      <WorkflowParameterConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflow={exampleWorkflow}
        onConfirm={handleAddWorkflow}
        onCancel={() => setDialogOpen(false)}
        title="配置工作流输入参数"
      />
    </div>
  );
}

/**
 * 完整示例页面
 */
export function WorkflowParameterConfigExamples() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">
          WorkflowParameterConfigDialog 示例
        </h1>
        <p className="text-muted-foreground">
          以下示例展示了 WorkflowParameterConfigDialog 组件的各种使用方式
        </p>
      </div>

      <div className="space-y-8">
        <BasicExample />
        <CustomTitleExample />
        <WorkflowIntegrationExample />
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">使用提示</h3>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• 字段名必须以字母开头，只能包含字母、数字和下划线</li>
          <li>• 描述不能为空，最大长度200个字符</li>
          <li>• 同一表单中的字段名不能重复</li>
          <li>• 支持三种参数类型：字符串、数字、布尔值</li>
          <li>• 可以设置参数是否为必填</li>
        </ul>
      </div>
    </div>
  );
}
