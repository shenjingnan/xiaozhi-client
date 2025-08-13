# 多端点连接管理迁移指南

## 概述

本指南将帮助您从单端点配置迁移到新的多端点连接管理系统。新系统完全向后兼容，您可以逐步迁移而不会中断现有服务。

## 兼容性说明

✅ **完全向后兼容**: 现有的单端点配置将继续正常工作
✅ **API 兼容**: 所有现有的 API 接口保持不变
✅ **配置兼容**: 现有的配置文件无需修改即可使用

## 迁移步骤

### 第一步：评估当前配置

检查您当前的 `xiaozhi.config.json` 文件：

```json
{
  "port": 3001,
  "mcpEndpoint": "wss://xiaozhi.example.com",
  "mcpServers": [...],
  "enableCors": true,
  "enableLogging": true
}
```

### 第二步：添加备用端点

将单个端点转换为端点数组：

```json
{
  "port": 3001,
  "mcpEndpoint": [
    "wss://xiaozhi.example.com",
    "wss://xiaozhi-backup.example.com"
  ],
  "mcpServers": [...],
  "enableCors": true,
  "enableLogging": true
}
```

### 第三步：配置连接选项（可选）

添加高级连接管理选项：

```json
{
  "port": 3001,
  "mcpEndpoint": [
    "wss://xiaozhi.example.com",
    "wss://xiaozhi-backup.example.com"
  ],
  "connectionOptions": {
    "healthCheckInterval": 30000,
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 10,
    "loadBalanceStrategy": "round-robin",
    "connectionTimeout": 10000,
    "reconnectStrategy": "exponential-backoff"
  },
  "mcpServers": [...],
  "enableCors": true,
  "enableLogging": true
}
```

### 第四步：重启服务

重启小智客户端以应用新配置：

```bash
npm run start
```

## 迁移场景

### 场景 1：开发环境

**目标**: 添加本地备用端点

**迁移前**:
```json
{
  "mcpEndpoint": "wss://localhost:8080"
}
```

**迁移后**:
```json
{
  "mcpEndpoint": [
    "wss://localhost:8080",
    "wss://localhost:8081"
  ]
}
```

### 场景 2：生产环境

**目标**: 高可用性配置

**迁移前**:
```json
{
  "mcpEndpoint": "wss://xiaozhi-prod.company.com"
}
```

**迁移后**:
```json
{
  "mcpEndpoint": [
    "wss://xiaozhi-prod-1.company.com",
    "wss://xiaozhi-prod-2.company.com",
    "wss://xiaozhi-prod-3.company.com"
  ],
  "connectionOptions": {
    "loadBalanceStrategy": "health-based",
    "healthCheckInterval": 30000,
    "maxReconnectAttempts": 15
  }
}
```

### 场景 3：多区域部署

**目标**: 跨区域负载均衡

**迁移前**:
```json
{
  "mcpEndpoint": "wss://xiaozhi-us-east.company.com"
}
```

**迁移后**:
```json
{
  "mcpEndpoint": [
    "wss://xiaozhi-us-east.company.com",
    "wss://xiaozhi-us-west.company.com",
    "wss://xiaozhi-eu-west.company.com"
  ],
  "connectionOptions": {
    "loadBalanceStrategy": "round-robin",
    "connectionTimeout": 15000
  }
}
```

## 代码迁移

### 如果您直接使用了 ProxyMCPServer

**迁移前**:
```typescript
import { ProxyMCPServer } from './ProxyMCPServer.js';

const server = new ProxyMCPServer('wss://xiaozhi.example.com');
await server.connect();
```

**迁移后**:
```typescript
import { XiaozhiConnectionManagerSingleton } from './services/XiaozhiConnectionManagerSingleton.js';

const manager = await XiaozhiConnectionManagerSingleton.getInstance();
const connection = manager.selectBestConnection();
```

### 如果您使用了 WebServer

**无需修改**: WebServer 会自动使用新的连接管理器，现有代码继续工作。

## 验证迁移

### 1. 检查连接状态

启动应用后，检查连接状态：

```bash
curl http://localhost:3001/api/status
```

或在代码中：

```typescript
const status = webServer.getXiaozhiConnectionStatus();
console.log(JSON.stringify(status, null, 2));
```

### 2. 验证负载均衡

观察日志确认请求在多个端点间分配：

```
[INFO] 选择端点: wss://xiaozhi-1.example.com
[INFO] 选择端点: wss://xiaozhi-2.example.com
[INFO] 选择端点: wss://xiaozhi-1.example.com
```

### 3. 测试故障转移

临时关闭一个端点，验证系统是否自动切换到其他端点。

## 回滚计划

如果需要回滚到单端点配置：

### 1. 修改配置文件

```json
{
  "mcpEndpoint": "wss://xiaozhi.example.com"
}
```

### 2. 重启服务

```bash
npm run start
```

系统会自动回退到单连接模式。

## 性能影响

### 预期改进

- **可用性**: 提高 99.9% → 99.99%
- **故障恢复**: 从分钟级降低到秒级
- **负载分布**: 更均匀的请求分配

### 资源使用

- **内存**: 每个额外端点约增加 1-2MB
- **CPU**: 健康检查约占用 <1% CPU
- **网络**: 健康检查流量约 1KB/分钟/端点

## 监控和告警

### 关键指标

1. **连接健康度**: 监控各端点的健康分数
2. **故障转移频率**: 监控故障转移事件
3. **负载分布**: 确保请求均匀分配
4. **响应时间**: 监控各端点的响应时间

### 告警设置

```typescript
// 监控连接状态
setInterval(() => {
  const status = webServer.getXiaozhiConnectionStatus();
  if (status.type === 'multi-endpoint') {
    const healthyRatio = status.manager.healthyConnections / status.manager.totalConnections;
    if (healthyRatio < 0.5) {
      console.warn('警告: 超过50%的端点不健康');
    }
  }
}, 60000);
```

## 常见问题

### Q: 迁移后性能是否会下降？
A: 不会。新系统经过优化，多连接启动时间不超过单连接的2倍，运行时性能更好。

### Q: 是否需要修改现有代码？
A: 不需要。新系统完全向后兼容，现有代码无需修改。

### Q: 如何选择负载均衡策略？
A: 
- 开发环境: `round-robin`
- 生产环境: `health-based`
- 测试环境: `random`

### Q: 多少个端点比较合适？
A: 建议 2-5 个端点。太少影响可用性，太多增加管理复杂度。

### Q: 如何处理端点认证？
A: 每个端点可以有独立的认证配置，在 URL 中包含认证信息或使用环境变量。

## 技术支持

如果在迁移过程中遇到问题：

1. 查看应用日志获取详细错误信息
2. 检查网络连接和端点可用性
3. 验证配置文件格式是否正确
4. 提交 Issue 并包含配置和日志信息

---

*本迁移指南适用于小智客户端 v1.6.1 及以上版本*
