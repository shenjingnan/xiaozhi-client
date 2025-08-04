# RestartButton 组件

一个独立的、可复用的重启按钮组件，基于 ConfigEditor.tsx 中的重启服务功能实现。

## 功能特性

- ✅ 点击按钮触发重启服务
- ✅ 显示重启进度状态（loading 动画）
- ✅ 处理重启成功/失败的状态反馈
- ✅ 在重启过程中禁用按钮防止重复点击
- ✅ 使用 RefreshCw 图标和 animate-spin 动画
- ✅ 完整的 TypeScript 类型支持
- ✅ 可自定义文本、样式和行为
- ✅ 完整的测试覆盖

## 基本用法

```tsx
import { RestartButton } from "@/components/RestartButton";

function MyComponent() {
  const handleRestart = async () => {
    // 你的重启逻辑
    await restartService();
  };

  return (
    <RestartButton onRestart={handleRestart} />
  );
}
```

## 带状态管理的用法

```tsx
import { RestartButton, type RestartStatus } from "@/components/RestartButton";

function MyComponent() {
  const [restartStatus, setRestartStatus] = useState<RestartStatus>();

  const handleRestart = async () => {
    setRestartStatus({ status: "restarting", timestamp: Date.now() });
    
    try {
      await restartService();
      setRestartStatus({ status: "completed", timestamp: Date.now() });
    } catch (error) {
      setRestartStatus({
        status: "failed",
        error: error.message,
        timestamp: Date.now(),
      });
    }
  };

  return (
    <RestartButton
      onRestart={handleRestart}
      restartStatus={restartStatus}
    />
  );
}
```

## Props 接口

```tsx
interface RestartButtonProps {
  /** 重启回调函数 */
  onRestart?: () => Promise<void> | void;
  /** 重启状态 */
  restartStatus?: RestartStatus;
  /** 是否禁用按钮 */
  disabled?: boolean;
  /** 按钮样式变体 */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** 自定义样式类 */
  className?: string;
  /** 重启中的文本 */
  restartingText?: string;
  /** 默认文本 */
  defaultText?: string;
}

interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}
```

## 自定义示例

### 自定义文本

```tsx
<RestartButton
  onRestart={handleRestart}
  defaultText="重新启动"
  restartingText="正在重启..."
/>
```

### 不同样式变体

```tsx
<RestartButton onRestart={handleRestart} variant="default" />
<RestartButton onRestart={handleRestart} variant="secondary" />
<RestartButton onRestart={handleRestart} variant="outline" />
```

### 自定义样式

```tsx
<RestartButton
  onRestart={handleRestart}
  className="w-full bg-blue-500 hover:bg-blue-600"
/>
```

## 在 ConfigEditor 中的使用

可以直接替换 ConfigEditor 中的内联重启按钮实现：

```tsx
// 原来的实现
{onRestart && (
  <Button
    type="button"
    onClick={handleRestart}
    variant="outline"
    disabled={isRestarting}
    className="flex items-center gap-2"
  >
    <RefreshCw className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
    {isRestarting ? "重启中..." : "重启服务"}
  </Button>
)}

// 使用新组件
{onRestart && (
  <RestartButton
    onRestart={onRestart}
    restartStatus={restartStatus}
  />
)}
```

## 错误处理

组件内部会自动处理错误：
- 显示 toast 错误消息
- 清除 loading 状态
- 恢复按钮可用状态

## 状态管理

组件支持两种状态管理方式：

1. **内部状态**：组件内部管理 `isRestarting` 状态
2. **外部状态**：通过 `restartStatus` prop 传入外部状态

当提供 `restartStatus` 时，组件会监听状态变化并相应地更新 UI。

## 测试

组件包含完整的测试覆盖，包括：
- 基本渲染测试
- 交互行为测试
- 状态管理测试
- 错误处理测试
- 自定义属性测试

运行测试：
```bash
pnpm test RestartButton.test.tsx
```

## 文件结构

```
web/src/components/
├── RestartButton.tsx          # 主组件
├── RestartButton.test.tsx     # 测试文件
├── RestartButton.example.tsx  # 使用示例
└── RestartButton.md          # 文档
```
