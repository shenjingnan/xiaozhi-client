# @xiaozhi-client/mcp-core 可运行示例

本目录包含 `@xiaozhi-client/mcp-core` 包的可运行示例，展示如何连接到 stdio 类型的 MCP 服务并使用工具。

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

```bash
pnpm start
```

## 代码说明

示例文件 `stdio.ts` 展示了如何使用 `MCPConnection` 连接到 stdio 类型的 MCP 服务：

### 1. 创建服务配置

```typescript
const config = {
  name: "calculator",                    // 服务名称
  type: "stdio" as const,                 // 传输类型：stdio
  command: "npx",                         // 执行命令
  args: ["-y", "@xiaozhi-client/calculator-mcp@1.9.7-beta.16"], // 命令参数
};
```

### 2. 创建连接并建立连接

```typescript
const connection = new MCPConnection(config);
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

## 如何修改为自己的 MCP 服务

只需要修改 `config` 变量即可：

### 使用本地 MCP 服务

```typescript
const config = {
  name: "my-service",           // 服务名称
  type: "stdio" as const,        // 传输类型，stdio 表示通过标准输入输出通信
  command: "node",               // 执行命令
  args: ["./my-mcp-server.js"]   // 命令参数
};
```

### 使用 npx 安装远程 MCP 服务

```typescript
const config = {
  name: "my-service",
  type: "stdio" as const,
  command: "npx",
  args: ["-y", "@xiaozhi-client/my-mcp@1.0.0"]  // -y 表示自动确认安装
};
```

### 使用 Python MCP 服务

```typescript
const config = {
  name: "my-python-service",
  type: "stdio" as const,
  command: "python",
  args: ["./my-mcp-server.py"]
};
```

### 使用带环境变量的 MCP 服务

```typescript
const config = {
  name: "my-service",
  type: "stdio" as const,
  command: "node",
  args: ["./my-mcp-server.js"],
  env: {                           // 环境变量配置
    API_KEY: "your-api-key",
    DEBUG: "true"
  }
};
```

## 注意事项

- 示例脚本会通过 `npx` 启动 MCP 服务，确保网络连接正常
- 首次运行时，npx 会自动下载 calculator-mcp 包
- 启动服务可能需要几秒钟
- 示例包含完整的错误处理和中文注释

## 相关文档

- [@xiaozhi-client/mcp-core README](../README.md)
- [MCP 协议规范](https://modelcontextprotocol.io/)
