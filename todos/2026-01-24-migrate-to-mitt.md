# 迁移 EventBus 到 mitt

## 背景

当前项目使用自定义的 EventBus 实现（基于 Node.js 的 EventEmitter），位于 `apps/backend/services/EventBus.ts`。这个自定义实现包含约 456 行代码，提供了类型安全的事件监听/发射功能、事件统计、错误处理等特性。

经过评估，使用开源的 [mitt](https://github.com/developit/mitt) 事件总线库可以带来以下优势：
- **降低维护成本**：mitt 是成熟的开源项目，有社区维护和测试
- **代码简化**：减少约 400+ 行自定义代码
- **专注核心功能**：团队可以更专注于小智客户端的核心功能迭代
- **更好的兼容性**：mitt 体积小（~200 bytes），无依赖，同时支持浏览器和 Node.js

## 为什么 Todo

1. **当前系统稳定运行**：现有 EventBus 已在生产环境中稳定运行，没有紧急问题需要立即修复
2. **迁移成本较高**：涉及 40+ 文件的修改，需要确保所有测试用例通过
3. **需要充分测试**：迁移后需要全面测试以确保功能完整性
4. **非核心功能**：事件总线是基础设施组件，不影响核心业务功能的开发

## 合适的处理时机

建议在以下情况下开始迁移：
- **版本迭代间隙**：在完成当前版本的核心功能后，有专门的维护窗口期
- **测试覆盖完善**：确保现有测试用例覆盖率足够（当前目标 80%）
- **团队时间充裕**：有足够的时间进行迁移和全面测试
- **无紧急功能需求**：没有紧急的功能需求或 bug 修复任务

## 正确的处理方法

### 阶段 1：准备工作
1. 安装 mitt 依赖：`pnpm add mitt`
2. 阅读 mitt 文档，熟悉其 API 和使用方式
3. 创建迁移分支：`feature/migrate-to-mitt`

### 阶段 2：创建适配层
1. 在 `apps/backend/utils/` 创建 `mittAdapter.ts`
2. 实现兼容当前 EventBus 接口的 mitt 包装器
3. 保留类型安全的 `EventBusEvents` 接口定义
4. 保留事件统计功能（可选，作为包装器的扩展）

### 阶段 3：逐步迁移
1. **核心文件优先**：
   - `apps/backend/services/EventBus.ts` → 改为重新导出 mitt 适配器
   - `apps/backend/lib/mcp/manager.ts` 和 `connection.ts`
   - `apps/backend/WebServer.ts`

2. **处理器和服务层**：
   - `apps/backend/handlers/*.ts`
   - `apps/backend/services/StatusService.ts`
   - `apps/backend/services/NotificationService.ts`

3. **前端部分**（如果需要）：
   - `apps/frontend/src/services/websocket.ts` 中的 EventBus 类

### 阶段 4：测试验证
1. **单元测试**：确保所有 `__tests__` 目录中的测试用例通过
2. **集成测试**：运行 `pnpm test` 确保整体功能正常
3. **手动测试**：启动服务，验证关键事件（MCP 连接、配置更新等）
4. **性能测试**：对比迁移前后的性能表现

### 阶段 5：清理工作
1. 移除旧的 EventEmitter 相关导入
2. 更新文档和注释
3. 合并到主分支并发布

### 注意事项
- **保持向后兼容**：确保现有 API 接口不变，减少对调用方的影响
- **类型安全**：保留 TypeScript 类型定义，确保事件名称和数据类型的类型安全
- **错误处理**：确保 mitt 的错误处理机制满足需求
- **单例模式**：保留 `getEventBus()` 单例模式，保持使用方式一致

## 影响范围

### 核心文件
- `apps/backend/services/EventBus.ts` - 主实现文件（~456 行）
- `apps/backend/services/index.ts` - 导出声明

### 使用 EventBus 的模块（40+ 文件）

**核心服务**：
- `apps/backend/WebServer.ts`
- `apps/backend/lib/mcp/manager.ts`
- `apps/backend/lib/mcp/connection.ts`
- `apps/backend/lib/npm/manager.ts`

**处理器层**：
- `apps/backend/handlers/endpoint.handler.ts`
- `apps/backend/handlers/MCPServerApiHandler.ts`
- `apps/backend/handlers/RealtimeNotificationHandler.ts`
- `apps/backend/handlers/ServiceApiHandler.ts`
- `apps/backend/handlers/UpdateApiHandler.ts`

**服务层**：
- `apps/backend/services/StatusService.ts`
- `apps/backend/services/NotificationService.ts`
- `packages/config/src/manager.ts`

**工具类**：
- `apps/backend/utils/ServiceRestartManager.ts`

**前端**：
- `apps/frontend/src/services/websocket.ts`
- `apps/frontend/src/services/index.ts`

**测试文件**（20+ 个）：
- 所有 `__tests__` 目录下使用 `getEventBus` 或 `eventBus` 的测试文件

### 事件类型定义
- `EventBusEvents` 接口定义了 30+ 种事件类型
- 涵盖配置、状态、服务、MCP、WebSocket、通知等多个领域

## 相关 Issue/PR

待创建关联 Issue

## 创建时间

2026-01-24

## 更新记录

- **2026-01-24**: 创建文档
