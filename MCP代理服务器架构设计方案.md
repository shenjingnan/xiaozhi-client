# MCP代理服务器架构设计方案

## 1. 项目背景与现状分析

### 1.1 当前工作流程
1. 系统添加真实的MCP服务，获取MCP服务列表并缓存在 `xiaozhi.config.json` 的 `mcpServerConfig` 字段中
2. 用户通过 `xiaozhi start --ui` 启动服务
3. 启动后，通过 `src/proxyMCPServer.ts` 文件作为接入点与小智AI连接，提供可用工具列表
4. 用户与小智交互后，小智调用LLM决定使用哪个工具
5. 小智发起工具调用请求，`src/proxyMCPServer.ts` 接收请求
6. **【缺失环节】** `src/proxyMCPServer.ts` 将工具调用请求转发到对应的真实MCP服务
7. **【缺失环节】** 真实MCP服务处理后返回结果给 `src/proxyMCPServer.ts`
8. `src/proxyMCPServer.ts` 将结果透传给小智
9. 小智处理后响应给用户

### 1.2 核心技术问题
1. **MCP服务启动时机**：何时启动MCP服务？
2. **请求转发机制**：`src/proxyMCPServer.ts` 如何将工具调用请求转发给真实MCP服务？
3. **响应回传机制**：MCP服务如何将响应返回给 `src/proxyMCPServer.ts`？
4. **多实例资源共享**：多个代理实例如何共享同一个MCP服务？

## 2. 架构设计方案

### 2.1 整体架构图

```mermaid
graph TB
    subgraph "小智AI层"
        AI[小智AI]
    end
    
    subgraph "代理层"
        P1[ProxyMCPServer实例1]
        P2[ProxyMCPServer实例2]
        P3[ProxyMCPServer实例N]
    end
    
    subgraph "服务管理层"
        SM[MCPServiceManager<br/>中央服务管理器]
        HTTP[HTTP API Server<br/>端口: 8080]
    end
    
    subgraph "MCP服务层"
        M1[Calculator MCP服务<br/>stdio通信]
        M2[DateTime MCP服务<br/>stdio通信]
        M3[其他MCP服务]
    end
    
    AI -.->|WebSocket| P1
    AI -.->|WebSocket| P2
    AI -.->|WebSocket| P3
    
    P1 -->|HTTP API| HTTP
    P2 -->|HTTP API| HTTP
    P3 -->|HTTP API| HTTP
    
    HTTP --> SM
    SM -->|@modelcontextprotocol/sdk| M1
    SM -->|@modelcontextprotocol/sdk| M2
    SM -->|@modelcontextprotocol/sdk| M3
```

### 2.2 核心组件设计

#### 2.2.1 MCPServiceManager（中央服务管理器）
**职责**：
- 管理所有MCP服务的生命周期
- 提供HTTP API接口供代理实例调用
- 维护工具到服务的映射关系
- 处理多实例的资源共享

**核心功能**：
```javascript
class MCPServiceManager {
  // 服务管理
  async startAllServices()
  async startService(serviceName, config)
  async stopAllServices()
  
  // 工具调用
  async callTool(toolName, arguments)
  getAllTools()
  
  // 状态管理
  getStatus()
}
```

#### 2.2.2 ProxyMCPServer（代理服务器）
**职责**：
- 与小智AI建立WebSocket连接
- 处理MCP协议请求（initialize、tools/list、tools/call）
- 通过HTTP API与MCPServiceManager通信

**需要扩展的功能**：
```typescript
class ProxyMCPServer {
  // 新增：HTTP客户端
  private httpClient: AxiosInstance;
  private mcpServiceManagerUrl: string;
  
  // 新增：tools/call处理
  private async handleToolCall(request: MCPMessage): Promise<void>
  
  // 新增：服务管理器注册
  private async registerToServiceManager(): Promise<void>
}
```

## 3. 关键技术实现

### 3.1 MCP服务启动时机

**方案：懒加载 + 预热策略**

1. **系统启动时**：
   - 启动MCPServiceManager作为独立服务
   - 不立即启动MCP服务，等待代理实例注册

2. **代理实例启动时**：
   - ProxyMCPServer向MCPServiceManager注册需要的工具
   - MCPServiceManager根据需要启动相应的MCP服务

3. **优化策略**：
   - 常用服务（如datetime）可以预热启动
   - 使用引用计数管理服务生命周期

### 3.2 请求转发机制

**实现方案：HTTP API + 工具名称映射**

```javascript
// 工具名称格式：{serviceName}__{originalToolName}
// 例如：datetime__get_current_time, calculator__calculator

// ProxyMCPServer 中的 tools/call 处理
private async handleToolCall(request: MCPMessage): Promise<void> {
  try {
    const { name, arguments: args } = request.params;
    
    // 调用 MCPServiceManager 的 HTTP API
    const response = await this.httpClient.post('/api/v1/tools/call', {
      toolName: name,
      arguments: args,
      proxyId: this.proxyId
    });
    
    this.sendResponse(request.id, response.data.result);
  } catch (error) {
    this.sendError(request.id, error);
  }
}
```

### 3.3 响应回传机制

**数据流**：
1. 小智AI → ProxyMCPServer（WebSocket）
2. ProxyMCPServer → MCPServiceManager（HTTP POST）
3. MCPServiceManager → MCP服务（@modelcontextprotocol/sdk）
4. MCP服务 → MCPServiceManager（SDK回调）
5. MCPServiceManager → ProxyMCPServer（HTTP响应）
6. ProxyMCPServer → 小智AI（WebSocket）

## 4. 多实例资源共享方案

### 4.1 服务注册机制

```javascript
// MCPServiceManager HTTP API
POST /api/v1/proxies/register
{
  "proxyId": "proxy-uuid-1",
  "requiredTools": ["datetime__get_current_time", "calculator__calculator"]
}

// 响应
{
  "success": true,
  "registeredTools": ["datetime__get_current_time", "calculator__calculator"],
  "startedServices": ["datetime", "calculator"]
}
```

### 4.2 引用计数管理

```javascript
class MCPServiceManager {
  constructor() {
    this.serviceReferences = new Map(); // 服务引用计数
    this.proxyRegistrations = new Map(); // 代理实例注册信息
  }
  
  async registerProxy(proxyId, requiredTools) {
    // 增加服务引用计数
    for (const toolName of requiredTools) {
      const serviceName = this.parseServiceName(toolName);
      this.incrementServiceReference(serviceName, proxyId);
    }
  }
  
  async unregisterProxy(proxyId) {
    // 减少服务引用计数
    const registration = this.proxyRegistrations.get(proxyId);
    if (registration) {
      for (const toolName of registration.tools) {
        const serviceName = this.parseServiceName(toolName);
        this.decrementServiceReference(serviceName, proxyId);
      }
    }
  }
}
```

## 5. 实现步骤

### 5.1 第一阶段：核心功能实现

**已完成验证**：
- ✅ MCPServiceManager基础实现（MCPServiceManager.js）
- ✅ MCP服务连接和工具调用（test-mcp-manager.js验证成功）

**待实现**：
1. **扩展MCPServiceManager为HTTP服务**
   ```javascript
   // 添加Express.js HTTP服务器
   import express from 'express';
   
   class MCPServiceManager {
     constructor(port = 8080) {
       this.app = express();
       this.setupRoutes();
     }
     
     setupRoutes() {
       this.app.post('/api/v1/tools/call', this.handleToolCall.bind(this));
       this.app.get('/api/v1/tools', this.handleToolsList.bind(this));
       this.app.post('/api/v1/proxies/register', this.handleProxyRegister.bind(this));
     }
   }
   ```

2. **扩展ProxyMCPServer**
   ```typescript
   // 在 src/proxyMCPServer.ts 中添加
   private handleServerRequest(request: MCPMessage): void {
     switch (request.method) {
       // 现有逻辑...
       case "tools/call":
         this.handleToolCall(request);
         break;
     }
   }
   ```

### 5.2 第二阶段：集成测试

1. **单实例测试**：验证单个ProxyMCPServer与MCPServiceManager的集成
2. **多实例测试**：验证多个ProxyMCPServer共享MCP服务
3. **工具子集测试**：验证不同实例使用同一服务的不同工具

### 5.3 第三阶段：生产优化

1. **错误处理和重试机制**
2. **性能监控和日志**
3. **配置热重载**
4. **健康检查机制**

## 6. 配置方案

### 6.1 扩展xiaozhi.config.json

```json
{
  "mcpEndpoint": "wss://xiaozhi.me/mcp",
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": ["./templates/hello-world/mcpServers/calculator.js"]
    },
    "datetime": {
      "command": "node",
      "args": ["./templates/hello-world/mcpServers/datetime.js"]
    }
  },
  "mcpServiceManager": {
    "port": 8080,
    "autoStart": true,
    "serviceTimeout": 30000,
    "cleanupInterval": 300000,
    "preloadServices": ["datetime"]
  },
  "webUI": {
    "port": 9999
  }
}
```

## 7. 验证结果

### 7.1 概念验证成功

通过 `MCPServiceManager.js` 和 `test-mcp-manager.js` 的测试，我们成功验证了：

1. **✅ MCP服务管理**：能够启动和管理多个MCP服务
2. **✅ 工具发现**：能够获取所有服务的工具列表
3. **✅ 工具调用**：能够成功调用不同服务的工具
4. **✅ 工具映射**：使用 `serviceName__toolName` 格式成功区分工具
5. **✅ 资源管理**：能够正确启动和停止服务

### 7.2 测试结果摘要

- **Calculator服务**：1个工具（calculator）
- **DateTime服务**：4个工具（get_current_time, get_current_date, format_datetime, add_time）
- **总计**：5个工具，全部调用成功
- **工具命名**：`calculator__calculator`, `datetime__get_current_time` 等

## 8. 下一步实现建议

### 8.1 立即可实施的改进

1. **将MCPServiceManager改造为HTTP服务**：
   ```bash
   npm install express cors
   ```

2. **扩展ProxyMCPServer添加tools/call处理**：
   ```typescript
   // 在 src/proxyMCPServer.ts 中添加
   case "tools/call":
     await this.handleToolCall(request);
     break;
   ```

3. **添加HTTP客户端依赖**：
   ```bash
   npm install axios
   ```

### 8.2 架构优势

1. **资源效率**：多个代理实例共享同一个MCP服务
2. **灵活性**：支持动态工具选择和服务管理
3. **可扩展性**：易于添加新的MCP服务和工具
4. **容错性**：集中式管理便于实现重试和错误处理
5. **可维护性**：清晰的组件分离和职责划分

### 8.3 技术栈选择

- **通信协议**：HTTP REST API（简单、可靠、易调试）
- **MCP连接**：@modelcontextprotocol/sdk（官方SDK，稳定可靠）
- **进程管理**：SDK内置管理（减少复杂度）
- **工具映射**：前缀命名法（`serviceName__toolName`）

## 9. 风险评估与缓解

### 9.1 潜在风险

1. **单点故障**：MCPServiceManager故障影响所有代理实例
2. **性能瓶颈**：所有工具调用都经过MCPServiceManager
3. **资源竞争**：多个代理实例同时调用同一工具

### 9.2 缓解策略

1. **高可用性**：
   - MCPServiceManager支持多实例部署
   - 实现健康检查和自动重启

2. **性能优化**：
   - 异步处理工具调用
   - 实现连接池和请求缓存
   - 工具调用结果缓存

3. **资源管理**：
   - 实现工具调用队列
   - 添加并发限制和超时机制

## 10. 总结

本架构方案通过引入中央MCPServiceManager成功解决了MCP代理服务器的核心技术问题：

1. **✅ 解决了MCP服务启动时机问题**：采用懒加载策略，按需启动服务
2. **✅ 解决了请求转发机制问题**：通过HTTP API实现清晰的请求路由
3. **✅ 解决了响应回传机制问题**：使用标准HTTP响应机制
4. **✅ 解决了多实例资源共享问题**：通过中央管理器和引用计数机制

**验证结果表明**，该架构方案技术可行，能够有效支持小智AI系统的MCP服务代理需求。通过简化版的实现验证，我们确认了核心概念的正确性，为后续的完整实现奠定了坚实基础。
