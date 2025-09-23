# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 开发命令

### 构建和测试
- `pnpm build` - 构建项目（包括 Web 构建和 TypeScript 编译）
- `pnpm dev` - 开发模式（带监视功能）
- `pnpm test` - 运行一次测试
- `pnpm test:watch` - 监视模式下运行测试
- `pnpm test:coverage` - 运行测试并生成覆盖率报告
- `pnpm test:silent` - 静默运行测试（用于 CI）

### 代码质量
- `pnpm lint` - 运行 Biome linter 并自动修复
- `pnpm format` - 使用 Biome 格式化代码
- `pnpm type:check` - 运行 TypeScript 类型检查
- `pnpm check` - 运行 Biome 检查
- `pnpm check:fix` - 运行 Biome 检查并自动修复
- `pnpm check:all` - 运行所有质量检查（lint、typecheck、spellcheck、duplicate check）

### 其他质量工具
- `pnpm spell:check` - 使用 cspell 检查拼写
- `pnpm duplicate:check` - 使用 jscpd 检查重复代码
- `pnpm docs:dev` - 启动文档开发服务器

## 架构概览

这是一个基于 TypeScript 的 MCP（Model Context Protocol）客户端，用于连接小智 AI 服务。项目采用模块化架构，具有清晰的关注点分离，最新版本采用独立多接入点架构。

### 核心组件

1. **CLI 层** (`src/cli/`) - 使用 Commander.js 的命令行界面
   - 入口点：`src/cli/index.ts`
   - 依赖注入容器：`src/cli/Container.ts`
   - 命令注册和处理

2. **核心 MCP 层** (`src/core/`) - MCP 协议实现
   - `UnifiedMCPServer.ts` - 主要 MCP 服务器实现
   - `ServerFactory.ts` - 用于创建不同服务器类型的工厂
   - `MCPMessageHandler.ts` - 消息处理和路由

3. **传输层** (`src/transports/`) - 通信适配器
   - `WebSocketAdapter.ts` - WebSocket 通信
   - `HTTPAdapter.ts` - HTTP 通信
   - `StdioAdapter.ts` - 标准 I/O 通信

4. **服务层** (`src/services/`) - 连接和服务管理
   - `IndependentXiaozhiConnectionManager.ts` - 独立多接入点连接管理器
   - `MCPServiceManager.ts` - MCP 服务管理器
   - `XiaozhiConnectionManagerSingleton.ts` - 全局单例管理器

5. **工具层** (`src/utils/`) - 共享工具和辅助函数

### 主要功能

- **独立多端点支持**：每个端点完全独立管理，无负载均衡，无故障转移
- **MCP 服务器聚合**：可聚合多个 MCP 服务器
- **Web UI**：提供基于 Web 的配置界面
- **Docker 支持**：完整的容器化，支持 Docker Compose
- **多种传输协议**：WebSocket、HTTP 和 Stdio
- **ModelScope 集成**：支持 ModelScope 托管的 MCP 服务
- **固定间隔重连**：连接失败时采用固定间隔重连策略
- **直接端点访问**：应用程序可以直接访问任何端点，无需路由

### 独立架构特点

- **完全独立**：每个端点拥有独立的连接和状态管理
- **无负载均衡**：移除所有负载均衡逻辑和算法
- **无故障转移**：端点失败时不自动切换到其他端点
- **简单重连**：固定间隔重连，避免指数退避复杂性
- **直接访问**：应用程序可以直接指定和访问特定端点

### 配置

主配置文件是 `xiaozhi.config.json`，支持：
- `mcpEndpoint` - 单个端点字符串或端点数组
- `mcpServers` - MCP 服务器配置对象
- `modelscope` - ModelScope API 配置
- `connection` - 连接参数（心跳、超时等）
- `webUI` - Web UI 配置

### 入口点

项目构建三个主要入口点：
- `dist/cli.js` - CLI 工具（主入口点）
- `dist/mcpServerProxy.js` - MCP 服务器代理，用于集成到其他客户端
- `dist/WebServerStandalone.js` - 独立 Web 服务器

### 测试策略

- 使用 Vitest 进行测试
- 覆盖率目标：分支、函数、行、语句均达到 80%
- 测试文件位于源文件旁的 `__tests__` 目录中
- 传输适配器和服务器功能的集成测试

### 构建过程

- 使用 tsup 进行打包
- 输出 Node.js 18+ 的 ESM 格式
- 包含源映射和 TypeScript 声明文件
- 将模板和配置文件复制到 dist 目录

### 代码风格

- 使用 Biome 进行 linting 和格式化
- 启用 TypeScript 严格模式
- 双引号、分号、ES5 尾随逗号
- 2 空格缩进
- 行结尾：LF

### 重要说明

- 项目完全使用 ESM 模块
- 配置了路径别名以实现更清晰的导入（`@cli/*` 等）
- 外部依赖不打包（ws、express、commander 等）
- 模板目录复制到 dist 用于项目脚手架
- Web UI 在 `web/` 目录中单独构建