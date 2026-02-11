---
name: docs-updater
description: 文档更新技能，用于批量更新文档和修复路径别名
---

# 文档更新技能

我是一个文档更新专家，专门批量更新现有文档内容并修复路径别名问题。

## 我的能力

当你需要更新现有文档时，我会：

1. **确定更新范围** - 根据参数确定要处理的文件范围
2. **扫描并分析** - 识别需要修复的问题
3. **执行修复** - 应用修复和更新
4. **验证结果** - 确保修复后文档正常工作

## 使用方式

使用格式：`/docs-update [更新类型] [目标]`

**示例**：
- `/docs-update path-aliases` - 批量修复所有文档的路径别名
- `/docs-update path-aliases development/docker-build.mdx` - 修复特定文件
- `/docs-update path-aliases usage/` - 修复整个目录
- `/docs-update code-examples typescript` - 优化 TypeScript 代码示例
- `/docs-update format-fix getting-started/quickstart.mdx` - 修复格式问题
- `/docs-update links-update internal` - 更新内部链接

## 支持的更新类型

### path-aliases - 路径别名修复

- **作用范围**：
  - 不指定参数：扫描所有 `docs/` 下的 `.mdx` 和 `.md` 文件
  - 指定文件：更新特定文件
  - 指定目录：更新整个目录

- **修复内容**：
  - 将相对路径 `../` 和 `./` 替换为 `@/xxx` 格式
  - 识别代码块中的 import 语句
  - 确保路径别名符合 xiaozhi-client 项目规范

### code-examples - 代码示例优化

- **支持类型**：`typescript`、`javascript`、`bash`
- **优化内容**：
  - 统一代码风格
  - 添加类型注解
  - 更新为最佳实践

### format-fix - 格式修复

- **修复内容**：
  - MDX 语法错误
  - Markdown 格式问题
  - 代码块语法高亮
  - 表格格式修正

### links-update - 链接更新

- **更新类型**：`internal`、`external`、`images`
- **检查内容**：
  - 链接有效性
  - 链接文本准确性
  - 锚点正确性

## 路径别名映射规则

基于 xiaozhi-client 项目的路径别名系统：

```typescript
// xiaozhi-client 项目别名映射
{
  "@/*": ["apps/backend/*"],                    // 后端根目录快速访问
  "@cli/*": ["packages/cli/*"],                 // CLI 相关代码
  "@handlers/*": ["apps/backend/handlers/*"],     // 请求处理器
  "@services/*": ["apps/backend/services/*"],     // 业务服务
  "@errors/*": ["apps/backend/errors/*"],         // 错误定义
  "@utils/*": ["apps/backend/utils/*"],           // 工具函数
  "@core/*": ["apps/backend/core/*"],             // 核心 MCP 功能
  "@transports/*": ["apps/backend/transports/*"], // 传输层适配器
  "@adapters/*": ["apps/backend/adapters/*"],     // 适配器模式
  "@managers/*": ["apps/backend/managers/*"],     // 管理器服务
  "@types/*": ["apps/backend/types/*"]            // 类型定义
}
```

## 常见修复模式

```typescript
// ❌ 需要修复的相对路径
import { Service } from "../services/file";
import { Command } from "./commands/help";
import { Type } from "../../types/interface";
import { util } from "./utils/helper";
import { Transport } from "../transports/websocket";
import { Core } from "../../core/unified-server";

// ✅ 修复后的别名路径（xiaozhi-client 项目）
import { Service } from "@/services/file";
import { Command } from "@cli/commands/help";
import { Type } from "@/types/interface";
import { util } from "@/utils/helper";
import { Transport } from "@transports/websocket";
import { Core } from "@/core/unified-server";
```

## 更新流程

### 扫描阶段

1. **识别目标文件**：根据参数确定要处理的文件范围
2. **内容分析**：解析 MDX 文件，提取代码块
3. **问题识别**：检测需要修复的问题

### 修复阶段

1. **路径别名修复**：替换相对路径为别名格式
2. **代码示例优化**：改进代码质量和风格
3. **格式修正**：修复 MDX 语法和格式问题

### 验证阶段

```bash
# 本地验证流程
pnpm dev:docs

# 等待服务启动后检查状态
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# 运行代码质量检查
pnpm check:spell
pnpm lint
pnpm check:type
```

## 注意事项

### 例外情况

以下相对路径使用是合理的，不会被自动修复：
- 同一目录下的紧密相关模块
- 测试文件对被测试文件的引用
- 动态导入路径

### 手动确认

对于复杂或不确定的修复：
- 标记需要手动确认的修复项
- 提供修复建议和理由
- 等待用户确认后再应用
