# 性能测试指南

## 概述

本项目包含两类测试：
- **单元测试**：快速执行的功能测试，用于日常开发
- **性能测试**：长时间运行的压力测试和内存测试，用于性能验证

## 测试分类

### 单元测试（默认）
```bash
# 运行所有单元测试（排除性能测试）
pnpm test

# 监听模式运行单元测试
pnpm test:unit:watch

# 运行单元测试并生成覆盖率报告
pnpm test:coverage
```

### 性能测试
```bash
# 运行所有性能测试（快速模式）
pnpm test:performance

# 运行完整性能测试（完整模式）
pnpm test:performance:full

# 运行压力测试
pnpm test:stress

# 运行内存测试
pnpm test:memory

# 运行性能基准测试（最完整）
pnpm test:benchmark
```

## 测试模式说明

### 快速模式（默认）
- 测试时间：5-20秒
- 用途：开发时快速验证功能
- 特点：降低了QPS、并发数和测试时长
- 适用场景：日常开发、CI/CD 快速反馈

### 完整模式（性能验证）
- 测试时间：30秒-5分钟
- 用途：性能验证和回归测试
- 特点：真实的性能指标和压力测试
- 适用场景：发布前验证、性能回归测试

## 环境变量控制

### `VITEST_INCLUDE_PERFORMANCE`
- `true`: 启用完整性能测试模式
- `false` 或未设置: 快速测试模式

### Node.js 内存配置
```bash
# 性能测试推荐配置
NODE_OPTIONS='--max-old-space-size=8192 --expose-gc'
```

## CI/CD 集成

### GitHub Actions
- **单元测试**：每次 PR 和 push 时运行
- **性能测试**：
  - 手动触发
  - 每周定时运行
  - 性能相关文件变更时运行

### 本地开发建议

#### 日常开发
```bash
# 快速测试（推荐）
pnpm test

# 监听模式
pnpm test:unit:watch
```

#### 性能验证
```bash
# 快速性能验证
pnpm test:performance

# 完整性能测试（发布前）
pnpm test:performance:full
```

## 性能测试详情

### 压力测试 (StressTest)
- **目标**：验证高并发下的系统稳定性
- **测试场景**：
  - 高并发基础测试
  - 高并发全功能测试
  - 极高并发采样测试
  - 长时间稳定性测试

### 内存测试 (MemoryResourceTest)
- **目标**：检测内存泄漏和资源使用
- **测试场景**：
  - 基础日志记录内存使用
  - 高频日志记录内存稳定性
  - 长时间运行内存稳定性
  - Pino vs Console 内存对比

## 性能指标说明

### 压力测试指标
- **吞吐量**：每秒操作数 (ops/sec)
- **错误率**：失败操作百分比
- **响应时间**：P95、P99 响应时间
- **内存增长**：测试期间内存增长量

### 内存测试指标
- **内存泄漏检测**：是否存在持续内存增长
- **内存增长率**：每分钟内存增长 (MB/min)
- **峰值内存使用**：测试期间最大内存使用
- **平均内存使用**：测试期间平均内存使用

## 故障排除

### 测试超时
```bash
# 增加超时时间
VITEST_TIMEOUT=600000 pnpm test:performance
```

### 内存不足
```bash
# 增加 Node.js 堆内存
NODE_OPTIONS='--max-old-space-size=8192' pnpm test:performance
```

### 测试不稳定
- 确保系统资源充足
- 关闭其他占用资源的应用
- 使用单线程模式：`pnpm test:performance:full`

## 最佳实践

### 开发阶段
1. 主要使用 `pnpm test` 进行快速反馈
2. 功能完成后运行 `pnpm test:performance` 验证性能
3. 重大变更前运行 `pnpm test:performance:full`

### 发布阶段
1. 运行完整测试套件：`pnpm test:all`
2. 执行性能基准测试：`pnpm test:benchmark`
3. 检查性能回归和内存泄漏

### 持续集成
1. PR 检查：单元测试 + 快速性能测试
2. 主分支：完整测试套件
3. 定期：性能基准测试和趋势分析
