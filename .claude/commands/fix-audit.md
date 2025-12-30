---
description: 安全审计
---

# 安全审计

请执行命令 `pnpm audit --audit-level moderate` 如果发现依赖需要更新，请帮我处理

## 完成以下步骤

- [ ] 执行 pnpm audit --audit-level moderate 检查依赖安全问题
- [ ] 分析审计结果并识别需要更新的依赖
- [ ] 更新有安全问题的依赖包
- [ ] 验证更新后的依赖是否正常工作

### 依赖更新策略

- 自动修复: 对于有修复版本的依赖，使用 pnpm audit --fix 自动更新
- 手动更新: 对于需要手动处理的依赖，分析兼容性后进行版本更新
- 特殊处理: 对于可能影响项目功能的重大版本更新，需要谨慎处理

## 验证和测试

- 运行 pnpm install 更新依赖
- 执行 pnpm build:all 确保构建正常
- 运行 pnpm test 确保所有测试通过
- 执行 pnpm type:check 确保类型检查无错误

## 代码质量检查

- 运行 pnpm check:fix 修复代码格式问题
- 执行 pnpm check:spell 检查拼写

## 风险控制

- 在更新前会检查依赖的兼容性
- 优先选择安全修复而非重大功能更新
- 确保更新后项目功能完全正常
