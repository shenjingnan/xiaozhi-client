# RestartButton 组件

一个独立的、可复用的重启按钮组件，集成了完整的重启服务功能和状态管理。

## 功能特性

- ✅ 点击按钮触发重启服务
- ✅ 显示重启进度状态（loading 动画）
- ✅ 异步轮询检查重连状态
- ✅ 智能显示重启/重连进度文本
- ✅ 在重启过程中禁用按钮防止重复点击
- ✅ 使用 PowerIcon 和 LoaderCircleIcon 图标
- ✅ 完整的 TypeScript 类型支持
- ✅ 可自定义文本和样式
- ✅ 完整的测试覆盖
- ✅ 集成 status store 状态管理

## 基本用法

```tsx
import { RestartButton } from "@/components/RestartButton";

function MyComponent() {
  return (
    <RestartButton />
  );
}
```

## 自定义样式用法

```tsx
import { RestartButton } from "@/components/RestartButton";

function MyComponent() {
  return (
    <RestartButton
      variant="default"
      className="w-full"
      defaultText="重新启动"
      restartingText="正在重启..."
    />
  );
}
```

## Props 接口

```tsx
interface RestartButtonProps {
  /** 重启状态（已废弃，组件内部自动管理） */
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
  defaultText="重新启动"
  restartingText="正在重启..."
/>
```

### 不同样式变体

```tsx
<RestartButton variant="default" />
<RestartButton variant="secondary" />
<RestartButton variant="outline" />
```

### 自定义样式

```tsx
<RestartButton
  className="w-full bg-blue-500 hover:bg-blue-600"
/>
```

### 禁用状态

```tsx
<RestartButton disabled />
```

## 重启行为说明

### 重启流程

1. **点击按钮**：触发 `restartService()` 方法
2. **发送重启请求**：向服务器发送重启命令
3. **启动轮询检查**：开始检查服务重连状态
4. **显示进度**：按钮显示"重启中..."或"重连中..."
5. **完成或超时**：重连成功或达到最大尝试次数后结束

### 状态显示逻辑

- **默认状态**：显示"重启服务"，使用 PowerIcon
- **重启中**：显示"重启中..."，使用旋转的 LoaderCircleIcon
- **重连中**：显示"重连中..."，使用旋转的 LoaderCircleIcon

### 集成的状态管理

组件完全集成了 status store，自动处理：

- **重启状态**：通过 `useStatusStore` 获取 `isRestarting` 状态
- **轮询状态**：通过 `useRestartPollingStatus` 获取重连进度
- **错误处理**：重启失败时在控制台记录错误日志
- **通知系统**：配合 `useRestartNotifications` 显示用户通知

## 依赖的 Hooks

组件内部使用以下 hooks：

- `useStatusStore()` - 获取重启状态和 restartService 方法
- `useRestartPollingStatus()` - 获取重连轮询状态

## 测试

组件包含完整的测试覆盖，包括：

- 基本渲染测试
- 交互行为测试（点击调用 restartService）
- 状态管理测试（重启状态显示）
- 错误处理测试（重启失败处理）
- 自定义属性测试（文本、样式等）

运行测试：

```bash
pnpm test RestartButton.test.tsx
```

## 相关文件

```text
web/src/components/
├── RestartButton.tsx          # 主组件
├── RestartButton.test.tsx     # 测试文件
└── RestartButton.md          # 文档

web/src/stores/
└── status.ts                 # 状态管理 store

web/src/hooks/
└── useRestartNotifications.ts # 重启通知 hook
```

## 迁移指南

如果你之前使用的是带 `onRestart` prop 的版本，请按以下方式迁移：

### 旧版本（已废弃）

```tsx
// ❌ 旧版本 - 不再支持
<RestartButton onRestart={handleRestart} />
```

### 新版本

```tsx
// ✅ 新版本 - 推荐使用
<RestartButton />
```

新版本的优势：

- 自动集成状态管理，无需手动处理重启逻辑
- 支持异步重连检查和进度显示
- 集成通知系统，提供更好的用户体验
- 更简洁的 API，减少样板代码
