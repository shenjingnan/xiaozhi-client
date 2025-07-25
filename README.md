# Xiaozhi Client

[![npm version](https://badge.fury.io/js/xiaozhi-client.svg)](https://badge.fury.io/js/xiaozhi-client)
[![codecov](https://codecov.io/gh/shenjingnan/xiaozhi-client/branch/main/graph/badge.svg)](https://codecov.io/gh/shenjingnan/xiaozhi-client)
[![CI](https://github.com/shenjingnan/xiaozhi-client/workflows/Release/badge.svg)](https://github.com/shenjingnan/xiaozhi-client/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<img src="https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/qq-qrcode.jpg" alt="QQ群" width="200"/>

小智 AI 客户端，目前主要用于 MCP 的对接

![效果图](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/preview.png)

## 功能特色

- 支持 小智(xiaozhi.me) 官方服务器接入点
- 支持 作为普通 MCP Server 集成到 Cursor/Cherry Studio 等客户端
- 支持 配置多个小智接入点，实现多个小智设备共享一个 MCP 配置
- 支持 通过标准方式聚合多个 MCP Server
- 支持 动态控制 MCP Server 工具的可见性，避免由于无用工具过多导致的小智服务端异常
- 支持 本地化部署的开源服务端集成，你可以使用和小智官方服务端一样的 RPC 通信或直接使用标准 MCP 集成方式
- 支持 Web 网页可视化配置(允许自定义 IP 和端口，你能将 xiaozhi-client 部署在设备 A，然后在设备 B 通过网页控制 xiaozhi-client)
- 支持 集成 ModelScope 的远程 MCP 服务
- 支持 通过模板创建 xiaozhi-client 项目 (xiaozhi create \<my-app\> --template hello-world)
- 支持 后台运行(xiaozhi start -d)

## 快速上手

### 全局安装 xiaozhi-client 命令行工具

```bash
## 安装
npm i -g xiaozhi-client

## 创建项目
xiaozhi create my-app --template hello-world

## 进入项目
cd my-app

## 安装依赖（主要是示例代码中mcp服务所使用的依赖）
pnpm install

# 修改 xiaozhi.config.json 中的 mcpEndpoint 为你的接入点地址（需要自行前往xiaozhi.me获取）
# 小智AI配置MCP接入点使用说明：https://ccnphfhqs21z.feishu.cn/wiki/HiPEwZ37XiitnwktX13cEM5KnSb

## 运行
xiaozhi start
```

### 通过 npx 直接运行

```bash
# 创建项目
npx -y xiaozhi-client create --template hello-world

# 进入项目目录
cd hello-world

# 安装依赖
pnpm install

# 修改 xiaozhi.config.json 中的 mcpEndpoint 为你的接入点地址（需要自行前往xiaozhi.me获取）
# 小智AI配置MCP接入点使用说明：https://ccnphfhqs21z.feishu.cn/wiki/HiPEwZ37XiitnwktX13cEM5KnSb

# 启动服务
npx -y xiaozhi-client start
```

## 可用命令

```bash
# 查看帮助
xiaozhi --help

# 启动服务
xiaozhi start

# 后台启动服务
xiaozhi start --daemon

# 将后台服务转到前台运行
xiaozhi attach

# 查看服务状态
xiaozhi status

# 停止服务
xiaozhi stop

# 重启服务
xiaozhi restart

# 列出所有使用的mcp服务
xiaozhi mcp list

# 列出所有mcp所提供的tools
xiaozhi mcp list --tools
```

## 多接入点配置

xiaozhi-client 支持同时连接多个小智 AI 接入点

### 配置方式

在 `xiaozhi.config.json` 中，`mcpEndpoint` 字段支持两种配置方式：

#### 方式一：单接入点配置（字符串）

```json
{
  "mcpEndpoint": "wss://api.xiaozhi.me/mcp/your-endpoint-id"
}
```

#### 方式二：多接入点配置（字符串数组）

```json
{
  "mcpEndpoint": [
    "wss://api.xiaozhi.me/mcp/endpoint-1",
    "wss://api.xiaozhi.me/mcp/endpoint-2",
    "wss://api.xiaozhi.me/mcp/endpoint-3"
  ]
}
```

### 使用命令管理接入点

```bash
# 查看当前配置的所有接入点
xiaozhi endpoint list

# 添加新的接入点
xiaozhi endpoint add wss://api.xiaozhi.me/mcp/new-endpoint

# 移除指定的接入点
xiaozhi endpoint remove wss://api.xiaozhi.me/mcp/old-endpoint

# 设置接入点（覆盖现有配置）
xiaozhi endpoint set wss://api.xiaozhi.me/mcp/endpoint-1 wss://api.xiaozhi.me/mcp/endpoint-2
```

### 示例配置

```json
{
  "mcpEndpoint": [
    "wss://api.xiaozhi.me/mcp/305847/abc123",
    "wss://api.xiaozhi.me/mcp/468832/def456"
  ],
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": ["./mcpServers/calculator.js"]
    },
    "datetime": {
      "command": "node",
      "args": ["./mcpServers/datetime.js"]
    }
  }
}
```

### 注意事项

- 多接入点配置时，每个接入点会启动独立的 MCP 进程
- 确保每个接入点的 URL 都是有效的
- 接入点之间相互独立，一个接入点的故障不会影响其他接入点
- 建议根据实际需求合理配置接入点数量

## ModelScope MCP 服务集成

xiaozhi-client 现已支持接入 [ModelScope](https://www.modelscope.cn/mcp) 托管的 MCP 服务。

### 配置方式

在 `xiaozhi.config.json` 的 `mcpServers` 中添加 SSE 类型的配置：

```json
{
  "mcpServers": {
    "amap-maps": {
      "type": "sse",
      "url": "https://mcp.api-inference.modelscope.net/caa0bd914d9b44/sse"
    }
  }
}
```

### 使用前准备

1. 获取 ModelScope API Token：

   - 访问 [ModelScope](https://www.modelscope.cn) 并登录
   - 在个人中心获取 API Token

2. 配置 API Token（两种方式任选其一）：

   **方式一：在配置文件中设置（推荐）**

   ```json
   {
     "modelscope": {
       "apiKey": "你的API Token"
     }
   }
   ```

   **方式二：设置环境变量**

   ```bash
   export MODELSCOPE_API_TOKEN="你的API Token"
   ```

3. 启动服务：

   ```bash
   xiaozhi start
   ```

### 注意事项

- ModelScope MCP 服务需要有效的 API Token 才能使用
- 配置文件中的 API Token 优先级高于环境变量
- 确保网络能够访问 ModelScope 的服务端点
- SSE 类型的服务会自动识别并使用相应的连接方式

## 自建服务端 JSON-RPC 消息格式规范

如果您使用自建的 MCP 服务端，请确保遵循以下 JSON-RPC 2.0 消息格式规范：

### 消息类型

#### 1. 请求（Request）- 需要响应

```json
{
  "jsonrpc": "2.0",
  "method": "方法名",
  "params": {},
  "id": 1 // 必须包含id字段，可以是数字或字符串
}
```

支持的请求方法：

- `initialize` - 初始化连接
- `tools/list` - 获取工具列表
- `tools/call` - 调用工具
- `ping` - 连接测试

#### 2. 通知（Notification）- 不需要响应

```json
{
  "jsonrpc": "2.0",
  "method": "方法名",
  "params": {}
  // 注意：不能包含id字段
}
```

支持的通知方法：

- `notifications/initialized` - 初始化完成通知

#### 3. 成功响应（Response）

```json
{
  "jsonrpc": "2.0",
  "result": {},
  "id": 1 // 必须与请求的id相同
}
```

#### 4. 错误响应（Error）

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "错误描述"
  },
  "id": 1 // 必须与请求的id相同
}
```

### 重要注意事项

1. **关键区别**：请求和通知的唯一区别是是否包含 `id` 字段

   - 有 `id` = 请求，需要响应
   - 无 `id` = 通知，不需要响应

2. **"notifications/initialized" 必须作为通知发送**：

   ```json
   // ✅ 正确
   {
     "jsonrpc": "2.0",
     "method": "notifications/initialized"
   }

   // ❌ 错误 - 不应包含id
   {
     "jsonrpc": "2.0",
     "method": "notifications/initialized",
     "id": 1
   }
   ```

3. **消息分隔**：每条 JSON-RPC 消息必须以换行符 `\n` 结束

4. **通信流程**：
   1. 客户端发送 `initialize` 请求
   2. 服务端返回 `initialize` 响应
   3. 客户端发送 `notifications/initialized` 通知（无需响应）
   4. 后续可进行工具列表查询和调用

### 通信时序图

```mermaid
sequenceDiagram
    participant Client as 小智客户端
    participant Server as 自建MCP服务端

    Note over Client,Server: 初始化阶段
    Client->>Server: {"jsonrpc":"2.0","method":"initialize","params":{...},"id":1}
    Server->>Client: {"jsonrpc":"2.0","result":{...},"id":1}
    Client->>Server: {"jsonrpc":"2.0","method":"notifications/initialized"}
    Note over Server: 无需响应通知

    Note over Client,Server: 获取工具列表
    Client->>Server: {"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}
    Server->>Client: {"jsonrpc":"2.0","result":{"tools":[...]},"id":2}

    Note over Client,Server: 调用工具
    Client->>Server: {"jsonrpc":"2.0","method":"tools/call","params":{...},"id":3}
    Server->>Client: {"jsonrpc":"2.0","result":{...},"id":3}

    Note over Client,Server: 保持连接
    Client->>Server: {"jsonrpc":"2.0","method":"ping","params":{},"id":4}
    Server->>Client: {"jsonrpc":"2.0","result":{},"id":4}

    Note over Client,Server: 错误处理示例
    Client->>Server: {"jsonrpc":"2.0","method":"unknown_method","params":{},"id":5}
    Server->>Client: {"jsonrpc":"2.0","error":{"code":-32601,"message":"Method not found"},"id":5}
```

### 常见错误

如果您看到类似 "未知的方法：notifications/initialized" 的错误，通常是因为在通知消息中错误地包含了 `id` 字段，导致客户端将其识别为请求而非通知。

## Web UI 配置界面

xiaozhi-client 提供了一个现代化的 Web UI 界面，让配置 MCP 服务更加直观和便捷。

![Web UI 配置界面](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/web-ui-preview.png)

### 功能特性

- 🎨 **现代化界面**：基于 React + TypeScript + Tailwind CSS 构建
- 🔧 **可视化配置**：直观的界面操作，无需手动编辑 JSON 文件
- 🚀 **实时连接状态**：实时显示与小智服务器的连接状态
- 📦 **MCP 服务管理**：
  - 添加/编辑/删除 MCP 服务
  - 支持本地服务和 SSE 服务
  - 支持批量导入配置
- ⚙️ **配置管理**：
  - 编辑连接参数（心跳间隔、超时时间等）
  - 管理 ModelScope API Key

### 启动 Web UI

```bash
xiaozhi ui
```

## 作为 MCP Server 集成到其他客户端

> 需升级至 `1.5.0` 及以上版本

xiaozhi-client 不仅可以作为小智 AI 的客户端使用，还可以作为标准的 MCP Server 被 Cursor、Cherry Studio 等支持 MCP 协议的客户端集成。

这样做的好处是你无需在多个客户端中重复配置 MCP Server，只需要在 xiaozhi.config.json 中配置一遍 MCP 服务，即可在任意客户端集成。

并且，由于 xiaozhi-client 允许你自定义暴露哪些 MCP Server tools 因此你可以选择性的定制自己的工具集。

![在CherryStudio中集成](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/integrate-to-cherry-studio.png)
![在Cursor中集成](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/integrate-to-cursor.png)

### 方式一：使用 stdio 模式（推荐）

第一步：确保已全局安装 xiaozhi-client：

```bash
npm install -g xiaozhi-client
```

第二步：在 客户端 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "xiaozhi-client": {
      "command": "xiaozhi",
      "args": ["start", "--stdio"]
    }
  }
}
```

提示：如果需要指定配置文件位置，可以使用环境变量

配置文件的查找顺序

1. 当前工作目录
2. 通过 `XIAOZHI_CONFIG_DIR` 环境变量指定的目录

```json
{
  "mcpServers": {
    "xiaozhi-client": {
      "command": "xiaozhi",
      "args": ["start", "--stdio"],
      "env": {
        "XIAOZHI_CONFIG_DIR": "/path/to/your/config/directory"
      }
    }
  }
}
```

### 方式二：使用 HTTP Server 模式

> 如果你将 xiaozhi-client 装在 docker 中使用，可以通过 http server 的方式暴露给外部客户端

第一步：启动 xiaozhi-client 的 HTTP Server：

```bash
# 使用默认端口 3000
xiaozhi start --server

# 使用自定义端口
xiaozhi start --server 8080

# 后台运行
xiaozhi start --server --daemon
```

第二步：在 客户端 中配置 SSE 连接：

```json
{
  "mcpServers": {
    "xiaozhi-client": {
      "type": "sse",
      "url": "http://localhost:3000/sse"
    }
  }
}
```
