# Xiaozhi Client

[![npm version](https://img.shields.io/npm/v/xiaozhi-client)](https://www.npmjs.com/package/xiaozhi-client)
[![codecov](https://codecov.io/gh/shenjingnan/xiaozhi-client/branch/main/graph/badge.svg)](https://codecov.io/gh/shenjingnan/xiaozhi-client)
[![CI](https://github.com/shenjingnan/xiaozhi-client/workflows/Release/badge.svg)](https://github.com/shenjingnan/xiaozhi-client/actions)
[![Docker: Ready](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://hub.docker.com/r/shenjingnan/xiaozhi-client)
[![Join: QQ Group](https://img.shields.io/badge/Join-QQ%20Group-5865F2?style=flat&logo=qq&logoColor=white)](https://qun.qq.com/universal-share/share?ac=1&authKey=c08PvS2zvAF1NN%2F%2BuaOi0ze1AElTIsvFBLwbWUMFc2ixjaZYxqZTUQHzipwd8Kka&busi_data=eyJncm91cENvZGUiOiIxMDU0ODg4NDczIiwidG9rZW4iOiJuSmJUN2cyUEVkNEQ5WXovM3RQbFVNcDluMGVibUNZTUQvL1RuQnFJRjBkZmRZQnRBRTdwU0szL3V2Y0dLc1ZmIiwidWluIjoiMzkxMTcyMDYwMCJ9&data=9cH6_zEC-sN3xYlwzKEWiYF71RLY9CId5taN-gy6XZo7axSlSWDpd1Ojui5hYMQKIgEJYSPw59XYgF5vH2wLog&svctype=4&tempid=h5_group_info)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![AI Code: 90%+](https://img.shields.io/badge/AI%20Code-90%25%2B-brightgreen)](https://img.shields.io/badge/AI%20Code-90%25%2B-brightgreen)
[![Xiaozhi AI: Supported](https://img.shields.io/badge/小智AI-Supported-ff6b35?style=flat)](http://xiaozhi.me)
[![ModelScope: Supported](https://img.shields.io/badge/ModelScope-Supported-6366f1?style=flat)](https://www.modelscope.cn/mcp)
![MCP Client: Compatible](https://img.shields.io/badge/MCP%20Client-Compatible-00d4aa?style=flat)

<img src="https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/qq-group-qrcode.jpg" alt="QQ群" width="300"/>

小智 AI 客户端，目前主要用于 MCP 的对接

![效果图](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/preview.png)

## 目录

1. [Xiaozhi Client](#xiaozhi-client)
   1. [目录](#目录)
   2. [功能特色](#功能特色)
   3. [快速上手](#快速上手)
      1. [使用 Docker 运行](#使用-docker-运行)
   4. [可用命令](#可用命令)
   5. [多接入点配置](#多接入点配置)
      1. [配置方式](#配置方式)
         1. [方式一：单接入点配置（字符串）](#方式一单接入点配置字符串)
         2. [方式二：多接入点配置（字符串数组）](#方式二多接入点配置字符串数组)
      2. [使用命令管理接入点](#使用命令管理接入点)
      3. [示例配置](#示例配置)
      4. [注意事项](#注意事项)
   6. [ModelScope MCP 服务集成](#modelscope-mcp-服务集成)
      1. [ModelScope 配置方式](#modelscope-配置方式)
      2. [使用前准备](#使用前准备)
      3. [ModelScope 注意事项](#modelscope-注意事项)
   7. [Web UI 配置界面](#web-ui-配置界面)
      1. [功能特性](#功能特性)
      2. [启动 Web UI](#启动-web-ui)
   8. [作为 MCP Server 集成到其他客户端](#作为-mcp-server-集成到其他客户端)

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

> 前置条件：请先完成 node:22(LTS) 与 pnpm 的安装

```bash
# 安装
pnpm install -g xiaozhi-client

# 创建应用
xiaozhi create my-app

# 进入应用目录
cd my-app

# 安装依赖
pnpm install

# 小智AI配置MCP接入点的 [使用说明](https://ccnphfhqs21z.feishu.cn/wiki/HiPEwZ37XiitnwktX13cEM5KnSb)
xiaozhi config set mcpEndpoint "<从小智服务端获取到的接入点地址>"

# 启动服务
xiaozhi start

# 最后，请前往小智服务端，检查对应的接入点，刷新后是否能获取到工具列表
```

### 使用 Docker 运行

我们提供了预配置的 Docker 镜像，可以快速启动 xiaozhi-client 环境。

#### 前置要求

- 已安装 Docker
- 已获取小智接入点地址（参见[小智AI配置MCP接入点的使用说明](https://ccnphfhqs21z.feishu.cn/wiki/HiPEwZ37XiitnwktX13cEM5KnSb)）

#### 快速启动

##### 方式一：使用启动脚本（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docker-start.sh | bash
```

> 无法访问 `Github` 可以使用 `Gitee` 替代

```bash
curl -fsSL https://gitee.com/shenjingnan/xiaozhi-client/raw/main/docker-start.sh | bash
```

##### 方式二：使用 Docker Compose

获取 docker-compose.yml 文件：

```bash
curl -O https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docker-compose.yml
```

> 无法访问 `Github` 可以使用 `Gitee` 替代

```bash
curl -O https://gitee.com/shenjingnan/xiaozhi-client/raw/main/docker-compose.yml
```

```bash
# 使用 Docker Compose 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 可用命令

### 基本命令

```bash
# 查看帮助
xiaozhi --help

# 查看版本信息
xiaozhi --version

# 查看详细系统信息
xiaozhi --info
```

### 项目管理

```bash
# 创建项目
xiaozhi create my-app --template hello-world

# 初始化配置文件
xiaozhi config init

# 查看配置
xiaozhi config get mcpEndpoint

# 设置配置
xiaozhi config set mcpEndpoint "your-endpoint-url"
```

### 服务管理

```bash
# 启动服务（前台）
xiaozhi start

# 后台启动服务
xiaozhi start -d

# 启动并打开 Web UI
xiaozhi start -u

# 以 MCP Server 模式启动（用于 Cursor 等客户端）
xiaozhi start --stdio

# 查看服务状态
xiaozhi status

# 停止服务
xiaozhi stop

# 重启服务
xiaozhi restart

# 将后台服务转到前台运行
xiaozhi attach
```

### MCP 管理

```bash
# 列出所有 MCP 服务
xiaozhi mcp list

# 列出所有 MCP 工具
xiaozhi mcp list --tools

# 查看特定服务
xiaozhi mcp server calculator
```

### 端点管理

```bash
# 列出所有端点
xiaozhi endpoint list

# 添加端点
xiaozhi endpoint add "ws://new-server:8080"

# 移除端点
xiaozhi endpoint remove "ws://old-server:8080"
```

### Web UI

```bash
# 启动 Web 配置界面
xiaozhi ui
```

> 📖 **详细使用说明**: 查看 [CLI 使用手册](docs/CLI.md) 获取完整的命令参考和使用示例。

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
xiaozhi endpoint add "wss://api.xiaozhi.me/mcp/new-endpoint"

# 移除指定的接入点
xiaozhi endpoint remove "wss://api.xiaozhi.me/mcp/old-endpoint"

# 设置单个接入点（覆盖现有配置）
xiaozhi endpoint set "wss://api.xiaozhi.me/mcp/endpoint-1"

# 或者使用 config 命令设置
xiaozhi config set mcpEndpoint "wss://api.xiaozhi.me/mcp/endpoint-1"
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

### ModelScope 配置方式

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

### ModelScope 注意事项

- ModelScope MCP 服务需要有效的 API Token 才能使用
- 配置文件中的 API Token 优先级高于环境变量
- 确保网络能够访问 ModelScope 的服务端点
- SSE 类型的服务会自动识别并使用相应的连接方式

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
# 启动 Web 配置界面
xiaozhi ui

# 或者在启动服务时同时启动 Web UI
xiaozhi start -u
```

启动后访问 <http://localhost:9999> 进行可视化配置。

## 作为 MCP Server 集成到其他客户端

> 需升级至 `1.6.12` 及以上版本

xiaozhi-client 不仅可以作为小智 AI 的客户端使用，还可以作为标准的 MCP Server 被 Cursor、Cherry Studio 等支持 MCP 协议的客户端集成。

这样做的好处是你无需在多个客户端中重复配置 MCP Server，只需要在 xiaozhi.config.json 中配置一遍 MCP 服务，即可在任意客户端集成。

并且，由于 xiaozhi-client 允许你自定义暴露哪些 MCP Server tools 因此你可以选择性的定制自己的工具集。

![在CherryStudio中集成](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/integrate-to-cherry-studio.png)
![在Cursor中集成](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/integrate-to-cursor.png)

### 使用方式

第一步：启动 xiaozhi-client 服务：

```bash
# 使用默认端口 9999
xiaozhi start
```

第二步：在客户端中配置 HTTP 连接：

```json
{
  "mcpServers": {
    "xiaozhi-client": {
      "type": "streamableHttp",
      "url": "http://localhost:9999/mcp"
    }
  }
}
```

**说明：**

- 服务启动后，MCP 端点将在 `http://localhost:9999/mcp` 提供服务
- 支持标准的 MCP over HTTP 协议
- 可以通过 `--port` 参数自定义端口号
- 使用 `-d` 参数可以后台运行服务

## 贡献者

![Contributors](https://contrib.rocks/image?repo=shenjingnan/xiaozhi-client&max=100&columns=10)
