# 多端点连接管理文档

## 概述

小智客户端现在支持多端点连接管理，提供了企业级的可靠性、负载均衡和故障转移功能。这个新的架构允许您配置多个小智接入点，系统会自动管理连接、监控健康状态，并在需要时进行故障转移。

## 核心功能

### 1. 多端点连接管理
- **并发连接**: 同时连接到多个小智接入点
- **连接池管理**: 智能管理连接资源
- **动态端点管理**: 运行时添加/移除端点

### 2. 健康检查机制
- **定期健康检查**: 自动监控连接状态
- **健康度评分**: 基于响应时间和成功率的智能评分
- **异常检测**: 实时检测和报告连接问题

### 3. 自动重连机制
- **智能重连策略**: 支持指数退避、线性退避、固定间隔、自适应四种策略
- **错误分类处理**: 针对不同错误类型的专门处理
- **抖动机制**: 避免雷群效应

### 4. 负载均衡
- **轮询算法**: 平均分配请求
- **随机算法**: 随机选择连接
- **基于健康度**: 优先选择健康的连接

### 5. 性能优化
- **连接预热**: 减少首次连接延迟
- **内存优化**: 防止内存泄漏
- **性能监控**: 实时监控性能指标

## 配置示例

### 基本多端点配置

```json
{
  "port": 3001,
  "mcpEndpoint": [
    "wss://xiaozhi-1.example.com",
    "wss://xiaozhi-2.example.com",
    "wss://xiaozhi-3.example.com"
  ],
  "mcpServers": [],
  "enableCors": true,
  "enableLogging": true
}
```

### 高级配置选项

```json
{
  "port": 3001,
  "mcpEndpoint": [
    "wss://xiaozhi-primary.example.com",
    "wss://xiaozhi-secondary.example.com"
  ],
  "connectionOptions": {
    "healthCheckInterval": 30000,
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 10,
    "loadBalanceStrategy": "health-based",
    "connectionTimeout": 10000,
    "reconnectStrategy": "exponential-backoff"
  },
  "mcpServers": [],
  "enableCors": true,
  "enableLogging": true
}
```

## API 参考

### XiaozhiConnectionManager

#### 初始化
```typescript
const manager = new XiaozhiConnectionManager(options);
await manager.initialize(endpoints, tools);
await manager.connect();
```

#### 连接管理
```typescript
// 添加端点
await manager.addEndpoint("wss://new-endpoint.com");

// 移除端点
await manager.removeEndpoint("wss://old-endpoint.com");

// 更新端点列表
await manager.updateEndpoints(["wss://endpoint1.com", "wss://endpoint2.com"]);
```

#### 健康检查
```typescript
// 启用/禁用健康检查
manager.setHealthCheckEnabled("wss://endpoint.com", true);

// 手动触发健康检查
await manager.triggerHealthCheck();

// 获取健康检查统计
const healthStats = manager.getHealthCheckStats();
```

#### 负载均衡
```typescript
// 选择最佳连接
const connection = manager.selectBestConnection();

// 切换负载均衡策略
manager.setLoadBalanceStrategy('round-robin');

// 执行故障转移
const backup = await manager.performFailover('failed-endpoint');
```

#### 性能监控
```typescript
// 预热连接
await manager.prewarmConnections();

// 获取性能指标
const metrics = manager.getPerformanceMetrics();

// 优化内存使用
manager.optimizeMemoryUsage();
```

### WebServer 集成

#### 获取连接状态
```typescript
const webServer = new WebServer(3001);
await webServer.start();

// 获取连接状态
const status = webServer.getXiaozhiConnectionStatus();
console.log(status);
```

## 配置选项详解

### 连接选项 (ConnectionOptions)

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `healthCheckInterval` | number | 30000 | 健康检查间隔（毫秒） |
| `reconnectInterval` | number | 5000 | 重连间隔（毫秒） |
| `maxReconnectAttempts` | number | 10 | 最大重连尝试次数 |
| `loadBalanceStrategy` | string | 'round-robin' | 负载均衡策略 |
| `connectionTimeout` | number | 10000 | 连接超时时间（毫秒） |
| `reconnectStrategy` | string | 'exponential-backoff' | 重连策略 |

### 负载均衡策略

- **round-robin**: 轮询算法，平均分配请求
- **random**: 随机算法，随机选择连接
- **health-based**: 基于健康度，优先选择健康的连接

### 重连策略

- **exponential-backoff**: 指数退避，延迟时间指数增长
- **linear-backoff**: 线性退避，延迟时间线性增长
- **fixed-interval**: 固定间隔，使用固定的重连间隔
- **adaptive**: 自适应，根据历史成功率调整间隔

## 迁移指南

### 从单端点配置升级

#### 旧配置
```json
{
  "mcpEndpoint": "wss://xiaozhi.example.com"
}
```

#### 新配置
```json
{
  "mcpEndpoint": [
    "wss://xiaozhi.example.com",
    "wss://xiaozhi-backup.example.com"
  ]
}
```

### 代码迁移

#### 旧代码
```typescript
// 直接使用 ProxyMCPServer
const server = new ProxyMCPServer(endpoint);
await server.connect();
```

#### 新代码
```typescript
// 使用连接管理器
const manager = await XiaozhiConnectionManagerSingleton.getInstance();
const connection = manager.selectBestConnection();
```

## 最佳实践

### 1. 端点配置
- 配置至少 2-3 个端点以确保高可用性
- 选择地理位置分散的端点以降低延迟
- 使用 HTTPS/WSS 协议确保安全性

### 2. 负载均衡策略选择
- **开发环境**: 使用 `round-robin` 进行简单的负载分配
- **生产环境**: 使用 `health-based` 确保最佳性能
- **测试环境**: 使用 `random` 进行随机测试

### 3. 健康检查配置
- 设置合适的健康检查间隔（推荐 30-60 秒）
- 监控健康检查统计以识别问题
- 根据网络条件调整超时时间

### 4. 重连策略
- 生产环境推荐使用 `exponential-backoff`
- 设置合理的最大重连次数（推荐 5-15 次）
- 监控重连统计以优化配置

### 5. 性能优化
- 在应用启动时预热连接
- 定期执行内存优化
- 监控性能指标并根据需要调整配置

## 故障排除

### 常见问题

#### 1. 连接失败
**症状**: 所有端点连接失败
**解决方案**:
- 检查端点 URL 是否正确
- 验证网络连接
- 检查防火墙设置
- 查看日志获取详细错误信息

#### 2. 负载均衡不工作
**症状**: 请求总是发送到同一个端点
**解决方案**:
- 检查负载均衡策略配置
- 验证多个端点是否都健康
- 查看负载均衡统计信息

#### 3. 内存使用过高
**症状**: 应用内存使用持续增长
**解决方案**:
- 定期调用 `optimizeMemoryUsage()`
- 检查连接是否正确关闭
- 监控性能指标

#### 4. 重连频繁
**症状**: 连接频繁断开和重连
**解决方案**:
- 检查网络稳定性
- 调整重连策略和间隔
- 增加连接超时时间

### 调试技巧

1. **启用详细日志**:
   ```json
   {
     "enableLogging": true,
     "logLevel": "debug"
   }
   ```

2. **监控连接状态**:
   ```typescript
   const status = webServer.getXiaozhiConnectionStatus();
   console.log(JSON.stringify(status, null, 2));
   ```

3. **查看性能指标**:
   ```typescript
   const metrics = manager.getPerformanceMetrics();
   console.log('Performance metrics:', metrics);
   ```

4. **健康检查统计**:
   ```typescript
   const healthStats = manager.getHealthCheckStats();
   console.log('Health check stats:', healthStats);
   ```

## 性能基准

### 目标性能指标

- **多连接启动时间**: 不超过单连接的 2 倍
- **内存使用**: 线性增长，每个连接约增加 1-2MB
- **连接切换延迟**: 小于 100ms
- **健康检查开销**: 小于 1% CPU 使用率

### 监控指标

- 连接成功率
- 平均响应时间
- 内存使用增长率
- 重连频率
- 负载分布均匀性

## 支持和反馈

如果您在使用多端点连接管理功能时遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查应用日志获取详细信息
3. 提交 Issue 并包含相关配置和日志信息

---

*本文档适用于小智客户端 v1.6.1 及以上版本*
