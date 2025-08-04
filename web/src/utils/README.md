# MCP 服务工具函数

这个目录包含用于处理 MCP (Model Context Protocol) 服务的工具函数。

## mcpServerUtils.ts

### 主要功能

提供了一套用于判断 MCP 服务通信类型的工具函数，支持三种通信方式：

- **stdio**: 本地进程通信
- **sse**: 服务器推送事件 (Server-Sent Events)
- **streamable-http**: 流式 HTTP 通信

### 核心函数

#### `getMcpServerCommunicationType(serverConfig)`

判断 MCP 服务的通信类型。

**参数:**
- `serverConfig`: MCP 服务配置对象

**返回值:**
- `"stdio" | "sse" | "streamable-http"`

**判断逻辑:**
1. 如果配置对象有 `command` 字段 → `stdio`
2. 如果配置对象有 `type: "sse"` 字段 → `sse`
3. 如果配置对象有 `url` 字段但没有 `type` 字段，或者 `type` 不是 `"sse"` → `streamable-http`

**示例:**

```typescript
import { getMcpServerCommunicationType } from '@/utils/mcpServerUtils';

// stdio 类型
const stdioConfig = {
  command: "node",
  args: ["./mcpServers/calculator.js"]
};
console.log(getMcpServerCommunicationType(stdioConfig)); // "stdio"

// sse 类型
const sseConfig = {
  type: "sse" as const,
  url: "https://mcp.api-inference.modelscope.net/d3cfd34529ae4e/sse"
};
console.log(getMcpServerCommunicationType(sseConfig)); // "sse"

// streamable-http 类型
const httpConfig = {
  url: "https://mcp.amap.com/mcp?key=1ec31da021b2702787841ea4ee822de3"
};
console.log(getMcpServerCommunicationType(httpConfig)); // "streamable-http"
```

### 辅助函数

#### 类型检查函数

- `isStdioMcpServer(serverConfig)`: 检查是否为 stdio 类型
- `isSSEMcpServer(serverConfig)`: 检查是否为 sse 类型
- `isStreamableHTTPMcpServer(serverConfig)`: 检查是否为 streamable-http 类型

#### 显示名称函数

- `getMcpServerTypeDisplayName(serverConfig)`: 获取用于 UI 显示的友好名称

### 使用场景

1. **在 UI 中显示服务类型标签**
   ```typescript
   <Badge variant="outline">
     {getMcpServerCommunicationType(mcpServer)}
   </Badge>
   ```

2. **根据服务类型显示不同的配置信息**
   ```typescript
   const type = getMcpServerCommunicationType(config);
   if (type === "stdio" && "command" in config) {
     return <span>{config.command} {config.args?.join(" ")}</span>;
   } else if ((type === "sse" || type === "streamable-http") && "url" in config) {
     return <span>URL: {config.url}</span>;
   }
   ```

3. **类型安全的配置处理**
   ```typescript
   if (isStdioMcpServer(config)) {
     // TypeScript 知道 config 有 command 和 args 属性
     console.log(config.command, config.args);
   }
   ```

### 测试

运行测试：
```bash
npm test mcpServerUtils.test.ts
```

测试覆盖了所有主要功能和边界情况，包括：
- 各种配置类型的正确识别
- 错误处理
- 实际示例配置的验证

### 兼容性

这个工具函数设计为在服务端和客户端通用，确保判断逻辑在两个环境中保持一致。
