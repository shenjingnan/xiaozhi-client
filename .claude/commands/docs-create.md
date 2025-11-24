---
description: 标准化文档创建
argument-hint: [document-type] [document-title]
---

<document-type>$1</document-type>
<document-title>$2</document-title>

我需要在 xiaozhi-client 项目中创建一个新的文档。请帮我完成以下任务：

## 1. 确定文档参数

根据我提供的文档类型 `<document-type>` 和标题 `<document-title>`，请：

- **验证文档类型**：确保类型是支持的类型之一
- **确定文件路径**：根据文档类型确定正确的存放位置
- **生成文件名**：基于标题生成合适的文件名（kebab-case 格式）
- **检查导航冲突**：确保不会与现有文档路径冲突

## 2. 支持的文档类型

### mcp-tool - MCP 工具文档

- **路径**：`docs/usage/{filename}.mdx`
- **用途**：为特定 MCP 工具或功能创建使用文档
- **模板内容**：
  - 功能介绍和适用场景
  - 配置方法和参数说明
  - 使用示例（基础和高级）
  - 常见问题和故障排除
  - 相关 API 参考链接

### dev-guide - 开发指南

- **路径**：`docs/development/{filename}.mdx`
- **用途**：开发相关的指南文档
- **模板内容**：
  - 开发背景和目标
  - 技术架构说明
  - 实施步骤和代码示例
  - 测试方法和验证流程
  - 注意事项和最佳实践

### api-doc - API 参考文档

- **路径**：`docs/reference/{filename}.mdx`
- **用途**：API 接口或命令参考文档
- **模板内容**：
  - 接口或命令概述
  - 参数详解和格式说明
  - 返回值和错误码
  - 完整示例代码
  - 相关命令和工具链接

### user-manual - 用户手册

- **路径**：`docs/getting-started/{filename}.mdx`
- **用途**：用户入门和操作指南
- **模板内容**：
  - 使用场景和目标用户
  - 操作步骤和界面说明
  - 配置选项和自定义设置
  - 常见问题解答
  - 进阶使用技巧

### arch-doc - 架构文档

- **路径**：`docs/arch/{filename}.mdx` (如目录不存在则创建)
- **用途**：系统架构和设计文档
- **模板内容**：
  - 架构概述和设计原理
  - 组件关系和数据流
  - 技术选型和权衡考虑
  - 扩展性和性能考虑
  - 未来发展规划

## 3. 文档风格要求

基于 xiaozhi-client 项目文档标准：

- **简洁直白**：围绕 MCP 客户端功能，避免冗余表述
- **减少 emoji 使用**：保持技术文档专业性
- **结构清晰**：使用合适的标题层级和表格
- **代码示例**：提供完整、可运行的命令和代码示例
- **中文优先**：使用中文编写说明性内容，变量名保持英文

## 4. 自动更新导航

创建文档后，请自动更新 `docs/docs.json` 文件：

- **getting-started**：入门和快速开始文档
- **usage**：使用指南和工具文档
- **reference**：参考文档和 API 说明
- **development**：开发指南和技术文档
- **arch**：架构文档（添加到现有组或创建新组）

### 导航更新规则

```json
{
  "navigation": {
    "pages": [
      // 按字母顺序或逻辑顺序插入新页面
      "getting-started/{new-doc}",
      // 或分组
      {
        "group": "开发",
        "pages": ["development/{new-doc}", "arch/{new-doc}"]
      }
    ]
  }
}
```

## 5. 质量检查与验证

完成文档创建后，请执行以下验证步骤：

### 5.1 基础质量检查

1. **语法检查**：确保 MDX 语法正确
2. **链接检查**：验证所有内部链接有效
3. **拼写检查**：运行 `pnpm spell:check`
4. **格式检查**：运行 `pnpm check:fix` 确保代码格式正确
5. **路径别名检查**：确保代码示例使用正确的 `@/xxx` 格式路径别名

#### 5.1.5 路径别名验证（重要！）

为确保文档中的代码示例遵循 xiaozhi-client 项目规范，必须进行路径别名检查：

1. **使用 path-alias-validator 技能**：

   ```
   技能: path-alias-validator
   ```

2. **检查内容**：

   - 代码示例中的 import 语句
   - 相对路径使用情况
   - MCP 相关的导入路径（@core/_, @transports/_, @cli/\* 等）

3. **自动修复**：
   - 将相对路径替换为正确的别名格式
   - 确保路径映射符合项目配置
   - 保留合理的相对路径使用场景

### 5.2 本地验证（重要！）

为了避免部署报错，必须在本地验证文档：

1. **启动文档服务**：

   ```bash
   pnpm docs:dev
   ```

2. **等待服务启动**（约 10-15 秒）

3. **检查服务状态**：

   - 确认无编译错误
   - 确认服务启动成功（通常在 http://localhost:3000）

4. **验证页面访问**：

   ```bash
   # 测试首页访问
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

   # 测试新创建的文档页面（根据路径调整）
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/docs/[path-to-document]
   ```

5. **验证返回状态码为 200**，如果返回 500 或其他错误，需要修复问题

### 5.3 常见问题排查

如果本地验证失败：

- **MDX 语法错误**：检查组件导入是否正确，避免使用不兼容的组件
- **导航配置错误**：确保新文档已在 docs.json 中正确配置
- **Mintlify 配置问题**：检查 docs.json 文件的语法和结构
- **TypeScript 配置问题**：检查文档中的 TypeScript 代码块语法

### 5.4 验证成功标准

- [ ] 文档服务启动无报错
- [ ] 首页返回 200 状态码
- [ ] 新创建的文档页面可以正常访问
- [ ] 无拼写和语法错误
- [ ] 代码示例格式正确
- [ ] **代码示例使用正确的 xiaozhi-client 路径别名**
- [ ] **导航菜单正确显示新文档**
- [ ] **MCP 相关功能描述准确**

## 6. 特殊内容指导

### 6.1 MCP 相关文档

对于 MCP (Model Context Protocol) 相关内容：

- **术语准确性**：正确使用 MCP Server、MCP Client、Endpoint 等术语
- **配置示例**：提供完整的 xiaozhi.config.json 配置片段
- **命令示例**：使用项目实际的 CLI 命令格式
- **连接管理**：清晰说明独立多接入点架构的特点

### 6.2 代码示例规范

```typescript
// ✅ 推荐的导入示例
import { UnifiedMCPServer } from "@core/unified-server";
import { IndependentXiaozhiConnectionManager } from "@managers";
import { XiaozhiConfig } from "@/types";

// ❌ 避免相对路径
import { UnifiedMCPServer } from "../../core/unified-server";
```

### 6.3 命令行示例

```bash
# ✅ 使用项目实际命令
pnpm build
pnpm dev
pnpm docs:dev
xiaozhi start --config ./xiaozhi.config.json

# ❌ 避免使用不存在的命令
nr dev
npm run build
```

## 7. 使用示例

```bash
# 创建MCP工具使用文档
/docs-create mcp-tool "Docker容器部署指南"

# 创建开发指南
/docs-create dev-guide "MCP Server开发详解"

# 创建API参考文档
/docs-create api-doc "CLI命令完整参考"

# 创建用户手册
/docs-create user-manual "多端点配置入门"

# 创建架构文档
/docs-create arch-doc "独立多接入点架构设计"
```

## 8. 文档模板示例

### MCP 工具文档模板

````mdx
---
title: "工具名称使用指南"
description: "详细介绍如何在小智客户端中使用特定功能"
---

# 功能名称

## 概述

简要说明功能的用途和适用场景

## 配置方法

### 基础配置

展示最小可用配置

### 高级配置

展示所有可选配置项

## 使用示例

### 基础用法

```bash
# 命令示例
```
````

### 高级用法

```typescript
// 代码示例
```

## 常见问题

解答用户可能遇到的常见问题

## 相关文档

- [相关功能文档](/docs/相关链接)
- [API 参考](/docs/reference/相关API)

```

请根据我提供的文档类型和标题，创建符合 xiaozhi-client 项目标准的高质量文档。
```
