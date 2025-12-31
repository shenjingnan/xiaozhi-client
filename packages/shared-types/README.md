# @xiaozhi-client/shared-types

小智项目的共享类型定义包，为 backend 和 frontend 提供统一的类型定义。

## 安装

```bash
pnpm add @xiaozhi-client/shared-types
```

## 使用

### 导入所有类型

```typescript
import * as SharedTypes from '@xiaozhi-client/shared-types'
```

### 按模块导入

```typescript
// MCP 协议相关类型
import { MCPMessage, ToolCallOptions } from '@xiaozhi-client/shared-types/mcp'

// 扣子平台相关类型
import { CozeWorkflow, CozeWorkspace } from '@xiaozhi-client/shared-types/coze'

// API 响应类型
import { ApiResponse, ToolValidationError } from '@xiaozhi-client/shared-types/api'

// 配置类型
import { AppConfig, ConnectionConfig } from '@xiaozhi-client/shared-types/config'

// 工具类型
import { TimeoutError, PerformanceMetrics } from '@xiaozhi-client/shared-types/utils'
```

## 模块结构

- **mcp/**: MCP 协议相关类型定义
- **coze/**: 扣子平台相关类型定义
- **api/**: API 响应和错误类型定义
- **config/**: 应用配置相关类型定义
- **utils/**: 工具类型（日志、性能监控、超时等）

## 开发

```bash
# 开发模式（监听文件变化）
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm type:check
```

## 发布

这个包会随主项目一起发布，不需要单独发布。
