# Build Command

构建项目。

## 执行步骤

1. 运行类型检查: `pnpm run typecheck`
2. 运行构建: `pnpm run build`
3. 验证构建产物存在于 `dist/` 目录

## 构建配置

- 构建工具: tsup
- 输出格式: ESM
- 类型声明: 自动生成 .d.ts
- Source Map: 启用

## 预期输出

```
dist/
├── index.js
├── index.js.map
├── index.d.ts
└── index.d.ts.map
```