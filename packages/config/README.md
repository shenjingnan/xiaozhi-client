# @xiaozhi-client/config

小智客户端配置管理库，提供配置文件解析、验证和管理的完整功能。

## 功能特性

- **ConfigManager**: 配置管理器，负责配置文件的加载、保存和验证
- **ConfigResolver**: 配置解析器，按优先级查找配置文件
- **ConfigInitializer**: 配置初始化器，负责创建默认配置
- **配置适配与转换**: 提供旧配置向新格式迁移、规范化
- **JSON5 读写**: 提供 JSON5 格式的读写支持

## 安装

```bash
npm install @xiaozhi-client/config
```

## 快速开始

```typescript
import { configManager } from '@xiaozhi-client/config';

// 获取配置
const config = configManager.getConfig();

// 更新 MCP 端点配置
configManager.updateMcpEndpoint('wss://api.example.com/mcp');

// 保存配置
await configManager.saveConfig();
```

## API 文档

详细的 API 文档请参考源码中的 JSDoc 注释。

## 相关包

- [`@xiaozhi-client/mcp-core`](../mcp-core/) - MCP 核心库
- [`@xiaozhi-client/endpoint`](../endpoint/) - 接入点管理
