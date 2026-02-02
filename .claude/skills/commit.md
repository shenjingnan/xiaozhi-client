---
description: 生成代码评审友好的 commit 信息
---

我是 Git Commit 生成技能，专门为 xiaozhi-client 项目生成符合规范的、代码评审友好的 commit 信息，同时遵循务实开发理念。

### 技能使用原则
- **真实准确，但避免过度详细**：基于实际代码改动生成信息，不虚构不存在的细节
- **评审友好优先，格式完美次之**：让评审人快速理解改动比完美格式更重要
- **简单明确优于复杂说明**：优先选择清晰直接的描述方式
- **务实开发指导**：突出"为什么改"和"改了什么"两个核心问题

## 技能能力

### 1. 代码改动分析
核心能力：分析实际的代码改动，提取关键信息用于生成 commit 信息。

#### 分析流程
```bash
# 1. 更新远程分支信息
git fetch origin

# 2. 获取主分支名称
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')

# 3. 获取改动内容（优先检查未 add 的改动）
git diff --no-pager
git diff --cached --no-pager

# 4. 获取相对于主分支的改动
git diff --no-pager origin/$MAIN_BRANCH...HEAD
```

#### 分析要点
- **改动范围**：哪些文件、模块被修改
- **改动类型**：新增功能、修复 bug、重构、文档更新等
- **影响分析**：改动对现有功能的影响
- **验证方式**：如何验证改动的正确性

### 2. Commit 类型判断
根据改动内容自动判断合适的 commit 类型。

#### Type 类型定义
- `feat`：新增 feature
- `fix`：修复 bug
- `docs`：仅仅修改了文档，比如 README、CHANGELOG、CONTRIBUTE 等等
- `style`：仅仅修改了空格、格式缩进、逗号等等，不改变代码逻辑
- `refactor`：代码重构，没有加新功能或者修复 bug
- `perf`：优化相关，比如提升性能、体验
- `test`：测试用例，包括单元测试、集成测试等
- `chore`：改变构建流程、或者增加依赖库、工具等
- `revert`：回滚到上一个版本

#### 类型判断示例
```typescript
// feat 判断标准
// - 新增文件
// - 新增公共方法
// - 新增配置选项
// - 新增 API 端点

// fix 判断标准
// - 修复 bug
// - 修复内存泄漏
// - 修复崩溃问题
// - 修复类型错误

// refactor 判断标准
// - 代码结构调整
// - 变量重命名
// - 代码提取/合并
// - 类型定义优化

// test 判断标准
// - 新增测试用例
// - 修复测试用例
// - 提高测试覆盖率
```

### 3. 分支名称生成
根据改动内容生成符合规范的分支名称。

#### 分支命名规范
- **前缀类型**：`feature/`、`bugfix/`、`docs/`、`test/`、`refactor/`、`chore/`
- **格式要求**：kebab-case 格式，简洁反映改动内容
- **长度限制**：不超过 50 字符

#### 分支命名示例
```bash
# 功能开发
feature/add-user-auth-api
feature/implement-websocket-adapter
feature/support-modelscope-integration

# Bug 修复
bugfix/fix-memory-leak
bugfix/fix-type-error-in-mcp-service
bugfix/fix-connection-timeout-issue

# 文档更新
docs/update-readme-installation
docs/add-mcp-protocol-guide

# 测试相关
test/add-unit-tests-for-connection-manager
test-improve-test-coverage

# 重构
refactor-simplify-mcp-manager
refactor-optimize-path-alias-system
```

### 4. Commit 信息生成
生成符合代码评审友好的 commit 信息。

#### Commit 信息结构
```
<type>(<scope>): <subject>

## 改动说明
- 为什么改：<改动动机和问题背景>
- 改了什么：<具体的改动内容>
- 影响范围：<受影响的模块和兼容性>
- 验证方式：<测试方法或验证点>
```

#### 输出格式
```text
<分支名称>
```

```text
<type>(<scope>): <subject>

## 改动说明
- 为什么改：<改动动机和问题背景>
- 改了什么：<具体的改动内容>
- 影响范围：<受影响的模块和兼容性>
- 验证方式：<测试方法或验证点>
```

## Commit 示例

### 示例 1：功能开发
```text
feature/add-user-auth-api
```

```text
feat(api): 新增用户认证接口

## 改动说明
- 为什么改：提升系统安全性，实现基于 JWT 的用户认证
- 改了什么：新增 UserAuthController，实现 register、login、refresh-token 接口
- 影响范围：新增 /api/auth/* 路由，需要前端适配认证流程
- 验证方式：新增 15 个单元测试，集成测试验证完整流程
```

### 示例 2：Bug 修复
```text
bugfix/fix-memory-leak
```

```text
fix(core): 修复内存泄漏导致的性能问题

## 改动说明
- 为什么改：生产环境发现内存持续增长导致服务崩溃
- 改了什么：修复 EventEmitter 监听器未移除问题，优化内存管理
- 影响范围：核心服务内存使用优化约 30%，API 接口保持不变
- 验证方式：24 小时压力测试验证内存稳定性
```

### 示例 3：代码重构
```text
refactor/simplify-mcp-manager
```

```text
refactor(mcp): 简化 MCP 服务管理器实现

## 改动说明
- 为什么改：原实现过于复杂（340 行），包含不必要的互斥锁和状态管理
- 改了什么：移除复杂的并发控制，简化为直接的单例实现（133 行）
- 影响范围：功能保持完整，大幅降低维护成本，API 保持向后兼容
- 验证方式：所有现有测试通过，功能验证正常
```

### 示例 4：测试相关
```text
test/add-connection-manager-tests
```

```text
test(mcp): 补充连接管理器的单元测试

## 改动说明
- 为什么改：连接管理器模块测试覆盖率不足
- 改了什么：新增 12 个测试用例，覆盖核心功能和边界情况
- 影响范围：测试覆盖率从 65% 提升至 85%
- 验证方式：所有新增测试通过，覆盖率报告符合要求
```

### 示例 5：文档更新
```text
docs/update-mcp-protocol-guide
```

```text
docs(mcp): 更新 MCP 协议集成文档

## 改动说明
- 为什么改：现有文档未包含最新的 ModelScope 集成说明
- 改了什么：新增 ModelScope 配置章节，更新示例代码
- 影响范围：仅文档更新，不影响代码功能
- 验证方式：文档本地渲染验证，链接检查通过
```

## 生成 Commit 时的注意事项

### 1. 真实性原则
- **基于实际改动**：不要虚构不存在的内容
- **避免夸大**：如实描述改动，不过度宣传
- **技术准确**：确保技术实现描述的准确性和专业性

### 2. 评审友好原则
- **突出重点**：评审人最关心的是"为什么改"和"改了什么"
- **具体明确**：避免模糊的描述，如"优化了性能"应具体说明如何优化
- **结构清晰**：按照模板结构组织信息，便于快速阅读

### 3. 格式规范
- **标题简洁**：commit 标题不超过 50 字符
- **使用中文**：所有 commit 信息必须使用中文
- **忽略分支名**：不参考当前分支名称（通常不具有参考价值）
- **不执行提交**：仅提供 commit 信息建议，不执行实际的 git commit 操作

## xiaozhi-client 项目特定规范

### 1. 路径别名系统
项目使用复杂的路径别名系统，commit 信息中应正确引用：

```typescript
// 常见 scope 定义
- cli: CLI 层 (packages/cli/)
- core: 核心 MCP 层 (apps/backend/core/)
- transport: 传输层 (apps/backend/transports/)
- service: 服务层 (apps/backend/services/)
- manager: 管理器 (apps/backend/managers/)
- handler: 处理器层 (apps/backend/handlers/)
- utils: 工具层 (apps/backend/utils/)
- types: 类型定义 (apps/backend/types/)
- test: 测试相关
- docs: 文档相关
- build: 构建相关
```

### 2. 常见改动模式
```typescript
// MCP 服务相关改动
feat(mcp): 支持新增的 MCP 服务器
fix(mcp): 修复 MCP 连接超时问题
refactor(mcp): 重构 MCP 服务管理器

// CLI 相关改动
feat(cli): 新增配置验证命令
fix(cli): 修复命令行参数解析错误

// Web UI 相关改动
feat(web): 新增服务配置界面
fix(web): 修复 WebSocket 连接断开问题

// 配置相关改动
feat(config): 支持环境变量配置
fix(config): 修复配置文件解析错误

// 测试相关改动
test(mcp): 补充 MCP 协议集成测试
test(cli): 新增命令行工具测试
```

### 3. 与项目开发理念一致
- **功能驱动**：commit 信息应体现"需要什么功能就实现什么功能"
- **优雅实现**：描述代码如何清晰、可维护、结构合理
- **避免过度设计**：不提及为了"未来可能需要"而增加的复杂度
- **务实开发**：反映"先实现功能，遇到问题再优化"的开发方式

## 质量检查清单

生成 commit 信息后，应检查以下项目：

- [ ] commit 标题符合 git 规范，简洁明确，不超过 50 字符
- [ ] 类型选择正确（feat/fix/refactor/test/docs 等）
- [ ] scope 准确反映改动模块
- [ ] 改动说明包含"为什么改"、"改了什么"、"影响范围"、"验证方式"
- [ ] 所有内容使用中文
- [ ] 基于实际代码改动，无虚构内容
- [ ] 技术描述准确专业
- [ ] 分支名称符合规范（前缀 + kebab-case）
- [ ] 便于代码评审人快速理解改动

## 使用方式

当需要生成 commit 信息时：

1. **确保代码已暂存**：`git add` 需要提交的文件
2. **调用此技能**：`/commit` 或 `skill: commit`
3. **分析输出结果**：获取分支名称建议和 commit 信息
4. **使用建议的 commit**：`git commit -m "<commit 信息>"`
5. **创建分支（如需要）**：`git checkout -b <分支名称>`

## 集成方式

### 1. Git 别名
```bash
# 设置 commit 生成别名
git config --global alias.gencommit '!git add -A && echo "请使用 /commit 技能生成 commit 信息"'
```

### 2. 与其他技能配合
- **type-validator**：修复类型错误后再生成 commit
- **localization-validator**：确保本地化符合要求
- **ci-validator**：commit 前运行完整质量检查

通过这个技能，可以确保 xiaozhi-client 项目的 commit 信息始终保持高质量，便于代码评审和项目维护，同时符合务实开发理念。
