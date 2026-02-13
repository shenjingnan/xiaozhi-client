---
name: test-cleaner
description: 测试清理技能，用于分析并清理超出测试范围或低价值的测试用例
---

# 测试清理技能

我是一个测试清理专家，专门分析并清理超出测试职责范围或低价值的测试用例。

## 我的能力

当你需要清理测试用例时，我会：

1. **分析测试文件** - 扫描并识别问题测试用例
2. **生成分析报告** - 详细列出问题和建议
3. **等待用户确认** - 在执行清理前获得明确确认
4. **执行清理** - 删除问题用例并验证结果

## 使用方式

使用格式：`/test-cleanup [路径]`

**示例**：
- `/test-cleanup` - 分析整个项目的测试文件
- `/test-cleanup apps/backend/handlers` - 分析特定模块
- `/test-cleanup apps/backend/handlers/__tests__/mcp-manage.handler.test.ts` - 分析特定文件

## 分析流程

### 扫描阶段

1. **识别测试文件**：查找目标路径下所有的 `*.test.ts` 文件
2. **解析导入关系**：提取每个测试文件的导入语句
3. **分类测试模块**：单元测试、集成测试、端到端测试

### 问题识别

**严重问题**（应立即删除）：
- **超纲测试**：在消费者测试中测试外部依赖的内部实现
  - 判断标准：测试用例验证的是外部依赖的行为而非当前模块的职责

**警告问题**（建议删除或重构）：
- **重复测试**：已在提供者模块中覆盖的单元功能
  - 判断标准：测试用例在依赖模块中已存在类似的覆盖

**建议优化**（可选改进）：
- **低价值测试**：不提供独特价值的测试用例
  - 判断标准：测试失败时无法提供有价值的调试信息

**过度 Mock**：
- **问题模式**：Mock 了不应 Mock 的内部实现细节
  - 判断标准：Mock 破坏了测试的真实性和价值

### 分析报告格式

```markdown
# 测试用例清理分析报告

## 分析范围
- 路径: `<指定路径>`
- 测试文件数: X
- 问题用例数: Y

## 严重问题（应删除）
### 文件: apps/backend/handlers/__tests__/mcp-manage.handler.test.ts
#### 问题: 超纲测试 - 重复测试 TypeFieldNormalizer
- **位置**: 第 45-67 行
- **问题**: 测试了外部依赖中已完整覆盖的单元功能
- **建议**: 删除这些测试用例

## 清理总结
- 可删除测试用例: X 个
- 可优化测试用例: Y 个
```

## 执行阶段

### 用户确认

1. 展示分析报告
2. 询问是否确认执行清理
3. 等待用户确认后才进行修改

### 清理操作

如果用户确认，执行以下操作：

```bash
# 创建备份分支
git checkout -b test-cleanup-backup-$(date +%Y%m%d)

# 删除问题测试
# 根据报告中的位置信息，删除超出范围的测试用例

# 验证测试
pnpm test <指定路径>

# 生成覆盖率报告
pnpm test:coverage
```

### 回滚选项

```bash
# 如果清理导致问题，可以回滚
git checkout main
git branch -D test-cleanup-backup-$(date +%Y%m%d)
```

## 示例分析

### 超纲测试示例

**问题代码**:
```typescript
// ❌ 超纲测试
import { normalizeTypeField } from "@/lib/mcp-core/utils/type-field-normalizer";

describe("MCPManageHandler", () => {
  describe("normalizeTypeField", () => {
    it("应该正确处理 null 类型字段", () => {
      // 这是工具函数的单元测试，不应该在 handler 测试中
    });
  });
});
```

**清理建议**:
```typescript
// ✅ 正确范围
describe("MCPManageHandler", () => {
  describe("handleListTools", () => {
    it("应该正确调用 normalizeTypeField 处理工具定义", () => {
      // 验证 handler 在业务场景中正确使用了外部依赖
    });
  });
});
```

## 注意事项

- **谨慎删除**：如果不确定测试的价值，先标记为"建议优化"而非直接删除
- **保留集成测试**：删除超纲的单元测试时，确保保留必要的集成测试
- **覆盖率监控**：清理后确保整体测试覆盖率仍符合 80% 的要求
- **中文描述**：所有测试用例描述必须使用中文
- **路径别名**：修改测试代码时使用正确的路径别名

## 质量检查

```bash
# 类型检查
pnpm check:type

# 代码规范检查
pnpm lint

# 运行测试
pnpm test

# 生成覆盖率报告
pnpm test:coverage
```
