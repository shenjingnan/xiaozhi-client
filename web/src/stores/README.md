# WebSocket 架构重构后的使用指南

本文档介绍重构后的 WebSocket 架构和新的 store 使用方式。

## 架构概述

经过重构，我们现在有三个专门的 stores：

### 1. WebSocket Store (`stores/websocket.ts`)

专门管理 WebSocket 连接状态：

- `connectionState`: 连接状态（connecting/connected/disconnected/reconnecting）
- `wsUrl`: WebSocket 连接地址
- `lastError`: 最后的连接错误
- `connectionStats`: 连接统计信息
- `portChangeStatus`: 端口切换状态

### 2. Config Store (`stores/config.ts`)

专门管理应用配置数据：

- `config`: 完整的应用配置
- `mcpEndpoint`: MCP 端点地址
- `mcpServers`: MCP 服务器配置
- `mcpServerConfig`: MCP 服务器工具配置
- `connection`: 连接配置
- `modelscope`: ModelScope 配置
- `webUI`: Web UI 配置

### 3. Status Store (`stores/status.ts`)

专门管理状态数据：

- `clientStatus`: 客户端状态
- `restartStatus`: 重启状态
- `serviceStatus`: 服务状态
- `serviceHealth`: 服务健康状态
- `polling`: 轮询配置

## 新架构使用方式

### 1. 推荐的新方式

使用专门的 stores 和 hooks：

```typescript
// 连接状态管理
import { useWebSocketConnected, useWebSocketUrl } from '@/stores/websocket';

// 配置数据管理
import { useConfig, useMcpEndpoint, useMcpServers } from '@/stores/config';

// 状态数据管理
import { useClientStatus, useRestartStatus } from '@/stores/status';

function MyComponent() {
  // WebSocket 连接状态
  const connected = useWebSocketConnected();
  const wsUrl = useWebSocketUrl();

  // 配置数据
  const config = useConfig();
  const mcpEndpoint = useMcpEndpoint();

  // 状态数据
  const clientStatus = useClientStatus();
  const restartStatus = useRestartStatus();

  return (
    <div>
      <p>连接状态: {connected ? '已连接' : '未连接'}</p>
      <p>连接地址: {wsUrl}</p>
      <p>MCP 端点: {mcpEndpoint}</p>
      <p>客户端状态: {clientStatus?.status}</p>
    </div>
  );
}
```

### 2. 专用 Hooks（推荐）

使用新的专用 hooks 获得更好的类型安全和功能分离：

```typescript
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useConfigData } from '@/hooks/useConfigData';
import { useStatusData } from '@/hooks/useStatusData';

function MyComponent() {
  // 连接管理
  const { connected, connect, disconnect, lastError } = useWebSocketConnection();

  // 配置管理
  const { config, updateConfig, isLoading } = useConfigData();

  // 状态管理
  const { clientStatus, refreshStatus, restartService } = useStatusData();

  return (
    <div>
      <p>连接状态: {connected ? '已连接' : '未连接'}</p>
      {lastError && <p>连接错误: {lastError.message}</p>}
      <button onClick={connect}>连接</button>
      <button onClick={() => refreshStatus()}>刷新状态</button>
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

## 迁移指南

### 从旧的 WebSocket Store 迁移

如果你的组件使用了以下废弃的选择器，请按照下表进行迁移：

| 旧选择器 | 新选择器 | 说明 |
|---------|---------|------|
| `useWebSocketConfig` | `useConfig` from `@/stores/config` | 配置数据已迁移到专门的 config store |
| `useWebSocketStatus` | `useClientStatus` from `@/stores/status` | 状态数据已迁移到专门的 status store |
| `useWebSocketMcpEndpoint` | `useMcpEndpoint` from `@/stores/config` | MCP 端点数据在 config store 中 |
| `useWebSocketMcpServers` | `useMcpServers` from `@/stores/config` | MCP 服务器数据在 config store 中|
| `useWebSocketRestartStatus` | `useRestartStatus` from `@/stores/status` | 重启状态在 status store 中 |

### 迁移示例

**之前：**

```typescript
import { useWebSocketConfig, useWebSocketStatus } from '@/stores/websocket';

function MyComponent() {
  const config = useWebSocketConfig();
  const status = useWebSocketStatus();
  // ...
}
```

**之后：**

```typescript
import { useConfig } from '@/stores/config';
import { useClientStatus } from '@/stores/status';

function MyComponent() {
  const config = useConfig();
  const status = useClientStatus();
  // ...
}
```

## 向后兼容性

- ✅ **完全兼容现有的 `useWebSocket` hook**：现有组件无需修改即可继续工作
- ✅ **废弃选择器仍然可用**：旧的选择器会显示警告但仍然工作
- ✅ **渐进式迁移**：可以在同一个应用中混合使用新旧方式
- ✅ **所有现有测试仍然有效**：不会破坏现有的测试用例

## 架构优势

### 重构前的问题

- WebSocket 多实例问题
- 职责混乱（连接管理、配置数据、状态数据混合）
- 状态管理分散

### 重构后的优势

- ✅ **WebSocket 单例模式**：确保全局唯一连接
- ✅ **职责分离**：连接、配置、状态分别管理
- ✅ **事件总线机制**：支持多个 store 订阅 WebSocket 事件
- ✅ **类型安全**：更好的 TypeScript 支持
- ✅ **性能优化**：减少不必要的重新渲染
