# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 开发理念

### 核心原则
- **功能驱动**：如无必要勿增实体，需要什么功能就实现什么功能
- **优雅实现**：代码要清晰、可维护、结构合理
- **避免过度设计**：不提前考虑竞态、并发、互斥锁、缓存等复杂概念
- **架构合理**：整体架构要有逻辑性，但不引入不必要的抽象层
- **确认优先**：当不确认时询问用户，不做自作主张的决策

### 开发哲学
- **先实现，后优化**：先把功能做好，再考虑性能优化
- **实用主义**：解决实际问题比理论完美更重要
- **简单直接**：避免为了工程化而工程化
- **渐进改进**：遇到问题再优化，不过度预防

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

### 文档开发

- **文档系统**：使用 Nextra (Next.js)，支持 MDX 格式
- **文档创建**：使用 `/docs-create [document-type] [document-title]` 命令
- **文档更新**：使用 `/docs-update [scope] [target]` 批量更新
- **文档验证**：
  - 本地运行 `pnpm docs:dev` 验证文档渲染
  - 执行代码示例测试确保可运行性
  - 检查路径别名使用是否正确
- **支持文档类型**：
  - `mcp-tool` - MCP 工具文档
  - `arch-doc` - 架构设计文档
  - `api-doc` - API 参考文档
  - `user-guide` - 用户指南
  - `dev-guide` - 开发指南

## 项目定位

xiaozhi-client 是一个务实的开源 MCP 客户端：

- **功能优先**：专注实现用户需要的核心功能
- **简洁设计**：架构合理但不复杂，代码优雅但不过度抽象
- **务实开发**：先实现功能，遇到问题再解决
- **维护友好**：代码清晰易懂，便于贡献者参与

## 架构概览

这是一个基于 TypeScript 的 MCP（Model Context Protocol）客户端，用于连接小智 AI 服务。项目采用模块化架构，具有清晰的关注点分离，最新版本采用独立多接入点架构。

### 核心组件

1. **CLI 层** (`packages/cli/`) - 使用 Commander.js 的命令行界面

   - 入口点：`packages/cli/src/index.ts` → `dist/cli/index.js`
   - 依赖注入容器：`packages/cli/src/Container.ts`
   - 命令注册和处理：`packages/cli/src/commands/`
   - 服务管理：`packages/cli/src/services/`
   - 工具类：`packages/cli/src/utils/`
   - 错误处理：`packages/cli/src/errors/`

2. **MCP 核心库** (`apps/backend/lib/mcp/`) - MCP 协议核心实现

   - `connection.ts` - **MCP 服务连接管理**，负责单个 MCP 服务的连接和工具管理
   - `manager.ts` - **MCP 服务管理器**，统一管理多个 MCP 服务
   - `types.ts` - MCP 相关类型定义
   - `index.ts` - 统一导出接口

3. **服务层** (`apps/backend/services/`) - 业务服务和工具

   - `MCPServiceManager.ts` - **重新导出**，指向 `@/lib/mcp/manager.js`（向后兼容）
   - `MCPService.ts` - **重新导出**，指向 `@/lib/mcp/connection.js`（向后兼容）
   - `MCPServer.ts` - 兼容性包装器，提供向后兼容的 API
   - 其他业务服务和工具类

3. **核心 MCP 层** (`apps/backend/core/`) - MCP 协议实现

   - `ServerFactory.ts` - 用于创建不同服务器类型的工厂
   - `MCPMessageHandler.ts` - 消息处理和路由

4. **传输层** (`apps/backend/transports/`) - 通信适配器

   - `WebSocketAdapter.ts` - WebSocket 通信
   - `HTTPAdapter.ts` - HTTP 通信
   - `StdioAdapter.ts` - 标准 I/O 通信

5. **连接管理器** (`apps/backend/services/`) - 连接管理

   - `IndependentXiaozhiConnectionManager.ts` - 独立多接入点连接管理器
   - `XiaozhiConnectionManagerSingleton.ts` - 全局单例管理器

5. **工具层** (`apps/backend/utils/`) - 共享工具和辅助函数

6. **类型定义** (`apps/backend/types/`) - TypeScript 类型定义

7. **错误处理** (`apps/backend/errors/`) - 统一错误定义和处理

8. **管理器服务** (`apps/backend/managers/`) - 各种管理器实现

9. **适配器模式** (`apps/backend/adapters/`) - 适配器实现

10. **处理器层** (`apps/backend/handlers/`) - 请求处理器

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

项目构建两个主要入口点：

- `dist/cli.js` - CLI 工具（主入口点）
- `dist/WebServerStandalone.js` - 独立 Web 服务器，提供 /mcp 端点

### 测试策略

- 使用 Vitest 进行测试
- 覆盖率目标：分支、函数、行、语句均达到 80%
- 测试文件位于源文件旁的 `__tests__` 目录中
- 支持多种测试类型：
  - **单元测试** (`unit`) - 独立函数和类的测试
  - **集成测试** (`integration`) - 多模块协作测试
  - **CLI 命令测试** (`cli-command`) - 命令行功能测试
  - **传输层测试** (`transport`) - 适配器通信测试
  - **核心功能测试** (`mcp-core`) - MCP 协议实现测试
- 传输适配器和服务器功能的集成测试
- 使用 `/test-create` 命令快速生成测试用例

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

### 代码质量要求（务实版）

**核心要求**：
- **功能正确性**：核心功能必须正确实现
- **代码可读性**：代码要清晰，便于理解和维护
- **基本安全性**：避免明显的安全漏洞
- **架构合理性**：整体设计要有逻辑性

**质量标准**：
- **类型安全**：尽量使用具体类型，优先实用而非理论完美
- **本地化要求**：用户界面和面向用户的文本必须使用中文
- **路径别名**：使用项目路径别名系统，保持一致性
- **错误处理**：关键操作必须有适当的错误处理

### 避免的过度设计
- 不要为了"未来可能需要"而增加复杂度
- 不要过度使用设计模式和抽象
- 不要提前优化不存在的性能问题
- 不要引入复杂的并发控制，除非确实需要

## 务实开发指导

### 何时考虑复杂设计
- **实际遇到问题**：当确实出现性能瓶颈时
- **功能需求**：当用户明确需要相关功能时
- **维护困难**：当代码确实难以维护时
- **团队协作**：当多人协作需要统一接口时

### 何时保持简单
- **预防性设计**：为了"可能的需要"而增加复杂度
- **理论完美**：为了代码的"优雅"而过度抽象
- **过度优化**：在没有性能问题时优化性能
- **设计模式**：为了使用设计模式而使用

### 务实开发最佳实践
- **功能驱动**：需要什么功能就实现什么功能
- **渐进改进**：遇到问题再优化，不过度预防
- **优雅实现**：代码要清晰、可维护、结构合理
- **架构合理**：整体架构要有逻辑性，但不引入不必要的抽象层

### 案例分析
**MCPServiceManagerSingleton 简化**：
- **原始实现**：340行，复杂的状态管理和互斥锁
- **简化后**：133行，直接的单例实现
- **效果**：保持功能完整，大幅降低维护成本
- **结论**：优先考虑简单直接的实现方式

### 代码审查检查清单

在提交代码前，请确保：
- [ ] 所有路径别名使用正确
- [ ] 没有 `any` 类型（包括测试文件，除非有充分理由并通过审查）
- [ ] 测试文件中使用具体的 React 组件属性类型而非 `any`
- [ ] 所有导入语句符合最佳实践
- [ ] **本地化检查**：
  - [ ] 所有代码注释使用中文
  - [ ] 所有测试用例描述使用中文（describe, it）
  - [ ] 用户界面中没有硬编码英文字符串
  - [ ] 面向用户的错误信息使用中文
- [ ] 代码能通过 `pnpm check:all` 检查
- [ ] 测试覆盖率达到 80% 要求
- [ ] 错误处理完善且有意义
- [ ] **执行开发流程检查**：修改代码后必须运行相应的检查命令
  - 前端代码：`nr type:check && nr lint && nr test`
  - 后端代码：`pnpm type:check && pnpm lint && pnpm test`
  - 全面检查：`pnpm check:all`

### 本地化规范

- **注释信息**：请使用中文编写所有代码注释，禁止使用英文注释
- **测试用例描述**：`describe` 和 `it` 函数的参数必须使用中文描述，禁止英文描述
- **用户界面字符串**：所有面向用户的文本必须使用中文，硬编码英文字符串应提取为常量
- **错误信息**：所有面向用户的错误信息必须使用中文
- **文档和说明**：README、技术文档等说明性内容优先使用中文
- **变量和函数名**：继续使用英文命名（符合编程惯例）
- **技术标识符例外**：API 标识符、服务名称等技术标识符可保持英文
- **目的**：有助于中国开发团队的持续维护和代码理解，降低沟通成本

### 本地化检查清单

在提交代码前，请确保：
- [ ] 所有代码注释使用中文
- [ ] 所有测试用例描述使用中文
- [ ] 用户界面中没有硬编码英文字符串
- [ ] 错误信息已中文化
- [ ] 技术文档已中文化
- [ ] 使用本地化验证技能检查代码质量

### 路径别名系统

项目使用复杂的路径别名系统以实现清晰的模块导入和代码组织：

#### 完整别名映射
```json
{
  "@/*": ["apps/backend/*"],                    // 后端根目录快速访问
  "@handlers/*": ["apps/backend/handlers/*"],     // 请求处理器
  "@services/*": ["apps/backend/services/*"],     // 业务服务（重新导出层）
  "@errors/*": ["apps/backend/errors/*"],         // 错误定义
  "@utils/*": ["apps/backend/utils/*"],           // 工具函数
  "@/lib/*": ["apps/backend/lib/*"],             // 核心库模块
  "@core/*": ["apps/backend/core/*"],             // 核心 MCP 功能
  "@transports/*": ["apps/backend/transports/*"], // 传输层适配器
  "@adapters/*": ["apps/backend/adapters/*"],     // 适配器模式
  "@managers/*": ["apps/backend/managers/*"],     // 管理器服务
  "@types/*": ["apps/backend/types/*"],           // 类型定义
  "@root/*": ["apps/backend/*"]                   // 根目录别名
}
```

#### 新架构说明（2024年12月迁移）

**CLI 迁移到 packages/cli**：
- CLI 代码已从 `apps/backend/cli/` 迁移到 `packages/cli/`
- CLI 包使用相对路径进行内部导入
- CLI 包通过 external 依赖引用 `@root/*` 和 `@/lib/config/*` 模块
- 构建产物：`packages/cli` → `dist/cli/index.js`
- CLI 包是项目入口点，不是独立发布的 npm 包

**MCP 核心库迁移**：
- `MCPService` 已迁移至 `@/lib/mcp/connection.js`
- `MCPServiceManager` 已迁移至 `@/lib/mcp/manager.js`
- 原路径通过重新导出保持向后兼容
- 建议新代码直接使用 `@/lib/mcp/*` 路径

**推荐导入方式**：
```typescript
// ✅ 新代码推荐方式
import { MCPService } from "@/lib/mcp";
import { MCPServiceManager } from "@/lib/mcp";

// ✅ 向后兼容方式（仍然支持）
import { MCPService } from "@/lib/mcp";
import { MCPServiceManager } from "@services/MCPServiceManager.js";
```

#### 导入顺序最佳实践
```typescript
// 1. Node.js 内置模块
import { fs } from "node:fs";
import { path } from "node:path";

// 2. 外部依赖
import express from "express";
import { Command } from "commander";

// 3. xiaozhi-client 路径别名导入（按分组排序）
// 核心模块
import { UnifiedMCPServer } from "@core";
import type { MCPMessage } from "@types";

// 传输和适配器
import { WebSocketAdapter } from "@transports";
import { HTTPAdapter } from "@adapters";

// 管理器和服务
import { ConnectionManager } from "@managers";
import { ConfigService } from "@/services";

// CLI相关
import { StartCommand } from "@cli/commands";
import { Container } from "@cli";

// 工具和错误
import { formatConfig } from "@/utils";
import { ConfigError } from "@errors";

// 4. 相对路径（仅在必要时）
import { helperFunction } from "./helpers";
```

## Claude Code 技能和命令

项目配置了专门的 Claude Code 技能和斜杠命令来提升开发效率：

### 斜杠命令
- `/docs-create [document-type] [document-title]` - 标准化文档创建流程
- `/docs-update [scope] [target]` - 文档批量更新和路径别名修复
- `/test-create [test-type] [target-file-or-module]` - 测试用例生成流程
- `/tool-create [tool-name] [tool-description]` - MCP工具开发流程

### Claude 技能
- **路径别名验证器** - 检查和修复路径别名使用问题
- **类型验证器** - TypeScript 严格模式检查和修复
- **CI 验证器** - 完整代码质量检查和 CI 标准验证
- **API 文档生成器** - 从源码自动生成 Nextra 格式文档
- **开发流程检查器** - 确保代码修改后执行必要的质量检查命令

### 重要说明

- 项目完全使用 ESM 模块
- 使用复杂的路径别名系统（见上表）进行模块导入
- 外部依赖不打包（ws、express、commander 等）
- 模板目录复制到 dist 用于项目脚手架
- Web UI 在 `web/` 目录中单独构建
- 文档系统使用 Nextra (Next.js)，支持 MDX 格式
