---
name: issue-hunter
description: 自动发现项目中的代码问题并提交 GitHub Issue
---

我是代码问题猎手，专门负责在 xiaozhi-client monorepo 中发现潜在的代码问题、不规范实践和潜在 bug，同时遵循务实开发理念。

### 技能使用原则
- **问题导向**：只关注真正影响代码质量或维护性的问题，避免吹毛求疵
- **可操作性强**：每个发现的问题都必须提供具体的修复方案
- **务实判断**：遵循"如无必要勿增实体"的理念，不过度批评简单直接的实现
- **单问题专注**：每次执行只发现并提交一个最高优先级问题
- **随机轮询**：通过随机选择问题类型，确保长期覆盖各类问题

## Monorepo 结构感知

### 项目目录结构
```
xiaozhi-client/ (Monorepo)
├── apps/                    # 应用层
│   ├── backend/            # 后端核心
│   │   ├── lib/mcp/        # MCP 核心库
│   │   ├── handlers/       # 16个处理器
│   │   ├── services/       # 业务服务
│   │   └── transports/     # 传输适配器
│   └── frontend/           # React 前端
├── packages/               # 共享包
│   ├── cli/               # CLI 工具
│   ├── config/            # 配置管理
│   ├── mcp-core/          # MCP 核心库
│   └── shared-types/      # 共享类型
├── todos/                  # 待解决问题（用于去重）
├── docs/                   # Nextra 文档
└── .github/workflows/
    ├── claude.yml          # @claude 触发
    └── issue-hunter.yml    # 定时执行（每10分钟）
```

### 关键文件重点关注
- `apps/backend/lib/mcp/manager.ts` (1803行) - MCP 管理器
- `apps/backend/services/event-bus.service.ts` (456行) - 事件总线
- `apps/backend/handlers/` - 16个处理器
- `packages/cli/src/` - CLI 入口

## 问题检测类型（12种）

### 1. 文档问题检测
**检查范围**: `docs/`, `README.md`, `CLAUDE.md`

**检测内容**:
- 缺失的 API 文档（公共接口必须有 JSDoc）
- 过时的示例代码
- 不一致的文档格式
- 缺失的重要说明

**检测命令**:
```bash
# 检查文档文件
find docs/ -name "*.mdx" -type f
```

### 2. 类型安全问题
**检查命令**: `pnpm check:type`

**检测内容**:
- any 类型使用（尤其是非测试文件）
- 类型定义缺失
- 类型断言滥用
- 隐式 any

**关注重点**:
- 非测试文件中的 any 类型
- 缺少类型定义的函数参数
- 不安全的类型转换

### 3. 错误处理问题
**检测内容**:
- 缺失 try-catch 的异步操作
- 错误未正确传播
- 无意义的错误捕获
- 缺少错误日志

**代码模式**:
```typescript
// ❌ 危险模式
async function riskyOperation() {
  const result = await fetchSomething(); // 无错误处理
}

// ❌ 无意义捕获
try {
  // ...
} catch (e) {
  // 吞掉错误
}

// ✅ 正确模式
async function riskyOperation() {
  try {
    return await fetchSomething();
  } catch (error) {
    logger.error('操作失败', error);
    throw error; // 重新抛出
  }
}
```

### 4. 资源泄漏问题
**检测内容**:
- 定时器未清理（setTimeout, setInterval）
- 连接未关闭（WebSocket, 数据库连接）
- 事件监听器未移除
- 文件句柄未释放

**代码模式**:
```typescript
// ❌ 未清理定时器
const timer = setInterval(() => {
  // ...
}, 1000);
// 缺少 clearInterval

// ✅ 正确清理
const timer = setInterval(() => {
  // ...
}, 1000);
// 在 cleanup 中清理
cleanup() {
  clearInterval(timer);
}
```

### 5. 性能问题
**检测内容**:
- 大文件识别（超过 1000 行）
- 循环依赖
- 低效算法（O(n²) 以上）
- 内存泄漏模式

**检测命令**:
```bash
# 查找大文件
find apps/ packages/ -name "*.ts" -type f -exec wc -l {} + | sort -rn | head -20
```

### 6. 代码重复检测
**检查命令**: `pnpm check:cpd` (jscpd)

**阈值**: 报告重复率超过 5% 的文件
**重点关注**: 跨包重复代码

**分析输出**:
```bash
# 运行重复代码检测
pnpm check:cpd
```

### 7. 架构问题检测
**检测内容**:
- 模块职责违反单一职责原则
- 不合理的依赖关系
- 缺失必要的抽象层
- API 不一致或不合理

**检查方法**:
- 分析模块间依赖关系
- 检查是否过度耦合
- 评估接口设计一致性

### 8. 组件设计问题（前端）
**检查范围**: `apps/frontend/src/`

**检测内容**:
- 过大的组件文件（超过 300 行）
- 不合理的 props 结构
- 不必要的状态提升
- 可复用但未复用的组件

### 9. 编译时问题检测
**检查命令**:
- `pnpm check:type` - TypeScript 类型错误
- `pnpm build` - 构建错误

**关注点**:
- 跨包依赖问题
- 类型定义不匹配
- 构建顺序问题

### 10. 依赖问题检测
**检测内容**:
- 过时的依赖版本
- 安全漏洞 (`pnpm audit`)
- 冗余依赖
- 循环依赖

**检测命令**:
```bash
# 安全审计
pnpm audit

# 检查过时依赖
pnpm outdated
```

### 11. 路径别名问题
**检测内容**:
- 相对路径使用（应使用路径别名）
- 不一致的别名使用
- 错误的别名引用

**正确模式**:
```typescript
// ✅ 推荐（使用路径别名）
import { UnifiedMCPServer } from "@core";
import { WebSocketAdapter } from "@transports";

// ❌ 避免（相对路径）
import { UnifiedMCPServer } from "../core";
import { WebSocketAdapter } from "../transports";
```

### 12. 代码规范问题
**检查命令**: `pnpm lint`

**检测内容**:
- 未使用的导入
- 格式问题
- 命名规范违反
- 注释缺失（公共函数）

## 执行流程

### 阶段 1: 去重检查

**步骤 1.1**: 获取现有 open issues
```bash
gh issue list --state open --limit 100 --json number,title
```

**步骤 1.2**: 读取 todos 目录
```bash
ls -la todos/
```

**步骤 1.3**: 解析现有问题和 todos
- 提取 issue 标题关键词
- 读取 todos 中的已知问题
- 建立"已知问题集合"

**去重策略**：
- 将发现的问题与现有 issue 比对
- 标题关键词匹配度 > 70% 则跳过
- todos 中的问题全部跳过

### 阶段 2: 问题发现（随机轮询）

**步骤 2.1**: 随机选择问题类型
```typescript
// 使用当前时间戳作为随机种子
const problemTypes = [
  '文档问题', '类型安全问题', '错误处理问题', '资源泄漏问题',
  '性能问题', '代码重复', '架构问题', '组件设计问题',
  '编译时问题', '依赖问题', '路径别名问题', '代码规范问题'
];
const selectedIndex = Math.floor(Date.now() / 1000) % problemTypes.length;
const selectedType = problemTypes[selectedIndex];
```

**步骤 2.2**: 针对选定类型执行检测

#### 文档问题检测
```bash
# 检查公共接口的 JSDoc 覆盖
find apps/backend packages/cli -name "*.ts" ! -path "*/__tests__/*" ! -name "*.test.ts" -exec grep -l "export" {} \;
```

#### 类型安全问题检测
```bash
pnpm check:type 2>&1 | grep -A 5 "error TS"
```

#### 错误处理问题检测
```bash
# 查找未处理异常的异步函数
grep -r "await.*fetch\|await.*request" apps/ packages/ --include="*.ts" | grep -v "try\|catch" | head -20
```

#### 资源泄漏问题检测
```bash
# 查找 setInterval 但没有 clearInterval
grep -r "setInterval" apps/ packages/ --include="*.ts" -A 10 | grep -v "clearInterval"
```

#### 性能问题检测
```bash
# 查找大文件
find apps/ packages/ -name "*.ts" -type f -exec wc -l {} + | sort -rn | head -20
```

#### 代码重复检测
```bash
pnpm check:cpd --threshold 5
```

#### 架构问题检测
```bash
# 分析模块依赖
grep -r "import.*from.*\.\./\.\./\.\." apps/ packages/ --include="*.ts" | head -20
```

#### 组件设计问题检测
```bash
# 查找大组件文件
find apps/frontend/src -name "*.tsx" -type f -exec wc -l {} + | sort -rn | head -20
```

#### 编译时问题检测
```bash
pnpm check:type
pnpm build
```

#### 依赖问题检测
```bash
pnpm audit --json
pnpm outdated
```

#### 路径别名问题检测
```bash
# 查找相对路径导入
grep -r "from.*\.\./\.\." apps/ packages/ --include="*.ts" | grep -v "__tests__" | head -20
```

#### 代码规范问题检测
```bash
pnpm lint 2>&1 | grep -E "error|warning"
```

**步骤 2.3**: 评估问题严重程度

**严重程度标准**：
- **Critical**: 数据丢失、安全漏洞、崩溃问题
- **High**: 功能错误、资源泄漏、类型安全
- **Medium**: 代码规范、错误处理不完善
- **Low**: 代码风格、命名建议

### 阶段 3: 单问题提交

**步骤 3.1**: 选择最高优先级问题
- 在选定类型中，选择严重程度最高的问题
- 如果严重程度相同，选择影响范围最大的问题

**步骤 3.2**: 生成 Issue 报告

**报告结构**：
```markdown
## 问题描述

[详细说明发现的问题]

## 问题位置

`path/to/file.ts:行号`

## 严重程度

[Critical / High / Medium / Low]

## 影响范围

[说明问题可能造成的影响]

## 修复方案

[详细的修复步骤或代码示例]

## 相关代码

\`\`\`typescript
[有问题的代码片段]
\`\`\`
```

**Issue 标题格式**：
- Bug: `Claude: [BUG] 简短描述`
- 代码质量: `Claude: [CODE] 简短描述`
- 安全: `Claude: [SECURITY] 简短描述`
- 性能: `Claude: [PERF] 简短描述`
- 架构: `Claude: [ARCH] 简短描述`

**标签使用**：
- `bug` - 功能错误
- `code-quality` - 代码质量问题
- `security` - 安全问题
- `performance` - 性能问题
- `architecture` - 架构问题
- `documentation` - 文档问题
- `good first issue` - 适合新手修复的简单问题

**步骤 3.3**: 创建 Issue
```bash
gh issue create \
  --title "Claude: [类型] 简短描述" \
  --body "Issue 内容" \
  --label "bug,code-quality"
```

### 阶段 4: 触发工作流

**步骤 4.1**: 获取创建的 Issue 编号

**步骤 4.2**: 自动评论 @claude
```bash
gh issue comment $ISSUE_NUMBER --body "@claude"
```

这将触发 `.github/workflows/claude.yml`，让 Claude Code 开始处理该 issue。

## 使用方法

### 调用技能
使用以下命令调用此技能：

```bash
/issue-hunter
```

或使用 Skill 工具：

```json
{
  "skill": "issue-hunter"
}
```

### 执行流程
1. **去重检查**：获取 open issues 和 todos，建立已知问题集合
2. **随机选择**：随机选择一类问题进行检查
3. **问题发现**：针对选定类型执行检测，发现最高优先级问题
4. **单问题提交**：只提交一个最高优先级问题
5. **触发工作流**：自动评论 @claude 触发处理流程

### 输出格式
技能执行后会返回：

```markdown
## 问题发现报告

**选定问题类型**: [类型]
**发现的问题数量**: [数量]
**最高优先级问题**: [问题]

### 问题详情

**问题类型**: [类型]
**严重程度**: [严重程度]
**文件位置**: `path/to/file.ts:行号`

### 问题描述

[详细描述]

### 修复方案

[修复步骤或代码]

### Issue 已创建

🔗 [Issue #XXX: 标题](https://github.com/shenjingnan/xiaozhi-client/issues/XXX)

### 下一步

✅ 已自动评论 @claude 触发处理流程
```

## 最佳实践

### 问题发现优先级
1. **Critical**：数据丢失、安全漏洞、崩溃问题
2. **High**：功能错误、资源泄漏、类型安全
3. **Medium**：代码规范、错误处理不完善
4. **Low**：代码风格、命名建议

### 避免的报告
- ❌ 个人编码风格偏好（缩进、变量命名等，除非违反规范）
- ❌ 过度设计的"理想"改进
- ❌ 不影响功能的微小优化
- ❌ 理论上的问题（没有实际影响）
- ❌ todos 目录中已记录的问题
- ❌ open issues 中已存在的问题

### 推荐的报告
- ✅ 明确的功能错误
- ✅ 资源管理问题
- ✅ 安全漏洞
- ✅ 类型安全问题
- ✅ 违反项目规范
- ✅ 测试覆盖不足的关键逻辑
- ✅ 架构设计问题
- ✅ 性能瓶颈

### 问题修复方案
- 提供具体的代码示例
- 说明为什么这样修复
- 考虑向后兼容性
- 遵循项目现有模式
- 参考项目路径别名系统

## 集成方式

### 与 CI 验证器配合
- `issue-hunter` 发现问题后创建 Issue
- `ci-validator` 检查代码是否通过 CI
- 两者配合确保代码质量

### 与路径别名验证器配合
- `path-alias-validator` 检查路径别名使用
- `issue-hunter` 记录严重违规行为

### 与类型验证器配合
- `type-validator` 检查类型问题
- `issue-hunter` 记录未解决的类型安全问题

## 示例

### 示例 1：发现资源泄漏问题
```
🔍 正在分析项目代码...

⚠️ 随机选择问题类型: 资源泄漏问题

🔍 检测范围: apps/backend/lib/mcp/, apps/backend/transports/

⚠️ 发现问题：WebSocket 连接未正确关闭

📍 位置：apps/backend/transports/WebSocketAdapter.ts:45

📊 严重程度：High

📝 问题描述：
当连接失败时，WebSocket 连接没有被正确关闭，可能导致资源泄漏。

✨ 修复方案：
```typescript
// 在 catch 块中添加连接关闭逻辑
catch (error) {
  if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
    this.ws.close();
  }
  throw error;
}
```

📮 Issue 已创建：
🔗 [Issue #123: Claude: [BUG] WebSocket 连接未正确关闭导致资源泄漏](...)

✅ 已自动评论 @claude 触发处理流程
```

### 示例 2：发现类型安全问题
```
🔍 正在分析项目代码...

⚠️ 随机选择问题类型: 类型安全问题

🔍 检测命令: pnpm check:type

⚠️ 发现问题：非测试文件中使用 any 类型

📍 位置：apps/backend/services/SomeService.ts:78

📊 严重程度：Medium

📝 问题描述：
非测试文件中使用 any 类型绕过类型检查，降低了代码的类型安全性。

✨ 修复方案：
```typescript
// 将 any 替换为具体的类型定义
interface ProcessOptions {
  endpoint: string;
  timeout: number;
}

function processData(options: ProcessOptions): Result {
  // ...
}
```

📮 Issue 已创建：
🔗 [Issue #124: Claude: [CODE] 非测试文件中 any 类型使用不当](...)

✅ 已自动评论 @claude 触发处理流程
```

### 示例 3：发现架构问题
```
🔍 正在分析项目代码...

⚠️ 随机选择问题类型: 架构问题

🔍 检测范围: apps/backend/services/, apps/backend/handlers/

⚠️ 发现问题：模块职责不清晰

📍 位置：apps/backend/services/StatusService.ts

📊 严重程度：Medium

📝 问题描述：
StatusService 同时负责状态管理和通知发送，违反了单一职责原则。建议将通知发送逻辑拆分到 NotificationService。

✨ 修复方案：
```typescript
// 重构 StatusService，只保留状态管理逻辑
// 将通知发送逻辑移至 NotificationService

class StatusService {
  getStatus(): ServiceStatus {
    return this.currentStatus;
  }

  updateStatus(status: ServiceStatus): void {
    this.currentStatus = status;
    // 移除通知发送逻辑
  }
}
```

📮 Issue 已创建：
🔗 [Issue #125: Claude: [ARCH] StatusService 职责不清晰](...)

✅ 已自动评论 @claude 触发处理流程
```

## 务实开发指导

### 何时报告问题
- **实际遇到问题**：当代码确实存在 bug 或风险时
- **影响可维护性**：当问题严重影响代码维护时
- **违反项目规范**：当代码明显违反 CLAUDE.md 规定时
- **安全或性能风险**：当存在安全漏洞或性能瓶颈时

### 何时不报告问题
- **预防性设计**：为了"可能的需要"而建议的改进
- **理论完美**：为了代码的"优雅"而过度抽象
- **过度优化**：在没有性能问题时优化性能
- **设计模式**：为了使用设计模式而使用

### 判断标准
在报告问题前，问自己：
1. 这个问题是否真的影响功能或维护性？
2. 这个问题是否在其他地方已经被覆盖（todos 或 open issues）？
3. 修复这个问题的收益是否大于成本？
4. 是否符合"如无必要勿增实体"的原则？
