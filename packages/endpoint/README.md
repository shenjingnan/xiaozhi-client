# @xiaozhi-client/endpoint

小智接入点 WebSocket 连接管理库，提供独立、易用的小智接入点连接功能。

## 特性

- **独立部署** - 无需配置文件、日志系统等外部依赖
- **简单易用** - 传入端点 URL 即可使用
- **多端点管理** - 支持同时管理多个小智接入点
- **MCP 协议** - 完整实现 Model Context Protocol 协议
- **TypeScript** - 完整的类型定义支持
- **事件驱动** - 基于 EventEmitter 的状态管理

## 安装

```bash
npm install @xiaozhi-client/endpoint
# 或
pnpm add @xiaozhi-client/endpoint
# 或
yarn add @xiaozhi-client/endpoint
```

## 快速开始

### 单个连接（Endpoint）

```typescript
import { Endpoint } from '@xiaozhi-client/endpoint';

const endpoint = new Endpoint("ws://localhost:8080", {
  mcpServers: {
    // 本地 MCP 服务器
    calculator: {
      command: "node",
      args: ["./calculator.js"]
    },
    // SSE MCP 服务器
    "sse-service": {
      type: "sse",
      url: "https://api.example.com/sse"
    }
  },
  reconnectDelay: 2000
});

await endpoint.connect();

// 检查状态
const status = endpoint.getStatus();
console.log('已连接:', status.connected);
console.log('可用工具数:', status.availableTools);

// 断开连接
endpoint.disconnect();
```

### 多连接管理（EndpointManager）

```typescript
import { Endpoint, EndpointManager } from '@xiaozhi-client/endpoint';

// 创建多个 Endpoint 实例
const endpoint1 = new Endpoint("ws://localhost:8080", {
  mcpServers: {
    calculator: {
      command: "node",
      args: ["./calculator.js"]
    }
  }
});

const endpoint2 = new Endpoint("ws://localhost:8081", {
  mcpServers: {
    datetime: {
      command: "node",
      args: ["./datetime.js"]
    }
  }
});

// 创建管理器并添加端点
const manager = new EndpointManager();
manager.addEndpoint(endpoint1);
manager.addEndpoint(endpoint2);

// 连接所有端点
await manager.connect();

// 检查状态
const statuses = manager.getConnectionStatus();
console.log('已连接端点数:', statuses.filter(s => s.connected).length);

// 断开所有连接
await manager.disconnect();
```

## API 参考

### Endpoint

单个小智接入点的连接管理类。

#### 构造函数

```typescript
constructor(endpointUrl: string, config: EndpointConfig)
```

- `endpointUrl`: 小智接入点的 WebSocket URL（必须以 `ws://` 或 `wss://` 开头）
- `config`: 配置对象
  - `mcpServers`: MCP 服务器配置对象
  - `reconnectDelay`: 重连延迟时间（毫秒），默认 2000

#### 方法

##### connect()

连接到小智接入点。

```typescript
async connect(): Promise<void>
```

##### disconnect()

主动断开连接。

```typescript
disconnect(): void
```

##### reconnect()

重连到小智接入点。

```typescript
async reconnect(): Promise<void>
```

##### getStatus()

获取当前连接状态。

```typescript
getStatus(): EndpointConnectionStatus
```

返回类型：
```typescript
interface EndpointConnectionStatus {
  connected: boolean;           // 是否已连接
  initialized: boolean;         // 是否已完成 MCP 初始化
  url: string;                  // 端点 URL
  availableTools: number;       // 可用工具数量
  connectionState: ConnectionState;  // 连接状态枚举
  lastError?: string;           // 最后一次错误信息
}
```

##### isConnected()

检查是否已连接。

```typescript
isConnected(): boolean
```

##### getTools()

获取所有可用工具列表。

```typescript
getTools(): Tool[]
```

##### getUrl()

获取端点 URL。

```typescript
getUrl(): string
```

### EndpointManager

多个小智接入点的连接管理类，继承自 EventEmitter。

#### 构造函数

```typescript
constructor(config?: EndpointManagerConfig)
```

配置选项：
```typescript
interface EndpointManagerConfig {
  defaultReconnectDelay?: number;  // 默认重连延迟（毫秒）
}
```

#### 方法

##### addEndpoint()

添加 Endpoint 实例。

```typescript
addEndpoint(endpoint: Endpoint): void
```

##### removeEndpoint()

移除 Endpoint 实例。

```typescript
removeEndpoint(endpoint: Endpoint): void
```

##### connect()

连接所有 Endpoint。

```typescript
async connect(): Promise<void>
```

##### disconnect()

断开所有连接。

```typescript
async disconnect(): Promise<void>
```

##### reconnectAll()

重连所有端点。

```typescript
async reconnectAll(): Promise<void>
```

##### reconnectEndpoint()

重连指定的端点。

```typescript
async reconnectEndpoint(url: string): Promise<void>
```

##### getEndpoints()

获取所有端点列表。

```typescript
getEndpoints(): string[]
```

##### getEndpoint()

获取指定 Endpoint 实例。

```typescript
getEndpoint(url: string): Endpoint | undefined
```

##### getConnectionStatus()

获取所有连接状态。

```typescript
getConnectionStatus(): SimpleConnectionStatus[]
```

##### isAnyConnected()

检查是否有任何连接处于连接状态。

```typescript
isAnyConnected(): boolean
```

##### isEndpointConnected()

检查指定端点是否已连接。

```typescript
isEndpointConnected(url: string): boolean
```

##### getEndpointStatus()

获取指定端点的状态。

```typescript
getEndpointStatus(url: string): SimpleConnectionStatus | undefined
```

##### clearEndpoints()

清除所有端点。

```typescript
async clearEndpoints(): Promise<void>
```

##### cleanup()

清理资源。

```typescript
async cleanup(): Promise<void>
```

#### 事件

EndpointManager 继承自 EventEmitter，支持以下事件：

```typescript
// 端点添加事件
manager.on('endpointAdded', (event) => {
  console.log('端点已添加:', event.endpoint);
});

// 端点移除事件
manager.on('endpointRemoved', (event) => {
  console.log('端点已移除:', event.endpoint);
});
```

## 类型定义

### EndpointConfig

Endpoint 配置接口。

```typescript
interface EndpointConfig {
  // MCP 服务器配置（必需）
  mcpServers: Record<string, MCPServerConfig>;
  // 重连延迟（可选）
  reconnectDelay?: number;
  // ModelScope API Key（可选）
  modelscopeApiKey?: string;
}
```

### MCPServerConfig

MCP 服务器配置类型，支持三种类型：

#### 本地 MCP 服务器

```typescript
interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}
```

#### SSE MCP 服务器

```typescript
interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}
```

#### HTTP MCP 服务器

```typescript
interface HTTPMCPServerConfig {
  type?: "http";
  url: string;
  headers?: Record<string, string>;
}
```

### ConnectionState

连接状态枚举。

```typescript
enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',  // 已断开
  CONNECTING = 'CONNECTING',      // 连接中
  CONNECTED = 'CONNECTED'         // 已连接
}
```

### ToolCallErrorCode

工具调用错误码。

```typescript
enum ToolCallErrorCode {
  INVALID_PARAMS = -32602,        // 参数无效
  TOOL_NOT_FOUND = -32001,        // 工具不存在
  SERVICE_UNAVAILABLE = -32002,   // 服务不可用
  TOOL_EXECUTION_ERROR = -32003,  // 工具执行错误
  TIMEOUT = -32008                // 超时
}
```

### ToolCallError

工具调用错误类。

```typescript
class ToolCallError extends Error {
  constructor(
    public code: ToolCallErrorCode,
    message: string,
    public data?: unknown
  )
}
```

## 工具函数

### sliceEndpoint()

截断端点 URL 用于日志显示。

```typescript
import { sliceEndpoint } from '@xiaozhi-client/endpoint';

const short = sliceEndpoint('ws://very-long-endpoint-url-here.example.com/endpoint');
// 返回: "ws://very-long-endpoint-u...e.com/endpoint"
```

### isValidEndpointUrl()

验证端点 URL 格式。

```typescript
import { isValidEndpointUrl } from '@xiaozhi-client/endpoint';

const valid = isValidEndpointUrl('ws://xiaozhi.example.com/endpoint');
```

### validateToolCallParams()

验证工具调用参数。

```typescript
import { validateToolCallParams } from '@xiaozhi-client/endpoint';

const params = validateToolCallParams({
  name: 'my_tool',
  arguments: { foo: 'bar' }
});
```

## 完整示例

### 创建简单的小智客户端

```typescript
import { Endpoint } from '@xiaozhi-client/endpoint';

// 使用示例
async function main() {
  const endpoint = new Endpoint('ws://xiaozhi.example.com/endpoint', {
    mcpServers: {
      calculator: {
        command: "node",
        args: ["./calculator.js"]
      }
    }
  });

  try {
    await endpoint.connect();
    console.log('连接成功！');

    const status = endpoint.getStatus();
    console.log('可用工具:', status.availableTools);

    // 监听连接状态变化...
  } catch (error) {
    console.error('连接失败:', error);
  } finally {
    endpoint.disconnect();
  }
}

main();
```

### 多端点负载均衡示例

```typescript
import { Endpoint, EndpointManager } from '@xiaozhi-client/endpoint';

// 创建多个端点
const endpoint1 = new Endpoint("wss://xiaozhi1.example.com/endpoint", {
  mcpServers: {
    calculator: {
      command: "node",
      args: ["./calculator.js"]
    }
  }
});

const endpoint2 = new Endpoint("wss://xiaozhi2.example.com/endpoint", {
  mcpServers: {
    calculator: {
      command: "node",
      args: ["./calculator.js"]
    }
  }
});

const endpoint3 = new Endpoint("wss://xiaozhi3.example.com/endpoint", {
  mcpServers: {
    calculator: {
      command: "node",
      args: ["./calculator.js"]
    }
  }
});

// 创建管理器
const manager = new EndpointManager();

// 添加所有端点
manager.addEndpoint(endpoint1);
manager.addEndpoint(endpoint2);
manager.addEndpoint(endpoint3);

// 连接所有端点
await manager.connect();

// 检查连接状态
const statuses = manager.getConnectionStatus();
statuses.forEach(status => {
  console.log(`${status.endpoint}: ${status.connected ? '已连接' : '未连接'}`);
});

// 监听端点添加事件
manager.on('endpointAdded', (event) => {
  console.log('端点已添加:', event.endpoint);
});

manager.on('endpointRemoved', (event) => {
  console.log('端点已移除:', event.endpoint);
});
```

## 错误处理

```typescript
import { Endpoint, ToolCallError, ToolCallErrorCode } from '@xiaozhi-client/endpoint';

const endpoint = new Endpoint('ws://xiaozhi.example.com/endpoint', {
  mcpServers: {
    calculator: {
      command: "node",
      args: ["./calculator.js"]
    }
  }
});

try {
  await endpoint.connect();
} catch (error) {
  if (error instanceof ToolCallError) {
    switch (error.code) {
      case ToolCallErrorCode.TIMEOUT:
        console.error('连接超时');
        break;
      case ToolCallErrorCode.SERVICE_UNAVAILABLE:
        console.error('服务不可用');
        break;
      default:
        console.error('未知错误:', error.message);
    }
  }
}
```

## 常见问题

### Q: 如何处理连接断开？

A: EndpointManager 不支持自动重连。你需要监听连接状态并手动调用 `reconnect()` 或 `reconnectAll()`。

### Q: 如何自定义工具调用超时时间？

A: 目前工具调用超时固定为 30 秒。如需修改，可以在 `Endpoint` 类中调整 `toolCallTimeout` 属性。

### Q: 支持哪些 WebSocket URL 格式？

A: 支持 `ws://` 和 `wss://` 协议的 URL。可以使用 `isValidEndpointUrl()` 函数验证 URL 格式。

### Q: 如何监听端点状态变化？

A: EndpointManager 继承自 EventEmitter，可以监听 `endpointAdded` 和 `endpointRemoved` 事件。

## 许可证

MIT

## 相关链接

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [MCP 协议规范](https://modelcontextprotocol.io/)
