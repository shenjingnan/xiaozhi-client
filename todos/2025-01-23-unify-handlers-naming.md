# Handlers 命名规范统一待办事项

## 背景

在之前的架构演进中，我们成功将 `MCPEndpointApiHandler.ts` 重命名为 `endpoint.handler.ts`，确立了新的命名规范：使用 `*.handler.ts` 后缀和中划线命名（kebab-case），与项目的 `.middleware.ts` 和 `.route.ts` 保持一致。

目前 `apps/backend/handlers/` 目录下仍有 13 个 handler 文件使用旧的命名规范：
- `*ApiHandler.ts` 格式（8 个）
- `*Handler.ts` 格式（4 个）
- 基础类（1 个）

## 为什么 Todo

1. **刚刚完成示例迁移**：`endpoint.handler.ts` 是新命名规范的第一个示例，需要时间验证这个命名方式是否真正适合项目
2. **保持稳定性**：大量文件重命名会带来大规模的导入更新，需要谨慎操作避免引入错误
3. **优先级考虑**：当前可能有更重要的功能开发任务，命名统一是技术债务，可以稍后处理

## 合适的处理时机

满足以下任一条件时可以考虑处理：
1. **验证期过后**：`endpoint.handler.ts` 命名方式运行 1-2 周后，团队确认这个命名规范确实更好
2. **集中维护窗口**：安排专门的代码质量周或重构周进行批量处理
3. **相关修改时**：当需要修改某个 handler 的内部逻辑时，可以顺便进行该文件的重命名
4. **新功能开发前**：在开始新的功能开发前，统一命名规范可以减少认知负担

## 正确的处理方法

### 步骤 1：分类处理

**按类型分批处理，降低风险：**

#### 批次 1：ApiHandler 类型（8 个文件）
| 当前文件名 | 新文件名 | 类名变更 |
|-----------|---------|---------|
| `ConfigApiHandler.ts` | `config.handler.ts` | `ConfigApiHandler` → `ConfigHandler` |
| `CozeApiHandler.ts` | `coze.handler.ts` | `CozeApiHandler` → `CozeHandler` |
| `MCPServerApiHandler.ts` | `mcp-server.handler.ts` | `MCPServerApiHandler` → `MCPServerHandler` |
| `ServiceApiHandler.ts` | `service.handler.ts` | `ServiceApiHandler` → `ServiceHandler` |
| `StatusApiHandler.ts` | `status.handler.ts` | `StatusApiHandler` → `StatusHandler` |
| `ToolApiHandler.ts` | `tool.handler.ts` | `ToolApiHandler` → `ToolHandler` |
| `ToolCallLogApiHandler.ts` | `tool-call-log.handler.ts` | `ToolCallLogApiHandler` → `ToolCallLogHandler` |
| `UpdateApiHandler.ts` | `update.handler.ts` | `UpdateApiHandler` → `UpdateHandler` |

#### 批次 2：Handler 类型（4 个文件）
| 当前文件名 | 新文件名 | 类名变更 |
|-----------|---------|---------|
| `HeartbeatHandler.ts` | `heartbeat.handler.ts` | 类名保持 `HeartbeatHandler` |
| `MCPRouteHandler.ts` | `mcp-route.handler.ts` | 类名保持 `MCPRouteHandler` |
| `RealtimeNotificationHandler.ts` | `notification.handler.ts` | `RealtimeNotificationHandler` → `NotificationHandler` |
| `StaticFileHandler.ts` | `static-file.handler.ts` | 类名保持 `StaticFileHandler` |

#### 批次 3：基础类（1 个文件）
| 当前文件名 | 新文件名 | 类名变更 |
|-----------|---------|---------|
| `AbstractApiHandler.ts` | `abstract.handler.ts` | `AbstractApiHandler` → `AbstractHandler` |

### 步骤 2：每个文件的重命名流程

参考 `endpoint.handler.ts` 的重命名流程：

1. **重命名主文件并修改类名**
   - 重命名文件：`OldName.ts` → `new-name.handler.ts`
   - 修改类名：去掉 `Api` 后缀（如适用）
   - 更新文件内注释中的类名引用

2. **更新 `handlers/index.ts`**
   - 修改导出语句
   - 从 `export * from "./OldName.js"` 改为 `export { NewName } from "./new-name.handler.js"`

3. **更新所有导入语句**
   - 搜索整个 codebase 中对该类的引用
   - 更新导入路径和类名
   - 典型位置：
     - `routes/types.ts`
     - `routes/index.ts`
     - `types/hono.context.ts`
     - `middlewares/` 下的相关文件
     - 测试文件

4. **重命名并更新测试文件**
   - 重命名测试文件：`OldName.test.ts` → `new-name.handler.test.ts`
   - 更新导入语句和类名引用
   - 更新 `describe` 块描述

5. **更新 mock 路径**（如果适用）
   - 搜索 `vi.mock` 调用
   - 更新 mock 路径和导出的类名

### 步骤 3：验证

每个文件重命名后立即验证：
```bash
# 1. TypeScript 类型检查
pnpm check:type

# 2. 代码规范检查
pnpm lint:fix

# 3. 运行相关测试
pnpm test handlers/__tests__/new-name.handler.test.ts

# 4. 全面检查
pnpm check:all
```

### 步骤 4：批量处理的注意事项

1. **一次处理一个批次**：完成一个批次并验证通过后再进行下一个批次
2. **每个批次提交一次**：便于代码审查和问题回滚
3. **保持测试通过**：每个文件处理后确保相关测试全部通过
4. **文档更新**：完成后更新相关文档中的类名引用

### 步骤 5：命名规则总结

**文件命名规则：**
- 使用中划线分隔（kebab-case）
- 使用 `.handler.ts` 后缀
- 去掉 `Api` 后缀（语义简化）
- 保留必要的修饰词（如 `mcp-server`, `tool-call-log`）

**类名规则：**
- 去掉 `Api` 后缀
- 首字母大写（PascalCase）
- 保留必要的语义词

## 影响范围

### 主要目录
- `apps/backend/handlers/` - 13 个 handler 文件
- `apps/backend/handlers/__tests__/` - 对应的测试文件
- `apps/backend/routes/` - 类型定义和导出
- `apps/backend/types/` - 类型引用
- `apps/backend/middlewares/` - 中间件中的 handler 引用

### 具体文件清单

**Handler 文件（13 个）：**
1. `ConfigApiHandler.ts`
2. `CozeApiHandler.ts`
3. `HeartbeatHandler.ts`
4. `MCPRouteHandler.ts`
5. `MCPServerApiHandler.ts`
6. `RealtimeNotificationHandler.ts`
7. `ServiceApiHandler.ts`
8. `StaticFileHandler.ts`
9. `StatusApiHandler.ts`
10. `ToolApiHandler.ts`
11. `ToolCallLogApiHandler.ts`
12. `UpdateApiHandler.ts`
13. `VersionApiHandler.ts`
14. `AbstractApiHandler.ts`

**关联文件（需要更新引用）：**
- `apps/backend/handlers/index.ts` - 导出声明
- `apps/backend/routes/types.ts` - HandlerDependencies 类型
- `apps/backend/routes/index.ts` - 类型导出
- `apps/backend/types/hono.context.ts` - AppContextVariables 类型
- `apps/backend/WebServer.test.ts` - mock 声明

## 相关 Issue/PR

- 已完成：`endpoint.handler.ts` 重命名（2025-01-23）

## 创建时间

2025-01-23

## 更新记录

- **2025-01-23**: 创建文档，完成 `endpoint.handler.ts` 作为示例
