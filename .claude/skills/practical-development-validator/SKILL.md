---
name: practical-development-validator
description: 务实开发原则检查和验证
---

我是务实开发原则检查技能，专门帮助开发团队避免过度设计，确保代码实现符合"如无必要勿增实体"的核心原则。

### 技能使用原则
- **检查是否引入了不必要的复杂性**：评估代码变更是否增加了不必要的复杂度
- **评估功能实现是否符合"如无必要勿增实体"**：确保每个实体都有明确的功能价值
- **确保代码优雅但不过度设计**：平衡代码质量和复杂度
- **验证架构合理性但不冗余**：确保架构设计有实际意义

## 技能能力

### 1. 过度设计检查
核心能力：识别代码中可能存在的过度设计和不必要的复杂性。

#### 检查内容
- **过度抽象**：为了抽象而抽象的代码结构
- **预防性编程**：为"未来可能需要"而增加的复杂功能
- **过度设计模式**：不必要的复杂设计模式使用
- **过度配置**：过于复杂的配置系统
- **过早优化**：在没有性能问题时进行的性能优化

#### 检查示例
```typescript
// ❌ 过度抽象
abstract class BaseService<T, U, V> {
  abstract execute(request: T): Promise<U>;
  abstract validate(request: T): V;
  abstract handleError(error: Error): void;
}

// ✅ 简单直接
class UserService {
  async createUser(userData: UserData): Promise<User> {
    // 直接实现功能
  }
}
```

### 2. 复杂度评估
评估代码变更的复杂度是否与其功能价值匹配。

#### 评估标准
- **功能价值比**：复杂度与实际功能价值的比例
- **维护成本**：新增代码对整体维护成本的影响
- **理解难度**：新贡献者理解代码的难度
- **扩展性需求**：是否真的需要当前设计的扩展性

#### 复杂度指标
```typescript
// 复杂度检查清单
interface ComplexityChecklist {
  // ✅ 合理的复杂度
  hasClearPurpose: boolean;           // 有明确的目的
  solvesRealProblem: boolean;         // 解决实际问题
  necessaryAbstraction: boolean;     // 必要的抽象
  maintainableCode: boolean;         // 可维护的代码

  // ❌ 过度的复杂度
  futureProofing: boolean;           // 为未来过度设计
  unnecessaryPatterns: boolean;      // 不必要的设计模式
  overConfiguration: boolean;        // 过度配置
  prematureOptimization: boolean;    // 过早优化
}
```

### 3. 实用性验证
验证代码实现的实用性，确保解决实际问题。

#### 实用性检查
- **问题匹配**：代码是否解决了实际的用户问题
- **功能必要性**：每个功能模块是否都必要
- **接口设计**：API 设计是否简洁实用
- **错误处理**：错误处理是否实用而非过度

#### 实用性示例
```typescript
// ❌ 过度的错误处理
try {
  const result = await apiCall();
  if (result !== null && result !== undefined) {
    if (typeof result === 'object' && result.data) {
      // 过度嵌套的检查
    }
  }
} catch (error) {
  if (error instanceof NetworkError) {
    // 详细的错误分类
  } else if (error instanceof ValidationError) {
    // 详细的错误分类
  }
  // ...
}

// ✅ 实用的错误处理
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('API调用失败:', error);
  throw new Error('服务不可用');
}
```

### 4. 架构合理性验证
确保架构设计有实际意义，避免不必要的抽象层。

#### 架构检查项
- **模块职责**：每个模块是否有明确的职责
- **分层必要性**：每一层抽象是否真的必要
- **接口设计**：接口是否简洁实用
- **依赖关系**：依赖关系是否合理且必要

## 使用方法

### 基础过度设计检查
```
请检查当前的代码变更，是否存在过度设计的问题？
```

### 功能必要性评估
```
请评估这个新功能的实现是否符合"如无必要勿增实体"的原则？
```

### 架构合理性检查
```
请检查当前的架构设计是否合理，是否存在不必要的抽象层？
```

### 复杂度优化建议
```
请分析这段代码的复杂度，并提供简化建议。
```

## 实用原则指导

### 何时考虑复杂设计
- **实际遇到问题**：当确实出现性能瓶颈时
- **功能需求**：当用户明确需要相关功能时
- **维护困难**：当代码确实难以维护时
- **团队协作**：当多人协作需要统一接口时

### 何时保持简单
- **预防性设计**：为了"可能的需要"而增加复杂度
- **理论完美**：为了代码的"优雅"而过度抽象
- **过度优化**：在没有性能问题时优化性能
- **设计模式**：为了使用设计模式而使用

### 务实开发检查清单

#### 设计阶段检查
- [ ] 每个新模块都有明确的功能价值
- [ ] 没有为"未来可能需要"而增加的功能
- [ ] 抽象层次适度，不过度分层
- [ ] 接口设计简洁实用

#### 实现阶段检查
- [ ] 代码实现直接，避免不必要的间接层
- [ ] 错误处理实用，不过度分类
- [ ] 配置简单，避免过度复杂
- [ ] 注释解释实际复杂度，而非简单逻辑

#### 代码审查检查
- [ ] 新增代码的复杂度与功能价值匹配
- [ ] 没有引入不必要的设计模式
- [ ] 代码易于理解，不需要过度文档
- [ ] 维护成本在合理范围内

## 最佳实践

### 简单直接的设计
```typescript
// ✅ 推荐的简单设计
class ConfigManager {
  private config: Config;

  constructor(configPath: string) {
    this.config = this.loadConfig(configPath);
  }

  get(key: string): any {
    return this.config[key];
  }

  set(key: string, value: any): void {
    this.config[key] = value;
  }
}
```

### 避免的过度设计
```typescript
// ❌ 避免的过度设计
abstract class ConfigurationProvider<T extends ConfigurationOptions> {
  abstract getConfiguration(): Promise<Configuration<T>>;
  abstract validateConfiguration(config: Configuration<T>): ValidationResult;
  abstract transformConfiguration(config: Configuration<T>): TransformedConfiguration<T>;
}

class JSONConfigurationProvider<T extends JSONConfigurationOptions>
  extends ConfigurationProvider<T> {
  // 过度复杂的实现
}
```

通过这个技能的帮助，可以确保 xiaozhi-client 项目始终保持务实的设计理念，避免过度工程化，专注解决实际问题。