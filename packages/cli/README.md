# @xiaozhi/client-cli

小智客户端 CLI 包，提供命令行界面用于管理 MCP 服务和配置。

## 包说明

此包是 xiaozhi-client 项目的 CLI 入口点，不是独立发布的 npm 包。它与 backend、frontend、shared-types 组成一个完整的发布单元。

## 目录结构

```
packages/cli/
├── src/
│   ├── index.ts              # 主入口
│   ├── Container.ts          # DI 容器
│   ├── Types.ts              # 类型定义
│   ├── Constants.ts          # 常量定义
│   ├── commands/             # 命令处理器
│   │   ├── index.ts
│   │   ├── CommandRegistry.ts
│   │   ├── CommandHandlerFactory.ts
│   │   ├── ConfigCommandHandler.ts
│   │   ├── EndpointCommandHandler.ts
│   │   ├── McpCommandHandler.ts
│   │   ├── ProjectCommandHandler.ts
│   │   └── ServiceCommandHandler.ts
│   ├── services/             # 服务管理器
│   │   ├── ProcessManager.ts
│   │   ├── DaemonManager.ts
│   │   ├── ServiceManager.ts
│   │   └── TemplateManager.ts
│   ├── utils/                # 工具类
│   ├── interfaces/           # 接口定义
│   └── errors/               # 错误处理
├── package.json
├── project.json              # Nx 项目配置
├── tsconfig.json
└── tsup.config.ts            # 构建配置
```

## 构建配置

- **入口点**：`src/index.ts` → `../../dist/cli/index.js`
- **格式**：ESM (ES Modules)
- **目标**：Node.js 18+
- **打包工具**：tsup (esbuild)

## 外部依赖

CLI 包通过 external 配置引用 backend 模块：

- `@root/WebServer` → `dist/backend/WebServer.js` (通过 WebServerLauncher)
- `@/lib/config/manager` → `dist/backend/lib/config/manager.js`

## 导入方式

### 内部导入（使用相对路径）

```typescript
// CLI 包内部使用相对路径
import { DIContainer } from "./Container";
import { CommandRegistry } from "./commands/index";
```

### 外部依赖（使用路径别名）

```typescript
// 引用 backend 模块
import { configManager } from "@/lib/config/manager";
```

## 开发命令

```bash
# 构建
pnpm build

# 类型检查
pnpm type-check

# 运行测试
pnpm test

# 代码检查
pnpm lint
```

## 依赖关系

```
packages/cli
  ↓ (implicitDependencies)
apps/backend
  ↓ (implicitDependencies)
packages/shared-types
```

构建顺序：shared-types → backend → cli
