# WorkflowParameterConfigDialog 组件

## 概述

`WorkflowParameterConfigDialog` 是一个通用的工作流参数配置对话框组件，用于为工作流配置输入参数。该组件支持动态添加/删除参数、参数类型选择、字段验证等功能。

## 特性

- ✅ **动态参数管理**：支持添加、删除参数
- ✅ **类型支持**：支持 string、number、boolean 三种参数类型
- ✅ **表单验证**：完整的字段验证规则
- ✅ **响应式设计**：适配不同屏幕尺寸
- ✅ **无障碍访问**：支持键盘操作和屏幕阅读器
- ✅ **TypeScript 支持**：完整的类型定义

## 安装依赖

组件依赖以下包，请确保已安装：

```bash
pnpm add react-hook-form @hookform/resolvers zod
```

## 基本用法

```tsx
import { WorkflowParameterConfigDialog } from "@/components/common/workflow-parameter-config-dialog";
import type { CozeWorkflow, WorkflowParameter } from "@/types";

function MyComponent() {
  const [open, setOpen] = useState(false);
  
  const workflow: CozeWorkflow = {
    workflow_id: "example-id",
    workflow_name: "示例工作流",
    // ... 其他属性
  };

  const handleConfirm = (workflow: CozeWorkflow, parameters: WorkflowParameter[]) => {
    console.log("配置的参数:", parameters);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <WorkflowParameterConfigDialog
      open={open}
      onOpenChange={setOpen}
      workflow={workflow}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
```

## API 参考

### Props

| 属性 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `open` | `boolean` | ✅ | - | 对话框是否打开 |
| `onOpenChange` | `(open: boolean) => void` | ✅ | - | 对话框打开状态变化回调 |
| `workflow` | `CozeWorkflow` | ✅ | - | 工作流信息 |
| `onConfirm` | `(workflow: CozeWorkflow, parameters: WorkflowParameter[]) => void` | ✅ | - | 确认回调，返回配置的参数 |
| `onCancel` | `() => void` | ✅ | - | 取消回调 |
| `title` | `string` | ❌ | `配置工作流参数 - ${workflow.workflow_name}` | 自定义对话框标题 |

### 类型定义

```typescript
interface WorkflowParameter {
  fieldName: string;      // 英文字段名，用作参数标识符
  description: string;    // 中英文描述，说明参数用途
  type: 'string' | 'number' | 'boolean';  // 参数类型
  required: boolean;      // 是否必填参数
}

interface WorkflowParameterConfig {
  parameters: WorkflowParameter[];
}
```

## 验证规则

### 字段名验证
- 不能为空
- 必须以字母开头
- 只能包含字母、数字和下划线
- 正则表达式：`/^[a-zA-Z][a-zA-Z0-9_]*$/`

### 描述验证
- 不能为空
- 最大长度 200 个字符

### 唯一性验证
- 同一表单中的字段名不能重复

## 使用示例

### 基础示例

```tsx
const [dialogOpen, setDialogOpen] = useState(false);

const handleAddWorkflow = (workflow: CozeWorkflow, parameters: WorkflowParameter[]) => {
  // 处理添加工作流逻辑
  console.log("工作流:", workflow);
  console.log("参数配置:", parameters);
  
  // 调用 API 添加工作流
  toolsApiService.addCustomTool({
    workflow,
    parameterConfig: { parameters }
  });
  
  setDialogOpen(false);
};

<WorkflowParameterConfigDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  workflow={selectedWorkflow}
  onConfirm={handleAddWorkflow}
  onCancel={() => setDialogOpen(false)}
/>
```

### 自定义标题

```tsx
<WorkflowParameterConfigDialog
  open={open}
  onOpenChange={setOpen}
  workflow={workflow}
  onConfirm={handleConfirm}
  onCancel={handleCancel}
  title="自定义工作流参数"
/>
```

### 集成到现有组件

```tsx
// 在 CozeWorkflowIntegration 组件中使用
const handleWorkflowAdd = (workflow: CozeWorkflow) => {
  setSelectedWorkflow(workflow);
  setParameterDialogOpen(true);
};

const handleParameterConfirm = async (workflow: CozeWorkflow, parameters: WorkflowParameter[]) => {
  try {
    await toolsApiService.addCustomTool({
      workflow,
      parameterConfig: { parameters }
    });
    toast.success("工作流添加成功");
  } catch (error) {
    toast.error("添加失败");
  } finally {
    setParameterDialogOpen(false);
  }
};
```

## 样式定制

组件使用 Tailwind CSS 和 shadcn/ui 组件库，支持主题定制：

```css
/* 自定义样式示例 */
.workflow-parameter-dialog {
  --dialog-max-width: 800px;
  --dialog-max-height: 80vh;
}
```

## 测试

组件包含完整的单元测试，覆盖率 > 90%：

```bash
# 运行测试
pnpm test WorkflowParameterConfigDialog

# 生成覆盖率报告
pnpm test:coverage
```

## 注意事项

1. **表单重置**：对话框关闭时会自动重置表单状态
2. **验证时机**：表单验证在提交时触发，实时显示错误信息
3. **性能优化**：使用 `useFieldArray` 优化动态列表性能
4. **无障碍访问**：支持键盘导航和屏幕阅读器

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基础参数配置功能
- 完整的表单验证
- 单元测试覆盖

## 贡献

如需改进组件，请：
1. 确保所有测试通过
2. 更新相关文档
3. 遵循项目代码规范
