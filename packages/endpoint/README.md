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

### 新 API（推荐使用）

新 API 提供更简洁的配置方式，直接在构造函数中传入 MCP 服务器配置：

#### 单个连接（Endpoint）

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

#### 多连接管理（EndpointManager）

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

### 旧 API（向后兼容）

旧 API 仍然可用，需要单独设置服务管理器：

#### 单个连接（EndpointConnection）

```typescript
import { EndpointConnection } from '@xiaozhi-client/endpoint';
import type { IMCPServiceManager } from '@xiaozhi-client/endpoint';

// 1. 实现服务管理器接口（用于工具调用）
class MyServiceManager implements IMCPServiceManager {
  getAllTools() {
    return [
      {
        name: 'my_tool',
        description: '我的工具',
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string' }
          }
        }
      }
    ];
  }

  async callTool(toolName: string, args: Record<string, unknown>) {
    // 实现工具调用逻辑
    return {
      content: [{ type: 'text', text: '执行成功' }],
      isError: false
    };
  }
}

// 2. 创建连接实例
const connection = new EndpointConnection('ws://xiaozhi.example.com/endpoint', {
  reconnectDelay: 2000  // 重连延迟（毫秒）
});

// 3. 设置服务管理器（必需）
const serviceManager = new MyServiceManager();
connection.setServiceManager(serviceManager);

// 4. 连接
await connection.connect();

// 5. 检查状态
const status = connection.getStatus();
console.log('已连接:', status.connected);
console.log('可用工具数:', status.availableTools);

// 6. 断开连接
connection.disconnect();
```

### 多连接管理（EndpointManager）

```typescript
import { EndpointManager } from '@xiaozhi-client/endpoint';
import type { IMCPServiceManager } from '@xiaozhi-client/endpoint';

// 1. 创建管理器
const manager = new EndpointManager({
  connectionTimeout: 10000,  // 连接超时（毫秒）
  reconnectDelay: 2000       // 重连延迟（毫秒）
});

// 2. 设置服务管理器
manager.setServiceManager(serviceManager);

// 3. 初始化并连接
const endpoints = [
  'ws://xiaozhi1.example.com/endpoint',
  'ws://xiaozhi2.example.com/endpoint'
];

await manager.initialize(endpoints, tools);
await manager.connect();

// 4. 查询状态
const statuses = manager.getConnectionStatus();
console.log('已连接端点数:', statuses.filter(s => s.connected).length);

// 5. 动态添加端点
await manager.addConnection('ws://xiaozhi3.example.com/endpoint');

// 6. 移除端点
await manager.removeConnection('ws://xiaozhi1.example.com/endpoint');

// 7. 重连所有端点
const result = await manager.reconnectAll();
console.log(`重连成功: ${result.successCount}, 失败: ${result.failureCount}`);

// 8. 清理资源
await manager.cleanup();
```

## API 参考

### EndpointConnection

单个小智接入点的连接管理类。

#### 构造函数

```typescript
constructor(endpointUrl: string, reconnectDelay = 2000)
```

- `endpointUrl`: 小智接入点的 WebSocket URL（必须以 `ws://` 或 `wss://` 开头）
- `reconnectDelay`: 重连延迟时间（毫秒），默认 2000

#### 方法

##### setServiceManager()

设置 MCP 服务管理器实例（连接前必须设置）。

```typescript
setServiceManager(serviceManager: IMCPServiceManager): void
```

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

### EndpointManager

多个小智接入点的连接管理类，继承自 EventEmitter。

#### 构造函数

```typescript
constructor(options?: ConnectionOptions)
```

配置选项：
```typescript
interface ConnectionOptions {
  connectionTimeout?: number;  // 连接超时（毫秒），默认 10000
  reconnectDelay?: number;     // 重连延迟（毫秒），默认 2000
}
```

#### 方法

##### setServiceManager()

设置 MCP 服务管理器实例。

```typescript
setServiceManager(manager: IMCPServiceManager): void
```

##### initialize()

初始化管理器，创建所有端点的连接实例。

```typescript
async initialize(endpoints: string[], tools: Tool[]): Promise<void>
```

- `endpoints`: 小智接入点 URL 数组
- `tools`: 工具列表（符合 MCP SDK 的 Tool 类型）

##### connect()

连接所有已初始化的端点。

```typescript
async connect(): Promise<void>
```

##### disconnect()

断开所有连接。

```typescript
async disconnect(): Promise<void>
```

##### addConnection()

动态添加新连接（不写入配置文件）。

```typescript
async addConnection(endpoint: string): Promise<void>
```

##### removeConnection()

移除指定连接（不写入配置文件）。

```typescript
async removeConnection(endpoint: string): Promise<void>
```

##### reconnectAll()

重连所有端点。

```typescript
async reconnectAll(): Promise<ReconnectResult>
```

返回类型：
```typescript
interface ReconnectResult {
  successCount: number;        // 成功数量
  failureCount: number;        // 失败数量
  results: Array<{
    endpoint: string;
    success: boolean;
    error?: string;
  }>;
}
```

##### getEndpoints()

获取所有端点列表。

```typescript
getEndpoints(): string[]
```

##### getConnectionStatus()

获取所有连接状态。

```typescript
getConnectionStatus(): ConnectionStatus[]
```

##### isAnyConnected()

检查是否有任何连接处于连接状态。

```typescript
isAnyConnected(): boolean
```

##### cleanup()

清理所有资源。

```typescript
async cleanup(): Promise<void>
```

#### 事件

EndpointManager 继承自 EventEmitter，支持以下事件：

```typescript
// 配置变更事件
manager.on('configChange', (event: ConfigChangeEvent) => {
  console.log('配置变更:', event.type);
});
```

## 类型定义

### IMCPServiceManager

服务管理器接口，需要由使用者实现。

```typescript
interface IMCPServiceManager {
  // 获取所有工具列表
  getAllTools(): EnhancedToolInfo[];

  // 调用工具
  callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult>;
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
import { EndpointConnection } from '@xiaozhi-client/endpoint';
import type { IMCPServiceManager, ToolCallResult } from '@xiaozhi-client/endpoint';

// 实现服务管理器
class SimpleServiceManager implements IMCPServiceManager {
  private tools = [
    {
      name: 'echo',
      description: '回显输入的文本',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要回显的文本' }
        },
        required: ['text']
      }
    },
    {
      name: 'get_time',
      description: '获取当前时间',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  getAllTools() {
    return this.tools;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    switch (toolName) {
      case 'echo':
        return {
          content: [{
            type: 'text',
            text: `回显: ${args.text}`
          }],
          isError: false
        };

      case 'get_time':
        return {
          content: [{
            type: 'text',
            text: `当前时间: ${new Date().toISOString()}`
          }],
          isError: false
        };

      default:
        return {
          content: [{
            type: 'text',
            text: `未知工具: ${toolName}`
          }],
          isError: true
        };
    }
  }
}

// 使用示例
async function main() {
  const connection = new EndpointConnection('ws://xiaozhi.example.com/endpoint');
  const serviceManager = new SimpleServiceManager();

  connection.setServiceManager(serviceManager);

  try {
    await connection.connect();
    console.log('连接成功！');

    const status = connection.getStatus();
    console.log('可用工具:', status.availableTools);

    // 监听连接状态变化...
  } catch (error) {
    console.error('连接失败:', error);
  } finally {
    connection.disconnect();
  }
}

main();
```

### 多端点负载均衡示例

```typescript
import { EndpointManager } from '@xiaozhi-client/endpoint';
import type { IMCPServiceManager } from '@xiaozhi-client/endpoint';

const manager = new EndpointManager({
  connectionTimeout: 10000,
  reconnectDelay: 2000
});

manager.setServiceManager(serviceManager);

// 初始化多个端点
const endpoints = [
  'wss://xiaozhi1.example.com/endpoint',
  'wss://xiaozhi2.example.com/endpoint',
  'wss://xiaozhi3.example.com/endpoint'
];

await manager.initialize(endpoints, tools);
await manager.connect();

// 检查连接状态
const statuses = manager.getConnectionStatus();
statuses.forEach(status => {
  console.log(`${status.endpoint}: ${status.connected ? '已连接' : '未连接'}`);
});

// 监听配置变更事件
manager.on('configChange', (event) => {
  console.log('配置变更:', event.type);
});
```

## 错误处理

```typescript
import { EndpointConnection, ToolCallError, ToolCallErrorCode } from '@xiaozhi-client/endpoint';

const connection = new EndpointConnection('ws://xiaozhi.example.com/endpoint');

try {
  await connection.connect();
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

### Q: 连接时提示 "MCPServiceManager 未设置"？

A: 在调用 `connect()` 前必须先调用 `setServiceManager()` 设置服务管理器。

### Q: 如何处理连接断开？

A: EndpointManager 不支持自动重连。你需要监听连接状态并手动调用 `reconnect()` 或 `reconnectAll()`。

### Q: 如何自定义工具调用超时时间？

A: 目前工具调用超时固定为 30 秒。如需修改，可以在 `EndpointConnection` 类中调整 `toolCallTimeout` 属性。

### Q: 支持哪些 WebSocket URL 格式？

A: 支持 `ws://` 和 `wss://` 协议的 URL。可以使用 `isValidEndpointUrl()` 函数验证 URL 格式。

## 许可证

MIT

## 相关链接

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [MCP 协议规范](https://modelcontextprotocol.io/)
