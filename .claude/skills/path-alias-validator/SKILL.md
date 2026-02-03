---
name: path-alias-validator
description: 路径别名系统检查与修复
---

我是路径别名系统检查与修复技能，专门针对 xiaozhi-client 项目的路径别名系统进行检查、验证和优化，同时遵循务实开发理念。

### 技能使用原则
- **保持代码质量，但避免过度工程化**：维护路径别名的一致性，但不追求过度复杂的设计
- **实用功能优先，理论完美次之**：解决实际的导入问题比完美的路径设计更重要
- **简单解决方案优于复杂方案**：在复杂和简单之间做出合理选择
- **务实开发指导**：评估路径别名设计的必要性，避免过度设计

## 技能能力

### 1. 路径别名使用检查
核心能力：检测项目中相对路径的使用情况，并提供别名替换建议。

#### 检测范围
- **源代码文件**：TypeScript/JavaScript 文件中的导入语句
- **文档文件**：MDX 文件代码块中的示例代码
- **跨目录相对路径**：`../` 格式的导入语句
- **同级目录引用**：`./` 格式的导入语句
- **混合使用情况**：同一文件中别名和相对路径混用
- **配置一致性**：各配置文件中别名配置的一致性检查

#### 文档场景特殊处理
- **代码块识别**：自动识别 MDX 文件中的 TypeScript/JavaScript 代码块
- **示例代码检查**：检查文档中的代码示例是否遵循路径别名规范
- **教学一致性**：确保文档示例展示最佳实践
- **语法高亮支持**：支持多种编程语言的路径检查

#### 检查规则
```typescript
// ✅ 推荐的别名使用
import { LightService } from "@/services";
import type { HassState } from "@/types";
import { formatDate } from "@/utils";

// ❌ 需要修复的相对路径
import { LightService } from "../services";
import type { HassState } from "../types";
import { formatDate } from "./utils";
```

### 2. 别名配置验证
检查项目配置文件中的路径别名设置是否正确和一致。

#### 验证项目
- **tsconfig.json** - TypeScript 编译器配置
- **vitest.config.ts** - 测试框架配置
- **tsup.config.ts** - 构建工具配置
- **package.json** - 导入映射配置（如存在）

#### 标准别名映射
```typescript
// xiaozhi-client 项目完整别名映射
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
  "@types/*": ["apps/backend/types/*"]            // 类型定义
}
```

### 3. 自动修复建议
为检测到的问题提供具体的修复建议和代码示例。

#### 修复示例
```typescript
// ❌ 原始代码（相对路径）
import { UserService } from "../services/user";
import type { APIResponse } from "../types/api";
import { formatDate } from "./utils/date";
import { Command } from "./commands/help";
import { WebSocketAdapter } from "../transports/websocket";
import { ConnectionManager } from "../../managers/connection";

// ✅ 修复后（xiaozhi-client 别名）
import { UserService } from "@/services/user";
import type { APIResponse } from "@/types/api";
import { formatDate } from "@/utils/date";
import { Command } from "@cli/commands/help";
import { WebSocketAdapter } from "@transports/websocket";
import { ConnectionManager } from "@managers/connection";
```

## 使用方法

### 基础检查
```
请检查当前项目的路径别名使用情况，识别所有需要修复的相对路径。
```

### 配置验证
```
请验证项目中所有配置文件的路径别名设置是否一致和正确。
```

### 自动修复
```
请帮我修复检测到的路径别名问题，自动替换相对路径为 @/xxx 格式的别名。
```

### 特定文件检查
```
请检查 apps/backend/services/ 目录下的所有文件，确保它们正确使用路径别名。
```

### CLI模块检查
```
请检查 apps/backend/cli/ 目录下的所有文件，确保CLI命令正确使用 @cli/* 别名。
```

### 核心模块检查
```
请检查 apps/backend/core/ 目录下的所有文件，确保核心MCP功能正确使用路径别名。
```

### 传输层检查
```
请检查 apps/backend/transports/ 目录下的所有文件，确保传输适配器使用 @transports/* 别名。
```

### 文档专项检查
```
请检查 docs/ 目录下的所有 MDX 文件，确保文档中的代码示例使用正确的 xiaozhi-client 路径别名。
```

### 文档批量修复
```
请批量修复文档中的路径别名问题，重点关注代码示例中的 import 语句。
```

### 文档质量验证
```
请验证文档更新后的正确性，确保修复后的代码示例语法正确且符合项目规范。
```

## 检查流程

### 1. 扫描阶段
- **源代码扫描**：遍历项目中的所有 TypeScript/JavaScript 文件
- **文档扫描**：扫描所有 MDX 文件中的代码块
- **语句识别**：识别所有 import 和 export 语句
- **路径提取**：提取相对路径使用情况

### 2. 分析阶段
- **路径映射**：分析相对路径的目标位置
- **别名确定**：确定应该使用的别名
- **上下文分析**：分析代码块的语言和上下文
- **例外识别**：识别例外情况（紧密相关的模块、测试文件等）

### 3. 文档特殊处理阶段
- **代码块解析**：解析 MDX 文件中的代码块
- **语言识别**：识别代码块的编程语言
- **示例分类**：区分示例代码和配置代码
- **教学价值评估**：评估修复对教学效果的影响

### 4. 验证阶段
- **配置一致性**：检查配置文件的一致性
- **语法正确性**：验证修复建议的正确性
- **功能完整性**：确保不会破坏现有功能
- **文档可读性**：确保修复后文档仍然清晰易懂

### 5. 报告阶段
- **问题分类**：区分源代码和文档中的问题
- **修复建议**：提供具体的修复建议
- **优先级标记**：标记优先级和影响范围
- **文档影响评估**：评估修复对文档质量的影响

## 例外情况

### 源代码中的例外
以下情况下相对路径是可以接受的：

1. **紧密相关的模块**
```typescript
// light.test.ts 可以使用相对路径导入 light.ts
import { LightService } from "./light";
```

2. **同目录下的辅助函数**
```typescript
// 同一目录下的工具函数
import { helperFunction } from "./helpers";
```

3. **动态导入的特殊情况**
```typescript
// 运行时动态导入
const module = await import(`../modules/${moduleName}`);
```

### 文档中的例外
文档中的代码示例有特殊的例外规则：

1. **演示相对路径概念**
```typescript
// 当文档需要解释相对路径概念时
import { utils } from "../shared/utils"; // 这是相对路径的示例
```

2. **展示不同的导入方式**
```typescript
// 对比展示：相对路径 vs 别名路径
// 相对路径写法：
import { Service } from "./service";
// 别名路径写法：
import { Service } from "@/services/service";
```

3. **第三方项目示例**
```typescript
// 展示其他项目或框架的代码示例
import { Component } from "../components/Button";
```

4. **配置文件示例**
```json
{
  "paths": {
    "./*": ["./src/*"]  // 配置文件中的相对路径
  }
}
```

### 文档修复策略
- **教学优先**：当修复可能影响教学效果时，优先考虑教学价值
- **添加说明**：在保留相对路径示例时，添加说明解释为什么使用相对路径
- **提供对比**：同时展示相对路径和别名路径的使用方式
- **标注上下文**：明确标注代码示例的上下文和适用场景

## 工具集成

### 与其他技能的协作
- **type-validator** - 确保别名使用不会破坏类型安全
- **mock-generator** - 确保 Mock 数据正确使用别名导入
- **api-docs** - 确保生成的文档反映正确的路径结构

### CI/CD 集成
可以作为 CI 流程的一部分，自动检查新代码是否遵循路径别名规范。

## 最佳实践建议

### 1. 导入顺序
```typescript
// 1. Node.js 内置模块
import { fs } from "node:fs";
import { path } from "node:path";

// 2. 外部依赖
import express from "express";
import { Command } from "commander";

// 3. xiaozhi-client 路径别名导入（按分组排序）
// 核心模块
import { UnifiedMCPServer } from "@core";
import type { MCPMessage } from "@types";

// 传输和适配器
import { WebSocketAdapter } from "@transports";
import { HTTPAdapter } from "@adapters";

// 管理器和服务
import { ConnectionManager } from "@managers";
import { ConfigService } from "@/services";

// CLI相关
import { StartCommand } from "@cli/commands";
import { Container } from "@cli";

// 工具和错误
import { formatConfig } from "@/utils";
import { ConfigError } from "@errors";

// 4. 相对路径（仅在必要时）
import { helperFunction } from "./helpers";
```

### 2. 类型导入优先
```typescript
// ✅ 推荐
import type { HassState } from "@/types";

// ❌ 避免
import { HassState } from "@/types";
```

### 3. 一致性原则
同一文件中对同一目录的模块使用一致的导入方式。

## 验证检查清单

- [ ] 所有跨目录导入都使用正确的别名格式（@cli/*, @core/*, @transports/* 等）
- [ ] 配置文件（vitest.config.ts, tsup.config.ts）中的别名设置一致
- [ ] 没有与 npm 包名冲突的别名
- [ ] IDE 能正确识别和跳转别名路径
- [ ] 构建和测试都能正常运行
- [ ] 代码审查规则包含别名检查
- [ ] **MCP 相关模块使用 @core/* 别名**
- [ ] **CLI 命令使用 @cli/* 别名**
- [ ] **传输适配器使用 @transports/* 别名**
- [ ] **类型导入使用 `import type` 语法**
- [ ] **文档示例使用正确的路径别名**

通过这个技能的帮助，可以确保项目始终遵循路径别名最佳实践，提高代码质量和可维护性。
