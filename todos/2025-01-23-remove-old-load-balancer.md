# 移除旧的负载均衡逻辑

## 背景

在独立架构迁移（#590, #588）中，项目从负载均衡架构迁移到独立多端点架构。旧的 `LoadBalancer` 类及相关逻辑已不再需要，但由于向后兼容性要求，在迁移完成前需要保留这些代码。

## 为什么 Todo

1. 当前可能仍有遗留代码引用旧的 `LoadBalancer` 类
2. 需要确保所有端点都已完全迁移到独立架构
3. 需要确认所有相关测试已更新或删除
4. 一次性改动风险较高，需要在确认无影响后再移除

## 合适的处理时机

1. 所有端点都已迁移到 `IndependentXiaozhiConnectionManager`
2. 没有代码引用 `LoadBalancer` 类
3. 所有相关测试已更新或删除
4. 项目运行稳定，无相关功能问题

## 正确的处理方法

1. **搜索引用**
   ```bash
   grep -r "LoadBalancer" apps/backend/
   grep -r "loadBalancer" apps/backend/
   ```

2. **确认无引用后删除文件**
   - 删除 `apps/backend/services/LoadBalancer.ts`
   - 删除 `apps/backend/services/__tests__/LoadBalancer.test.ts`

3. **清理相关导入**
   - 移除所有 `import { LoadBalancer }` 相关语句
   - 移除类型定义中的引用

4. **验证构建**
   ```bash
   pnpm check:type
   pnpm lint
   pnpm test
   ```

5. **提交 PR**
   - 标题：`refactor(services): 移除旧的负载均衡逻辑`
   - 关联此 todo 文档

## 影响范围

- `apps/backend/services/LoadBalancer.ts` - 待删除
- `apps/backend/services/__tests__/LoadBalancer.test.ts` - 待删除
- `apps/backend/services/MCPServiceManager.ts` - 可能需要清理导入
- `apps/backend/services/IndependentXiaozhiConnectionManager.ts` - 可能需要清理导入
- `apps/backend/types/` - 可能需要清理类型定义

## 相关 Issue/PR

- #590 - 重构端点连接管理架构
- #588 - 实现共享 MCPManager 架构优化多端点连接

## 创建时间

2025-01-23

## 更新记录

- **2025-01-23**: 创建文档
