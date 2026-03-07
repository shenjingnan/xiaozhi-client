# @xiaozhi-client/config

> 小智客户端配置管理库，提供配置文件解析、验证和管理功能

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fconfig.svg)](https://www.npmjs.com/package/@xiaozhi-client/config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/config` 是一个功能完整的配置管理库，提供：

- **多格式支持** - 支持 JSON、JSON5、JSONC 三种配置文件格式
- **智能解析** - 按优先级自动查找配置文件
- **配置验证** - 内置配置验证和类型检查
- **注释保留** - 使用 comment-json 保留配置文件中的注释
- **事件驱动** - 基于回调的配置变更通知
- **完整类型** - TypeScript 严格模式，提供完整的类型支持

## 特性

### 核心功能

- **配置文件解析** - 支持 JSON、JSON5、JSONC 格式的配置文件
- **配置管理器** - 单例模式管理应用配置
- **配置解析器** - 按优先级查找配置文件
- **配置初始化器** - 创建默认配置文件
- **配置适配器** - 旧配置格式转换和规范化
- **JSON5 支持** - 使用 comment-json 保留注释和格式

### 支持的配置格式

| 格式 | 扩展名 | 优先级 | 说明 |
|------|--------|--------|------|
| **JSON5** | `.json5` | 最高 | 支持注释、尾随逗号 |
| **JSONC** | `.jsonc` | 中 | 支持注释 |
| **JSON** | `.json` | 默认 | 标准 JSON 格式 |

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/config

# 使用 pnpm
pnpm add @xiaozhi-client/config

# 使用 yarn
yarn add @xiaozhi-client/config
```

### 依赖要求

```json
{
  "dependencies": {
    "@xiaozhi-client/mcp-core": "workspace:*",
    "comment-json": "^4.2.5",
    "dayjs": "^1.11.13"
  }
}
```

## 快速开始

### 使用 configManager 单例（推荐）

```typescript
import { configManager } from '@xiaozhi-client/config';

// 获取完整配置
const config = configManager.getConfig();
console.log('MCP 端点:', config.mcpEndpoint);
console.log('MCP 服务器:', config.mcpServers);

// 更新 MCP 端点
configManager.updateMcpEndpoint('wss://api.example.com/mcp');

// 添加 MCP 服务器
configManager.updateMcpServer('my-server', {
  command: 'npx',
  args: ['-y', '@example/mcp-server']
});

// 监听配置更新事件
configManager.on('config:updated', (payload) => {
  console.log('配置已更新:', payload.type);
});
```

### 使用 ConfigManager 类

```typescript
import { ConfigManager } from '@xiaozhi-client/config';

// 获取单例实例
const manager = ConfigManager.getInstance();

// 检查配置文件是否存在
if (!manager.configExists()) {
  // 初始化配置文件
  manager.initConfig('json5');
}

// 获取配置
const config = manager.getConfig();

// 更新配置
manager.updateConfig({
  connection: {
    heartbeatInterval: 30000,
    heartbeatTimeout: 10000,
    reconnectInterval: 5000
  }
});
```

### 使用 ConfigResolver

```typescript
import { ConfigResolver } from '@xiaozhi-client/config';

// 解析配置文件路径
const configPath = ConfigResolver.resolveConfigPath();
console.log('配置文件路径:', configPath);

// 获取默认配置目录
const defaultDir = ConfigResolver.getDefaultConfigDir();
console.log('默认配置目录:', defaultDir);

// 在指定目录中查找配置文件
const found = ConfigResolver.findConfigInDir('/path/to/dir');
console.log('找到的配置文件:', found);
```

### 使用 ConfigInitializer

```typescript
import { ConfigInitializer } from '@xiaozhi-client/config';

// 初始化默认配置
const configDir = await ConfigInitializer.initializeDefaultConfig();
console.log('配置目录已创建:', configDir);
```

### 使用配置适配器

```typescript
import {
  normalizeServiceConfig,
  normalizeServiceConfigBatch,
  isModelScopeURL
} from '@xiaozhi-client/config';

// 标准化单个服务配置
const normalized = normalizeServiceConfig({
  command: 'npx',
  args: ['-y', '@example/mcp-server']
});

// 批量标准化配置
const configs = normalizeServiceConfigBatch({
  'server1': { url: 'https://api.example.com/mcp' },
  'server2': { command: 'node', args: ['server.js'] }
});

// 检查是否为 ModelScope URL
const isModelScope = isModelScopeURL('https://api.modelscope.cn/mcp');
```

## API 参考

### ConfigManager 类

配置管理器核心类，提供配置文件的读取、解析、验证和更新功能。

#### 静态方法

##### getInstance()

获取 ConfigManager 单例实例。

```typescript
ConfigManager.getInstance(): ConfigManager
```

#### 实例方法

##### configExists()

检查配置文件是否存在。

```typescript
configExists(): boolean
```

##### initConfig()

初始化配置文件。

```typescript
initConfig(format: 'json' | 'json5' | 'jsonc' = 'json'): void
```

##### getConfig()

获取完整配置对象（只读）。

```typescript
getConfig(): Readonly<AppConfig>
```

##### updateConfig()

更新配置对象。

```typescript
updateConfig(newConfig: Partial<AppConfig>): void
```

##### updateMcpEndpoint()

更新 MCP 端点配置。

```typescript
updateMcpEndpoint(endpoint: string | string[]): void
```

##### addMcpEndpoint()

添加 MCP 端点到现有列表。

```typescript
addMcpEndpoint(endpoint: string): void
```

##### removeMcpEndpoint()

从现有列表中移除 MCP 端点。

```typescript
removeMcpEndpoint(endpoint: string): void
```

##### updateMcpServer()

更新或添加 MCP 服务器配置。

```typescript
updateMcpServer(serverName: string, config: MCPServerConfig): void
```

##### removeMcpServer()

移除 MCP 服务器配置。

```typescript
removeMcpServer(serverName: string): void
```

##### getConnectionConfig()

获取连接配置。

```typescript
getConnectionConfig(): Required<ConnectionConfig>
```

##### updateConnectionConfig()

更新连接配置。

```typescript
updateConnectionConfig(config: Partial<ConnectionConfig>): void
```

##### getCustomMCPConfig()

获取自定义 MCP 工具配置。

```typescript
getCustomMCPConfig(): CustomMCPConfig | null
```

##### addCustomMCPTool()

添加自定义 MCP 工具。

```typescript
addCustomMCPTool(tool: CustomMCPTool): void
```

##### removeCustomMCPTool()

移除自定义 MCP 工具。

```typescript
removeCustomMCPTool(toolName: string): void
```

##### updateCustomMCPTool()

更新自定义 MCP 工具。

```typescript
updateCustomMCPTool(toolName: string, updates: Partial<CustomMCPTool>): void
```

##### getWebUIConfig()

获取 Web UI 配置。

```typescript
getWebUIConfig(): Readonly<WebUIConfig>
```

##### updateWebUIConfig()

更新 Web UI 配置。

```typescript
updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void
```

##### on()

注册事件监听器。

```typescript
on(eventName: string, callback: (data: unknown) => void): void
```

**支持的事件：**

- `config:updated` - 配置已更新
- `mcp:endpoint:updated` - MCP 端点已更新
- `mcp:server:updated` - MCP 服务器已更新
- `mcp:server:removed` - MCP 服务器已移除

### ConfigResolver 类

配置解析器，按优先级查找配置文件。

#### 静态方法

##### resolveConfigPath()

按优先级解析配置文件路径。

**优先级顺序：**
1. 环境变量 `XIAOZHI_CONFIG_DIR` 指定的目录
2. 当前工作目录
3. 用户家目录 `/.xiaozhi-client/`

```typescript
static resolveConfigPath(): string | null
```

##### findConfigInDir()

在指定目录中查找配置文件。

**查找优先级：** `.json5` > `.jsonc` > `.json`

```typescript
static findConfigInDir(dir: string): string | null
```

##### getDefaultConfigDir()

获取默认配置目录路径。

```typescript
static getDefaultConfigDir(): string | null
```

### ConfigInitializer 类

配置初始化器，负责创建默认配置。

#### 静态方法

##### initializeDefaultConfig()

初始化默认配置，复制整个默认模板目录到用户家目录的 `.xiaozhi-client`。

```typescript
static initializeDefaultConfig(): Promise<string>
```

### 配置适配器函数

#### normalizeServiceConfig()

将各种配置格式标准化为统一的服务配置格式。

```typescript
function normalizeServiceConfig(config: MCPServerConfig): MCPServiceConfig
```

#### normalizeServiceConfigBatch()

批量标准化配置。

```typescript
function normalizeServiceConfigBatch(
  legacyConfigs: Record<string, MCPServerConfig>
): Record<string, MCPServiceConfig>
```

#### isModelScopeURL()

检查是否为 ModelScope URL。

```typescript
function isModelScopeURL(url: string): boolean
```

#### getConfigTypeDescription()

获取配置类型描述。

```typescript
function getConfigTypeDescription(config: MCPServerConfig): string
```

## 配置文件格式

### xiaozhi.config.json

```json
{
  "mcpEndpoint": "",
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": ["-y", "@xiaozhi-client/calculator-mcp"]
    },
    "datetime": {
      "command": "npx",
      "args": ["-y", "@xiaozhi-client/datetime-mcp"]
    },
    "web-search": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    },
    "sse-server": {
      "type": "sse",
      "url": "https://api.example.com/sse"
    }
  },
  "asr": {
    "model": "doubao",
    "appid": "your-appid",
    "accessToken": "your-access-token"
  },
  "llm": {
    "prompt": "./prompts/default.md",
    "model": "your-model-name",
    "apiKey": "your-api-key",
    "baseURL": "your-base-url"
  },
  "tts": {
    "model": "doubao",
    "appid": "your-appid",
    "accessToken": "your-access-token",
    "voice_type": "zh_female_xiaohe_uranus_bigtts"
  },
  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },
  "webUI": {
    "port": 9999,
    "autoRestart": true
  },
  "modelscope": {
    "apiKey": "your-modelscope-api-key"
  },
  "platforms": {
    "coze": {
      "token": "your-coze-token"
    }
  }
}
```

### 配置项说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `mcpEndpoint` | `string \| string[]` | MCP 服务端点 URL |
| `mcpServers` | `Record<string, MCPServerConfig>` | MCP 服务器配置对象 |
| `asr` | `ASRConfig` | ASR（语音识别）配置 |
| `llm` | `LLMConfig` | LLM（大语言模型）配置 |
| `tts` | `TTSConfig` | TTS（文本转语音）配置 |
| `connection` | `ConnectionConfig` | 连接配置 |
| `webUI` | `WebUIConfig` | Web UI 配置 |
| `modelscope` | `ModelScopeConfig` | ModelScope 配置 |
| `platforms` | `PlatformsConfig` | 平台配置 |

### MCP 服务器配置类型

#### 本地进程（STDIO）

```json
{
  "command": "npx",
  "args": ["-y", "@example/mcp-server"],
  "env": {
    "API_KEY": "your-api-key"
  }
}
```

#### HTTP 服务

```json
{
  "type": "http",
  "url": "https://api.example.com/mcp",
  "headers": {
    "Authorization": "Bearer your-api-key"
  }
}
```

#### SSE 服务

```json
{
  "type": "sse",
  "url": "https://api.example.com/sse",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

## 配置文件优先级

配置文件查找按以下优先级进行：

1. **环境变量** - `XIAOZHI_CONFIG_DIR` 指定的目录
2. **当前目录** - `./xiaozhi.config.{json5,jsonc,json}`
3. **用户目录** - `~/.xiaozhi-client/xiaozhi.config.{json5,jsonc,json}`

在同一目录中，按以下优先级查找：

1. `.json5` - JSON5 格式（支持注释、尾随逗号）
2. `.jsonc` - JSONC 格式（支持注释）
3. `.json` - 标准 JSON 格式

## 类型定义

### AppConfig

```typescript
interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  customMCP?: CustomMCPConfig;
  connection?: ConnectionConfig;
  modelscope?: ModelScopeConfig;
  webUI?: WebUIConfig;
  platforms?: PlatformsConfig;
  toolCallLog?: ToolCallLogConfig;
  tts?: TTSConfig;
  asr?: ASRConfig;
  llm?: LLMConfig;
}
```

### MCPServerConfig

```typescript
type MCPServerConfig =
  | LocalMCPServerConfig      // 本地进程配置
  | SSEMCPServerConfig        // SSE 配置
  | HTTPMCPServerConfig;      // HTTP 配置
```

### ConnectionConfig

```typescript
interface ConnectionConfig {
  heartbeatInterval?: number;  // 心跳检测间隔（毫秒），默认 30000
  heartbeatTimeout?: number;   // 心跳超时时间（毫秒），默认 10000
  reconnectInterval?: number;  // 重连间隔（毫秒），默认 5000
}
```

### WebUIConfig

```typescript
interface WebUIConfig {
  port?: number;           // Web UI 端口号，默认 9999
  autoRestart?: boolean;   // 是否在配置更新后自动重启服务，默认 true
}
```

## 完整示例

### 带完整错误处理的配置管理

```typescript
import { configManager, ConfigResolver, ConfigInitializer } from '@xiaozhi-client/config';

class ConfigService {
  async initialize() {
    try {
      // 检查配置文件是否存在
      if (!configManager.configExists()) {
        console.log('配置文件不存在，正在初始化...');

        // 初始化默认配置
        await ConfigInitializer.initializeDefaultConfig();
        console.log('默认配置已创建');
      }

      // 获取配置
      const config = configManager.getConfig();
      console.log('当前配置:', config);

      // 设置事件监听
      this.setupEventListeners();

    } catch (error) {
      console.error('配置初始化失败:', error);
      throw error;
    }
  }

  private setupEventListeners() {
    // 监听配置更新事件
    configManager.on('config:updated', (payload) => {
      console.log('配置已更新:', payload);
    });

    // 监听 MCP 端点更新
    configManager.on('mcp:endpoint:updated', (payload) => {
      console.log('MCP 端点已更新:', payload);
    });
  }

  updateMcpServer(serverName: string, config: any) {
    try {
      configManager.updateMcpServer(serverName, config);
      console.log(`MCP 服务器 ${serverName} 已更新`);
    } catch (error) {
      console.error('更新 MCP 服务器失败:', error);
      throw error;
    }
  }

  getConnectionSettings() {
    return configManager.getConnectionConfig();
  }
}

// 使用示例
async function main() {
  const configService = new ConfigService();

  try {
    await configService.initialize();

    // 更新 MCP 服务器
    configService.updateMcpServer('my-server', {
      command: 'npx',
      args: ['-y', '@example/mcp-server']
    });

    // 获取连接配置
    const connectionConfig = configService.getConnectionSettings();
    console.log('连接配置:', connectionConfig);

  } catch (error) {
    console.error('错误:', error);
  }
}

main();
```

## 最佳实践

### 1. 配置文件格式选择

```typescript
// ✅ 推荐：使用 JSON5 格式（支持注释）
manager.initConfig('json5');

// ✅ 可接受：使用标准 JSON 格式
manager.initConfig('json');

// ❌ 避免：使用 JSONC（JSON5 是更好的选择）
manager.initConfig('jsonc');
```

### 2. 配置文件路径管理

```typescript
// ✅ 推荐：使用环境变量指定配置目录
process.env.XIAOZHI_CONFIG_DIR = '/path/to/config';
const configPath = ConfigResolver.resolveConfigPath();

// ✅ 可接受：使用默认路径
const configPath = ConfigResolver.resolveConfigPath();

// ❌ 避免：硬编码配置文件路径
const configPath = '/hardcoded/path/to/config.json';
```

### 3. 配置更新通知

```typescript
// ✅ 推荐：监听配置更新事件
configManager.on('config:updated', (payload) => {
  console.log('配置已更新:', payload.type);
  // 处理配置更新
});

// ✅ 可接受：在更新后手动处理
configManager.updateConfig(newConfig);
// 手动处理配置更新...

// ❌ 避免：忽略配置更新事件
configManager.updateConfig(newConfig);
// 忘记通知其他组件...
```

### 4. 错误处理

```typescript
// ✅ 推荐：捕获并处理配置错误
try {
  configManager.updateMcpServer('name', config);
} catch (error) {
  if (error instanceof Error) {
    console.error('配置更新失败:', error.message);
  }
}

// ❌ 避免：忽略错误
configManager.updateMcpServer('name', config); // 可能抛出异常
```

## 常见问题

### Q: 配置文件支持哪些格式？

**A:** 支持 JSON、JSON5、JSONC 三种格式：
- **JSON** - 标准格式，兼容性最好
- **JSON5** - 支持注释、尾随逗号等特性（推荐）
- **JSONC** - 支持注释的 JSON

### Q: 如何指定配置文件位置？

**A:** 有三种方式：
1. 设置环境变量 `XIAOZHI_CONFIG_DIR`
2. 在当前工作目录放置配置文件
3. 在用户家目录 `~/.xiaozhi-client/` 放置配置文件

### Q: 配置文件查找优先级是什么？

**A:** 按以下顺序查找：
1. 环境变量 `XIAOZHI_CONFIG_DIR` 指定的目录
2. 当前工作目录
3. 用户家目录 `~/.xiaozhi-client/`

在同一目录中，按 `.json5` > `.jsonc` > `.json` 顺序查找。

### Q: 如何保留配置文件中的注释？

**A:** 使用 JSON5 格式，库会使用 comment-json 保留注释和格式：

```json5
{
  // 这是注释
  "mcpEndpoint": "wss://api.example.com/mcp", // 这是行尾注释
}
```

### Q: 如何监听配置变更？

**A:** 使用 `on` 方法注册事件监听器：

```typescript
configManager.on('config:updated', (payload) => {
  console.log('配置已更新:', payload);
});
```

## 许可证

[MIT](LICENSE)

## 相关资源

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [@xiaozhi-client/mcp-core](https://www.npmjs.com/package/@xiaozhi-client/mcp-core)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**作者**: xiaozhi-client
**版本**: 2.0.0
