---
description: TypeScript严格模式检查
---

我是 TypeScript 严格模式检查技能，专门针对 xiaozhi-client 项目的 TypeScript 配置进行类型安全检查和修复建议，同时遵循务实开发理念。

### 技能使用原则
- **保持类型安全，但避免过度抽象**：确保代码类型正确，但不追求完美的类型设计
- **实用功能优先，理论完美次之**：解决实际的类型问题比预防所有可能更重要
- **简单解决方案优于复杂方案**：优先选择直接有效的类型定义方式
- **务实开发指导**：评估类型定义的必要性，避免过度设计

## 技能能力

### 1. any 类型检测与修复
核心能力：检测并修复所有 `any` 类型的使用，符合项目的严格类型要求。

#### 检测范围
- **变量声明**：`const/let/var` 声明的 any 类型
- **函数参数**：参数类型为 any 的情况
- **返回值类型**：函数返回值类型为 any
- **对象属性**：对象属性的类型为 any
- **数组元素**：数组元素的 any 类型
- **类型断言**：不安全的类型断言使用

#### 修复策略
```typescript
// ❌ 原始代码
function process(data: any): any {
  return data.value;
}

// ✅ 修复后（xiaozhi-client 项目标准）
function process<T extends Record<string, unknown>>(data: T): T[keyof T] {
  return data.value as T[keyof T];
}

// MCP 相关的修复示例
// ❌ 原始代码
function handleMCPMessage(message: any): any {
  return { id: message.id, result: "processed" };
}

// ✅ 修复后
function handleMCPMessage(message: MCPRequest): MCPResponse {
  return {
    jsonrpc: "2.0",
    id: message.id,
    result: "processed"
  };
}
```

### 2. 类型定义完整性检查
确保所有接口、类型定义和函数都有完整的类型注解。

#### 检查项目
- **接口属性**：确保所有属性都有明确的类型
- **可选属性**：正确使用 `?` 标记可选属性
- **函数签名**：完整的参数和返回值类型
- **泛型使用**：合理的泛型约束和使用
- **类型守卫**：提供运行时类型检查

#### 类型补全示例
```typescript
// 不完整的类型定义
interface User {
  name: string;
  // age 类型缺失
  address?: any; // 使用 any 类型
}

// 完整的类型定义
interface User {
  name: string;
  age: number;
  address?: {
    street: string;
    city: string;
    zipCode: string;
  };
}
```

### 3. Zod 验证集成
确保运行时验证与 TypeScript 类型定义的一致性。

#### 验证检查
- **Schema 匹配**：Zod schema 与 TypeScript 接口的对应关系
- **验证逻辑**：运行时验证的完整性和正确性
- **错误处理**：验证失败时的错误处理逻辑
- **类型推断**：Zod 的 `z.infer` 类型使用

#### 集成示例
```typescript
import { z } from "zod";

// TypeScript 接口
interface LightControlParams {
  name: string;
  action: "turn_on" | "turn_off";
  brightness?: number;
}

// Zod 验证 Schema
const lightControlSchema = z.object({
  name: z.string(),
  action: z.enum(["turn_on", "turn_off"]),
  brightness: z.number().min(1).max(100).optional(),
});

// 类型推断确保一致性
type LightControlParams = z.infer<typeof lightControlSchema>;
```

### 4. 路径别名类型检查
确保 xiaozhi-client 项目复杂路径别名系统的类型安全，避免别名使用导致的类型错误。

#### 别名一致性检查
```typescript
// 检查别名导入的类型定义（xiaozhi-client 项目标准）
import { UnifiedMCPServer } from "@core/unified-server";
import { IndependentXiaozhiConnectionManager } from "@managers";
import { StartCommand } from "@cli/commands/start";
import { WebSocketAdapter } from "@transports/websocket";
import type { XiaozhiConfig } from "@/types";

// 验证导入的模块是否具有正确的类型定义
// 确保所有别名指向 apps/backend/ 下的正确文件
```

#### 类型别名映射验证
```typescript
// 确保 xiaozhi-client 项目别名映射不会导致类型冲突
interface XiaozhiClientTypeMapping {
  "@/*": "./apps/backend/*";
  "@cli/*": "./apps/backend/cli/*";
  "@cli/commands/*": "./apps/backend/cli/commands/*";
  "@core/*": "./apps/backend/core/*";
  "@transports/*": "./apps/backend/transports/*";
  "@managers/*": "./apps/backend/managers/*";
  "@services/*": "./apps/backend/services/*";
  "@types/*": "./apps/backend/types/*";
  "@utils/*": "./apps/backend/utils/*";
}

// 验证映射的正确性和类型完整性
```

### 5. Biome 配置集成
与现有的 Biome 代码检查工具集成，确保类型检查与代码规范的一致性。

#### 配置同步
- **noExplicitAny** 规则：检查 any 类型使用
- **路径别名支持**：确保 Biome 能正确解析别名路径
- **noUnusedVariables**：检查未使用的变量
- **noImplicitReturns**：确保函数返回值类型明确
- **exactOptionalPropertyTypes**：精确的可选属性类型

## 检查规则详解

### 1. any 类型替换规则

#### 使用 unknown 替代 any
```typescript
// 代码前
function processData(data: any): any {
  return JSON.parse(data);
}

// 代码后
function processData(data: unknown): unknown {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  throw new Error('Invalid data type');
}
```

#### 使用联合类型
```typescript
// 代码前
function setValue(value: any) {
  // ...
}

// 代码后
function setValue(value: string | number | boolean) {
  // ...
}
```

#### 使用泛型
```typescript
// 代码前
function createResponse(data: any, status: any) {
  return { data, status };
}

// 代码后
function createResponse<T, U extends number>(data: T, status: U) {
  return { data, status };
}
```

### 2. 类型守卫函数

#### 基础类型守卫
```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
```

#### 对象类型守卫
```typescript
function isMCPRequest(value: unknown): value is MCPRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'jsonrpc' in value &&
    (value as any).jsonrpc === '2.0' &&
    'id' in value &&
    'method' in value
  );
}

function isXiaozhiConfig(value: unknown): value is XiaozhiConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('mcpEndpoint' in value || 'mcpServers' in value)
  );
}

function isTransportAdapter(value: unknown): value is TransportAdapter {
  return (
    typeof value === 'object' &&
    value !== null &&
    'connect' in value &&
    'disconnect' in value &&
    'send' in value
  );
}
```

### 3. 错误处理类型安全

#### 自定义错误类型
```typescript
export class ValidationError extends Error {
  public readonly code: string;
  public readonly field?: string;

  constructor(message: string, code: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    if (field !== undefined) {
      this.field = field;
    }
  }
}
```

#### 类型安全的结果类型
```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function safeParse<T>(data: unknown, schema: z.Schema<T>): Result<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: new ValidationError(error.message, 'VALIDATION_ERROR') };
    }
    return { success: false, error: error as Error };
  }
}
```

## 修复流程

### 1. 扫描阶段
```typescript
interface TypeIssue {
  type: 'any_usage' | 'missing_type' | 'invalid_cast' | 'unsafe_assignment';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  message: string;
  suggestion: string;
}

const issues: TypeIssue[] = scanTypeIssues(sourceCode);
```

### 2. 分析阶段
```typescript
interface TypeAnalysis {
  anyUsageCount: number;
  missingTypes: string[];
  invalidCasts: Array<{ from: string; to: string; line: number }>;
  unsafeAssignments: Array<{ variable: string; type: string; line: number }>;
  recommendations: string[];
}

const analysis = analyzeTypeIssues(issues);
```

### 3. 修复阶段
```typescript
interface FixResult {
  fixedIssues: number;
  remainingIssues: TypeIssue[];
  modifiedFiles: string[];
  warnings: string[];
}

const result = applyTypeFixes(analysis, options);
```

## 自动化修复

### 1. 简单 any 类型替换
```typescript
// 自动替换规则
const replacementRules = [
  {
    pattern: /const\s+(\w+)\s*:\s*any\s*=/,
    replacement: (match, varName) => `const ${varName}: unknown =`
  },
  {
    pattern: /function\s+(\w+)\s*\([^)]*\)\s*:\s*any\s*{/,
    replacement: (match, fnName) => `function ${fnName}(): unknown {`
  }
];
```

### 2. 类型推断补全
```typescript
// 自动添加类型注解
function inferAndAddTypes(ast: ASTNode): TypeAnnotation[] {
  // 基于 AST 分析推断类型
  // 生成适当的类型注解
}
```

### 3. 导入类型整理
```typescript
// 自动整理和优化类型导入
function organizeTypeImports(sourceFile: SourceFile): void {
  // 确保所有必要的类型都已导入
  // 移除未使用的类型导入
  // 按照项目规范排序导入语句
}
```

## 质量保证

### 1. 检查命令
```bash
# 运行类型检查（xiaozhi-client 项目）
pnpm type-check

# 运行代码规范和格式检查
pnpm lint

# 运行拼写检查
pnpm spell:check

# 运行所有质量检查
pnpm check:all

# 运行测试并检查覆盖率
pnpm test:coverage
```

### 2. 覆盖率要求
- **any 类型使用**：0% 容忍度，必须全部修复
- **类型覆盖率**：95% 以上的代码有明确类型
- **Zod 验证覆盖**：所有外部输入必须有验证
- **错误处理覆盖**：所有可能错误的场景都有处理

### 3. 性能检查
```typescript
// 确保类型检查不影响运行时性能
function performanceCheck() {
  const start = performance.now();
  // 类型检查逻辑
  const end = performance.now();
  console.log(`Type validation took ${end - start} milliseconds`);
}
```

## 集成方式

### 1. CLI 工具
```bash
# 检查整个项目
npx type-validator check

# 检查特定文件
npx type-validator check src/services/light.ts

# 自动修复
npx type-validator fix --auto

# 生成报告
npx type-validator report --format json --output type-report.json
```

### 2. VS Code 扩展
- 实时类型检查提示
- 一键修复 any 类型
- 类型建议和补全
- 错误高亮和导航

### 3. CI/CD 集成
```yaml
# GitHub Actions 示例
- name: Type Validation
  run: |
    npx type-validator check --strict
    npx type-validator report --format junit --output type-results.xml
```

## 最佳实践

### 1. 类型优先设计
- 先定义类型，再实现逻辑
- 使用 TypeScript 的类型系统作为设计工具
- 保持类型定义的稳定性和向后兼容性

### 2. 渐进式改进
- 优先修复高风险的 any 类型使用
- 逐步完善类型定义
- 保持代码的可编译性

### 3. 文档维护
- 为复杂类型提供详细注释
- 维护类型变更日志
- 提供类型使用示例

通过这个技能，可以确保 xiaozhi-client 项目始终保持高质量的 TypeScript 代码标准，减少运行时错误，提升开发效率。特别针对 MCP 协议的复杂类型和项目的路径别名系统提供专门的类型安全保障。
