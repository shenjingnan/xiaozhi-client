---
name: docs-creator
description: 文档创建技能，用于创建标准化的项目文档
---

# 文档创建技能

我是一个文档创建专家，专门为 xiaozhi-client 项目创建符合标准的高质量文档。

## 我的能力

当你需要创建新文档时，我会：

1. **确定文档参数** - 根据类型确定正确的文件路径和命名
2. **生成文档内容** - 创建符合项目标准的文档
3. **更新导航配置** - 自动更新文档导航
4. **执行质量检查** - 验证文档语法、链接和路径别名

## 使用方式

使用格式：`/docs-create [文档类型] [文档标题]`

**示例**：
- `/docs-create mcp-tool "Docker容器部署指南"`
- `/docs-create dev-guide "MCP Server开发详解"`
- `/docs-create api-doc "CLI命令完整参考"`
- `/docs-create user-manual "多端点配置入门"`
- `/docs-create arch-doc "独立多接入点架构设计"`

## 支持的文档类型

### mcp-tool - MCP 工具文档

- **路径**：`docs/content/guides/mcp-tools/{filename}.mdx`
- **用途**：为特定 MCP 工具或功能创建使用文档
- **模板内容**：
  - 功能介绍和适用场景
  - 配置方法和参数说明
  - 使用示例（基础和高级）
  - 常见问题和故障排除

### dev-guide - 开发指南

- **路径**：`docs/content/development/{filename}.mdx`
- **用途**：开发相关的指南文档
- **模板内容**：
  - 开发背景和目标
  - 技术架构说明
  - 实施步骤和代码示例
  - 测试方法和验证流程

### api-doc - API 参考文档

- **路径**：`docs/content/api/reference/{filename}.mdx`
- **用途**：API 接口或命令参考文档
- **模板内容**：
  - 接口或命令概述
  - 参数详解和格式说明
  - 返回值和错误码
  - 完整示例代码

### user-manual - 用户手册

- **路径**：`docs/content/getting-started/{filename}.mdx`
- **用途**：用户入门和操作指南
- **模板内容**：
  - 使用场景和目标用户
  - 操作步骤和界面说明
  - 配置选项和自定义设置
  - 常见问题解答

### arch-doc - 架构文档

- **路径**：`docs/content/architecture/{filename}.mdx`
- **用途**：系统架构和设计文档
- **模板内容**：
  - 架构概述和设计原理
  - 组件关系和数据流
  - 技术选型和权衡考虑
  - 扩展性和性能考虑

## 文档风格要求

- **简洁直白**：围绕 MCP 客户端功能，避免冗余表述
- **减少 emoji 使用**：保持技术文档专业性
- **结构清晰**：使用合适的标题层级和表格
- **代码示例**：提供完整、可运行的命令和代码示例
- **中文优先**：使用中文编写说明性内容，变量名保持英文

## 质量检查与验证

### 基础质量检查

```bash
# 拼写检查
pnpm check:spell

# 代码格式检查
pnpm lint
```

### 路径别名验证（重要！）

确保文档中的代码示例遵循 xiaozhi-client 项目规范：

1. 检查代码示例中的 import 语句
2. 检查相对路径使用情况
3. 检查 MCP 相关的导入路径（@core/*, @transports/*, @cli/* 等）

### 本地验证（重要！）

为了避免部署报错，必须在本地验证文档：

```bash
# 启动文档服务
pnpm dev:docs

# 等待服务启动后检查状态
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

验证成功标准：
- [ ] 文档服务启动无报错
- [ ] 首页返回 200 状态码
- [ ] 新创建的文档页面可以正常访问
- [ ] 无拼写和语法错误
- [ ] 代码示例格式正确
- [ ] 代码示例使用正确的 xiaozhi-client 路径别名
- [ ] 导航菜单正确显示新文档

## 代码示例规范

```typescript
// ✅ 推荐的导入示例
import { UnifiedMCPServer } from "@core/unified-server";
import { IndependentXiaozhiConnectionManager } from "@managers";
import { XiaozhiConfig } from "@/types";

// ❌ 避免相对路径
import { UnifiedMCPServer } from "../../core/unified-server";
```

## 命令行示例规范

```bash
# ✅ 使用项目实际命令
pnpm build
pnpm dev
pnpm dev:docs
xiaozhi start --config ./xiaozhi.config.json

# ❌ 避免使用不存在的命令
nr dev
npm run build
```
