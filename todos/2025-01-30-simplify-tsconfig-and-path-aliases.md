# 简化 tsconfig.json 配置和统一路径别名规范

## 背景

当前项目的 TypeScript 配置存在以下问题：

1. **tsconfig.json 继承不一致**：13 个 tsconfig.json 文件中，有 4 个没有继承根目录的配置（`apps/frontend`、`packages/mcp-core`、`docs`、`scripts`）

2. **路径别名定义混乱**：
   - 前端项目使用了 9 个 `@xxx/*` 格式的路径别名（`@components/*`、`@hooks/*` 等），不符合项目文档定义的 `@/xxx` 规范
   - 后端在 `packages/cli/vitest.config.ts` 中定义了大量路径别名（`@handlers/*`、`@services/*` 等），但实际代码中**完全未使用**
   - 实际代码中只使用 `@/`、`@/lib/*` 等少数别名

3. **配置与使用严重脱节**：
   - 前端 `@components/*` 仅在测试文件中使用，组件间导入使用相对路径
   - 后端定义了 11 个路径别名，实际使用次数为 0

## 为什么 Todo

1. **影响范围大**：涉及前端、后端、多个 packages 和测试配置
2. **需要全面测试**：修改路径别名后需要确保所有导入正常工作
3. **文档和工具依赖**：`.claude/skills`、`.claude/commands` 等工具文件可能依赖当前路径别名配置
4. **需要分阶段进行**：先清理未使用的别名，再统一规范，最后验证所有功能

## 合适的处理时机

1. **当前分支**：`feature/cleanup-vitest-path-aliases` - 已经开始清理路径别名工作
2. **前置条件**：完成当前的 vitest 配置清理工作
3. **信号**：当所有测试通过，且 vitest 相关的路径别名清理完成后

## 正确的处理方法

### 阶段一：清理未使用的路径别名

1. **后端清理**（从 `packages/cli/vitest.config.ts` 移除）：
   - `@handlers/*`、`@services/*`、`@errors/*`、`@utils/*`、`@core/*`、`@transports/*`、`@adapters/*`、`@managers/*`、`@types/*`、`@routes/*`、`@constants/*`
   - 保留：`@/` 和 `@/lib/*`（实际使用中）

2. **前端清理**（从 `apps/frontend/tsconfig.json` 移除）：
   - `@components/*` - 仅测试使用，组件间不使用
   - `@ui/*` - 无实际使用
   - `@lib/*` - 无实际使用
   - `@pages/*` - 无实际使用
   - `@providers/*` - 无实际使用

3. **前端保留**：
   - `@/` - 核心导入方式
   - `@stores/*` - Zustand 状态管理（23次使用）
   - `@services/*` - API 和 WebSocket 服务（18次使用）
   - `@hooks/*` - 自定义 Hooks（5次使用）

### 阶段二：统一路径别名规范

**规范原则**：
- 路径别名统一使用 `@/xxx` 格式
- 只有包名才使用 `@xxx` 格式（如 `@xiaozhi-client/shared-types`）

**前端路径别名调整**：
```json
{
  "@/*": ["./src/*"],
  "@/stores/*": ["./src/stores/*"],
  "@/services/*": ["./src/services/*"],
  "@/hooks/*": ["./src/hooks/*"],
  "@/components/*": ["./src/components/*"],
  "@/utils/*": ["./src/utils/*"]
}
```

**后端路径别名**（保持不变，已经符合规范）：
```json
{
  "@/*": ["./*"]
}
```

### 阶段三：代码迁移

1. 使用搜索替换工具批量更新：
   - `@stores/` → `@/stores/`
   - `@services/` → `@/services/`
   - `@hooks/` → `@/hooks/`
   - `@components/` → `@/components/`
   - `@utils/` → `@/utils/`

2. 更新 `.claude/skills` 和 `.claude/commands` 中的路径别名示例

3. 更新 `CLAUDE.md` 文档中的路径别名说明

### 阶段四：tsconfig.json 继承统一

**统一继承根目录 tsconfig.json**：

1. **保持独立**（合理例外）：
   - `apps/frontend/tsconfig.json` - Next.js 项目需要特殊配置
   - `packages/mcp-core/tsconfig.json` - 核心库需要独立版本控制
   - `docs/tsconfig.json` - Nextra 文档项目

2. **统一继承**（应继承根配置）：
   - `scripts/tsconfig.json` - 应继承根配置

### 阶段五：验证

1. **类型检查**：`pnpm check:type`
2. **Lint 检查**：`pnpm lint`
3. **运行测试**：`pnpm test`
4. **构建检查**：`pnpm build`

## 影响范围

### 配置文件（需修改）
- `packages/cli/vitest.config.ts` - 移除未使用的路径别名
- `apps/frontend/tsconfig.json` - 统一路径别名格式
- `scripts/tsconfig.json` - 继承根配置

### 源代码（需批量更新）
- `apps/frontend/src/**/*` - 前端所有源文件
- `.claude/skills/**/*` - Claude 技能文件
- `.claude/commands/**/*` - Claude 命令文件
- `CLAUDE.md` - 项目文档

### 保持不变
- `apps/backend/` - 已符合规范
- `packages/mcp-core/` - 独立核心库
- `apps/backend/tsconfig.json` - 已符合规范

## 相关 Issue/PR

- 当前分支：`feature/cleanup-vitest-path-aliases`
- 近期相关 PR：
  - #658: refactor(config): 清理 vitest 配置中冗余的路径别名
  - #657: refactor(backend): 统一路径别名规范，移除冗余的 @root/* 别名
  - #656: refactor(config): 移除后端冗余的路径别名配置

## 创建时间

2025-01-30

## 更新记录

- **2025-01-30**: 创建文档，基于探索结果制定清理计划
