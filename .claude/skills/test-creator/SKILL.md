---
name: test-creator
description: 测试创建技能，用于生成符合项目标准的测试用例
---

# 测试创建技能

我是一个测试创建专家，专门为 xiaozhi-client 项目生成符合标准的测试用例。

## 我的能力

当你需要创建测试用例时，我会：

1. **分析测试需求** - 确定测试范围、场景和 Mock 策略
2. **生成测试文件** - 创建符合项目标准的完整测试文件
3. **确保覆盖率** - 满足 80% 覆盖率要求
4. **执行质量检查** - 验证测试代码质量

## 使用方式

使用格式：`/test-create [测试类型] [目标文件或模块]`

**示例**：
- `/test-create mcp-tool "core/unified-server"`
- `/test-create cli-command "cli/commands/start"`
- `/test-create transport "transports/websocket-adapter"`
- `/test-create utility "utils/config-parser"`
- `/test-create type "types/xiaozhi-config"`
- `/test-create service "managers/connection-manager"`

## 支持的测试类型

### mcp-tool - MCP 工具测试

- **测试重点**：参数验证、API 调用、设备查找、错误处理
- **Mock 对象**：外部服务、设备状态数据

### service - 服务类测试

- **测试重点**：业务逻辑、数据转换、异常处理
- **Mock 对象**：外部 API、数据库连接

### utility - 工具函数测试

- **测试重点**：输入输出、边界值、类型安全
- **Mock 对象**：通常无需 Mock

### type - 类型定义测试

- **测试重点**：类型构造函数、类型守卫、错误类型
- **Mock 对象**：根据具体需求定

### cli-command - CLI 命令测试

- **测试重点**：参数解析、配置加载、错误输出
- **Mock 对象**：process.argv、console.log、文件系统

### transport - 传输层适配器测试

- **测试重点**：连接建立、消息收发、错误处理、重连
- **Mock 对象**：WebSocket、HTTP 服务器

## 测试文件结构

```typescript
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
// 导入要测试的模块（使用项目路径别名）
import { TargetClass, TargetFunction } from "@/module/target-module";
// 导入类型定义
import type { TargetType } from "@/module/target-module";

describe("测试描述", () => {
  beforeEach(() => {
    // 测试前的准备工作
  });

  afterEach(() => {
    // 测试后的清理工作
    vi.clearAllMocks();
  });

  describe("功能分组", () => {
    it("应该正确处理基本场景", async () => {
      // 基础功能测试
    });

    it("应该正确处理边界条件", async () => {
      // 边界条件测试
    });

    it("应该正确处理错误情况", async () => {
      // 错误处理测试
    });
  });
});
```

## 测试覆盖要求

基于 xiaozhi-client 项目覆盖率目标（80% 分支、函数、行、语句）：

### 必须覆盖的场景

- **正常流程**：所有主要功能路径
- **边界条件**：最小值、最大值、空值、null/undefined
- **错误处理**：所有异常分支和错误码
- **异步操作**：Promise、async/await 的各种状态

## 测试数据设计

- **有效数据**：符合预期的正常输入
- **无效数据**：各种格式错误的输入
- **边界数据**：临界值和极值
- **特殊数据**：null、undefined、空字符串、空数组

## 测试执行命令

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test apps/backend/{module}/{target}.test.ts

# 生成覆盖率报告
pnpm test:coverage
```

## 质量保证检查

```bash
pnpm check:type      # TypeScript类型检查
pnpm lint            # 代码规范和格式检查
pnpm check:spell     # 拼写检查
pnpm check:all       # 运行所有质量检查
```

## 测试最佳实践

### 测试命名

- 使用描述性的测试名称
- 采用中文描述
- 包含测试的具体场景和预期结果

### 测试结构

- 使用 AAA 模式：Arrange（准备）、Act（执行）、Assert（断言）
- 每个测试用例只验证一个行为
- 使用有意义的测试数据

### Mock 使用

- 只 Mock 外部依赖，不测试实现细节
- Mock 行为应该真实且一致
- 在测试后清理 Mock 状态
