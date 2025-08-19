# Xiaozhi CLI 使用手册

`xiaozhi` 是小智 AI 客户端的命令行工具，提供完整的 MCP (Model Context Protocol) 服务管理、配置管理和项目创建功能。

## 目录

- [概述](#概述)
- [安装](#安装)
- [快速开始](#快速开始)
- [全局选项](#全局选项)
- [命令详解](#命令详解)
  - [服务管理命令](#服务管理命令)
  - [配置管理命令](#配置管理命令)
  - [项目管理命令](#项目管理命令)
  - [MCP 管理命令](#mcp-管理命令)
  - [端点管理命令](#端点管理命令)
  - [UI 管理命令](#ui-管理命令)
- [快速参考](#快速参考)
- [故障排除](#故障排除)
- [环境变量](#环境变量)

## 概述

小智的架构比较特别：它将您的个人电脑作为 AI 服务端，远端的小智服务器实际上是客户端。当您启动小智服务后，您的电脑就成为了 AI 的"大脑"，为远端提供各种工具和能力。

xiaozhi-client 支持多种运行模式：

- **传统模式**: 连接到小智官方服务器
- **MCP Server 模式**: 作为标准 MCP 服务器供其他客户端使用
- **Web UI 模式**: 提供可视化配置界面
- **项目模式**: 基于模板快速创建项目

## 安装

### 全局安装（推荐）

```bash
npm install -g xiaozhi-client
```

### 通过 npx 使用

```bash
npx xiaozhi-client --help
```

### 本地开发

```bash
git clone <repository>
cd xiaozhi-client
npm install
npm run build
```

## 快速开始

1. **创建项目**：

```bash
xiaozhi create my-app --template hello-world
cd my-app
npm install
```

2. **初始化配置**：

```bash
xiaozhi config init
```

3. **设置端点**：

```bash
xiaozhi config set mcpEndpoint "your-endpoint-url"
```

4. **启动服务**：

```bash
xiaozhi start
```

## 全局选项

| 选项             | 描述             | 示例                     |
| ---------------- | ---------------- | ------------------------ |
| `--info`         | 显示详细系统信息 | `xiaozhi --info`         |
| `-v, --version`  | 显示版本信息     | `xiaozhi -v`             |
| `--version-info` | 显示详细版本信息 | `xiaozhi --version-info` |
| `-h, --help`     | 显示帮助信息     | `xiaozhi -h`             |

### 示例输出

```bash
$ xiaozhi --info
🤖 小智 MCP 客户端 - 详细信息

版本信息:
  名称: xiaozhi-client
  版本: 1.6.2
  描述: 小智 AI 客户端 命令行工具

系统信息:
  Node.js: v18.17.0
  平台: darwin arm64

配置信息:
  配置文件: /path/to/xiaozhi.config.json
  MCP 端点: 1 个
```

## 命令详解

### 服务管理命令

服务管理命令用于控制 xiaozhi 服务的生命周期。支持前台运行、后台运行、MCP Server 模式等多种运行方式。

#### `xiaozhi start` - 启动服务

**语法**：

```bash
xiaozhi start [选项]
xiaozhi service start [选项]  # 完整命令形式
```

**选项**：

- `-d, --daemon` - 在后台运行服务
- `-u, --ui` - 同时启动 Web UI 服务
- `-s, --server [port]` - 以 MCP Server 模式启动（可选指定端口，默认 3000）
- `--stdio` - 以 stdio 模式运行 MCP Server（用于 Cursor 等客户端）

**使用示例**：

```bash
# 前台启动（开发调试）
xiaozhi start

# 后台启动（生产环境）
xiaozhi start -d

# 启动并打开 Web UI
xiaozhi start -u

# 以 MCP Server 模式启动，监听 3000 端口
xiaozhi start -s 3000

# 以 stdio 模式启动（用于 Cursor 集成）
xiaozhi start --stdio
```

**预期输出**：

```bash
$ xiaozhi start
🤖 小智 MCP 客户端正在启动...
✅ 配置文件已加载: xiaozhi.config.json
✅ MCP 服务已启动: calculator, datetime
🌐 连接到端点: ws://localhost:8080
✅ 服务启动成功，按 Ctrl+C 停止

$ xiaozhi start -d
🤖 小智 MCP 客户端正在启动...
✅ 服务已在后台启动 (PID: 12345)
💡 使用 'xiaozhi status' 查看状态
💡 使用 'xiaozhi attach' 查看日志
```

**使用场景**：

- **开发调试**: 使用前台模式，可以实时查看日志
- **生产部署**: 使用后台模式，服务持续运行
- **客户端集成**: 使用 stdio 模式集成到 Cursor、Claude Desktop 等
- **Web 管理**: 使用 `-u` 选项同时启动 Web 界面

#### `xiaozhi stop` - 停止服务

**语法**：

```bash
xiaozhi stop
xiaozhi service stop  # 完整命令形式
```

**使用示例**：

```bash
xiaozhi stop
```

**预期输出**：

```bash
$ xiaozhi stop
🛑 正在停止服务...
✅ 服务已停止 (PID: 12345)
```

**注意事项**：

- 只能停止后台运行的服务
- 前台运行的服务请使用 `Ctrl+C` 停止

#### `xiaozhi status` - 查看服务状态

**语法**：

```bash
xiaozhi status
xiaozhi service status  # 完整命令形式
```

**使用示例**：

```bash
xiaozhi status
```

**预期输出**：

```bash
$ xiaozhi status
✅ 服务正在运行 (PID: 12345)
⏱️  运行时间: 2小时30分钟
🔧 运行模式: 后台模式

$ xiaozhi status  # 服务未运行时
❌ 服务未运行
```

#### `xiaozhi restart` - 重启服务

**语法**：

```bash
xiaozhi restart [选项]
xiaozhi service restart [选项]  # 完整命令形式
```

**选项**：

- `-d, --daemon` - 在后台运行服务
- `-u, --ui` - 同时启动 Web UI 服务

**使用示例**：

```bash
# 重启为前台模式
xiaozhi restart

# 重启为后台模式
xiaozhi restart -d
```

#### `xiaozhi attach` - 连接后台服务查看日志

**语法**：

```bash
xiaozhi attach
xiaozhi service attach  # 完整命令形式
```

**使用示例**：

```bash
xiaozhi attach
```

**预期输出**：

```bash
$ xiaozhi attach
🔗 连接到后台服务 (PID: 12345)
📋 显示实时日志...
[2025-08-19 10:30:15] INFO: MCP 连接已建立
[2025-08-19 10:30:16] INFO: 工具调用: calculator.add
```

**注意事项**：

- 按 `Ctrl+C` 可以断开连接，但不会停止后台服务
- 只能连接到后台运行的服务

### 配置管理命令

配置管理命令用于初始化、查看和修改 xiaozhi 的配置文件。支持 JSON、JSON5、JSONC 三种配置格式。

#### `xiaozhi config init` - 初始化配置文件

**语法**：

```bash
xiaozhi config init [选项]
```

**选项**：

- `-f, --format <format>` - 配置文件格式（json/json5/jsonc），默认为 json

**使用示例**：

```bash
# 创建 JSON 格式配置文件
xiaozhi config init

# 创建 JSON5 格式配置文件（支持注释）
xiaozhi config init -f json5

# 创建 JSONC 格式配置文件（VS Code 风格）
xiaozhi config init -f jsonc
```

**预期输出**：

```bash
$ xiaozhi config init
✅ 配置文件已创建: xiaozhi.config.json
📝 请编辑配置文件设置你的 MCP 端点:
   配置文件路径: /path/to/xiaozhi.config.json
💡 或者使用命令设置:
   xiaozhi config set mcpEndpoint <your-endpoint-url>
```

**生成的配置文件示例**：

```json
{
  "mcpEndpoint": "<请填写你的接入点地址（获取地址在 xiaozhi.me）>",
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": ["./mcpServers/calculator.js"]
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

#### `xiaozhi config get` - 查看配置值

**语法**：

```bash
xiaozhi config get <key>
```

**支持的配置键**：

- `mcpEndpoint` - MCP 端点地址
- `mcpServers` - MCP 服务配置
- `connection` - 连接配置
- `heartbeatInterval` - 心跳检测间隔
- `heartbeatTimeout` - 心跳超时时间
- `reconnectInterval` - 重连间隔

**使用示例**：

```bash
# 查看 MCP 端点
xiaozhi config get mcpEndpoint

# 查看所有 MCP 服务
xiaozhi config get mcpServers

# 查看连接配置
xiaozhi config get connection
```

**预期输出**：

```bash
$ xiaozhi config get mcpEndpoint
MCP 端点: ws://localhost:8080

$ xiaozhi config get mcpServers
MCP 服务:
  calculator: node ./mcpServers/calculator.js
  datetime: node ./mcpServers/datetime.js

$ xiaozhi config get connection
连接配置:
  心跳检测间隔: 30000ms
  心跳超时时间: 10000ms
  重连间隔: 5000ms
```

#### `xiaozhi config set` - 设置配置值

**语法**：

```bash
xiaozhi config set <key> <value>
```

**支持设置的配置键**：

- `mcpEndpoint` - MCP 端点地址
- `heartbeatInterval` - 心跳检测间隔（毫秒）
- `heartbeatTimeout` - 心跳超时时间（毫秒）
- `reconnectInterval` - 重连间隔（毫秒）

**使用示例**：

```bash
# 设置 MCP 端点
xiaozhi config set mcpEndpoint "ws://localhost:8080"

# 设置心跳间隔为 60 秒
xiaozhi config set heartbeatInterval 60000

# 设置超时时间为 15 秒
xiaozhi config set heartbeatTimeout 15000
```

**预期输出**：

```bash
$ xiaozhi config set mcpEndpoint "ws://localhost:8080"
✅ MCP 端点已设置为: ws://localhost:8080

$ xiaozhi config set heartbeatInterval 60000
✅ 心跳检测间隔已设置为: 60000ms
```

**注意事项**：

- 配置更改会立即保存到配置文件
- 如果配置文件不存在，会提示先运行 `xiaozhi config init`
- 数值类型的配置项会进行有效性验证

### 项目管理命令

项目管理命令用于基于模板快速创建 xiaozhi 项目。

#### `xiaozhi create` - 创建项目

**语法**：

```bash
xiaozhi create <projectName> [选项]
```

**选项**：

- `-t, --template <templateName>` - 使用指定模板创建项目

**可用模板**：

- `default` - 默认模板，包含基本配置
- `hello-world` - Hello World 示例，包含计算器和日期时间服务
- `docker` - Docker 配置模板，适用于容器化部署
- `json5` - JSON5 配置格式模板，支持注释
- `jsonc` - JSONC 配置格式模板，VS Code 风格
- `modelscope` - ModelScope 集成模板，支持 AI 模型服务

**使用示例**：

```bash
# 创建基础项目
xiaozhi create my-app

# 使用 Hello World 模板创建项目
xiaozhi create my-hello-app -t hello-world

# 使用 Docker 模板创建项目
xiaozhi create my-docker-app -t docker

# 使用 ModelScope 模板创建 AI 项目
xiaozhi create my-ai-app -t modelscope
```

**预期输出**：

```bash
$ xiaozhi create my-app -t hello-world
✅ 项目 "my-app" 创建成功

✅ 项目创建完成!
📝 接下来的步骤:
   cd my-app
   pnpm install  # 安装依赖
   # 编辑 xiaozhi.config.json 设置你的 MCP 端点
   xiaozhi start  # 启动服务
```

**项目结构**：

```
my-app/
├── xiaozhi.config.json    # 配置文件
├── package.json           # 项目依赖
├── mcpServers/           # MCP 服务目录
│   ├── calculator.js     # 计算器服务
│   └── datetime.js       # 日期时间服务
└── README.md             # 项目说明
```

### MCP 管理命令

MCP 管理命令用于查看和管理 MCP 服务及其工具。

#### `xiaozhi mcp list` - 列出 MCP 服务

**语法**：

```bash
xiaozhi mcp list [选项]
```

**选项**：

- `--tools` - 显示所有服务的工具列表

**使用示例**：

```bash
# 列出所有 MCP 服务
xiaozhi mcp list

# 列出服务及其工具
xiaozhi mcp list --tools
```

#### `xiaozhi mcp server` - 管理指定 MCP 服务

**语法**：

```bash
xiaozhi mcp server <serverName>
```

**使用示例**：

```bash
# 查看 calculator 服务详情
xiaozhi mcp server calculator
```

#### `xiaozhi mcp tool` - 启用/禁用工具

**语法**：

```bash
xiaozhi mcp tool <serverName> <toolName> <action>
```

**参数**：

- `<serverName>` - 服务名称
- `<toolName>` - 工具名称
- `<action>` - 操作（enable/disable）

**使用示例**：

```bash
# 启用 calculator 服务的 add 工具
xiaozhi mcp tool calculator add enable

# 禁用 calculator 服务的 subtract 工具
xiaozhi mcp tool calculator subtract disable
```

### 端点管理命令

端点管理命令用于管理 MCP 端点地址，支持单端点和多端点配置。

#### `xiaozhi endpoint list` - 列出所有端点

**语法**：

```bash
xiaozhi endpoint list
```

**使用示例**：

```bash
xiaozhi endpoint list
```

**预期输出**：

```bash
$ xiaozhi endpoint list
共 2 个端点:
  1. ws://localhost:8080
  2. ws://server.example.com:8080
```

#### `xiaozhi endpoint add` - 添加端点

**语法**：

```bash
xiaozhi endpoint add <url>
```

**使用示例**：

```bash
xiaozhi endpoint add "ws://new-server:8080"
```

#### `xiaozhi endpoint remove` - 移除端点

**语法**：

```bash
xiaozhi endpoint remove <url>
```

**使用示例**：

```bash
xiaozhi endpoint remove "ws://old-server:8080"
```

#### `xiaozhi endpoint set` - 设置端点

**语法**：

```bash
xiaozhi endpoint set <url>
```

**使用示例**：

```bash
# 设置单个端点
xiaozhi endpoint set "ws://localhost:8080"
```

### UI 管理命令

UI 管理命令用于启动 Web 配置界面。

#### `xiaozhi ui` - 启动 Web UI

**语法**：

```bash
xiaozhi ui
```

**使用示例**：

```bash
xiaozhi ui
```

**预期输出**：

```bash
$ xiaozhi ui
✅ 配置管理网页已启动，可通过以下地址访问:
   本地访问: http://localhost:9999
   网络访问: http://<你的IP地址>:9999
💡 提示: 按 Ctrl+C 停止服务
```

**功能特性**：

- 可视化配置编辑
- 实时配置验证
- 服务状态监控
- 日志查看

## 快速参考

### 常用命令速查表

| 功能           | 命令                                                   | 说明                  |
| -------------- | ------------------------------------------------------ | --------------------- |
| **项目创建**   | `xiaozhi create my-app -t hello-world`                 | 创建 Hello World 项目 |
| **配置初始化** | `xiaozhi config init`                                  | 初始化配置文件        |
| **设置端点**   | `xiaozhi config set mcpEndpoint "ws://localhost:8080"` | 设置 MCP 端点         |
| **前台启动**   | `xiaozhi start`                                        | 前台启动服务          |
| **后台启动**   | `xiaozhi start -d`                                     | 后台启动服务          |
| **启动 + UI**  | `xiaozhi start -u`                                     | 启动服务并打开 Web UI |
| **查看状态**   | `xiaozhi status`                                       | 查看服务运行状态      |
| **停止服务**   | `xiaozhi stop`                                         | 停止后台服务          |
| **查看日志**   | `xiaozhi attach`                                       | 连接后台服务查看日志  |
| **重启服务**   | `xiaozhi restart -d`                                   | 重启为后台模式        |
| **启动 UI**    | `xiaozhi ui`                                           | 启动 Web 配置界面     |
| **查看配置**   | `xiaozhi config get mcpEndpoint`                       | 查看端点配置          |
| **列出服务**   | `xiaozhi mcp list`                                     | 列出所有 MCP 服务     |

### 典型使用流程

#### 1. 新项目开发流程

```bash
# 1. 创建项目
xiaozhi create my-project -t hello-world
cd my-project
npm install

# 2. 配置端点
xiaozhi config set mcpEndpoint "your-endpoint-url"

# 3. 启动开发
xiaozhi start  # 前台模式，便于调试
```

#### 2. 生产部署流程

```bash
# 1. 后台启动
xiaozhi start -d

# 2. 检查状态
xiaozhi status

# 3. 配置监控（可选）
xiaozhi ui  # 启动 Web 界面监控
```

#### 3. 客户端集成流程

```bash
# 1. 配置 Cursor/Claude Desktop
xiaozhi start --stdio

# 2. 或者启动 HTTP Server
xiaozhi start -s 3000
```

## 故障排除

### 常见问题及解决方案

#### 1. 配置文件相关问题

**问题**: `配置文件不存在`

```bash
❌ 配置文件不存在
💡 提示: 请先运行 "xiaozhi config init" 初始化配置
```

**解决方案**:

```bash
xiaozhi config init
```

**问题**: `配置格式错误`

**解决方案**:

```bash
# 备份现有配置
cp xiaozhi.config.json xiaozhi.config.json.backup

# 重新初始化
xiaozhi config init

# 手动恢复配置内容
```

#### 2. 服务启动问题

**问题**: `端口被占用`

```bash
❌ 启动失败: 端口 9999 已被占用
```

**解决方案**:

```bash
# 查找占用端口的进程
lsof -i :9999

# 或者修改配置使用其他端口
xiaozhi config set webUI.port 8888
```

**问题**: `MCP 端点连接失败`

```bash
❌ 连接失败: 无法连接到 ws://localhost:8080
```

**解决方案**:

```bash
# 1. 检查端点地址是否正确
xiaozhi config get mcpEndpoint

# 2. 检查网络连接
ping localhost

# 3. 重新设置端点
xiaozhi config set mcpEndpoint "correct-endpoint-url"
```

#### 3. 服务管理问题

**问题**: `无法停止服务`

```bash
❌ 停止失败: 找不到运行中的服务
```

**解决方案**:

```bash
# 1. 检查服务状态
xiaozhi status

# 2. 强制清理（如果进程已死但 PID 文件仍存在）
rm -f .xiaozhi/xiaozhi.pid

# 3. 查找并手动终止进程
ps aux | grep xiaozhi
kill <PID>
```

#### 4. 权限问题

**问题**: `权限不足`

```bash
❌ 启动失败: 权限不足
```

**解决方案**:

```bash
# 检查文件权限
ls -la xiaozhi.config.json

# 修复权限
chmod 644 xiaozhi.config.json
chmod 755 mcpServers/
```

### 调试技巧

#### 1. 查看详细信息

```bash
# 查看系统信息
xiaozhi --info

# 查看详细版本信息
xiaozhi --version-info
```

#### 2. 日志分析

```bash
# 前台模式查看实时日志
xiaozhi start

# 后台模式查看日志
xiaozhi attach
```

#### 3. 配置验证

```bash
# 检查配置完整性
xiaozhi config get mcpEndpoint
xiaozhi config get mcpServers
xiaozhi config get connection
```

#### 4. 网络诊断

```bash
# 测试端点连接
curl -I http://your-endpoint-host

# 检查端口监听
netstat -an | grep :9999
```

### 获取帮助

如果遇到问题无法解决，可以：

1. **查看帮助信息**:

```bash
xiaozhi --help
xiaozhi <command> --help
```

2. **查看项目文档**: 访问项目 GitHub 仓库的 docs 目录

3. **提交问题**: 在 GitHub Issues 中描述问题，包含：
   - 操作系统信息
   - Node.js 版本
   - xiaozhi 版本 (`xiaozhi --version`)
   - 完整的错误信息
   - 复现步骤

## 环境变量

xiaozhi 支持以下环境变量：

| 变量名                  | 描述             | 默认值       | 示例                         |
| ----------------------- | ---------------- | ------------ | ---------------------------- |
| `XIAOZHI_CONFIG_DIR`    | 配置文件目录     | 当前工作目录 | `/path/to/config`            |
| `XIAOZHI_DAEMON`        | 标记守护进程模式 | 无           | `true`                       |
| `MCP_SERVER_PROXY_PATH` | MCP 代理文件路径 | 自动检测     | `/path/to/mcpServerProxy.js` |

**使用示例**:

```bash
# 指定配置目录
XIAOZHI_CONFIG_DIR=/etc/xiaozhi xiaozhi start

# 在 Docker 中使用
docker run -e XIAOZHI_CONFIG_DIR=/app/config xiaozhi-client
```
