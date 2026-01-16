# @xiaozhi-client/mcp-core 可运行示例

本目录包含 `@xiaozhi-client/mcp-core` 包的可运行示例，展示如何连接到不同类型的 MCP 服务并使用工具。

## 前置要求

- Node.js 18+
- pnpm 或 npm

## 安装依赖

```bash
# 进入示例目录
cd packages/mcp-core/examples

# 安装依赖
pnpm install
```

## 运行示例

### stdio 示例

连接到 stdio 类型的 MCP 服务（如 calculator-mcp）：

```bash
pnpm connect:stdio
```

### http 示例

连接到 http 类型的 MCP 服务（如 ModelScope 托管的 12306-mcp）：

```bash
pnpm connect:http
```

### SSE 示例

连接到 SSE 类型的 MCP 服务（如 ModelScope 托管的 12306-mcp）：

```bash
pnpm connect:sse
```

### streamable-http 示例

演示 streamable-http 服务的连接，展示 type 字段的多种格式兼容性：

```bash
pnpm connect:streamable-http
```

**支持的 type 格式：**
- `streamable-http` - MCP 官方格式
- `streamableHttp` - camelCase 格式
- `streamable_http` - snake_case 格式
- `http` - 标准格式

所有格式都会被自动规范化为 `http` 类型并正常连接。

### 多服务管理示例

使用 MCPManager 管理多个 stdio MCP 服务（calculator-mcp 和 datetime-mcp）：

```bash
pnpm connect:multi
```

## 代码说明

示例文件 `stdio.ts` 展示了如何使用 `MCPConnection` 连接到 stdio 类型的 MCP 服务：

### 1. 创建服务配置

```typescript
const serviceName = "calculator";              // 服务名称
const config = {
  type: MCPTransportType.STDIO,                // 传输类型：stdio
  command: "npx",                              // 执行命令
  args: ["-y", "@xiaozhi-client/calculator-mcp@1.9.7-beta.16"], // 命令参数
};
```

### 2. 创建连接并建立连接

```typescript
const connection = new MCPConnection(serviceName, config);
await connection.connect();
```

### 3. 获取工具列表

```typescript
const tools = connection.getTools();
```

### 4. 调用工具

```typescript
const result = await connection.callTool("calculator", {
  expression: "1 + 1",
});
```

### 5. 断开连接

```typescript
await connection.disconnect();
```

---

## 多服务管理示例说明

示例文件 `multi-manager.ts` 展示了如何使用 `MCPManager` 管理多个 MCP 服务：

### 1. 创建管理器

```typescript
const manager = new MCPManager();
```

### 2. 添加多个服务

```typescript
// 添加计算器服务
manager.addServer('calculator', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@xiaozhi-client/calculator-mcp']
});

// 添加日期时间服务
manager.addServer('datetime', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@xiaozhi-client/datetime-mcp']
});
```

### 3. 监听事件

```typescript
manager.on('connected', ({ serverName, tools }) => {
  console.log(`✅ 服务 ${serverName} 已连接，发现 ${tools.length} 个工具`);
});

manager.on('error', ({ serverName, error }) => {
  console.error(`❌ 服务 ${serverName} 出错:`, error.message);
});
```

### 4. 连接所有服务

```typescript
await manager.connect();
```

### 5. 列出各服务的工具

```typescript
// 获取所有工具
const allTools = manager.listTools();

// 按服务分组
const toolsByServer: Record<string, typeof allTools> = {};
for (const tool of allTools) {
  if (!toolsByServer[tool.serverName]) {
    toolsByServer[tool.serverName] = [];
  }
  toolsByServer[tool.serverName].push(tool);
}

// 打印每个服务的工具
for (const [serverName, tools] of Object.entries(toolsByServer)) {
  console.log(`【${serverName}】`);
  for (const tool of tools) {
    console.log(`  - ${tool.name}: ${tool.description}`);
  }
}
```

### 6. 调用指定服务的工具

```typescript
// 调用 calculator 服务的工具
const calcResult = await manager.callTool('calculator', 'calculator', {
  expression: '12 * 3 + 4'
});

// 调用 datetime 服务的工具
const timeResult = await manager.callTool('datetime', 'get_current_time', {
  format: 'locale'
});
```

### 7. 查询服务状态

```typescript
// 获取所有服务状态
const allStatus = manager.getAllServerStatus();
for (const [serverName, status] of Object.entries(allStatus)) {
  console.log(`【${serverName}】`);
  console.log(`  已连接: ${status.connected}`);
  console.log(`  工具数: ${status.toolCount}`);
}

// 获取已连接的服务列表
const connectedServers = manager.getConnectedServerNames();
```

### 8. 断开所有连接

```typescript
await manager.disconnect();
```

---

## http 示例说明

示例文件 `http.ts` 展示了如何使用 `MCPConnection` 连接到 http 类型的 MCP 服务：

### 1. 创建服务配置

```typescript
const serviceName = "12306-mcp";                  // 服务名称
const config = {
  type: MCPTransportType.HTTP,                   // 传输类型：http
  url: "https://mcp.api-inference.modelscope.net/7521b0f1413b49/mcp", // 服务 URL
};
```

### 2. 创建连接并建立连接

```typescript
const connection = new MCPConnection(serviceName, config);
await connection.connect();
```

### 3. 获取工具列表

```typescript
const tools = connection.getTools();
```

### 4. 调用工具

```typescript
const result = await connection.callTool("tool-name", {
  // 工具参数
});
```

### 5. 断开连接

```typescript
await connection.disconnect();
```

### 使用 API Key 认证

```typescript
const serviceName = "my-service";
const config = {
  url: "https://api.example.com/mcp",
  apiKey: "your-api-key"                          // 添加 Bearer 认证
};
```

### 使用自定义请求头

```typescript
const serviceName = "my-service";
const config = {
  url: "https://api.example.com/mcp",
  headers: {                                      // 自定义请求头
    "Authorization": "Bearer token",
    "X-Custom-Header": "value"
  }
};
```

**注意**: `type` 字段是可选的，MCPConnection 会根据 URL 自动推断传输类型：
- URL 以 `/mcp` 结尾 → 自动识别为 `http` 类型
- URL 以 `/sse` 结尾 → 自动识别为 `sse` 类型

---

## SSE 示例说明

示例文件 `sse.ts` 展示了如何使用 `MCPConnection` 连接到 SSE 类型的 MCP 服务：

### 1. 创建服务配置

```typescript
const serviceName = "12306-mcp";                  // 服务名称
const config = {
  type: MCPTransportType.SSE,                     // 传输类型：sse
  url: "https://mcp.api-inference.modelscope.net/ed2b195cc8f94d/sse", // 服务 URL
};
```

### 2. 创建连接并建立连接

```typescript
const connection = new MCPConnection(serviceName, config);
await connection.connect();
```

### 3. 获取工具列表

```typescript
const tools = connection.getTools();
```

### 4. 调用工具

```typescript
const result = await connection.callTool("tool-name", {
  // 工具参数
});
```

### 5. 断开连接

```typescript
await connection.disconnect();
```

### 使用自定义请求头

```typescript
const serviceName = "my-service";
const config = {
  url: "https://api.example.com/sse",
  headers: {                                    // 自定义请求头
    "Authorization": "Bearer token",
    "X-Custom-Header": "value"
  }
};
```

---

## 如何修改为自己的 MCP 服务

只需要修改 `serviceName` 和 `config` 变量即可：

### 使用本地 MCP 服务

```typescript
const serviceName = "my-service";              // 服务名称
const config = {
  type: MCPTransportType.STDIO,                // 传输类型，stdio 表示通过标准输入输出通信
  command: "node",                             // 执行命令
  args: ["./my-mcp-server.js"]                 // 命令参数
};
const connection = new MCPConnection(serviceName, config);
```

### 使用 npx 安装远程 MCP 服务

```typescript
const serviceName = "my-service";
const config = {
  type: MCPTransportType.STDIO,
  command: "npx",
  args: ["-y", "@xiaozhi-client/my-mcp@1.0.0"] // -y 表示自动确认安装
};
const connection = new MCPConnection(serviceName, config);
```

### 使用 Python MCP 服务

```typescript
const serviceName = "my-python-service";
const config = {
  type: MCPTransportType.STDIO,
  command: "python",
  args: ["./my-mcp-server.py"]
};
const connection = new MCPConnection(serviceName, config);
```

### 使用带环境变量的 MCP 服务

```typescript
const serviceName = "my-service";
const config = {
  type: MCPTransportType.STDIO,
  command: "node",
  args: ["./my-mcp-server.js"],
  env: {                                         // 环境变量配置
    API_KEY: "your-api-key",
    DEBUG: "true"
  }
};
const connection = new MCPConnection(serviceName, config);
```

## 注意事项

- 示例脚本会通过 `npx` 启动 MCP 服务，确保网络连接正常
- 首次运行时，npx 会自动下载 calculator-mcp 包
- 启动服务可能需要几秒钟
- 示例包含完整的错误处理和中文注释

## 相关文档

- [@xiaozhi-client/mcp-core README](../README.md)
- [MCP 协议规范](https://modelcontextprotocol.io/)
