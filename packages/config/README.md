# @xiaozhi-client/config

> 小智客户端配置管理库，提供配置文件解析、验证和管理功能

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fconfig.svg)](https://www.npmjs.com/package/@xiaozhi-client/config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/config` 是小智客户端的配置管理核心库，提供：

- **多格式支持** - 支持 JSON、JSON5、JSONC 配置文件格式
- **优先级解析** - 按优先级自动查找配置文件
- **配置验证** - 完整的配置类型检查和验证
- **事件通知** - 配置变更事件的订阅机制
- **适配转换** - 旧配置格式自动转换到新格式
- **单例管理** - 全局配置管理器单例模式

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/config

# 使用 pnpm
pnpm add @xiaozhi-client/config

# 使用 yarn
yarn add @xiaozhi-client/config
```

## 快速开始

### 基本使用

```typescript
import { configManager } from '@xiaozhi-client/config';

// 获取当前配置
const config = configManager.getConfig();
console.log('MCP 端点:', config.mcpEndpoint);

// 更新 MCP 端点配置
configManager.updateMcpEndpoint('wss://api.example.com/mcp');

// 获取 MCP 服务列表
const servers = configManager.getMcpServers();
console.log('已配置的服务:', Object.keys(servers));
```

### 配置文件查找

使用 `ConfigResolver` 查找配置文件路径：

```typescript
import { ConfigResolver } from '@xiaozhi-client/config';

// 按优先级查找配置文件
const configPath = ConfigResolver.resolveConfigPath();

// 查找优先级：
// 1. 环境变量 XIAOZHI_CONFIG_DIR 指定的目录
// 2. 当前工作目录
// 3. 用户家目录/.xiaozhi-client/

// 在指定目录查找配置
const path = ConfigResolver.findConfigInDir('/path/to/dir');
// 支持: xiaozhi.config.json5, xiaozhi.config.jsonc, xiaozhi.config.json
```

### 初始化默认配置

使用 `ConfigInitializer` 创建默认配置：

```typescript
import { ConfigInitializer } from '@xiaozhi-client/config';

// 在用户家目录创建默认配置
const configDir = await ConfigInitializer.initializeDefaultConfig();
console.log('配置目录:', configDir);
```

### 监听配置变更事件

```typescript
import { configManager } from '@xiaozhi-client/config';

// 监听配置更新事件
configManager.on('config:updated', (payload) => {
  console.log('配置已更新:', payload.type);
  // payload.type 可能值:
  // 'endpoint' | 'customMCP' | 'config' | 'serverTools' | 
  // 'connection' | 'modelscope' | 'webui' | 'platform'
});

// 获取最新配置
const latestConfig = configManager.getConfig();
```

## 核心 API

### ConfigManager

配置管理器是核心类，提供完整的配置管理功能：

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `getConfig()` | 获取完整配置对象 | `Readonly<AppConfig>` |
| `getConfigPath()` | 获取当前配置文件路径 | `string` |
| `getConfigDir()` | 获取配置文件所在目录 | `string` |
| `getMcpEndpoint()` | 获取 MCP 端点地址 | `string` |
| `getMcpEndpoints()` | 获取所有 MCP 端点列表 | `string[]` |
| `getMcpServers()` | 获取 MCP 服务配置 | `Record<string, MCPServerConfig>` |
| `updateMcpEndpoint(endpoint)` | 更新 MCP 端点配置 | `void` |
| `updateMcpServer(name, config)` | 更新指定服务配置 | `void` |
| `updateConfig(newConfig)` | 更新部分配置 | `void` |
| `setToolEnabled(serverName, toolName, enabled)` | 设置工具启用状态 | `void` |
| `getConnectionConfig()` | 获取连接配置 | `Required<ConnectionConfig>` |
| `getWebUIConfig()` | 获取 Web UI 配置 | `Readonly<WebUIConfig>` |
| `getTTSConfig()` | 获取 TTS 配置 | `Readonly<TTSConfig>` |
| `getASRConfig()` | 获取 ASR 配置 | `Readonly<ASRConfig>` |
| `getLLMConfig()` | 获取 LLM 配置 | `LLMConfig \| null` |
| `getModelScopeConfig()` | 获取 ModelScope 配置 | `Readonly<ModelScopeConfig>` |
| `on(eventName, callback)` | 注册事件监听 | `void` |

### ConfigResolver

配置解析器，负责配置文件路径查找：

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `resolveConfigPath()` | 按优先级查找配置文件 | `string \| null` |
| `findConfigInDir(dir)` | 在指定目录查找配置文件 | `string \| null` |
| `getDefaultConfigDir()` | 获取默认配置目录 | `string \| null` |

### ConfigInitializer

配置初始化器，负责创建默认配置：

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `initializeDefaultConfig()` | 初始化默认配置目录 | `Promise<string>` |

### 配置适配器

提供旧配置格式转换功能：

```typescript
import { 
  normalizeServiceConfig, 
  normalizeServiceConfigBatch,
  getConfigTypeDescription,
  ConfigValidationError
} from '@xiaozhi-client/config';

// 单个配置转换
const newConfig = normalizeServiceConfig(oldConfig);

// 批量配置转换
const newConfigs = normalizeServiceConfigBatch({
  server1: oldConfig1,
  server2: oldConfig2
});

// 获取配置类型描述
const desc = getConfigTypeDescription(config);
// 返回: "本地进程 (node)" 或 "HTTP (https://...)" 等
```

## 配置文件格式

### 支持的配置文件名称

按优先级查找：

1. `xiaozhi.config.json5`
2. `xiaozhi.config.jsonc`
3. `xiaozhi.config.json`

### 配置文件示例

```json5
{
  // MCP 端点配置（支持单个或多个）
  "mcpEndpoint": "wss://api.example.com/mcp",
  // 或多个端点
  // "mcpEndpoint": [
  //   "wss://api1.example.com/mcp",
  //   "wss://api2.example.com/mcp"
  // ],

  // MCP 服务配置
  "mcpServers": {
    "datetime": {
      "command": "node",
      "args": ["./datetime-server.js"],
      "env": { "NODE_ENV": "production" }
    },
    "web-search": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer token" }
    }
  },

  // 连接配置
  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },

  // Web UI 配置
  "webUI": {
    "port": 9999,
    "autoRestart": true
  },

  // TTS 配置
  "tts": {
    "appid": "your-app-id",
    "accessToken": "your-token",
    "cluster": "volcengine_tts"
  },

  // ASR 配置
  "asr": {
    "appid": "your-app-id",
    "accessToken": "your-token",
    "cluster": "volcengine_streaming_common"
  },

  // LLM 配置
  "llm": {
    "model": "gpt-4",
    "apiKey": "your-api-key",
    "baseURL": "https://api.openai.com/v1"
  }
}
```

## 配置接口类型

### AppConfig

完整应用配置接口：

```typescript
interface AppConfig {
  mcpEndpoint?: string | string[];       // MCP 端点地址
  mcpServers?: Record<string, MCPServerConfig>; // MCP 服务配置
  mcpServerConfig?: Record<string, MCPServerToolsConfig>; // 服务工具配置
  connection?: ConnectionConfig;         // 连接参数
  webUI?: WebUIConfig;                   // Web UI 配置
  modelscope?: ModelScopeConfig;         // ModelScope 配置
  tts?: TTSConfig;                       // TTS 配置
  asr?: ASRConfig;                       // ASR 配置
  llm?: LLMConfig;                       // LLM 配置
  toolCallLog?: ToolCallLogConfig;       // 工具调用日志配置
}
```

### MCPServerConfig

MCP 服务配置类型：

```typescript
// 本地服务配置
interface LocalMCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// SSE 服务配置
interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

// HTTP 服务配置
interface HTTPMCPServerConfig {
  type?: "http" | "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

type MCPServerConfig = LocalMCPServerConfig | SSEMCPServerConfig | HTTPMCPServerConfig;
```

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/xiaozhi-client.git
cd xiaozhi-client/packages/config

# 安装依赖
pnpm install

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

## 许可证

[MIT](LICENSE)

## 相关资源

- [xiaozhi-client 项目](https://github.com/shenjingnan/xiaozhi-client)
- [@xiaozhi-client/mcp-core](https://github.com/shenjingnan/xiaozhi-client/tree/main/packages/mcp-core)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**作者**: xiaozhi-client
**版本**: 2.2.0