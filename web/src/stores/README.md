# WebSocket Store 使用指南

本文档介绍如何使用 zustand store 来管理 WebSocket 数据，避免 props 层层传递的问题。

## 概述

我们创建了一个 zustand store 来缓存 WebSocket 获取的数据，包括：
- `connected`: WebSocket 连接状态
- `config`: 应用配置数据
- `status`: 客户端状态
- `restartStatus`: 重启状态
- `wsUrl`: WebSocket 连接地址

## 基本使用

### 1. 导入 Store

```typescript
import { 
  useWebSocketStore,
  useWebSocketConfig,
  useWebSocketStatus,
  useWebSocketConnected,
  useWebSocketRestartStatus,
  useWebSocketUrl
} from '../stores/websocket';
```

### 2. 使用选择器 Hooks

推荐使用选择器 hooks，这样组件只会在相关状态变化时重新渲染：

```typescript
function MyComponent() {
  // 只订阅 connected 状态
  const connected = useWebSocketConnected();
  
  // 只订阅 config 状态
  const config = useWebSocketConfig();
  
  // 只订阅 status 状态
  const status = useWebSocketStatus();
  
  return (
    <div>
      <p>连接状态: {connected ? '已连接' : '未连接'}</p>
      <p>配置: {config ? '已加载' : '加载中'}</p>
    </div>
  );
}
```

### 3. 使用复合选择器

对于需要多个状态的组件，可以使用复合选择器：

```typescript
import { useWebSocketConnectionInfo, useWebSocketData } from '../stores/websocket';

function MyComponent() {
  // 获取连接相关信息
  const { connected, wsUrl } = useWebSocketConnectionInfo();
  
  // 获取数据相关信息
  const { config, status } = useWebSocketData();
  
  return (
    <div>
      <p>连接到: {wsUrl}</p>
      <p>状态: {connected ? '已连接' : '未连接'}</p>
    </div>
  );
}
```

### 4. 使用完整 Store

如果需要访问所有状态和操作方法：

```typescript
function MyComponent() {
  const store = useWebSocketStore();
  
  return (
    <div>
      <p>连接状态: {store.connected ? '已连接' : '未连接'}</p>
      <button onClick={() => store.setConnected(!store.connected)}>
        切换连接状态
      </button>
    </div>
  );
}
```

## 迁移指南

### 从 Props 传递迁移到 Store

**之前 (使用 props):**
```typescript
interface StatusCardProps {
  connected: boolean;
  status: ClientStatus | null;
}

function StatusCard({ connected, status }: StatusCardProps) {
  return (
    <div>
      <p>连接状态: {connected ? '已连接' : '未连接'}</p>
      <p>服务状态: {status?.status}</p>
    </div>
  );
}

// 在父组件中
function Dashboard() {
  const { connected, status } = useWebSocket();
  
  return <StatusCard connected={connected} status={status} />;
}
```

**之后 (使用 store):**
```typescript
import { useWebSocketConnected, useWebSocketStatus } from '../stores/websocket';

function StatusCard() {
  // 直接从 store 获取数据，无需 props
  const connected = useWebSocketConnected();
  const status = useWebSocketStatus();
  
  return (
    <div>
      <p>连接状态: {connected ? '已连接' : '未连接'}</p>
      <p>服务状态: {status?.status}</p>
    </div>
  );
}

// 在父组件中
function Dashboard() {
  // 不需要传递 props
  return <StatusCard />;
}
```

## 最佳实践

### 1. 选择合适的选择器

- 使用具体的选择器 hooks（如 `useWebSocketConfig`）而不是完整的 store
- 只订阅组件实际需要的状态
- 对于需要多个状态的组件，考虑使用复合选择器

### 2. 保持操作方法的传递

虽然状态可以从 store 获取，但操作方法（如 `updateConfig`, `restartService`）仍然建议通过 props 传递，这样可以：
- 保持组件的可测试性
- 明确组件的依赖关系
- 便于组件复用

### 3. 渐进式迁移

不需要一次性迁移所有组件，可以：
- 先迁移深层嵌套的组件
- 保留简单组件的 props 传递方式
- 根据实际需要决定是否迁移

## 示例组件

查看以下示例组件了解具体用法：
- `StatusCardWithStore.tsx`: 基本的状态订阅示例
- `ConfigEditorWithStore.tsx`: 复杂组件的 store 使用示例
- `DashboardWithStore.tsx`: 混合使用 hook 和 store 的示例

## 兼容性

- ✅ 完全兼容现有的 `useWebSocket` hook
- ✅ 现有组件无需修改即可继续工作
- ✅ 可以在同一个应用中混合使用两种方式
- ✅ 所有现有测试仍然有效
