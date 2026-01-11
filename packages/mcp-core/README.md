# @xiaozhi-client/mcp-core

> MCP 协议核心实现库，提供服务连接和管理功能

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fmcp-core.svg)](https://www.npmjs.com/package/@xiaozhi-client/mcp-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/mcp-core` 是一个完全独立的 MCP（Model Context Protocol）核心实现库，提供：

- **零业务耦合** - 纯粹的 MCP 协议实现，无任何业务逻辑依赖
- **多传输协议支持** - 支持 STDIO、SSE、StreamableHTTP 三种传输方式
- **灵活的事件系统** - 基于回调的事件机制，易于集成
- **完整的类型定义** - TypeScript 严格模式，提供完整的类型支持
- **生产就绪** - 经过充分测试，可直接用于生产环境

## 特性

### 核心功能

- **MCP 服务连接管理** - 自动连接、重连、断开处理
- **工具发现与管理** - 自动发现和管理 MCP 工具
- **工具调用** - 简单易用的工具调用接口
- **参数验证** - 内置参数验证和类型检查
- **事件通知** - 连接状态变化、工具更新的实时通知

### 传输协议

| 协议 | 说明 | 使用场景 |
|------|------|----------|
| **STDIO** | 标准输入输出通信 | 本地进程通信 |
| **SSE** | Server-Sent Events | 单向服务器推送 |
| **StreamableHTTP** | 流式 HTTP 通信 | 现代 HTTP/2 场景 |

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/mcp-core

# 使用 pnpm
pnpm add @xiaozhi-client/mcp-core

# 使用 yarn
yarn add @xiaozhi-client/mcp-core
```

### 依赖要求

```json
{
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.24.0"
  }
}
```

请确保项目中安装了 `@modelcontextprotocol/sdk`：

```bash
npm install @modelcontextprotocol/sdk
```

## 快速开始

### 基础用法

```typescript
import { MCPConnection, MCPTransportType } from '@xiaozhi-client/mcp-core';

// 1. 创建连接配置
const config = {
  name: 'my-mcp-service',
  type: MCPTransportType.STREAMABLE_HTTP,
  url: 'https://api.example.com/mcp',
  apiKey: 'your-api-key'
};

// 2. 创建事件回调
const callbacks = {
  onConnected: (data) => {
    console.log(`服务 ${data.serviceName} 已连接，发现 ${data.tools.length} 个工具`);
  },
  onDisconnected: (data) => {
    console.log(`服务 ${data.serviceName} 已断开: ${data.reason}`);
  },
  onConnectionFailed: (data) => {
    console.error(`连接失败: ${data.error.message}`);
  }
};

// 3. 创建并连接
const connection = new MCPConnection(config, callbacks);
await connection.connect();

// 4. 调用工具
const result = await connection.callTool('my_tool', {
  param1: 'value1',
  param2: 'value2'
});

// 5. 获取工具列表
const tools = connection.getTools();
console.log('可用工具:', tools.map(t => t.name));

// 6. 断开连接
await connection.disconnect();
```

### STDIO 连接示例

```typescript
import { MCPConnection, MCPTransportType } from '@xiaozhi-client/mcp-core';

const config = {
  name: 'local-mcp-server',
  type: MCPTransportType.STDIO,
  command: 'node',
  args: ['path/to/server.js'],
  env: {
    NODE_ENV: 'production'
  }
};

const connection = new MCPConnection(config);
await connection.connect();
```

### SSE 连接示例

```typescript
import { MCPConnection, MCPTransportType } from '@xiaozhi-client/mcp-core';

const config = {
  name: 'sse-server',
  type: MCPTransportType.SSE,
  url: 'https://api.example.com/sse',
  headers: {
    'X-Custom-Header': 'value'
  }
};

const connection = new MCPConnection(config);
await connection.connect();
```

## 核心概念

### MCPConnection

`MCPConnection` 是核心连接类，负责单个 MCP 服务的完整生命周期管理。

#### 主要方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `connect()` | 建立连接 | `Promise<void>` |
| `disconnect()` | 断开连接 | `Promise<void>` |
| `callTool(name, args)` | 调用工具 | `Promise<ToolCallResult>` |
| `getTools()` | 获取工具列表 | `Tool[]` |
| `getConfig()` | 获取配置 | `MCPServiceConfig` |
| `getStatus()` | 获取状态 | `MCPServiceStatus` |
| `isConnected()` | 检查连接状态 | `boolean` |

#### 连接状态

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
  ERROR = 'error'
}
```

### 事件回调

使用回调函数模式处理连接事件：

```typescript
interface MCPServiceEventCallbacks {
  onConnected?: (data: {
    serviceName: string;
    tools: Tool[];
    connectionTime: Date;
  }) => void;

  onDisconnected?: (data: {
    serviceName: string;
    reason?: string;
    disconnectionTime: Date;
  }) => void;

  onConnectionFailed?: (data: {
    serviceName: string;
    error: Error;
    attempt: number;
  }) => void;
}
```

## 配置选项

### MCPServiceConfig

```typescript
interface MCPServiceConfig {
  // 基础配置
  name: string;                          // 服务名称（必需）
  type?: MCPTransportType;               // 传输类型（可选，自动推断）

  // STDIO 配置
  command?: string;                      // 执行命令
  args?: string[];                       // 命令参数
  env?: Record<string, string>;          // 环境变量

  // 网络配置
  url?: string;                          // 服务 URL

  // 认证配置
  apiKey?: string;                       // API 密钥
  headers?: Record<string, string>;      // 自定义请求头

  // 超时配置
  timeout?: number;                      // 连接超时（毫秒，默认 10000）

  // 重试配置
  retryAttempts?: number;                // 重试次数
}
```

### 传输类型推断

如果不指定 `type`，库会自动根据配置推断：

- 有 `command` 字段 → `MCPTransportType.STDIO`
- 有 `url` 字段 → `MCPTransportType.STREAMABLE_HTTP` 或 `MCPTransportType.SSE`

## 工具调用

### 基础调用

```typescript
const result = await connection.callTool('tool_name', {
  parameter1: 'value1',
  parameter2: 123
});

// 结果格式
interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}
```

### 参数验证

使用内置验证器确保参数正确：

```typescript
import { validateToolCallParams, ToolCallValidationOptions } from '@xiaozhi-client/mcp-core';

const options: ToolCallValidationOptions = {
  validateName: true,
  validateArguments: true,
  allowEmptyArguments: false
};

const validated = validateToolCallParams(params, options);
```

### 错误处理

```typescript
import { ToolCallError, ToolCallErrorCode } from '@xiaozhi-client/mcp-core';

try {
  await connection.callTool('tool_name', params);
} catch (error) {
  if (error instanceof ToolCallError) {
    switch (error.code) {
      case ToolCallErrorCode.INVALID_PARAMS:
        console.error('参数无效');
        break;
      case ToolCallErrorCode.TOOL_NOT_FOUND:
        console.error('工具不存在');
        break;
      case ToolCallErrorCode.SERVICE_UNAVAILABLE:
        console.error('服务不可用');
        break;
    }
  }
}
```

## 工具函数

### TypeFieldNormalizer

标准化类型字段格式：

```typescript
import { normalizeTypeField } from '@xiaozhi-client/mcp-core';

// 自动转换各种格式到标准 kebab-case
normalizeTypeField({ type: 'streamableHttp' });
// => { type: 'streamable-http' }

normalizeTypeField({ type: 'S_SE' });
// => { type: 'sse' }
```

### TransportFactory

直接创建传输层：

```typescript
import { TransportFactory } from '@xiaozhi-client/mcp-core';

const transport = TransportFactory.create(config);
```

## 完整示例

### 带完整错误处理的 MCP 客户端

```typescript
import {
  MCPConnection,
  MCPTransportType,
  ToolCallError,
  ToolCallErrorCode
} from '@xiaozhi-client/mcp-core';

class MyMCPClient {
  private connection: MCPConnection;

  constructor(url: string, apiKey: string) {
    const config = {
      name: 'my-service',
      type: MCPTransportType.STREAMABLE_HTTP,
      url,
      apiKey,
      timeout: 30000
    };

    const callbacks = {
      onConnected: (data) => {
        console.log(`✅ 已连接，发现 ${data.tools.length} 个工具`);
      },
      onDisconnected: (data) => {
        console.log(`❌ 已断开: ${data.reason}`);
      },
      onConnectionFailed: (data) => {
        console.error(`⚠️ 连接失败: ${data.error.message}`);
      }
    };

    this.connection = new MCPConnection(config, callbacks);
  }

  async connect() {
    try {
      await this.connection.connect();
    } catch (error) {
      console.error('连接错误:', error);
      throw error;
    }
  }

  async callTool(name: string, params: Record<string, unknown>) {
    try {
      const result = await this.connection.callTool(name, params);

      if (result.isError) {
        throw new Error(`工具调用失败: ${result.content[0]?.text}`);
      }

      return result.content[0]?.text;
    } catch (error) {
      if (error instanceof ToolCallError) {
        this.handleToolCallError(error);
      }
      throw error;
    }
  }

  private handleToolCallError(error: ToolCallError) {
    switch (error.code) {
      case ToolCallErrorCode.INVALID_PARAMS:
        console.error('❌ 参数错误:', error.message);
        break;
      case ToolCallErrorCode.TOOL_NOT_FOUND:
        console.error('❌ 工具不存在:', error.message);
        break;
      case ToolCallErrorCode.TIMEOUT:
        console.error('⏱️ 调用超时:', error.message);
        break;
      default:
        console.error('❌ 未知错误:', error.message);
    }
  }

  async disconnect() {
    await this.connection.disconnect();
  }
}

// 使用示例
const client = new MyMCPClient(
  'https://api.example.com/mcp',
  'your-api-key'
);

await client.connect();
const result = await client.callTool('calculate', {
  expression: '2 + 2'
});
console.log('结果:', result);
await client.disconnect();
```

## API 参考

### 导出的类

```typescript
// 连接管理
export { MCPConnection } from './connection.js';

// 错误处理
export { ToolCallError } from './types.js';

// 传输工厂
export { TransportFactory } from './transport-factory.js';
```

### 导出的类型

```typescript
export type {
  // 配置
  MCPServiceConfig,
  ModelScopeSSEOptions,
  UnifiedServerConfig,

  // 状态
  MCPServiceStatus,
  MCPServiceConnectionStatus,
  ManagerStatus,
  UnifiedServerStatus,

  // 工具
  ToolInfo,
  EnhancedToolInfo,
  ToolCallResult,
  ToolCallParams,
  ValidatedToolCallParams,
  ToolCallValidationOptions,
  CustomMCPTool,
  JSONSchema,

  // 传输
  MCPServerTransport,

  // 事件
  MCPServiceEventCallbacks,
} from './types.js';
```

### 导出的枚举

```typescript
export {
  MCPTransportType,    // 传输类型
  ConnectionState,     // 连接状态
  ToolCallErrorCode,   // 错误码
} from './types.js';
```

### 导出的工具函数

```typescript
export {
  TypeFieldNormalizer,
  normalizeTypeField,
  validateToolCallParams,
  inferTransportTypeFromUrl,
  inferTransportTypeFromConfig,
} from './utils/index.js';

export {
  isValidToolJSONSchema,
  ensureToolJSONSchema,
} from './types.js';
```

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/xiaozhi-client.git
cd xiaozhi-client/packages/mcp-core

# 安装依赖
pnpm install

# 开发模式（监听文件变化）
pnpm dev

# 构建
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm type-check
```

### 构建产物

```bash
dist/
├── index.js           # ESM 格式的编译产物
├── index.d.ts         # TypeScript 类型声明
└── index.js.map       # Source Map
```

## 最佳实践

### 1. 连接管理

```typescript
// ✅ 推荐：使用 try-finally 确保断开连接
try {
  await connection.connect();
  // 使用连接...
} finally {
  await connection.disconnect();
}

// ❌ 避免：不处理断开连接
await connection.connect();
// 使用连接...
// 忘记断开
```

### 2. 错误处理

```typescript
// ✅ 推荐：捕获并处理特定错误
try {
  await connection.callTool(name, params);
} catch (error) {
  if (error instanceof ToolCallError) {
    // 处理特定错误
  }
}

// ❌ 避免：忽略错误
await connection.callTool(name, params); // 可能抛出异常
```

### 3. 配置验证

```typescript
// ✅ 推荐：使用工厂函数推断类型
const config = {
  name: 'service',
  url: 'https://api.example.com'
  // type 会自动推断为 STREAMABLE_HTTP
};

// ❌ 避免：手动指定容易出错的类型
const config = {
  name: 'service',
  type: MCPTransportType.SSE, // 如果 URL 不支持 SSE 会失败
  url: 'https://api.example.com'
};
```

## 常见问题

### Q: 如何选择传输协议？

**A:**
- **本地进程** → 使用 `STDIO`
- **单向推送** → 使用 `SSE`
- **现代 HTTP** → 使用 `StreamableHTTP`（推荐）

### Q: 连接超时如何处理？

**A:** 在配置中设置 `timeout` 字段（单位：毫秒）：

```typescript
{
  timeout: 30000  // 30 秒超时
}
```

### Q: 如何处理连接失败？

**A:** 使用 `onConnectionFailed` 回调：

```typescript
const callbacks = {
  onConnectionFailed: (data) => {
    console.error(`第 ${data.attempt} 次尝试失败`);
    // 实现重连逻辑
  }
};
```

### Q: 工具调用支持流式响应吗？

**A:** 这取决于具体的 MCP 服务实现。`@xiaozhi-client/mcp-core` 支持所有 MCP SDK 定义的功能，包括流式响应。

## 许可证

[MIT](LICENSE)

## 相关资源

- [MCP 协议规范](https://modelcontextprotocol.io)
- [@xiaozhi-client/mcp-sdk](https://github.com/shenjingnan/xiaozhi-client)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**作者**: xiaozhi-client
**版本**: 1.9.7-beta.3
