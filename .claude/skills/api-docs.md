---
description: 文档自动生成
---

我是 API 文档自动生成技能，专门从 xiaozhi-client 项目的源代码中提取 API 信息，生成符合 Nextra (Next.js) 标准的 MDX 文档，同时遵循务实开发理念。

### 技能使用原则
- **保持文档质量，但避免过度复杂**：生成清晰有用的文档，但不追求完美的文档结构
- **实用功能优先，理论完美次之**：解决实际的文档需求比完美的文档设计更重要
- **简单解决方案优于复杂方案**：优先选择直接有效的文档生成方式
- **务实开发指导**：评估文档的必要性，避免为了文档而文档

## 技能能力

### 1. 源代码分析
深度解析 TypeScript/JavaScript 源代码，提取 API 相关信息：

#### 支持的代码元素
- **类和方法**：使用 `@Tool` 装饰器的方法
- **函数接口**：纯函数和工具方法
- **类型定义**：接口、类型别名、枚举
- **参数信息**：使用 `@Param` 装饰器的参数定义
- **注释文档**：JSDoc 格式的代码注释

#### 解析能力
```typescript
// 示例源代码
@Tool("控制灯光设备 - 支持通过名称控制灯光设备的开关、亮度和色温")
public async LightControl(
  @Param(z.string().describe("灯光设备名称"))
  name: string,
  @Param(z.enum(["turn_on", "turn_off"]).describe("控制动作"))
  action: "turn_on" | "turn_off",
  @Param(z.number().min(1).max(100).optional().describe("亮度百分比"))
  brightnessPct?: number
) {
  // 实现逻辑...
}

// 提取的信息
{
  name: "LightControl",
  description: "控制灯光设备 - 支持通过名称控制灯光设备的开关、亮度和色温",
  parameters: [
    {
      name: "name",
      type: "string",
      description: "灯光设备名称",
      required: true
    },
    {
      name: "action",
      type: "turn_on | turn_off",
      description: "控制动作",
      required: true
    },
    {
      name: "brightnessPct",
      type: "number",
      description: "亮度百分比",
      required: false,
      constraints: { min: 1, max: 100 }
    }
  ]
}
```

### 2. MDX 文档生成
基于提取的信息生成符合 xiaozhi-client 项目标准的 Nextra MDX 文档。

#### 文档结构模板
```mdx
# {ToolName}

## 工具介绍

{工具描述}

## 参数定义

| 参数 | 类型 | 范围 | 说明 |
|------|------|------|------|
{参数表格}

## 使用示例

### 基础用法
{基础示例代码}

### 高级功能
{高级示例代码}

## 错误信息

| 错误类型 | 错误信息 | 处理建议 |
|----------|----------|----------|
{错误表格}

## 返回值格式

### 成功响应
{成功响应示例}

### 错误响应
{错误响应示例}
```

### 3. 类型信息集成
从类型定义文件中提取相关类型信息，增强文档的完整性。

#### 类型文档化
```typescript
// 源类型定义
export interface LightControlParams {
  entity_id: string;
  action: LightActionType;
  brightness?: number;
  transition?: number;
}

export type LightActionType = "turn_on" | "turn_off" | "toggle";

// 生成的类型文档
### LightControlParams
灯光控制参数接口

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| entity_id | string | 是 | 灯光设备实体ID |
| action | LightActionType | 是 | 控制动作类型 |
| brightness | number | 否 | 亮度百分比 (1-100) |
| transition | number | 否 | 渐变时间(秒) |

### LightActionType
灯光控制动作类型

**可选值：**
- `"turn_on"` - 开灯
- `"turn_off"` - 关灯
- `"toggle"` - 切换开关状态
```

### 4. 示例代码生成
基于 API 定义生成实际可运行的示例代码。

#### 代码示例模板
```typescript
// 基础示例
// 开启客厅主灯
LightControl("客厅主灯", "turn_on");

// 高级示例
// 开启灯光并设置亮度和渐变效果
LightControl("客厅主灯", "turn_on", 80, undefined, 2);

// 错误处理示例
try {
  const result = await LightControl("不存在的设备", "turn_on");
  console.log("操作成功:", result);
} catch (error) {
  console.error("操作失败:", error.message);
}
```

## 解析规则

### 1. 装饰器解析
```typescript
// @Tool 装饰器解析
@Tool(description: string)
// 提取：工具描述信息

// @Param 装饰器解析
@Param(zSchema, description: string)
// 提取：参数类型、验证规则、描述信息
```

### 2. JSDoc 注释解析
```typescript
/**
 * 通过名称控制灯光设备
 * @param name 灯光设备名称
 * @param action 控制动作 枚举值：turn_on | turn_off
 * @param brightnessPct 亮度百分比 (1-100)，可选参数
 * @returns Promise<LightControlResult> 控制结果
 * @example
 * ```typescript
 * LightControl("书房小灯", "turn_on", 80);
 * ```
 */
// 提取：功能描述、参数说明、返回值、使用示例
```

### 3. 路径别名解析
```typescript
// 支持 xiaozhi-client 项目的复杂路径别名系统
import { UnifiedMCPServer } from "@core/unified-server";
import { StartCommand } from "@cli/commands/start";
import { WebSocketAdapter } from "@transports/websocket";
import type { XiaozhiConfig } from "@/types";

// 提取：模块路径信息，用于生成导航和链接
// 支持：@cli/*, @core/*, @transports/*, @managers/*, @services/*, @types/*, @utils/*
```

### 4. 类型定义解析
```typescript
// 接口定义
export interface LightControlResult {
  success: boolean;
  entity_id: string;
  action: string;
  changed_states?: HassState[];
  errors?: string[];
}

// 枚举定义
export enum LightActionType {
  TURN_ON = "turn_on",
  TURN_OFF = "turn_off"
}

// 类型别名
export type DeviceState = "on" | "off" | "unavailable";
// 提取：完整的类型信息和文档
```

## 生成流程

### 1. 源码扫描
```typescript
interface ScanOptions {
  include: string[];      // 包含的文件模式
  exclude: string[];      // 排除的文件模式
  tools: boolean;         // 是否扫描工具方法
  types: boolean;         // 是否扫描类型定义
  examples: boolean;      // 是否生成示例
}

const scanResult = scanSourceCode(options);
```

### 2. 信息提取
```typescript
interface ExtractedInfo {
  tools: ToolInfo[];
  types: TypeInfo[];
  examples: ExampleInfo[];
  relationships: RelationshipInfo[];
}

const extractedInfo = extractApiInfo(scanResult);
```

### 3. 文档生成
```typescript
interface GenerationOptions {
  template: string;       // 文档模板路径
  output: string;         // 输出目录
  format: 'mdx' | 'md';   // 输出格式
  navigation: boolean;    // 是否更新导航
}

const generatedDocs = generateDocumentation(extractedInfo, options);
```

### 4. 导航更新
```typescript
// 自动更新 meta.json 文件（Nextra 导航配置）
function updateNavigation(docs: GeneratedDoc[]): void {
  const metaJsonPath = 'docs/meta.json';
  const currentConfig = readFileSync(metaJsonPath, 'utf8');
  const updatedConfig = insertIntoNavigation(currentConfig, docs);
  writeFileSync(metaJsonPath, updatedConfig);
}

function insertIntoNavigation(config: string, docs: GeneratedDoc[]): string {
  const parsed = JSON.parse(config);
  // 根据文档类型插入到合适的导航位置
  // MCP 工具文档 -> 使用指南，API 参考 -> 开发指南
  return JSON.stringify(parsed, null, 2);
}
```

## 模板系统

### 1. 工具文档模板
```handlebars
# {{toolName}}

## 工具介绍

{{description}}

## 参数定义

| 参数 | 类型 | 范围 | 说明 |
|------|------|------|------|
{{#each parameters}}
| {{name}} | {{type}} | {{constraints}} | {{description}} |
{{/each}}

## 使用示例

{{#each examples}}
### {{title}}
```typescript
{{code}}
```
{{/each}}

{{#if errors}}
## 错误信息

| 错误类型 | 错误信息 | 处理建议 |
|----------|----------|----------|
{{#each errors}}
| {{type}} | {{message}} | {{suggestion}} |
{{/each}}
{{/if}}
```

### 2. 类型文档模板
```handlebars
## {{typeName}}

{{description}}

{{#if properties}}
### 属性

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
{{#each properties}}
| {{name}} | {{type}} | {{required}} | {{description}} |
{{/each}}
{{/if}}

{{#if values}}
### 可选值

{{#each values}}
- `{{value}}` - {{description}}
{{/each}}
{{/if}}
```

### 3. 示例代码模板
```typescript
// 基础用法示例
function generateBasicExample(tool: ToolInfo): string {
  const requiredParams = tool.parameters.filter(p => p.required);
  const paramValues = requiredParams.map(p => getExampleValue(p));

  return `${tool.name}(${paramValues.join(', ')});`;
}

// 完整功能示例
function generateAdvancedExample(tool: ToolInfo): string {
  const allParams = tool.parameters;
  const paramValues = allParams.map(p => getExampleValue(p));

  return `const result = await ${tool.name}(${paramValues.join(', ')});\n` +
         `console.log('操作结果:', result);`;
}
```

## 配置选项

### 1. 全局配置
```typescript
interface ApiDocConfig {
  input: {
    sourceDir: string;        // 源码目录
    patterns: string[];       // 文件匹配模式
  };
  output: {
    docsDir: string;          // 文档输出目录
    format: 'mdx' | 'md';     // 输出格式
    templateDir?: string;     // 自定义模板目录
  };
  generation: {
    includeExamples: boolean; // 是否生成示例
    includeTypes: boolean;    // 是否包含类型文档
    updateNavigation: boolean; // 是否更新导航
  };
  formatting: {
    codeTheme: string;        // 代码主题
    tableStyle: 'github' | 'gitlab'; // 表格样式
    useEmojis: boolean;       // 是否使用表情符号
  };
}
```

### 2. 工具特定配置
```typescript
interface ToolConfig {
  name: string;
  category: string;
  tags: string[];
  examples: ExampleConfig[];
  relatedTools: string[];
  deprecated?: boolean;
  experimental?: boolean;
}
```

## 质量保证

### 1. 文档验证
```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100 文档质量评分
}

function validateDocumentation(docs: GeneratedDoc[]): ValidationResult {
  // 检查文档完整性
  // 验证链接有效性
  // 检查代码示例正确性
  // 评估文档质量
}
```

### 2. 自动化测试
```typescript
// 测试生成的示例代码
async function testExamples(examples: CodeExample[]): Promise<TestResult[]> {
  const results = [];

  for (const example of examples) {
    try {
      const result = await executeExample(example);
      results.push({ example, success: true, result });
    } catch (error) {
      results.push({ example, success: false, error });
    }
  }

  return results;
}
```

### 3. 持续同步
```typescript
// 监听源码变化，自动更新文档
function setupDocumentationSync(): void {
  watch(sourceFiles, (filePath) => {
    const changes = detectChanges(filePath);
    if (changes.affectsApi) {
      regenerateDocumentation(changes);
    }
  });
}
```

## 集成方式

### 1. CLI 命令
```bash
# 生成所有API文档
api-docs generate

# 生成特定工具的文档
api-docs generate --tool LightControl

# 监听模式，自动更新
api-docs generate --watch

# 验证文档质量
api-docs validate

# 生成覆盖率报告
api-docs coverage
```

### 2. 构建集成
```json
{
  "scripts": {
    "docs:generate": "api-docs generate",
    "docs:validate": "api-docs validate",
    "docs:watch": "api-docs generate --watch"
  }
}
```

### 3. CI/CD 集成
```yaml
# GitHub Actions 示例
- name: Generate API Documentation
  run: |
    api-docs generate
    api-docs validate

- name: Deploy Documentation
  run: |
    # 部署生成的文档到文档站点
```

## 最佳实践

### 1. 文档编写规范
- 使用清晰简洁的描述
- 提供完整的使用示例
- 包含错误处理说明
- 保持文档与代码同步

### 2. 示例代码要求
- 代码必须可运行
- 包含常见使用场景
- 展示最佳实践
- 有适当的错误处理

### 3. 版本管理
- 记录API变更历史
- 标记废弃功能
- 提供迁移指南
- 维护向后兼容性

通过这个技能，可以确保 xiaozhi-client 项目的 API 文档始终保持最新、准确和高质量，提升开发者体验和项目可维护性。特别适配 Nextra (Next.js) 文档系统和项目的复杂路径别名结构。

## Nextra 特定说明

### 导航配置
- 使用 `docs/meta.json` 管理文档导航结构
- 支持多层级嵌套和分组
- 自动根据文件路径生成导航树

### 文档放置
- MCP 工具文档：`docs/content/guides/mcp-tools/*.mdx`
- API 参考文档：`docs/content/api/reference/*.mdx`
- 开发指南：`docs/content/development/*.mdx`

### Front Matter 支持
```yaml
---
title: 工具名称
description: 工具描述
---
```
