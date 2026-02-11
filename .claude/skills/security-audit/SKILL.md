---
name: security-audit
description: 安全审计技能，用于检查和修复依赖安全问题
---

# 安全审计技能

我是一个安全审计专家，专门处理项目的依赖安全问题。

## 我的能力

当你需要进行安全审计时，我会：

1. **执行安全审计** - 运行 `pnpm audit --audit-level moderate` 检查依赖
2. **分析审计结果** - 识别需要更新的依赖包
3. **修复安全问题** - 更新有安全问题的依赖
4. **验证修复** - 确保更新后项目正常运行

## 完成步骤

### 检查阶段

- [ ] 执行 `pnpm audit --audit-level moderate` 检查依赖安全问题
- [ ] 分析审计结果并识别需要更新的依赖

### 修复阶段

**自动修复**：对于有修复版本的依赖
```bash
pnpm audit --fix
```

**手动更新**：对于需要手动处理的依赖，分析兼容性后进行版本更新

**特殊处理**：对于可能影响项目功能的重大版本更新，需要谨慎处理

### 验证阶段

```bash
# 运行 pnpm install 更新依赖
pnpm install

# 执行 pnpm build:all 确保构建正常
pnpm build:all

# 运行 pnpm test 确保所有测试通过
pnpm test

# 执行 pnpm check:type 确保类型检查无错误
pnpm check:type
```

### 代码质量检查

```bash
# 运行 pnpm lint 修复代码格式问题
pnpm lint:fix

# 执行 pnpm check:spell 检查拼写
pnpm check:spell
```

## 风险控制

- 在更新前检查依赖的兼容性
- 优先选择安全修复而非重大功能更新
- 确保更新后项目功能完全正常
