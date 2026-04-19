# Lint Command

运行代码检查和格式化。

## 执行步骤

1. 运行类型检查: `pnpm run typecheck`
2. 运行 Biome 检查: `pnpm run lint`
3. 自动修复: `pnpm run lint:fix`
4. 格式化代码: `pnpm run format`
5. 拼写检查: `pnpm run spellcheck`

## Lint 配置

- Linter: Biome
- 格式化: Biome
- 拼写检查: cspell

## 代码风格

- 缩进: 2 空格
- 引号: 单引号
- 分号: 必须有
- 行宽: 100 字符

## 快捷命令

```bash
# 完整检查
pnpm run check

# 检查并修复
pnpm run check:fix
```