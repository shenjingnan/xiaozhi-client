---
name: security-audit
description: 安全审计技能，用于检查和修复依赖安全问题
---

# 安全审计

## 执行步骤

### 1. 清空 overrides

将 `package.json` 中的 `pnpm.overrides` 设为 `{}`，然后 `pnpm install`。

### 2. 执行审计

```bash
pnpm audit --audit-level moderate
```

零漏洞则结束。

### 3. 逐个修复漏洞

对每个漏洞包：

1. **尝试升级**：`pnpm update <包名>` 或升级其上游依赖
2. **验证**：`pnpm typecheck && pnpm build && pnpm test && pnpm lint`
3. **验证失败则回滚**：`git checkout -- package.json pnpm-lock.yaml && pnpm install`
4. **回滚后用 override 解决**：在 `pnpm.overrides` 中添加 `"<包名>": ">=安全版本"`，再验证

### 4. 收尾

- 确认 `pnpm audit --audit-level moderate` 通过
- overrides 按包名字母序排列，版本格式 `>=X.Y.Z`
- `pnpm install --lockfile-only` 同步 lockfile

## 原则

- 禁止使用 `pnpm audit --fix`
- 优先升级依赖，override 仅作为最后手段
