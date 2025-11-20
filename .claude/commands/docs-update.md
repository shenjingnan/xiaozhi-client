---
description: 文档批量更新和路径别名修复
argument-hint: [scope] [target]
---

<scope>$1</scope>
<target>$2</target>

我需要更新现有的文档内容。请帮我完成以下任务：

## 1. 确定更新范围

根据我提供的参数 `<scope>` 和 `<target>`，请：

- **验证更新范围**：确认要更新的文档范围
- **确定目标文件**：根据参数确定具体要处理的文件
- **制定更新策略**：选择合适的更新方法

## 2. 支持的更新类型

### path-aliases - 路径别名修复
- **参数格式**：`/docs-update path-aliases [file-or-directory]`
- **作用范围**：
  - 不指定参数：扫描所有 `docs/` 下的 `.mdx` 和 `.md` 文件
  - 指定文件：更新特定文件（如 `development/docker-build.mdx`）
  - 指定目录：更新整个目录（如 `usage/`）
- **修复内容**：
  - 将相对路径 `../` 和 `./` 替换为 `@/xxx` 格式
  - 识别代码块中的 import 语句
  - 确保路径别名符合 xiaozhi-client 项目规范

### code-examples - 代码示例优化
- **参数格式**：`/docs-update code-examples [type]`
- **支持类型**：
  - `typescript` - TypeScript 代码示例
  - `javascript` - JavaScript 代码示例
  - `bash` - 命令行示例
- **优化内容**：
  - 统一代码风格
  - 添加类型注解
  - 更新为最佳实践

### format-fix - 格式修复
- **参数格式**：`/docs-update format-fix [file-or-directory]`
- **修复内容**：
  - MDX 语法错误
  - Markdown 格式问题
  - 代码块语法高亮
  - 表格格式修正

### links-update - 链接更新
- **参数格式**：`/docs-update links-update [type]`
- **更新类型**：
  - `internal` - 内部链接
  - `external` - 外部链接
  - `images` - 图片链接
- **检查内容**：
  - 链接有效性
  - 链接文本准确性
  - 锚点正确性

## 3. 路径别名映射规则

基于 xiaozhi-client 项目的复杂路径别名系统：

```typescript
// xiaozhi-client 项目别名映射
{
  "@/*": ["apps/backend/*"],                    // 后端根目录快速访问
  "@cli/*": ["apps/backend/cli/*"],             // CLI 相关代码
  "@cli/commands/*": ["apps/backend/cli/commands/*"],  // CLI 命令
  "@cli/services/*": ["apps/backend/cli/services/*"],  // CLI 服务
  "@cli/utils/*": ["apps/backend/cli/utils/*"],        // CLI 工具
  "@cli/errors/*": ["apps/backend/cli/errors/*"],      // CLI 错误处理
  "@cli/interfaces/*": ["apps/backend/cli/interfaces/*"], // CLI 接口
  "@handlers/*": ["apps/backend/handlers/*"],     // 请求处理器
  "@services/*": ["apps/backend/services/*"],     // 业务服务
  "@errors/*": ["apps/backend/errors/*"],         // 错误定义
  "@utils/*": ["apps/backend/utils/*"],           // 工具函数
  "@core/*": ["apps/backend/core/*"],             // 核心 MCP 功能
  "@transports/*": ["apps/backend/transports/*"], // 传输层适配器
  "@adapters/*": ["apps/backend/adapters/*"],     // 适配器模式
  "@managers/*": ["apps/backend/managers/*"],     // 管理器服务
  "@types/*": ["apps/backend/types/*"],           // 类型定义
  "@root/*": ["apps/backend/*"]                   // 根目录别名
}
```

### 常见修复模式
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

## 4. 更新流程

### 4.1 扫描阶段
1. **识别目标文件**：根据参数确定要处理的文件范围
2. **内容分析**：解析 MDX 文件，提取代码块
3. **问题识别**：检测需要修复的问题

### 4.2 修复阶段
1. **路径别名修复**：替换相对路径为别名格式
2. **代码示例优化**：改进代码质量和风格
3. **格式修正**：修复 MDX 语法和格式问题

### 4.3 验证阶段
1. **语法检查**：确保修复后的内容语法正确
2. **链接验证**：检查内部和外部链接的有效性
3. **本地测试**：验证文档在本地环境正常运行

## 5. 质量保证

### 5.1 修复前备份
- 自动创建修复文件的备份
- 记录修复操作日志
- 支持一键回滚

### 5.2 修复验证
```bash
# 本地验证流程（xiaozhi-client 项目）
pnpm docs:dev

# 等待服务启动后检查状态
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# 运行代码质量检查
pnpm spell:check
pnpm check:fix
pnpm type:check
```

### 5.3 修复报告
- 修复文件数量统计
- 修复问题类型分类
- 修复前后对比
- 潜在风险提示

## 6. 使用示例

### 批量修复所有文档的路径别名
```bash
/docs-update path-aliases
```

### 修复特定文件的路径别名
```bash
/docs-update path-aliases development/docker-build.mdx
```

### 修复整个目录
```bash
/docs-update path-aliases usage/
```

### 优化 TypeScript 代码示例
```bash
/docs-update code-examples typescript
```

### 修复格式问题
```bash
/docs-update format-fix getting-started/quickstart.mdx
```

### 更新内部链接
```bash
/docs-update links-update internal
```

## 7. 高级功能

### 7.1 智能检测
- 自动识别文档中的编程语言
- 根据文件路径推断正确的别名
- 识别并保留合理的相对路径使用

### 7.2 批量操作
- 支持多文件同时处理
- 提供批量预览功能
- 支持选择性应用修复

### 7.3 集成检查
- 与项目的 CI/CD 流程集成
- 自动生成修复报告
- 支持持续监控和维护

## 8. 注意事项

### 8.1 例外情况
以下相对路径使用是合理的，不会被自动修复：
- 同一目录下的紧密相关模块
- 测试文件对被测试文件的引用
- 动态导入路径

### 8.2 手动确认
对于复杂或不确定的修复，系统会：
- 标记需要手动确认的修复项
- 提供修复建议和理由
- 等待用户确认后再应用

### 8.3 回滚机制
如果修复结果不理想：
- 可以快速回滚到修复前状态
- 支持选择性撤销部分修复
- 提供修复历史记录

请根据我提供的更新类型和目标范围，执行相应的文档更新操作。