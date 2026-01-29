---
description: 分析并清理超出测试范围或低价值的测试用例
argument-hint: [指定路径]
---

<指定路径>$1</指定路径>

# 测试用例清理命令

我需要分析 xiaozhi-client 项目中的测试文件，识别并清理超出测试职责范围或低价值的测试用例。

## 1. 分析目标

基于 CLAUDE.md 中定义的"测试职责范围规范"，分析指定的测试文件：

**指定路径**: `<指定路径>`
- 如果未指定路径，分析整个项目的测试文件
- 如果指定文件路径，分析该测试文件
- 如果指定目录路径，分析该目录下的所有测试文件

## 2. 分析流程

### 2.1 扫描阶段

1. **识别测试文件**：查找目标路径下所有的 `*.test.ts` 文件
2. **解析导入关系**：提取每个测试文件的导入语句，识别外部依赖
3. **分类测试模块**：
   - 单元测试模块（核心库、工具函数）
   - 集成测试模块（handlers、services）
   - 端到端测试模块（CLI 命令）

### 2.2 问题识别

检查以下问题模式：

**严重问题**（应立即删除）：
- **超纲测试**: 在消费者测试中测试外部依赖的内部实现
  - 例如：在 `handler.test.ts` 中详细测试 `normalizeTypeField` 函数的各种输入
  - 判断标准：测试用例验证的是外部依赖的行为而非当前模块的职责

**警告问题**（建议删除或重构）：
- **重复测试**: 已在提供者模块中覆盖的单元功能
  - 例如：`utils` 模块已有完整测试，`handler` 不需要重复验证相同逻辑
  - 判断标准：测试用例在依赖模块中已存在类似的覆盖

**建议优化**（可选改进）：
- **低价值测试**: 不提供独特价值的测试用例
  - 例如：测试显而易见的行为，或 Mock 过度导致测试无意义
  - 判断标准：测试失败时无法提供有价值的调试信息

**过度 Mock**：
- **问题模式**: Mock 了不应 Mock 的内部实现细节
  - 例如：Mock 被测试函数内部的辅助函数
  - 判断标准：Mock 破坏了测试的真实性和价值

### 2.3 报告格式

按以下格式输出分析报告：

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
- **问题**: 测试了 `@/lib/mcp-core/utils/type-field-normalizer` 中已完整覆盖的单元功能
- **建议**: 删除这些测试用例，该函数的单元测试应在 `mcp-core` 模块中
- **代码片段**:
  ```typescript
  it("应该正确处理 null 类型字段", () => {
    const result = normalizeTypeField({ type: null });
    expect(result.type).toBe("unknown");
  });
  ```

### ...更多问题

## 警告问题（建议优化）

### ...问题详情

## 建议优化（可选）

### ...优化建议

## 清理总结

- 可删除测试用例: X 个
- 可优化测试用例: Y 个
- 预计节省维护成本: Z%
```

## 3. 执行阶段

### 3.1 用户确认

在执行清理前，必须获得用户明确确认：

1. 展示分析报告
2. 询问是否确认执行清理
3. 等待用户确认后才进行修改

### 3.2 清理操作

如果用户确认，执行以下操作：

1. **备份原始文件**：
   ```bash
   # 创建备份分支
   git checkout -b test-cleanup-backup-$(date +%Y%m%d)
   ```

2. **删除问题测试**：
   - 根据报告中的位置信息，删除超出范围的测试用例
   - 保留必要的集成测试

3. **验证测试**：
   ```bash
   # 运行测试确保清理后仍通过
   pnpm test <指定路径>
   ```

4. **生成覆盖率报告**：
   ```bash
   # 确认覆盖率仍符合要求
   pnpm test:coverage
   ```

### 3.3 回滚选项

告知用户如何回滚：
```bash
# 如果清理导致问题，可以回滚
git checkout main
git branch -D test-cleanup-backup-$(date +%Y%m%d)
```

## 4. 示例分析

### 4.1 超纲测试示例

**问题代码**:
```typescript
// apps/backend/handlers/__tests__/mcp-manage.handler.test.ts

import { normalizeTypeField } from "@/lib/mcp-core/utils/type-field-normalizer";

describe("MCPManageHandler", () => {
  describe("normalizeTypeField", () => {  // ❌ 超纲测试
    it("应该正确处理 null 类型字段", () => {
      const result = normalizeTypeField({ type: null });
      expect(result.type).toBe("unknown");
    });
    // ... 更多该函数的测试
  });
});
```

**问题分析**:
- `normalizeTypeField` 是 `@/lib/mcp-core/utils` 中的工具函数
- 该函数的单元测试应该在 `mcp-core` 模块的 `__tests__` 目录中
- `handler` 测试应该关注 handler 的业务逻辑，而不是工具函数的内部实现

**清理建议**:
```typescript
// apps/backend/handlers/__tests__/mcp-manage.handler.test.ts

describe("MCPManageHandler", () => {
  describe("handleListTools", () => {  // ✅ 正确范围
    it("应该正确调用 normalizeTypeField 处理工具定义", () => {
      // 验证 handler 正确调用了工具函数
      // 而不是测试工具函数本身的各种输入
    });
  });
});
```

### 4.2 正确的集成测试示例

**正确代码**:
```typescript
// apps/backend/handlers/__tests__/mcp-manage.handler.test.ts

import { MCPManageHandler } from "../mcp-manage.handler";
import { normalizeTypeField } from "@/lib/mcp-core/utils/type-field-normalizer";

describe("MCPManageHandler", () => {
  describe("handleListTools", () => {
    it("应该返回经过类型规范化的工具列表", async () => {
      // ✅ 测试 handler 在业务场景中正确使用了外部依赖
      const handler = new MCPManageHandler();
      const result = await handler.handleListTools();

      expect(result.tools).toBeDefined();
      // 验证业务结果，而不是工具函数的输入输出
    });
  });
});
```

## 5. 使用示例

```bash
# 分析整个项目的测试文件
/test-cleanup

# 分析特定模块的测试文件
/test-cleanup apps/backend/handlers

# 分析特定测试文件
/test-cleanup apps/backend/handlers/__tests__/mcp-manage.handler.test.ts
```

## 6. 注意事项

- **谨慎删除**：如果不确定测试的价值，先标记为"建议优化"而非直接删除
- **保留集成测试**：删除超纲的单元测试时，确保保留必要的集成测试
- **覆盖率监控**：清理后确保整体测试覆盖率仍符合 80% 的要求
- **中文描述**：所有测试用例描述必须使用中文
- **路径别名**：修改测试代码时使用正确的路径别名

## 7. 质量检查

清理完成后，执行以下质量检查：

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

请按照以上流程分析并清理测试用例，确保项目测试质量符合 CLAUDE.md 中定义的规范。
