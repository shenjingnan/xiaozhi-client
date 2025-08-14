# 示例文件使用说明

本文档详细介绍了 `src/services/` 目录中所有 `.example.ts` 文件的功能、使用方法和运行步骤。

## 概述

项目中包含以下示例文件：

1. **AdvancedFeatures.example.ts** - 高级功能演示（错误处理、性能监控、健康检查、配置热重载）
2. **MCPService.example.ts** - MCPService 基础使用示例
3. **MCPService.ping.example.ts** - MCP Service Ping 功能演示
4. **MCPServiceManager.example.ts** - MCPServiceManager 使用示例

## 环境要求

### 系统要求

- Node.js >= 18.0.0
- pnpm 包管理器（推荐）或 npm/yarn

### 项目依赖

确保已安装项目依赖：

```bash
pnpm install
```

### 必要的配置文件

示例运行需要以下配置文件：

- `xiaozhi.config.json` - 主配置文件
- `templates/hello-world/mcpServers/calculator.js` - 计算器 MCP 服务
- `templates/hello-world/mcpServers/datetime.js` - 日期时间 MCP 服务

## 示例文件详细说明

### 1. AdvancedFeatures.example.ts

**功能说明：**
演示 xiaozhi-client 的高级功能，包括：
- 错误处理和分类
- 性能监控和指标收集
- 健康检查和服务监控
- 配置文件热重载

**运行方法：**

```bash
# 方法一：使用 Node.js 直接运行
pnpm example src/services/AdvancedFeatures.example.ts

# 方法二：使用 tsx 运行（需要安装 tsx）
npx tsx src/services/AdvancedFeatures.example.ts

# 方法三：编译后运行
pnpm build
node dist/services/AdvancedFeatures.example.js
```

**可用的命令参数：**
```bash
# 运行完整演示（默认）
pnpm example src/services/AdvancedFeatures.example.ts

# 只演示错误处理
pnpm example src/services/AdvancedFeatures.example.ts error

# 只演示性能监控
pnpm example src/services/AdvancedFeatures.example.ts performance

# 只演示健康检查
pnpm example src/services/AdvancedFeatures.example.ts health

# 只演示配置热重载
pnpm example src/services/AdvancedFeatures.example.ts config
```

**预期输出：**
- 错误分类和处理策略信息
- 性能指标统计数据
- 服务健康状态报告
- 配置变更监听日志

**注意事项：**
- 配置热重载演示需要手动修改 `xiaozhi.config.json` 文件来触发变更事件
- 健康检查演示会启动实际的 MCP 服务，确保配置文件正确

### 2. MCPService.example.ts

**功能说明：**
演示 MCPService 类的基础使用，包括：
- 服务连接和断开
- 工具列表获取
- 工具调用
- 重连配置管理

**运行方法：**

```bash
# 使用 Node.js 运行
pnpm example src/services/MCPService.example.ts

# 使用 tsx 运行
npx tsx src/services/MCPService.example.ts

# 编译后运行
pnpm build
node dist/services/MCPService.example.js
```

**预期输出：**
- 服务连接状态信息
- 可用工具列表
- 工具调用结果（注意：当前示例代码对 calculator 工具缺少必需参数，会显示调用失败）
- 重连配置信息

**注意：** 当前示例代码中的工具调用逻辑只处理了 `add` 和 `multiply` 工具，但实际的计算器服务提供的是 `calculator` 工具，需要 `javascript_expression` 参数。如果要修复这个问题，可以在示例代码中添加：

```typescript
if (firstTool.name === "calculator") {
  args = { javascript_expression: "5 + 3" };
}
```

**依赖的 MCP 服务：**
- 计算器服务：`templates/hello-world/mcpServers/calculator.js`

### 3. MCPService.ping.example.ts

**功能说明：**
演示 MCP Service 的 Ping 监控功能，包括：
- Ping 配置管理
- 连接状态监控
- 故障检测和恢复
- 运行时配置更新

**运行方法：**

```bash
# 使用 Node.js 运行
pnpm example src/services/MCPService.ping.example.ts

# 使用 tsx 运行
npx tsx src/services/MCPService.ping.example.ts

# 编译后运行
pnpm build
node dist/services/MCPService.ping.example.js
```

**预期输出：**
- Ping 配置信息
- 连接状态和 Ping 统计
- 配置动态更新演示
- 默认行为对比演示

**依赖的 MCP 服务：**
- 日期时间服务：`templates/hello-world/mcpServers/datetime.js`

### 4. MCPServiceManager.example.ts

**功能说明：**
演示 MCPServiceManager 的服务管理功能，包括：
- 多服务管理
- 服务启动和停止
- 工具聚合和调用
- 配置动态管理

**运行方法：**

```bash
# 使用 Node.js 运行
pnpm example src/services/MCPServiceManager.example.ts

# 使用 tsx 运行
npx tsx src/services/MCPServiceManager.example.ts

# 编译后运行
pnpm build
node dist/services/MCPServiceManager.example.js
```

**预期输出：**
- 服务管理器状态
- 所有可用工具列表
- 工具调用演示
- 单个服务管理操作
- 配置管理演示

**依赖的 MCP 服务：**
- 计算器服务和日期时间服务（通过默认配置加载）

## 运行环境配置

### 配置文件设置

确保 `xiaozhi.config.json` 文件存在并包含正确的配置：

```json
{
  "mcpEndpoint": "<请填写你的接入点地址（获取地址在 xiaozhi.me）>",
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
  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },
  "webUI": {
    "port": 9999
  }
}
```

### 环境变量

可选的环境变量：
- `XIAOZHI_CONFIG_DIR` - 指定配置文件目录
- `NODE_ENV` - 设置运行环境（development/production）

## 常见问题和故障排除

### 1. 模块导入错误

**问题：** `Cannot find module` 或 `ERR_MODULE_NOT_FOUND`

**解决方案：**
```bash
# 确保依赖已安装
pnpm install

# 检查 Node.js 版本
node --version  # 应该 >= 18.0.0

# 使用正确的加载器
pnpm example src/services/AdvancedFeatures.example.ts
```

### 2. MCP 服务连接失败

**问题：** `Connection refused` 或 `ENOENT` (文件不存在错误)

**解决方案：**
```bash
# 检查 MCP 服务文件是否存在
ls -la templates/hello-world/mcpServers/

# 确保 calculator.js 和 datetime.js 可执行
node templates/hello-world/mcpServers/calculator.js

# 检查配置文件路径
cat xiaozhi.config.json
```

### 3. 权限错误

**问题：** `EACCES` (权限被拒绝错误) 或权限被拒绝

**解决方案：**
```bash
# 检查文件权限
chmod +x templates/hello-world/mcpServers/*.js

# 确保当前用户有读写权限
ls -la xiaozhi.config.json
```

### 4. TypeScript 编译错误

**问题：** TypeScript 类型错误

**解决方案：**
```bash
# 检查类型
pnpm type:check

# 安装类型定义
pnpm install --save-dev @types/node

# 使用 tsx 替代 ts-node
npx tsx src/services/AdvancedFeatures.example.ts
```

## 开发和调试

### 启用详细日志

在示例文件中，可以通过修改日志级别来获取更多调试信息：

```typescript
// 在示例文件顶部添加
process.env.DEBUG = "xiaozhi:*";
```

### 使用调试器

```bash
# 使用 Node.js 调试器
node --inspect --loader ts-node/esm src/services/AdvancedFeatures.example.ts

# 使用 VS Code 调试
# 在 .vscode/launch.json 中添加配置
```

### 测试运行

```bash
# 运行相关测试
pnpm test src/services/__tests__/

# 运行特定测试文件
pnpm test src/services/__tests__/MCPService.test.ts
```

## 最佳实践

### 1. 示例代码使用场景

- **学习和理解：** 通过运行示例了解各个组件的功能
- **集成参考：** 将示例代码作为集成到自己项目的参考
- **功能测试：** 验证 MCP 服务的正确性和性能
- **故障排除：** 使用示例诊断配置和连接问题

### 2. 生产环境注意事项

- 不要在生产环境直接运行示例文件
- 示例中的配置仅供参考，需要根据实际需求调整
- 注意安全性，特别是在使用 `eval()` 等功能时
- 建议使用环境变量管理敏感配置

### 3. 自定义扩展

示例文件可以作为基础进行扩展：

```typescript
// 基于示例创建自定义服务
import { AdvancedFeaturesDemo } from './AdvancedFeatures.example.js';

class MyCustomDemo extends AdvancedFeaturesDemo {
  // 添加自定义功能
}
```

## 快速开始指南

### 第一次运行示例

1. **克隆或下载项目**

```bash
git clone <repository-url>
cd xiaozhi-client
```

2. **安装依赖**

```bash
pnpm install
```

3. **配置文件准备**

```bash
# 复制示例配置文件
cp xiaozhi.config.json.example xiaozhi.config.json

# 编辑配置文件，填入你的接入点地址
nano xiaozhi.config.json
```

4. **运行第一个示例**

```bash
# 运行 MCPService 基础示例
npx tsx src/services/MCPService.example.ts
```

### 推荐的学习顺序

1. **MCPService.example.ts** - 了解基础服务操作
2. **MCPService.ping.example.ts** - 学习监控功能
3. **MCPServiceManager.example.ts** - 掌握多服务管理
4. **AdvancedFeatures.example.ts** - 探索高级功能

## 示例输出详解

### MCPService.example.ts 典型输出

```text
🚀 MCPService 使用示例
📡 正在连接到 MCP 服务...
✅ 连接成功！
📊 服务状态: {
  name: 'calculator',
  connected: true,
  initialized: true,
  toolCount: 1,
  connectionState: 'connected'
}
🛠️  可用工具: [
  {
    name: 'calculator',
    description: 'For mathematical calculation, always use this tool to calculate the result of a JavaScript expression. Math object and basic operations are available.'
  }
]
🔧 调用工具: calculator
📋 工具调用结果: {
  content: [
    {
      type: 'text',
      text: '{"success":true,"result":8}'
    }
  ]
}
⚙️  当前重连配置: {
  enabled: true,
  maxAttempts: 5,
  initialInterval: 2000,
  maxInterval: 30000,
  backoffMultiplier: 2
}
🔄 更新后的重连配置: {
  enabled: true,
  maxAttempts: 8,
  initialInterval: 1500,
  maxInterval: 30000,
  backoffMultiplier: 2
}
🔌 断开连接...
👋 示例结束
```

### AdvancedFeatures.example.ts 典型输出

```text
🚀 开始高级功能完整演示
=== 错误处理功能演示 ===
错误: Connection refused
分类: CONNECTION_ERROR (CONN_001)
可恢复: 是
恢复策略: RETRY_WITH_BACKOFF
用户消息: 连接服务失败，正在尝试重新连接...
需要告警: 否
---
=== 性能监控功能演示 ===
服务: demo-service
总操作数: 5
成功操作: 4
失败操作: 1
成功率: 80.0%
错误率: 20.0%
平均工具调用延迟: 180ms
运行时间: 0.1s
性能报告:
总服务数: 1
总操作数: 5
平均成功率: 80.0%
平均错误率: 20.0%
=== 健康检查功能演示 ===
健康检查结果:
服务: test-stdio-service
健康状态: 健康
连接稳定: 是
响应时间: 45ms
错误率: 0.0%
运行时间: 2.3s
---
✅ 高级功能演示完成
要演示配置热重载功能，请运行: npm run demo:config-watch
```

## 高级用法和扩展

### 自定义 MCP 服务

你可以创建自己的 MCP 服务来配合示例使用：

```javascript
// myCustomService.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "MyCustomService",
  version: "1.0.0",
});

server.tool(
  "greet",
  "Greet a person with a custom message",
  {
    name: z.string().describe("Name of the person to greet"),
    message: z.string().optional().describe("Custom greeting message"),
  },
  async ({ name, message = "Hello" }) => {
    return {
      content: [
        {
          type: "text",
          text: `${message}, ${name}!`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

然后在配置文件中添加：

```json
{
  "mcpServers": {
    "my-custom-service": {
      "command": "node",
      "args": ["./myCustomService.js"]
    }
  }
}
```

### 集成到现有项目

```typescript
// 在你的项目中使用示例代码
import { MCPService, MCPTransportType } from './src/services/MCPService.js';

async function integrateWithMyApp() {
  const service = new MCPService({
    name: "my-app-service",
    type: MCPTransportType.STDIO,
    command: "node",
    args: ["./my-mcp-server.js"],
    ping: {
      enabled: true,
      interval: 30000,
    }
  });

  await service.connect();

  // 使用服务...
  const tools = service.getTools();
  const result = await service.callTool("my-tool", { param: "value" });

  await service.disconnect();
}
```

### 性能优化建议

1. **连接池管理**
```typescript
// 使用连接池避免频繁连接断开
const servicePool = new Map<string, MCPService>();

async function getOrCreateService(config: MCPServiceConfig): Promise<MCPService> {
  if (!servicePool.has(config.name)) {
    const service = new MCPService(config);
    await service.connect();
    servicePool.set(config.name, service);
  }
  return servicePool.get(config.name)!;
}
```

2. **错误处理策略**
```typescript
// 实现智能重试机制
async function callToolWithRetry(service: MCPService, toolName: string, args: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await service.callTool(toolName, args);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

## 故障排除进阶

### 日志分析

启用详细日志来诊断问题：

```bash
# 设置环境变量启用调试日志
export DEBUG=xiaozhi:*,mcp:*
npx tsx src/services/AdvancedFeatures.example.ts
```

### 网络问题诊断

```bash
# 检查端口占用
lsof -i :9999

# 测试网络连接
telnet localhost 9999

# 检查防火墙设置
sudo ufw status
```

### 内存和性能监控

```bash
# 使用 Node.js 内置性能监控
node --inspect --loader ts-node/esm src/services/AdvancedFeatures.example.ts

# 使用 clinic.js 进行性能分析
npx clinic doctor -- pnpm example src/services/AdvancedFeatures.example.ts
```

## 相关文档

- [CLI 使用说明](./CLI.md)
- [架构文档](./Architecture.md)
- [配置管理](./SettingManager.md)
- [项目 README](../README.md)

## 贡献和反馈

如果你在使用示例过程中遇到问题或有改进建议，欢迎：

1. 提交 Issue 报告问题
2. 提交 Pull Request 改进文档
3. 在社区讨论中分享使用经验

---

*最后更新时间：2024年12月*
