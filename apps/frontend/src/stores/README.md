# Store 使用指南

本文档介绍项目的 Store 架构和使用方式。

## 架构概述

项目使用 Zustand 进行状态管理，包含两个专门的 stores：

### 1. Config Store (`stores/config.ts`)

专门管理应用配置数据：

- `config`: 完整的应用配置
- `mcpEndpoint`: MCP 端点地址
- `mcpServers`: MCP 服务器配置
- `mcpServerConfig`: MCP 服务器工具配置
- `connection`: 连接配置
- `modelscope`: ModelScope 配置
- `webUI`: Web UI 配置

### 2. Status Store (`stores/status.ts`)

专门管理状态数据（基于 HTTP 轮询）：

- `clientStatus`: 客户端状态
- `restartStatus`: 重启状态
- `serviceStatus`: 服务状态
- `serviceHealth`: 服务健康状态
- `polling`: 轮询配置

## 使用方式

### 推荐方式：使用专门的选择器 hooks

```typescript
// 配置数据管理
import { useConfig, useMcpEndpoint, useMcpServers } from '@/stores/config';

// 状态数据管理
import { useClientStatus, useRestartStatus, useConnectionStatus } from '@/stores/status';

function MyComponent() {
  // 配置数据
  const config = useConfig();
  const mcpEndpoint = useMcpEndpoint();

  // 状态数据
  const clientStatus = useClientStatus();
  const connected = useConnectionStatus();

  return (
    <div>
      <p>连接状态: {connected ? '已连接' : '未连接'}</p>
      <p>MCP 端点: {mcpEndpoint}</p>
      <p>客户端状态: {clientStatus?.status}</p>
    </div>
  );
}
```

### 使用复合选择器

当组件需要多个相关状态时，使用复合选择器可以减少 hook 调用次数：

```typescript
// 配置数据和加载状态
import { useConfigWithLoading } from '@/stores/config';

// MCP 相关配置
import { useMcpConfig } from '@/stores/config';

function ConfigPanel() {
  // 同时获取配置和加载状态
  const { config, isLoading, isUpdating, error } = useConfigWithLoading();

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return <pre>{JSON.stringify(config, null, 2)}</pre>;
}
```

## 最佳实践

### 1. 选择合适的选择器

- 使用具体的选择器 hooks（如 `useConfig`、`useMcpEndpoint`、`useConnectionStatus`）而不是完整的 store
- 只订阅组件实际需要的状态
- 对于需要多个状态的组件，考虑使用复合选择器

### 2. 保持操作方法的传递

虽然状态可以从 store 获取，但操作方法（如 `updateConfig`, `restartService`）通过 Provider Context 暴露：

```typescript
import { useNetworkServiceActions } from '@/providers/NetworkServiceProvider';

function ConfigEditor() {
  const { updateConfig } = useNetworkServiceActions();
  // ...
}
```

## 数据来源

所有业务数据均通过 HTTP API 获取：

- **配置数据**: 通过 `GET /api/config` 获取，支持缓存
- **状态数据**: 通过 HTTP 轮询（默认 15s 间隔）获取
- **连接状态**: 基于 `clientStatus.status === "connected"` 判断
- **NPM 安装日志**: 通过 SSE (`EventSource`) 实时流式推送
