# 统一 API 响应格式使用 c.success 和 c.fail

## 背景

在之前的开发中，我们添加了 `c.success()` 和 `c.fail()` 两个统一的 API 响应方法，用于规范化所有端点的响应格式。但是在 `apps/backend/handlers` 目录中，仍然有很多 API handler 使用 `c.json()` 返回响应，没有迁移到新的响应方法。

## 为什么 Todo

1. **改动范围较大**：涉及 9 个 handler 文件，一次性修改风险较高
2. **需要逐步迁移**：为了确保系统稳定性，需要按模块逐步处理
3. **需要测试验证**：每个改动都需要相应的测试用例覆盖，确保 API 响应格式对客户端保持兼容

## 合适的处理时机

1. **按模块逐步处理**：每次修改某个模块时顺便将其中的 `c.json` 替换掉
2. **新功能开发完成后**：当当前正在开发的功能完成并稳定后
3. **有空闲时间时**：在主要功能开发间隙进行处理

## 正确的处理方法

### 基本原则

1. **成功响应使用 `c.success()`**：统一成功响应格式
   ```typescript
   // 替换前
   return c.json({ data: result }, 200)

   // 替换后
   return c.success(result)
   ```

2. **失败响应使用 `c.fail()`**：统一错误响应格式
   ```typescript
   // 替换前
   return c.json({ error: message }, 400)

   // 替换后
   return c.fail(message, 400)
   ```

### 处理步骤

1. 选择一个 handler 文件进行处理
2. 检查所有 `c.json()` 调用
3. 根据场景判断是成功还是失败响应
4. 替换为相应的 `c.success()` 或 `c.fail()`
5. 添加或更新测试用例
6. 运行 `pnpm test` 确保测试通过
7. 运行 `pnpm check:type && pnpm lint` 确保代码质量

## 影响范围

### 需要修改的文件（共 9 个）

1. `apps/backend/handlers/MCPServerApiHandler.ts`
2. `apps/backend/handlers/MCPRouteHandler.ts`
3. `apps/backend/handlers/ToolApiHandler.ts`
4. `apps/backend/handlers/CozeApiHandler.ts`
5. `apps/backend/handlers/ConfigApiHandler.ts`
6. `apps/backend/handlers/StatusApiHandler.ts`
7. `apps/backend/handlers/UpdateApiHandler.ts`
8. `apps/backend/handlers/VersionApiHandler.ts`
9. `apps/backend/handlers/ServiceApiHandler.ts`

### 相关测试文件

修改 handler 后需要同步更新对应的测试文件：
- `apps/backend/handlers/__tests__/MCPServerApiHandler.test.ts`
- `apps/backend/handlers/__tests__/MCPRouteHandler.test.ts`
- `apps/backend/handlers/__tests__/MCPRouteHandler.integration.test.ts`
- `apps/backend/handlers/__tests__/ToolApiHandler.integration.test.ts`
- 其他相关测试文件

## 相关 Issue/PR

- 相关 PR: #592 - feat(api): 新增统一的 API 响应方法

## 创建时间

2025-01-23

## 更新记录

- **2025-01-23**: 创建文档
