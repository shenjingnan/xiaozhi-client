# 将 xiaozhi-client 从 Nx Monorepo 迁移为单体多入口架构

## 背景

### 当前状态

xiaozhi-client 项目当前使用 **Nx + pnpm workspaces** 的 monorepo 架构，包含 13 个 workspace（2 apps + 8 packages + 2 mcps + docs），总代码量约 **266,000 行**，源文件约 **1,382 个**。

### 为什么需要改造

经过对项目实际产物、依赖关系、分发方式的深度审计，发现以下核心问题：

**1. 11/13 的包是"假包"——没有外部独立消费者**

| 包名 | 代码量 | 有外部用户? | 独立价值 |
|------|--------|-----------|---------|
| `asr` | **143,822 行 (54%)** | ✗ | 零——完全自包含，monorepo 对它无任何收益 |
| `backend` | 44,828 行 | ✗ (仅 Docker) | 零——聚合器，依赖 7 个内部包 |
| `frontend` | 34,532 行 | ✗ | 低——配套 Web UI |
| `shared-types` | 3,713 行 | ✗ | 低——纯内部类型 |
| `config` | 4,133 行 | ✗ | 低——仅内部使用 |
| `endpoint` | 7,026 行 | ✗ | 低——仅内部使用 |
| `esp32` | 7,785 行 | ✗ | 低——硬件专用 |
| `version` | 598 行 | ✗ | 极低——可内联为单文件 |
| `mcp-core` | 4,988 行 | ✗ | 中——理论上可复用 |

只有 `cli`、`calculator-mcp`、`datetime-mcp` 这 3 个包有被外部独立使用的场景。

**2. 构建产物本质上是单体的**

```bash
# 用户执行：
npm install -g xiaozhi-client

# 实际安装得到的 dist/ 目录结构：
dist/
├── cli/              ← CLI 入口
├── backend/          ← 后端服务
├── config/           ← 配置模块
└── frontend/         ← 前端静态文件
```

根 `package.json` 的配置证实了这一点：
```json
{
  "name": "xiaozhi-client",
  "main": "dist/cli/index.js",
  "bin": { "xiaozhi": "dist/cli/index.js" },
  "files": ["dist", "templates", "README.md", "LICENSE"]
}
```

**Monorepo 的 13 个包边界在 `npm publish` 时完全消失。**

**3. 同步版本 = 假独立性**

nx.json 配置：`"projectsRelationship": "fixed"` —— 所有包强制同一版本号（2.3.0-beta.1）。这意味着不可能有独立的语义化版本演进或 breaking change 管理。发布本质上是"全量或无"，与单体包**没有区别**。

**4. Nx 投入产出比不划算**

- nx.json + 13 个 project.json + pnpm-workspace.yaml = **~200-300 行配置代码**
- 但 **cache 全部设为 false**（没用到 Nx 最大优势：增量缓存）
- 对于 1 人个人项目，这个复杂度不成比例

**5. 对 AI 编程不友好**

Monorepo 给 AI 带来的额外开销：
- 理解全貌需读 13 个 package.json + nx.json + 依赖图
- 每次改动需要决策"归哪个包"
- 跨包类型协调增加出错概率
- 预估 AI 维护效率损失 **15-20%**

### 参考对比：Claude Code 的架构

Claude Code（~512K 行 / 1,884 文件）采用**单体模块化架构**：
- 单一 `src/` 目录，53 个子目录按功能域组织
- 无 monorepo 基础设施
- Bun feature flag 替代了 monorepo 的 DCE 能力
- Plugin/Skills/MCP 三层扩展体系替代了内部包拆分

### 核心结论

```
Monorepo 把"一个产品的三个入口点"伪装成了"十三个独立包"。
构建时它们又合并回了一个 dist/ 目录。
这个 round-trip（拆开→合并）的唯一受益者是 Nx。
用户没有受益（本来就是一个安装包）。
开发者付出了代价（配置复杂度）。
AI 也付出了代价（上下文理解成本）。
```

---

## 目标架构

### 设计原则

1. **源码统一管理**：所有代码在同一个 TypeScript 项目中
2. **构建产物自然分离**：CLI / Server / Web 各自独立构建入口，输出到 dist/ 对应目录
3. **分发方式不变**：仍然是 1 个 npm 包，`npm install -g xiaozhi-client`
4. **用户体验不变**：`xiaozhi start` 一键启动全部能力
5. **Docker 部署不变**：单容器，单镜像
6. **前端技术栈隔离保留**：Web 可保留独立的 Vite 配置

### 目标目录结构

```
xiaozhi-client/
├── package.json                  ← 唯一（name: xiaozhi-client）
├── tsconfig.json                 ← 根 TS 配置（含 paths 别名）
├── biome.json                    ← 统一 lint
├── vitest.config.ts              ← 统一测试配置
│
├── src/                           ← 所有源码
│   │
│   ├── index.ts                   ← CLI 入口（= 原 packages/cli/src/index.ts）
│   │
│   ├── cli/                       ← CLI 实现（= 原 packages/cli/src）
│   │   ├── commands/
│   │   │   ├── CommandHandlerFactory.ts
│   │   │   ├── EndpointCommandHandler.ts
│   │   │   ├── ServiceCommandHandler.ts
│   │   │   ├── ConfigCommandHandler.ts
│   │   │   ├── McpCommandHandler.ts
│   │   │   └── ProjectCommandHandler.ts
│   │   ├── services/
│   │   │   ├── ServiceManager.ts
│   │   │   ├── ProcessManager.ts
│   │   │   └── DaemonManager.ts
│   │   ├── utils/
│   │   │   ├── FileUtils.ts
│   │   │   ├── PathUtils.ts
│   │   │   ├── FormatUtils.ts
│   │   │   ├── Validation.ts
│   │   │   └── PlatformUtils.ts
│   │   ├── interfaces/
│   │   │   └── Service.ts
│   │   ├── errors/
│   │   ├── types/
│   │   ├── Container.ts
│   │   ├── Constants.ts
│   │   └── index.ts
│   │
│   ├── server/                    ← 后端服务（= 原 apps/backend/src）
│   │   ├── WebServer.ts            ← Hono/Express HTTP 服务
│   │   ├── WebServerLauncher.ts   ← 启动器
│   │   ├── routes/                 ← API 路由
│   │   ├── handlers/               ← 请求处理器
│   │   ├── services/               ← 后端业务服务
│   │   │   ├── StatusService.ts
│   │   │   └── NotificationService.ts
│   │   ├── middleware/             ← 中间件
│   │   ├── lib/                    ← 后端库
│   │   │   ├── mcp/
│   │   │   └── ...
│   │   └── templates/              ← 项目模板
│   │       ├── default/
│   │       └── hello-world/
│   │
│   ├── web/                       ← 前端 UI（= 原 apps/frontend/src）
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── vite.config.ts         ← 保留独立 Vite 配置
│   │   └── index.html
│   │
│   ├── asr/                       ← ASR 引擎（= 原 packages/asr/src）
│   │   └── ... (288 files, 143K 行原样搬入)
│   │
│   ├── mcp-core/                  ← MCP 协议核心（= 原 packages/mcp-core/src）
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── types.ts
│   │   ├── utils/
│   │   └── index.ts
│   │
│   ├── config/                    ← 配置管理（= 原 packages/config/src）
│   │   ├── ConfigManager.ts
│   │   ├── ConfigInitializer.ts
│   │   └── index.ts
│   │
│   ├── endpoint/                  ← WebSocket 连接管理（= 原 packages/endpoint/src）
│   │   ├── EndpointManager.ts
│   │   └── ...
│   │
│   ├── esp32/                     ← ESP32 硬件 SDK（= 原 packages/esp32/src）
│   │   └── ...
│   │
│   ├── types/                     ← 共享类型定义（= 原 packages/shared-types/src）
│   │   ├── api.ts
│   │   ├── config.ts
│   │   ├── coze.ts
│   │   ├── mcp.ts
│   │   └── index.ts
│   │
│   ├── utils/                     ← 共享工具函数（合并各包重复的 utils）
│   │   ├── logger.ts              ← 从 shared-types/utils 迁入
│   │   ├── performance.ts
│   │   └── timeout.ts
│   │
│   ├── version.ts                 ← 版本工具（= 原 packages/version → 内联为单文件）
│   │
│   └── mcps/                      ← MCP 服务插件
│       ├── calculator/
│       │   ├── run.js
│       │   └── package.json       ← 保留用于独立发布
│       └── datetime/
│           ├── run.js
│           └── package.json       ← 保留用于独立发布
│
├── docker/                        ← 不变
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── scripts/
│   │   └── entrypoint.sh
│   └── templates/
│
├── scripts/                       ← 发布脚本等（不变）
│   └── release.ts
│
├── tests/                         ← 集成测试 / e2e 测试
│
├── README.md
├── LICENSE
└── CHANGELOG.md
```

### Import 路径变更对照表

| 原 import 路径 (Monorepo) | 新 import 路径 (单体) |
|--------------------------|---------------------|
| `@xiaozhi-client/config` | `./config` 或 `./src/config` |
| `@xiaozhi-client/mcp-core` | `./mcp-core` 或 `./src/mcp-core` |
| `@xiaozhi-client/shared-types` | `./types` 或 `./src/types` |
| `@xiaozhi-client/endpoint` | `./endpoint` 或 `./src/endpoint` |
| `@xiaozhi-client/asr` | `./asr` 或 `./src/asr` |
| `@xiaozhi-client/esp32` | `./esp32` 或 `./src/esp32` |
| `@xiaozhi-client/version` | `./version` 或内联到 `./utils/version.ts` |

具体路径风格待定（见下文"待决策事项"）。

---

## 运行时架构（不变）

迁移前后运行时架构完全一致：

```
用户终端                        运行时进程模型
─────────                      ──────────────

$ xiaozhi start               ┌──────────────────────┐
     │                          │   CLI 进程 (主进程)    │
     │                          │   src/index.ts        │
     │                          │          │            │
     │                          │    fork() 子进程      │
     │                          │          ↓            │
     │                          │ ┌──────────────────┐ │
     │                          │ │  Backend 进程     │ │
     │                          │ │  src/server/       │ │
     │                          │ │  WebServer.ts     │ │
     │                          │ │  (Hono/Express)   │ │
     │                          │ │       │           │ │
     │                          │ │  提供:             │ │
     │                          │ │  - API (:3000)    │ │
     │                          │ │  - 静态文件(:9999) │ │
     │                          │ │    → web/ 构建    │ │
     │                          │ └──────────────────┘ │
     └──────────────────────────┴──────────────────────┘
```

**CLI 和 Server 是"兄弟关系"（siblings），不是"父子关系"。** CLI 在运行时通过 fork 启动 Server 作为子进程。两者共同引用共享库（types/config/endpoint/asr 等）。

---

## 合适的处理时机

建议在以下条件满足后开始迁移：

### 必要条件

1. **当前无紧急功能需求**：没有正在进行的 feature 开发或 hotfix
2. **测试覆盖率达标**：确保现有测试用例通过（目标 80%+）
3. **时间窗口充裕**：预计需要 2-3 天的专注工作时间（不含验证时间）

### 推荐时机信号

- 一个大版本发布后的"冷却期"
- 当前版本功能稳定、bug 数量低的阶段
- 准备开始新的大功能开发之前（作为"基建"工作先做）

### 不建议的时机

- 正在进行重大 feature 开发期间
- 接近版本发布日期
- 存在未解决的 critical bug

---

## 迁移实施计划

### Phase 0：准备工作（预估 0.5 天）

#### 0.1 创建迁移分支

```bash
git checkout -b refactor/monorepo-to-single-package
git push origin refactor/monorepo-to-single-package
```

#### 0.2 全量备份当前状态

```bash
# 记录当前构建产物作为基准
pnpm run build
cp -r dist dist-baseline-monorepo

# 运行全量测试作为基准
pnpm run test:coverage
cp -r coverage coverage-baseline-monorepo
```

#### 0.3 审计所有跨包引用

生成完整的跨包 import 清单，用于后续批量替换：

```bash
# 找出所有 @xiaozhi-client/ 的内部引用
grep -rn "@xiaozhi-client/" --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v dist > /tmp/cross-package-imports.txt
```

预期结果：大约 200-400 处跨包 import 需要替换。

---

### Phase 1：去除 Nx 基础设施（预估 0.5 天，风险：极低）

**目标**：删除 Nx 层，替换为简单的 pnpm scripts。不影响任何代码逻辑。

#### 1.1 删除 Nx 配置文件

```bash
# 删除以下文件：
- nx.json
- .nx/                          （整个目录）
- .nx/cache/
- .nx/workspace/

# 每个 package.json 和 project.json 中的 nx 配置段
# （这些将在后续步骤中随包合并一起处理）
```

#### 1.2 替换根 package.json 的 scripts

将基于 `nx run-many` 的脚本替换为直接的 pnpm 脚本：

```json
{
  "scripts": {
    "build": "pnpm run build:shared && pnpm run build:cli && pnpm run build:server && pnpm run build:web",
    "build:shared": "tsup src/types src/config src/endpoint src/mcp-core src/esp32 src/asr --outDir dist/shared --format esm --dts --platform node",
    "build:cli": "tsup src/index.ts --outDir dist/cli --format esm --platform node --bundle",
    "build:server": "tsup src/server/WebServerLauncher.ts --outDir dist/server --format esm --platform node",
    "build:web": "vite build src/web --outDir dist/frontend",

    "dev": "concurrently \"tsx watch src/index.ts\" \"tsx watch src/server/WebServerLauncher.ts\" \"vite src/web\" --prefix \"{name}\" --names \"CLI,SERVER,WEB\"",
    "dev:cli": "tsx watch src/index.ts",
    "dev:server": "tsx watch src/server/WebServerLauncher.ts",
    "dev:web": "vite src/web",

    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",

    "lint": "biome check .",
    "lint:fix": "biome check --write .",

    "typecheck": "tsc --noEmit --project tsconfig.json",

    "clean:dist": "rimraf dist",

    "release": "tsx scripts/release.ts"
  }
}
```

> **注意**：此阶段的 scripts 是过渡性的，Phase 2 完成后会再次调整路径。

#### 1.3 更新根 tsconfig.json

创建统一的 TypeScript 配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

#### 1.4 验证

```bash
# 此时构建会失败（因为源码还在旧路径），但配置应该能正确解析
# 验证方法：
npx tsc --noEmit --showConfig   # 应该成功输出配置
```

---

### Phase 2：合并内部包为 src/ 目录（预估 1-1.5 天，风险：低-中）

**目标**：将 8 个内部包和 2 个 app 的源码移动到 `src/` 下的对应目录。

#### 2.1 移动顺序（按依赖关系从叶子到根）

```
第 1 批（无内部依赖，叶子节点）:
  ✓ packages/version/       → src/version.ts（内联为单文件）
  ✓ packages/shared-types/  → src/types/
  ✓ packages/mcp-core/      → src/mcp-core/
  ✓ packages/asr/           → src/asr/

第 2 批（仅依赖第 1 批）:
  ✓ packages/config/        → src/config/
  ✓ packages/endpoint/      → src/endpoint/
  ✓ packages/esp32/         → src/esp32/

第 3批（依赖第 1+2 批）:
  ✓ packages/cli/           → src/cli/  (+ src/index.ts 作为入口)
  ✓ apps/backend/           → src/server/

第 4 批（特殊处理）:
  ✓ apps/frontend/src/      → src/web/（保留 vite.config.ts）
```

#### 2.2 每个包的迁移步骤（标准化流程）

以 `packages/config` → `src/config` 为例：

```bash
# Step 1: 创建目标目录
mkdir -p src/config

# Step 2: 移动源文件（保留目录结构）
cp -r packages/config/src/* src/config/

# Step 3: 更新内部 import 路径
# @xiaozhi-client/mcp-core → ../mcp-core 或 ./mcp-core（取决于最终路径策略）
# 使用 IDE 的全局替换功能

# Step 4: 验证编译
npx tsc --noEmit --pretty  # 检查是否有类型错误

# Step 5: 删除原始目录（确认无误后）
rm -rf packages/config
```

#### 2.3 批量替换 import 路径

这是整个迁移中**工作量最大**的一步。建议分批进行：

```bash
# 使用 sed 或 IDE 全局替换
# 示例：替换 @xiaozhi-client/config 引用
find src/ -name "*.ts" -o -name "*.tsx" \
  | xargs sed -i 's|@xiaozhi-client/config|../config|g'

# 注意：相对路径的正确性取决于文件深度
# 可能需要多次迭代修正
```

**推荐工具**：使用 IDE（VS Code / Cursor）的全局替换功能，配合正则表达式精确匹配。

#### 2.4 处理特殊情况

**情况 A：version 包内联**

`packages/version` 只有 598 行且只有一个导出。直接内联：

```typescript
// src/utils/version.ts
export const VERSION = "2.3.0-beta.1";
export function getVersion(): string { return VERSION; }
```

然后全局搜索替换 `@xiaozhi-client/version` → `./utils/version` 或 `../utils/version`。

**情况 B：各包重复的 utils 合并**

当前每个包都有自己的 `utils/` 目录，存在大量重复（logger、timeout、performance 等）：

```
packages/shared-types/src/utils/   → 合并到 src/utils/
packages/mcp-core/src/utils/      → 合并（去重）
packages/cli/src/utils/           → 合并（去重）
packages/asr/src/utils/           → 合并（去重）
```

合并策略：
1. 先移动 `shared-types/src/utils/` 到 `src/utils/`（作为基础）
2. 逐个检查其他包的 utils 是否有独特函数
3. 独特函数迁移到 `src/utils/` 并重命名避免冲突
4. 重复函数删除，更新引用

**情况 C：前端 Vite 配置**

`apps/frontend` 保留其 `vite.config.ts`、`index.html`、`tsconfig.json`（前端专用）到 `src/web/` 下。前端的构建完全独立于后端和 CLI。

---

### Phase 3：统一构建配置（预估 0.5 天，风险：低）

**目标**：建立清晰的多入口构建系统，保持与当前 `dist/` 输出一致。

#### 3.1 最终构建脚本

```json
{
  "scripts": {
    "clean:dist": "rimraf dist",

    "build:shared": "tsup \
      'src/types/**/*.ts' \
      'src/config/**/*.ts' \
      'src/endpoint/**/*.ts' \
      'src/mcp-core/**/*.ts' \
      'src/esp32/**/*.ts' \
      'src/asr/**/*.ts' \
      --outDir dist/shared \
      --format esm \
      --dts \
      --platform node \
      --no-splitting \
      --treeshake",

    "build:cli": "tsup \
      src/index.ts \
      --outDir dist/cli \
      --format esm \
      --platform node \
      --bundle \
      --keepNames",

    "build:server": "tsup \
      src/server/WebServerLauncher.ts \
      --outDir dist/server \
      --format esm \
      --platform node \
      --bundle \
      --keepNames \
      --external express hono ws @modelcontextprotocol/sdk zod pino",

    "build:web": "vite build src/web --outDir dist/frontend",

    "build": "pnpm run clean:dist && pnpm run build:shared && pnpm run build:cli && concurrently \"pnpm run build:server\" \"pnpm run build:web\""
  }
}
```

#### 3.2 关键设计决策

**Decision 1: shared 库是否 bundle？**

推荐：**不 bundle（`--no-splitting`）**
- shared 库被 cli 和 server 同时引用
- 如果 bundle，会导致代码重复出现在 dist/cli/ 和 dist/server/ 中
- 如果不 bundle，运行时 Node.js 的 ESM 缓存会自动去重

**Decision 2: server 是否 externalize 重型依赖？**

推荐：**是（`--external express hono ws ...`）**
- express、hono、ws 等重型依赖不需要被打包
- 它们会在 node_modules 中存在
- 减少 bundle 体积和构建时间

**Decision 3: web 构建是否独立？**

推荐：**是（继续使用 Vite）**
- 前端有自己的生态系统（React/Vue 组件、CSS、静态资源）
- Vite 对前端构建的优化（HMR、代码分割、资源处理）不可替代
- 只改变源码位置（`apps/frontend/src` → `src/web`），不改变构建工具

#### 3.3 验证构建产物一致性

```bash
# 构建完成后，检查 dist/ 结构是否与 baseline 一致
diff <(ls -R dist-baseline-monorepo/) <(ls -R dist/)

# 关键文件必须存在：
[ -f dist/cli/index.js ]         && echo "✓ CLI OK"
[ -f dist/server/WebServer.js ]   && echo "✓ Server OK"
[ -f dist/frontend/index.html ]  && echo "✓ Frontend OK"
[ -f dist/config/index.js ]      && echo "✓ Config OK"
```

---

### Phase 4：清理收尾（预估 0.5 天，风险：低）

#### 4.1 删除 Monorepo 残留

```bash
# 删除 workspace 配置
rm pnpm-workspace.yaml          # 或仅保留 mcps/ 的最小 workspace（见 4.2）

# 删除空的 packages/ 和 apps/ 目录
rm -rf packages/ apps/

# 删除其他 Nx 残留
rm -rf .nx/

# 清理根 package.json 中的 workspace 依赖声明
# （移除所有 @xiaozhi-client/* 的 dependencies）
```

#### 4.2 MCP 插件的独立分发策略

MCP 插件（calculator-mcp、datetime-mcp）有两种处理方式：

**方案 A（推荐）：跟随主包发布，不独立分发**

理由：
- calculator-mcp 仅 113 行，datetime-mcp 仅 390 行
- 作为独立 npm 包发布的工程开销 > 代码本身的价值
- 大多数用户不需要单独安装 MCP 插件

实现：
```
src/mcps/ 保持在主包内
用户通过 xiaozhi 的命令启用 MCP 插件（如当前行为）
```

**方案 B：轻量 workspace（如果未来确实需要独立分发）**

```yaml
# pnpm-workspace.yaml（最小化）
packages:
  - src/mcps/*
```

只让 mcps/ 使用 workspace，其余全部在主包中。

#### 4.3 统一 package.json

最终的根 `package.json` 应该：

```json
{
  "name": "xiaozhi-client",
  "version": "2.3.0-beta.1",
  "type": "module",
  "main": "dist/cli/index.js",
  "bin": {
    "xiaozhi": "dist/cli/index.js",
    "xiaozhi-client": "dist/cli/index.js"
  },
  "files": ["dist", "templates", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "engines": { "node": ">=22.0.0" },
  "scripts": { /* 见 Phase 3 */ },
  "dependencies": {
    // 所有依赖集中声明（从各包 package.json 合并并去重）
  },
  "devDependencies": {
    // 所有开发依赖集中声明
  }
}
```

#### 4.4 更新 Docker 和部署配置

Dockerfile 和 docker-compose.yml **不需要改动**。它们已经基于 npm 安装后的产物工作：

```dockerfile
RUN npm install -g xiaozhi-client@${XIAOZHI_VERSION}
CMD ["xiaozhi", "start"]
```

只要 `dist/` 的输出结构不变，Docker 部署就不受影响。

---

### Phase 5：全面验证（预估 0.5-1 天，风险：验证性质）

#### 5.1 功能验证清单

```bash
# 1. 安装验证
npm install -g .
xiaozhi --version              # 应显示正确版本号

# 2. CLI 命令验证
xiaozhi help                   # 应显示帮助信息
xiaozhi config list            # 应列出配置项
xiaozhi endpoint status        # 应显示端点状态

# 3. 服务启动/停止验证
xiaozhi start                  # 应成功启动后台服务
xiaozhi status                 # 应显示 running 状态
xiaozhi stop                   # 应成功停止服务

# 4. Web UI 验证
# 启动服务后访问 http://localhost:9999
# 应能看到前端页面

# 5. MCP 功能验证
xiaozhi mcp list               # 应列出可用的 MCP 服务

# 6. 模板功能验证
xiaozhi create my-app          # 应能从模板创建项目
```

#### 5.2 测试验证

```bash
# 全量测试
pnpm test                      # 所有单元测试通过
pnpm test:coverage             # 覆盖率不低于 baseline

# 类型检查
pnpm typecheck                 # tsc --noEmit 无错误

# Lint
pnpm lint                      # biome check 通过
```

#### 5.3 回归对比

```bash
# 与 baseline 构建产物的 diff
diff -rq dist-baseline-monorepo/ dist/ | head -20

# 预期差异：
# - 源映射文件路径不同（正常，因为源码位置变了）
# - 文件内容应功能等价
```

---

## 待决策事项

在正式开始迁移前，需要确认以下几个技术选择：

### 决策 1：import 路径风格

**选项 A：相对路径**（如 `./config`, `../types`）
- 优点：无需配置，TypeScript 原生支持
- 缺点：深层嵌套时路径冗长（`../../../../types`）

**选项 B：路径别名**（如 `@/config`, `@/types`）
- 优点：简洁、统一、重构友好
- 缺点：需要 tsconfig.json paths 配置 + 构建工具适配

**选项 C：短绝对路径**（如 `#/config`, `~/config`）
- 介于 A 和 B 之间

**推荐：选项 B（路径别名 `@/*`）**
- Claude Code 也使用了类似的路径别名（`src/` 前缀）
- 对 AI 编程更友好（短路径 = 省 token）
- 需要在 tsup/vite 中配置 alias

### 决策 2：MCP 插件的未来策略

- **短期**：合入主包（方案 A），不独立分发
- **长期**：如果 MCP 生态爆发，再拆出为轻量 workspace（方案 B）

建议：**短期选 A，文档中记录 B 作为备选路径。**

### 决策 3：前端技术栈隔离程度

- **保守**：`src/web/` 保留自己的 `vite.config.ts`、`tsconfig.json`、`package.json`（仅 devDependencies）
- **激进**：完全纳入根配置，前端构建也由根 scripts 管理

**推荐：保守方案**。前端生态（Vite + React/Vue）与后端（tsup + Node.js）差异太大，强行统一会增加复杂度而收益有限。

---

## 风险评估与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| import 路径替换遗漏 | 中 | 高（运行时报错） | 分批替换 + tsc --noEmit 全量检查 + 全量测试 |
| 循环依赖暴露 | 低 | 中（编译错误） | Phase 2 逐批移动时每批都做 tsc 检查 |
| 构建产物不一致 | 低 | 高（用户受影响） | 与 baseline 做 diff 对比 |
| 前端构建破坏 | 中 | 中（Web UI 不可用） | 优先验证 vite build 输出 |
| Docker 部署失败 | 极低 | 高 | Dockerfile 基于 npm install，不受源码结构影响 |
| Git 历史丢失 | 低 | 中 | 使用 `git mv` 而非 `cp + rm` 保留历史 |

---

## 成功标准

迁移完成的标准：

1. ✅ `pnpm run build` 成功，`dist/` 结构与当前一致
2. ✅ `pnpm test` 全量通过，覆盖率不低于 baseline
3. ✅ `pnpm typecheck` 零错误
4. ✅ `pnpm lint` 零错误
5. ✅ `xiaozhi --version` / `xiaozhi start` / `xiaozhi stop` 正常工作
6. ✅ Web UI (`localhost:9999`) 正常访问
7. ✅ Docker 构建和运行正常
8. ✅ `npm pack` 产物可正常安装和使用
9. ✅ 无残留的 `@xiaozhi-client/` 内部引用
10. ✅ 无残留的 Nx / workspace 配置（除 mcps 外）

---

## 工作量估算

| Phase | 内容 | 预估时间 | 风险 |
|-------|------|---------|------|
| Phase 0 | 准备工作 + 审计 | 0.5 天 | 无 |
| Phase 1 | 去除 Nx | 0.5 天 | 极低 |
| Phase 2 | 合并包为 src/ 目录 | 1-1.5 天 | 低-中 |
| Phase 3 | 统一构建配置 | 0.5 天 | 低 |
| Phase 4 | 清理收尾 | 0.5 天 | 低 |
| Phase 5 | 全面验证 | 0.5-1 天 | 验证性质 |
| **总计** | | **4-5 天** | |

---

## 参考：加权评分回顾

| 评估维度 | 权重 | Monorepo (当前) | 单体多入口 (目标) | 差异 |
|---------|------|----------------|-----------------|------|
| 开发体验 | 25% | 6 | **8** | +0.5 |
| AI 编程友好度 | 20% | 6 | **8** | +0.4 |
| 构建/CI 复杂度 | 15% | 5 | **9** | +0.6 |
| 类型安全性 | 15% | 7 | **9** | +0.3 |
| 独立分发能力 | 10% | 9 | 5 | -0.4 |
| 多团队扩展性 | 10% | 8 | 4 | -0.4 |
| 新人上手难度 | 5% | 5 | 7 | +0.1 |
| **总分** | **100%** | **6.35** | **7.85** | **+1.5** |

---

*文档创建时间：2026-04-13*
*基于对 xiaozhi-client v2.3.0-beta.1 源码的完整审计*
*参考对比：Claude Code (Anthropic) 单体架构分析*
