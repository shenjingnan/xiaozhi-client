# @xiaozhi-client/config

小智客户端配置管理库，提供配置文件解析、验证和管理的完整功能。

## 特性

- **多种配置格式支持** - 支持 JSON、JSON5、JSONC 三种配置文件格式
- **智能路径解析** - 自动按优先级查找配置文件位置
- **配置适配与转换** - 提供旧配置向新格式迁移的工具
- **事件驱动** - 支持配置变更事件通知
- **单例模式** - 全局统一的配置管理实例
- **完整的类型定义** - TypeScript 严格模式，提供完整的类型支持

## 安装

```bash
npm install @xiaozhi-client/config
# 或
pnpm add @xiaozhi-client/config
# 或
yarn add @xiaozhi-client/config
```

## 快速开始

### 基础使用

```typescript
import { configManager } from '@xiaozhi-client/config';

// 获取配置
const config = configManager.getConfig();
console.log('MCP 端点:', config.mcpEndpoint);
console.log('MCP 服务器:', config.mcpServers);

// 更新 MCP 端点
configManager.updateMcpEndpoint('wss://api.example.com/mcp');

// 添加/删除 MCP 服务器
configManager.updateMcpServer('my-server', {
  type: 'http',
  url: 'https://api.example.com/mcp'
});

configManager.removeMcpServer('old-server');
```

### 配置文件查找优先级

配置解析器按以下优先级查找配置文件：

1. 环境变量 `XIAOZHI_CONFIG_DIR` 指定的目录
2. 当前工作目录
3. 用户家目录 `~/.xiaozhi-client/`

支持的配置文件格式（按优先级）：
- `xiaozhi.config.json5`
- `xiaozhi.config.jsonc`
- `xiaozhi.config.json`

### 配置文件格式

```json
{
  "mcpEndpoint": "wss://xiaozhi.example.com/mcp",
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": ["./calculator.js"]
    },
    "web-search": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    },
    "sse-service": {
      "type": "sse",
      "url": "https://api.example.com/sse"
    }
  },
  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },
  "modelscope": {
    "apiKey": "your-modelscope-api-key"
  },
  "webUI": {
    "port": 9999,
    "autoRestart": true
  }
}
```

## 核心组件

### ConfigManager

配置管理器单例类，负责配置的加载、保存和更新。

#### 主要方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `getConfig()` | 获取配置（只读） | `Readonly<AppConfig>` |
| `updateMcpEndpoint(endpoint)` | 更新 MCP 端点 | `void` |
| `addMcpEndpoint(endpoint)` | 添加 MCP 端点 | `void` |
| `removeMcpEndpoint(endpoint)` | 移除 MCP 端点 | `void` |
| `getMcpEndpoints()` | 获取所有 MCP 端点 | `string[]` |
| `updateMcpServer(name, config)` | 更新 MCP 服务配置 | `void` |
| `removeMcpServer(name)` | 删除 MCP 服务配置 | `void` |
| `getMcpServers()` | 获取 MCP 服务配置 | `Record<string, MCPServerConfig>` |
| `updateConnectionConfig(config)` | 更新连接配置 | `void` |
| `updateModelScopeConfig(config)` | 更新 ModelScope 配置 | `void` |
| `updateWebUIConfig(config)` | 更新 Web UI 配置 | `void` |
| `setToolEnabled(server, tool, enabled)` | 设置工具启用状态 | `void` |
| `on(event, callback)` | 注册事件监听器 | `void` |
| `reloadConfig()` | 重新加载配置 | `void` |
| `configExists()` | 检查配置文件是否存在 | `boolean` |

#### 事件监听

```typescript
// 监听配置更新事件
configManager.on('config:updated', (payload) => {
  console.log('配置已更新:', payload);
  // payload.type: 'endpoint' | 'customMCP' | 'config' | 'serverTools' | 'connection' | 'modelscope' | 'webui' | 'platform'
  // payload.timestamp: Date
});

// 监听配置错误事件
configManager.on('config:error', (payload) => {
  console.error('配置错误:', payload.error);
});
```

### ConfigResolver

配置解析器，负责按优先级查找配置文件。

```typescript
import { ConfigResolver } from '@xiaozhi-client/config';

// 解析配置文件路径
const configPath = ConfigResolver.resolveConfigPath();
console.log('配置文件路径:', configPath);

// 在指定目录中查找配置文件
const foundPath = ConfigResolver.findConfigInDir('/path/to/dir');
console.log('找到的配置文件:', foundPath);

// 获取默认配置目录
const defaultDir = ConfigResolver.getDefaultConfigDir();
console.log('默认配置目录:', defaultDir);
```

### ConfigInitializer

配置初始化器，负责创建默认配置。

```typescript
import { ConfigInitializer } from '@xiaozhi-client/config';

// 初始化默认配置（创建默认项目目录）
const configDir = await ConfigInitializer.initializeDefaultConfig();
console.log('配置目录已创建:', configDir);
```

### 配置适配器

将各种配置格式标准化为统一的服务配置格式。

```typescript
import {
  normalizeServiceConfig,
  normalizeServiceConfigBatch,
  getConfigTypeDescription,
  isModelScopeURL
} from '@xiaozhi-client/config';

// 标准化单个服务配置
const normalized = normalizeServiceConfig({
  command: 'node',
  args: ['./server.js']
});
// => { type: 'stdio', command: '/absolute/path/to/node', args: ['/absolute/path/to/server.js'] }

// 批量标准化配置
const normalizedBatch = normalizeServiceConfigBatch({
  'service1': { url: 'https://api.example.com/mcp' },
  'service2': { url: 'https://api.example.com/sse' }
});

// 获取配置类型描述
const description = getConfigTypeDescription({
  type: 'sse',
  url: 'https://api.modelscope.cn/api/v1/sse'
});
// => "SSE (ModelScope) (https://api.modelscope.cn/api/v1/sse)"

// 检查是否为 ModelScope URL
const isModelScope = isModelScopeURL('https://api.modelscope.cn/api/v1/sse');
// => true
```

## 配置类型定义

### AppConfig

主配置接口。

```typescript
interface AppConfig {
  mcpEndpoint: string | string[];           // MCP 端点（单个或多个）
  mcpServers: Record<string, MCPServerConfig>;  // MCP 服务器配置
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;  // MCP 工具配置
  customMCP?: CustomMCPConfig;              // 自定义 MCP 工具配置
  connection?: ConnectionConfig;            // 连接配置
  modelscope?: ModelScopeConfig;            // ModelScope 配置
  webUI?: WebUIConfig;                      // Web UI 配置
  platforms?: PlatformsConfig;              // 平台配置
  toolCallLog?: ToolCallLogConfig;          // 工具调用日志配置
  tts?: TTSConfig;                          // TTS 配置
}
```

### MCPServerConfig

MCP 服务器配置类型，支持三种类型：

#### 本地 MCP 服务器（STDIO）

```typescript
interface LocalMCPServerConfig {
  command: string;                          // 执行命令
  args: string[];                           // 命令参数
  env?: Record<string, string>;             // 环境变量
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
  type?: "http" | "streamable-http";
  url: string;
  headers?: Record<string, string>;
}
```

### ConnectionConfig

连接配置接口。

```typescript
interface ConnectionConfig {
  heartbeatInterval?: number;   // 心跳检测间隔（毫秒），默认 30000
  heartbeatTimeout?: number;    // 心跳超时时间（毫秒），默认 10000
  reconnectInterval?: number;   // 重连间隔（毫秒），默认 5000
}
```

### ModelScopeConfig

ModelScope 配置接口。

```typescript
interface ModelScopeConfig {
  apiKey?: string;   // ModelScope API 密钥
}
```

### WebUIConfig

Web UI 配置接口。

```typescript
interface WebUIConfig {
  port?: number;        // Web UI 端口号，默认 9999
  autoRestart?: boolean; // 是否在配置更新后自动重启服务，默认 true
}
```

## 完整示例

### 配置管理完整示例

```typescript
import { configManager } from '@xiaozhi-client/config';

async function manageConfig() {
  // 检查配置文件是否存在
  if (!configManager.configExists()) {
    console.log('配置文件不存在，请先初始化');
    return;
  }

  // 获取当前配置
  const config = configManager.getConfig();
  console.log('当前配置:', config);

  // 更新连接配置
  configManager.updateConnectionConfig({
    heartbeatInterval: 20000,
    reconnectInterval: 3000
  });

  // 添加新的 MCP 服务器
  configManager.updateMcpServer('new-service', {
    type: 'http',
    url: 'https://new-api.example.com/mcp',
    headers: {
      'Authorization': 'Bearer your-token'
    }
  });

  // 启用/禁用工具
  configManager.setToolEnabled('calculator', 'add', true, '加法运算');

  // 监听配置更新
  configManager.on('config:updated', (payload) => {
    console.log('配置已更新:', payload.type);
  });

  // 重新加载配置
  configManager.reloadConfig();
}
```

### 使用 ConfigInitializer 创建默认配置

```typescript
import { ConfigInitializer, ConfigResolver } from '@xiaozhi-client/config';

async function setupDefaultConfig() {
  // 检查是否已有配置
  if (ConfigResolver.resolveConfigPath()) {
    console.log('配置文件已存在');
    return;
  }

  // 初始化默认配置
  const configDir = await ConfigInitializer.initializeDefaultConfig();
  console.log('默认配置已创建:', configDir);
}
```

### 配置适配与验证

```typescript
import {
  normalizeServiceConfig,
  normalizeServiceConfigBatch,
  ConfigValidationError
} from '@xiaozhi-client/config';

// 单个配置适配
try {
  const normalized = normalizeServiceConfig({
    command: 'node',
    args: ['./my-server.js'],
    env: {
      NODE_ENV: 'production'
    }
  });
  console.log('标准化配置:', normalized);
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error('配置验证失败:', error.message);
  }
}

// 批量配置适配
const configs = {
  'service1': { url: 'https://api.example.com/mcp' },
  'service2': { url: 'https://api.example.com/sse' },
  'service3': { command: 'python', args: ['-m', 'server'] }
};

try {
  const normalized = normalizeServiceConfigBatch(configs);
  console.log('批量配置成功:', Object.keys(normalized));
} catch (error) {
  console.error('批量配置失败:', error);
}
```

## API 参考

### 导出的类

```typescript
// 配置管理器
export { ConfigManager } from './manager.js';

// 配置解析器
export { ConfigResolver } from './resolver.js';

// 配置初始化器
export { ConfigInitializer } from './initializer.js';
```

### 导出的函数

```typescript
// 配置适配工具
export {
  normalizeServiceConfig,
  normalizeServiceConfigBatch,
  getConfigTypeDescription,
  isModelScopeURL
} from './adapter.js';
```

### 导出的类型

```typescript
export type {
  // 配置类型
  AppConfig,
  MCPServerConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  HTTPMCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  ConnectionConfig,
  ModelScopeConfig,
  WebUIConfig,
  ToolCallLogConfig,
  TTSConfig,

  // CustomMCP 类型
  CustomMCPConfig,
  CustomMCPTool,
  HandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,

  // 平台配置
  PlatformsConfig,
  PlatformConfig,
  CozePlatformConfig,

  // Web 服务器
  WebServerInstance
} from './manager.js';

export {
  MCPTransportType
} from './adapter.js';
```

### 导出的单例

```typescript
// 配置管理器单例实例
export { configManager } from './manager.js';
```

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/xiaozhi-client.git
cd xiaozhi-client/packages/config

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

## 常见问题

### Q: 如何指定自定义配置文件路径？

A: 设置环境变量 `XIAOZHI_CONFIG_DIR` 指定配置文件所在目录：

```bash
export XIAOZHI_CONFIG_DIR=/path/to/config/dir
```

### Q: 支持哪些配置文件格式？

A: 支持三种格式，按优先级排列：
1. JSON5 (`.json5`) - 支持注释和尾随逗号
2. JSONC (`.jsonc`) - 支持注释
3. JSON (`.json`) - 标准格式

### Q: 如何监听配置变更？

A: 使用 `on()` 方法注册事件监听器：

```typescript
configManager.on('config:updated', (payload) => {
  console.log('配置类型:', payload.type);
  console.log('更新时间:', payload.timestamp);
});
```

### Q: 配置更新后会自动保存吗？

A: 是的，所有配置更新方法都会自动保存到文件，并保留原文件的注释信息（JSON5/JSONC 格式）。

## 许可证

MIT

## 相关链接

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [@xiaozhi-client/mcp-core](https://github.com/shenjingnan/xiaozhi-client/tree/main/packages/mcp-core)
- [@xiaozhi-client/endpoint](https://github.com/shenjingnan/xiaozhi-client/tree/main/packages/endpoint)
