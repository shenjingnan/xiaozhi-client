---
description: CI检查验证和质量保障
---

我是 CI 检查验证和质量保障技能，专门确保 xiaozhi-client 项目的代码质量符合标准，同时遵循务实开发理念。

### 技能使用原则
- **保证质量，但避免过度工程化**：维持代码质量，但不追求理论上的完美
- **实用功能优先，理论完美次之**：解决实际问题比预防各种可能更重要
- **简单解决方案优于复杂方案**：优先选择直接有效的解决方案
- **务实开发指导**：检查代码是否符合"如无必要勿增实体"的原则

## 技能能力

### 1. 完整代码质量检查流程
核心能力：自动执行项目要求的所有代码质量检查，确保代码符合 CI 标准。

#### 检查流程
```bash
# 1. 执行完整检查（xiaozhi-client 项目）
pnpm check:all

# 2. 运行测试套件
pnpm test

# 3. （可选）生成覆盖率报告
pnpm test:coverage
```

#### 检查内容详解
- **`pnpm check:all`** 包含：
  - `pnpm lint` - Biome 代码规范和格式检查
  - `pnpm type-check` - TypeScript 严格类型检查
  - `pnpm check:spell` - 拼写检查
  - `pnpm duplicate:check` - 重复代码检查

- **`pnpm test`** 包含：
  - Vitest 单元测试执行
  - 集成测试验证
  - 功能测试覆盖

### 2. 智能问题诊断与修复建议
当检查失败时，自动分析失败原因并提供针对性修复建议。

#### 类型检查失败诊断
```typescript
// 常见问题1：any 类型使用
// ❌ 错误示例
function processData(data: any): any {
  return data.value;
}

// ✅ 修复建议
function processData<T extends Record<string, unknown>>(data: T): T[keyof T] {
  return data.value as T[keyof T];
}

// 常见问题2：类型定义缺失
// ❌ 错误示例
const config = {
  apiEndpoint: "https://api.home-assistant.local",
  timeout: 5000,
};

// ✅ 修复建议
interface Config {
  apiEndpoint: string;
  timeout: number;
}

const config: Config = {
  apiEndpoint: "https://api.home-assistant.local",
  timeout: 5000,
};
```

#### 代码规范失败诊断
```bash
# 常见问题及修复命令

# 问题：Biome 检查失败
# 解决方案：运行自动修复
pnpm lint

# 问题：导入路径不规范
# 解决方案：使用路径别名系统
import { UnifiedMCPServer } from "@core/unified-server"; // ✅
import { StartCommand } from "@cli/commands/start";       // ✅
import { UnifiedMCPServer } from "./core/unified-server"; // ❌

# 问题：未使用的导入
# 解决方案：移除未使用的导入
pnpm lint  # 会自动清理
```

#### 拼写检查失败诊断
```bash
# 常见问题：技术术语被标记为拼写错误
# 解决方案1：确认确实是错误，修正拼写
# 解决方案2：如果是专业术语，添加到项目词典
echo "homeassistant" >> .cspell.json

# 解决方案3：忽略特定文件或目录
# 在 .cspell.json 中配置 ignorePaths
```

#### 测试失败诊断
```typescript
// 常见问题1：测试覆盖率不足
// 解决方案：补充测试用例，覆盖未测试的代码路径

// 常见问题2：异步测试处理不当
// ❌ 错误示例
test("should fetch data", () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// ✅ 修复建议
test("should fetch data", async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// 常见问题3：Mock 设置不完整
// ❌ 错误示例
vi.mock("@/services/light-service");

// ✅ 修复建议
vi.mock("@/services/light-service", () => ({
  LightService: {
    turnOn: vi.fn(),
    turnOff: vi.fn(),
  },
}));
```

### 3. CI/CD 流水线标准验证
确保代码符合项目的 CI/CD 要求，避免流水线失败。

#### CI 检查清单
```yaml
# GitHub Actions CI 流程检查项
- ✅ 类型检查通过 (pnpm type:check)
- ✅ 代码规范检查通过 (pnpm check)
- ✅ 拼写检查通过 (pnpm check:spell)
- ✅ 构建成功 (pnpm build)
- ✅ 测试通过 (pnpm test:coverage)
- ✅ 覆盖率达到要求
```

#### 覆盖率要求验证
```bash
# 检查当前覆盖率
pnpm test:coverage

# 覆盖率要求（基于 vitest.config.ts）
- 函数覆盖率: 80%
- 行覆盖率: 80%
- 语句覆盖率: 80%
- 分支覆盖率: 70%
```

### 4. 预提交检查自动化
在代码提交前自动执行所有必要的检查，确保只提交高质量的代码。

#### Git Hooks 集成
```bash
# 安装 husky（如果未安装）
pnpm add -D husky

# 设置 pre-commit hook
npx husky add .husky/pre-commit "pnpm check:all && pnpm test"

# 设置 pre-push hook
npx husky add .husky/pre-push "pnpm test:coverage"
```

#### 手动预提交检查
```bash
# 完整预提交检查流程
function preCommitCheck() {
  echo "🔍 执行预提交检查..."

  # 1. 代码格式化
  pnpm format

  # 2. 代码规范检查和修复
  pnpm lint

  # 3. 类型检查
  pnpm type-check

  # 4. 拼写检查
  pnpm check:spell

  # 5. 运行测试
  pnpm test

  # 6. 生成覆盖率报告
  pnpm test:coverage

  echo "✅ 预提交检查完成"
}
```

## 检查规则详解

### 1. 强制检查时机
```bash
# 必须执行检查的时机
- ✅ 每次代码修改后
- ✅ 提交代码前 (git commit)
- ✅ 创建 PR 前
- ✅ 合并到 main 分支前
- ✅ 发布版本前
```

### 2. 检查失败处理流程
```typescript
interface CheckFailure {
  type: 'type_error' | 'lint_error' | 'spell_error' | 'test_failure';
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  message: string;
  fixCommand?: string;
  autoFixable: boolean;
}

function handleCheckFailure(failure: CheckFailure): void {
  switch (failure.type) {
    case 'type_error':
      console.log(`🔧 类型错误: ${failure.message}`);
      if (failure.autoFixable) {
        console.log(`💡 建议修复: ${failure.fixCommand}`);
      }
      break;

    case 'lint_error':
      console.log(`📝 代码规范错误: ${failure.message}`);
      console.log(`💡 自动修复: pnpm lint`);
      break;

    case 'spell_error':
      console.log(`📖 拼写错误: ${failure.message}`);
      console.log(`💡 检查拼写: pnpm check:spell`);
      break;

    case 'test_failure':
      console.log(`🧪 测试失败: ${failure.message}`);
      console.log(`💡 修复测试: /fix-test ${failure.file}`);
      break;
  }
}
```

### 3. 质量门禁标准
```typescript
interface QualityGates {
  typeCheck: {
    anyTypesAllowed: 0;          // 0 容忍度
    strictMode: true;            // 必须启用严格模式
    implicitAny: false;          // 禁止隐式 any
  };

  lintCheck: {
    errorsAllowed: 0;            // 0 错误容忍度
    warningsAllowed: 5;          // 最多 5 个警告
    autoFixRate: 0.95;           // 95% 自动修复率
  };

  spellCheck: {
    spellingErrors: 0;           // 0 拼写错误容忍度
    technicalTerms: 'verified';  // 技术术语必须验证
  };

  testCoverage: {
    functions: 80;               // 函数覆盖率 80%
    lines: 80;                   // 行覆盖率 80%
    statements: 80;              // 语句覆盖率 80%
    branches: 70;                // 分支覆盖率 70%
  };
}
```

## 自动化修复

### 1. 一键修复命令
```bash
# 修复所有可自动修复的问题
pnpm lint

# 如果仍有问题，运行详细诊断
pnpm check:all  # 查看具体错误
pnpm type-check  # 查看类型错误详情
pnpm check:spell  # 查看拼写错误详情
```

### 2. 智能修复脚本
```typescript
#!/bin/bash
# auto-fix.sh - 智能修复脚本

echo "🚀 开始自动修复..."

# 1. 代码格式化
echo "📝 格式化代码..."
pnpm format

# 2. 代码规范检查和自动修复
echo "🔧 修复代码规范问题..."
pnpm lint

# 3. 类型检查（仅诊断，不自动修复）
echo "🔍 检查类型问题..."
TYPE_ERRORS=$(pnpm type-check 2>&1 | grep -c "error" || echo "0")
if [ "$TYPE_ERRORS" -gt 0 ]; then
  echo "❌ 发现 $TYPE_ERRORS 个类型错误，需要手动修复"
  pnpm type-check
  exit 1
fi

# 4. 拼写检查
echo "📖 检查拼写..."
SPELL_ERRORS=$(pnpm check:spell 2>&1 | grep -c "error" || echo "0")
if [ "$SPELL_ERRORS" -gt 0 ]; then
  echo "❌ 发现 $SPELL_ERRORS 个拼写错误，请检查"
  pnpm check:spell
  exit 1
fi

# 5. 运行测试
echo "🧪 运行测试..."
pnpm test

echo "✅ 自动修复完成！"
```

### 3. 渐进式修复策略
```typescript
interface FixStrategy {
  priority: 'high' | 'medium' | 'low';
  autoFix: boolean;
  description: string;
}

const fixStrategies: FixStrategy[] = [
  {
    priority: 'high',
    autoFix: true,
    description: '代码格式和规范问题（使用 pnpm lint）'
  },
  {
    priority: 'high',
    autoFix: false,
    description: 'TypeScript 严重类型错误'
  },
  {
    priority: 'medium',
    autoFix: false,
    description: '测试用例修复（使用 /fix-test）'
  },
  {
    priority: 'low',
    autoFix: true,
    description: '拼写错误（添加到词典或修正）'
  }
];
```

## 质量报告

### 1. 检查结果报告
```typescript
interface QualityReport {
  timestamp: string;
  typeCheck: {
    passed: boolean;
    errors: number;
    warnings: number;
    issues: TypeIssue[];
  };
  lintCheck: {
    passed: boolean;
    errors: number;
    warnings: number;
    fixed: number;
  };
  spellCheck: {
    passed: boolean;
    errors: number;
    words: string[];
  };
  testCoverage: {
    passed: boolean;
    coverage: CoverageReport;
    failingTests: TestFailure[];
  };
  overall: {
    passed: boolean;
    score: number; // 0-100
    recommendations: string[];
  };
}
```

### 2. 质量趋势分析
```bash
# 生成质量报告
function generateQualityReport() {
  echo "📊 生成代码质量报告..."

  # 运行所有检查
  pnpm check:all > check-results.txt 2>&1
  pnpm test:coverage > coverage-results.txt 2>&1

  # 分析结果
  echo "📈 质量趋势分析:"
  echo "- 类型错误: $(grep -c "error" check-results.txt || echo "0")"
  echo "- 代码规范问题: $(grep -c "error" check-results.txt || echo "0")"
  echo "- 测试覆盖率: $(tail -10 coverage-results.txt | grep -o "[0-9]*%" | head -1)"

  # 生成改进建议
  echo "💡 改进建议:"
  echo "- 定期运行 pnpm check:all 进行预防性检查"
  echo "- 在提交前确保所有检查通过"
  echo "- 保持测试覆盖率在要求水平以上"
}
```

## 集成方式

### 1. CLI 集成
```bash
# 使用技能验证代码质量
skill: ci-validator

# 手动执行完整检查
pnpm check:all && pnpm test

# 快速检查（仅核心检查）
pnpm lint && pnpm test
```

### 2. IDE 集成建议
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.preferTypeOnlyAutoImports": true,
  "cSpell.enableFiletypes": ["typescript", "javascript", "markdown", "yaml"]
}
```

### 3. Git 工作流集成
```bash
# 创建 Git 别名简化检查
git config --global alias.precheck '!pnpm check:all && pnpm test'
git config --global alias.quality '!pnpm check:all && pnpm test:coverage'

# 使用别名
git precheck    # 快速检查
git quality     # 完整质量检查
```

## 最佳实践

### 1. 预防性检查
- **每次保存文件时**：启用 IDE 自动格式化
- **每完成一个功能**：运行 `pnpm check:all`
- **每天结束开发前**：运行完整质量检查

### 2. 渐进式改进
- 优先修复高优先级问题
- 保持代码始终可编译
- 定期更新质量标准

### 3. 团队协作
- 统一开发环境配置
- 建立代码审查检查清单
- 分享质量改进经验

### 4. 持续监控
- 设置质量指标监控
- 定期生成质量报告
- 追踪质量趋势变化

通过这个技能，可以确保 xiaozhi-client 项目始终保持高质量的代码标准，减少 CI/CD 流水线失败，提升开发效率和代码质量。特别适配项目的 MCP 协议特性和复杂路径别名系统。
