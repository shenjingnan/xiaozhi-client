# 动态MCP服务管理方案

## 1. 现有代码分析

### 1.1 MCPServiceManager.ts 架构分析

**当前实现优点**：
- ✅ **清晰的服务生命周期管理**：`startService()` 和 `stopAllServices()` 提供完整的启动/停止逻辑
- ✅ **工具映射机制**：使用 `serviceName__toolName` 格式实现工具唯一标识
- ✅ **错误处理**：每个服务启动都有独立的错误处理机制
- ✅ **状态查询**：`getStatus()` 提供服务状态的完整视图
- ✅ **SDK集成**：正确使用 @modelcontextprotocol/sdk 进行服务通信

**当前实现限制**：
- ❌ **硬编码配置**：mcpServers在构造函数中硬编码，无法动态管理
- ❌ **缺乏单服务操作**：只能批量启动所有服务，无法单独管理特定服务
- ❌ **无服务移除能力**：缺少停止和移除单个服务的方法
- ❌ **状态信息有限**：无法获取单个服务的详细状态和健康信息
- ❌ **无重试机制**：服务连接失败后无法重新连接

### 1.2 ProxyMCPServer.ts 动态管理模式借鉴

**核心设计模式**：
```typescript
// 增量式管理
addTool(name: string, tool: Tool): this

// 批量操作
addTools(tools: Record<string, Tool>): this

// 移除操作
removeTool(name: string): this

// 验证机制
private validateTool(name: string, tool: Tool): void

// 状态查询
hasTool(name: string): boolean
getTools(): Tool[]
```

**设计优势**：
1. **链式调用**：返回 `this` 支持方法链
2. **验证机制**：确保数据的有效性
3. **增量管理**：支持动态添加/移除
4. **状态查询**：提供完整的状态查询能力

## 2. 动态MCP服务管理方案设计

### 2.1 核心使用场景分析

| 场景 | 描述 | 技术要求 |
|------|------|----------|
| **批量初始化** | 服务启动后从配置文件批量添加预配置的MCP服务 | 支持批量添加、错误处理、状态跟踪 |
| **动态添加** | 通过Web界面实时添加新的MCP服务 | 服务验证、启动、工具发现、状态更新 |
| **连接重试** | 重新连接失败的MCP服务 | 重试机制、状态恢复、错误处理 |
| **状态查询** | 获取特定MCP服务的连接状态和健康信息 | 详细状态信息、健康检查、性能指标 |
| **服务移除** | 通过Web界面删除不需要的MCP服务 | 资源清理、工具移除、状态更新 |

### 2.2 架构设计

#### 2.2.1 服务状态模型

```typescript
enum MCPServiceState {
  NOT_STARTED = 'not_started',
  STARTING = 'starting',
  RUNNING = 'running',
  FAILED = 'failed',
  STOPPING = 'stopping',
  STOPPED = 'stopped'
}

interface MCPServiceInfo {
  name: string;
  config: LocalMCPServerConfig;
  state: MCPServiceState;
  client?: Client;
  tools: Tool[];
  addedAt: Date;
  lastConnectedAt?: Date;
  lastError?: Error;
  retryCount: number;
  maxRetries: number;
}
```

#### 2.2.2 核心API设计

```typescript
export class MCPServiceManager {
  // 服务管理
  async addService(name: string, config: LocalMCPServerConfig): Promise<MCPServiceInfo>
  async addServices(services: Record<string, LocalMCPServerConfig>): Promise<MCPServiceInfo[]>
  async removeService(name: string): Promise<void>
  async retryService(name: string): Promise<MCPServiceInfo>
  
  // 状态查询
  getServiceInfo(name: string): MCPServiceInfo | null
  getServiceState(name: string): MCPServiceState | null
  getAllServices(): MCPServiceInfo[]
  getServicesByState(state: MCPServiceState): MCPServiceInfo[]
  
  // 健康检查
  async healthCheck(name: string): Promise<boolean>
  async healthCheckAll(): Promise<Record<string, boolean>>
  
  // 工具管理
  getServiceTools(name: string): Tool[]
  async refreshServiceTools(name: string): Promise<Tool[]>
}
```

### 2.3 详细实现方案

#### 2.3.1 动态添加服务

```typescript
async addService(name: string, config: LocalMCPServerConfig): Promise<MCPServiceInfo> {
  // 1. 验证服务配置
  this.validateServiceConfig(name, config);
  
  // 2. 检查服务是否已存在
  if (this.services.has(name)) {
    throw new Error(`服务 '${name}' 已存在`);
  }
  
  // 3. 创建服务信息
  const serviceInfo: MCPServiceInfo = {
    name,
    config,
    state: MCPServiceState.NOT_STARTED,
    tools: [],
    addedAt: new Date(),
    retryCount: 0,
    maxRetries: 3
  };
  
  // 4. 添加到服务列表
  this.services.set(name, serviceInfo);
  
  // 5. 启动服务
  try {
    await this.startSingleService(name);
    return serviceInfo;
  } catch (error) {
    // 启动失败时保留服务信息，但标记为失败状态
    serviceInfo.state = MCPServiceState.FAILED;
    serviceInfo.lastError = error as Error;
    throw error;
  }
}
```

#### 2.3.2 服务重试机制

```typescript
async retryService(name: string): Promise<MCPServiceInfo> {
  const serviceInfo = this.services.get(name);
  if (!serviceInfo) {
    throw new Error(`服务 '${name}' 不存在`);
  }
  
  // 检查重试次数
  if (serviceInfo.retryCount >= serviceInfo.maxRetries) {
    throw new Error(`服务 '${name}' 已达到最大重试次数 (${serviceInfo.maxRetries})`);
  }
  
  // 清理现有连接
  await this.cleanupService(name);
  
  // 增加重试计数
  serviceInfo.retryCount++;
  serviceInfo.state = MCPServiceState.STARTING;
  
  try {
    await this.startSingleService(name);
    // 重试成功，重置计数
    serviceInfo.retryCount = 0;
    return serviceInfo;
  } catch (error) {
    serviceInfo.state = MCPServiceState.FAILED;
    serviceInfo.lastError = error as Error;
    throw error;
  }
}
```

#### 2.3.3 服务移除

```typescript
async removeService(name: string): Promise<void> {
  const serviceInfo = this.services.get(name);
  if (!serviceInfo) {
    throw new Error(`服务 '${name}' 不存在`);
  }
  
  // 1. 停止服务
  await this.stopSingleService(name);
  
  // 2. 清理工具映射
  this.removeServiceTools(name);
  
  // 3. 从服务列表中移除
  this.services.delete(name);
  
  console.log(`服务 '${name}' 已移除`);
}
```

## 3. API接口设计

### 3.1 服务管理接口

```typescript
interface ServiceManagementAPI {
  // 添加服务
  addService(name: string, config: LocalMCPServerConfig): Promise<MCPServiceInfo>;
  addServices(services: Record<string, LocalMCPServerConfig>): Promise<MCPServiceInfo[]>;
  
  // 移除服务
  removeService(name: string): Promise<void>;
  removeServices(names: string[]): Promise<void>;
  
  // 重试服务
  retryService(name: string): Promise<MCPServiceInfo>;
  retryAllFailedServices(): Promise<MCPServiceInfo[]>;
  
  // 启动/停止服务
  startService(name: string): Promise<void>;
  stopService(name: string): Promise<void>;
  restartService(name: string): Promise<MCPServiceInfo>;
}
```

### 3.2 状态查询接口

```typescript
interface StatusQueryAPI {
  // 单服务状态
  getServiceInfo(name: string): MCPServiceInfo | null;
  getServiceState(name: string): MCPServiceState | null;
  getServiceHealth(name: string): Promise<ServiceHealthInfo>;
  
  // 批量状态
  getAllServices(): MCPServiceInfo[];
  getServicesByState(state: MCPServiceState): MCPServiceInfo[];
  getServicesHealth(): Promise<Record<string, ServiceHealthInfo>>;
  
  // 统计信息
  getServiceStats(): ServiceStats;
}
```

### 3.3 工具管理接口

```typescript
interface ToolManagementAPI {
  // 工具查询
  getServiceTools(name: string): Tool[];
  getAllToolsByService(): Record<string, Tool[]>;
  
  // 工具刷新
  refreshServiceTools(name: string): Promise<Tool[]>;
  refreshAllTools(): Promise<Record<string, Tool[]>>;
  
  // 工具搜索
  findToolsByName(pattern: string): ToolSearchResult[];
  findToolsByService(serviceName: string): Tool[];
}
```

## 4. 实现步骤规划

### 4.1 第一阶段：基础动态管理

**目标**：实现基本的动态添加/移除服务功能

**任务**：
1. **重构构造函数**：移除硬编码配置，改为空初始化
2. **实现 addService()**：单个服务动态添加
3. **实现 removeService()**：单个服务移除
4. **实现 addServices()**：批量服务添加
5. **扩展状态管理**：添加服务状态跟踪

**预期成果**：
- 支持动态添加/移除MCP服务
- 保持现有API的向后兼容性
- 完整的错误处理机制

### 4.2 第二阶段：高级功能

**目标**：实现重试、健康检查等高级功能

**任务**：
1. **实现重试机制**：`retryService()` 和自动重试
2. **健康检查**：定期检查服务状态
3. **详细状态信息**：扩展状态查询功能
4. **性能监控**：添加性能指标收集

### 4.3 第三阶段：集成优化

**目标**：与现有系统完整集成

**任务**：
1. **配置文件集成**：支持从 xiaozhi.config.json 加载配置
2. **Web界面集成**：提供REST API接口
3. **持久化支持**：服务配置的持久化存储
4. **监控和日志**：完整的监控和日志系统

## 5. 错误处理策略

### 5.1 服务启动错误

```typescript
enum ServiceStartError {
  CONFIG_INVALID = 'config_invalid',
  COMMAND_NOT_FOUND = 'command_not_found',
  CONNECTION_FAILED = 'connection_failed',
  TOOLS_FETCH_FAILED = 'tools_fetch_failed',
  TIMEOUT = 'timeout'
}

interface ServiceError {
  type: ServiceStartError;
  message: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
}
```

### 5.2 错误恢复机制

1. **自动重试**：对于可重试的错误，自动进行重试
2. **降级处理**：服务不可用时，标记为失败但保留配置
3. **错误通知**：通过事件机制通知上层应用
4. **日志记录**：详细记录错误信息用于调试

## 6. 使用示例

### 6.1 批量初始化场景

```typescript
// 服务启动时批量添加预配置的服务
const predefinedServices = {
  "calculator": {
    "command": "node",
    "args": ["./mcpServers/calculator.js"]
  },
  "datetime": {
    "command": "node", 
    "args": ["./mcpServers/datetime.js"]
  }
};

const manager = await MCPServiceManagerSingleton.getInstance();
const results = await manager.addServices(predefinedServices);
console.log(`成功添加 ${results.length} 个服务`);
```

### 6.2 Web界面动态添加

```typescript
// 用户通过Web界面添加新服务
app.post('/api/mcp/services', async (req, res) => {
  try {
    const { name, config } = req.body;
    const manager = await MCPServiceManagerSingleton.getInstance();
    const serviceInfo = await manager.addService(name, config);
    
    res.json({
      success: true,
      service: serviceInfo,
      tools: serviceInfo.tools
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

### 6.3 服务重试

```typescript
// 重试失败的服务
app.post('/api/mcp/services/:name/retry', async (req, res) => {
  try {
    const { name } = req.params;
    const manager = await MCPServiceManagerSingleton.getInstance();
    const serviceInfo = await manager.retryService(name);
    
    res.json({
      success: true,
      service: serviceInfo
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

### 6.4 状态查询

```typescript
// 获取所有服务状态
app.get('/api/mcp/services', async (req, res) => {
  const manager = await MCPServiceManagerSingleton.getInstance();
  const services = manager.getAllServices();
  
  res.json({
    success: true,
    services: services.map(service => ({
      name: service.name,
      state: service.state,
      toolCount: service.tools.length,
      lastConnectedAt: service.lastConnectedAt,
      retryCount: service.retryCount
    }))
  });
});
```

### 6.5 服务移除

```typescript
// 移除服务
app.delete('/api/mcp/services/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const manager = await MCPServiceManagerSingleton.getInstance();
    await manager.removeService(name);
    
    res.json({
      success: true,
      message: `服务 '${name}' 已移除`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

## 7. 技术优势

### 7.1 架构优势

1. **渐进式重构**：保持现有API兼容性，逐步添加新功能
2. **状态驱动**：清晰的状态模型，便于管理和调试
3. **错误恢复**：完整的错误处理和恢复机制
4. **可扩展性**：模块化设计，易于扩展新功能

### 7.2 使用优势

1. **动态管理**：支持运行时动态添加/移除服务
2. **用户友好**：Web界面支持，操作简单直观
3. **可靠性**：自动重试和健康检查机制
4. **可观测性**：详细的状态信息和监控能力

## 8. 后续扩展计划

### 8.1 配置管理

- 支持从 xiaozhi.config.json 自动加载配置
- 配置变更的热重载
- 配置验证和迁移

### 8.2 性能优化

- 服务启动的并行化
- 连接池管理
- 工具调用的缓存机制

### 8.3 监控和运维

- 服务性能指标收集
- 告警机制
- 自动故障恢复

### 8.4 安全增强

- 服务访问控制
- 配置加密存储
- 审计日志

## 9. 总结

本方案通过借鉴 ProxyMCPServer 的动态工具管理模式，为 MCPServiceManager 设计了一套完整的动态服务管理方案。该方案具有以下特点：

1. **完整性**：覆盖了所有核心使用场景
2. **可靠性**：完善的错误处理和恢复机制
3. **易用性**：简洁的API设计和Web界面支持
4. **可扩展性**：模块化架构，便于后续扩展
5. **兼容性**：保持现有API的向后兼容性

通过分阶段实施，可以逐步将现有的静态配置系统升级为功能完整的动态服务管理系统。
