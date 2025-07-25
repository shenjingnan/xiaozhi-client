# Xiaozhi CLI 使用文档

`xiaozhi` 是小智AI客户端的命令行工具，提供配置管理和服务管理功能。

## 概述

小智的架构比较特别：它将您的个人电脑作为AI服务端，远端的小智服务器实际上是客户端。当您启动小智服务后，您的电脑就成为了AI的"大脑"，为远端提供各种工具和能力。

## 安装

在项目根目录下运行：

```bash
npm install
```

## 使用方法

### 基本命令

```bash
xiaozhi --help          # 显示帮助信息
xiaozhi --version       # 显示版本信息
```

### 服务管理

#### 启动服务

```bash
xiaozhi start           # 在前台启动服务
xiaozhi start -d        # 在后台启动服务（守护进程模式）
xiaozhi start --daemon  # 同上，完整参数形式
```

**示例：**

```bash
# 前台启动（按 Ctrl+C 停止）
xiaozhi start

# 后台启动
xiaozhi start -d
```

#### 停止服务

```bash
xiaozhi stop            # 停止后台运行的服务
```

#### 查看服务状态

```bash
xiaozhi status          # 查看服务运行状态和配置信息
```

#### 重启服务

```bash
xiaozhi restart         # 重启服务（前台模式）
xiaozhi restart -d      # 重启服务（后台模式）
```

#### 前台/后台切换

```bash
xiaozhi attach          # 将后台服务转到前台运行
```

**注意：** `attach` 命令会先停止后台服务，然后在前台重新启动。

### 配置管理

#### 设置配置项

```bash
xiaozhi set-config <key>=<value>
```

**示例：**

```bash
# 设置小智API端点
xiaozhi set-config xiaozhi.endpoint=wss://api.xiaozhi.me/mcp

# 设置嵌套配置
xiaozhi set-config mcpServers.myserver.command=node

# 包含特殊字符的值需要用引号包围
xiaozhi set-config "xiaozhi.endpoint=wss://api.xiaozhi.me/mcp/?token=abc123"
```

#### 获取配置项

```bash
xiaozhi get-config [key]
```

**示例：**

```bash
# 获取特定配置项
xiaozhi get-config xiaozhi.endpoint

# 获取所有配置
xiaozhi get-config
```

## 配置文件

配置文件位于 `.xiaozhi/settings.json`，支持嵌套结构：

```json
{
  "xiaozhi": {
    "endpoint": "wss://api.xiaozhi.me/mcp/?token=..."
  },
  "mcpServers": {
    "amap-maps": {
      "command": "npx",
      "args": ["-y", "@amap/amap-maps-mcp-server"],
      "env": {
        "AMAP_MAPS_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 支持的配置键

- `xiaozhi.endpoint` - 小智API WebSocket端点地址
- `mcpServers.*` - MCP服务器配置

## 服务管理详解

### 前台 vs 后台模式

- **前台模式**: 服务在当前终端窗口运行，可以看到实时日志，按 `Ctrl+C` 停止
- **后台模式**: 服务在后台运行，不占用终端，需要使用 `xiaozhi stop` 停止

### 进程管理

小智使用 PID 文件（`.xiaozhi/xiaozhi.pid`）来跟踪后台进程：

- 启动服务时会检查是否已有服务在运行，防止重复启动
- 停止服务时会清理 PID 文件
- 如果进程异常退出，下次启动时会自动清理无效的 PID 文件

### 常见使用场景

```bash
# 开发调试：前台启动，查看实时日志
xiaozhi start

# 生产使用：后台启动，持续运行
xiaozhi start -d

# 检查服务状态
xiaozhi status

# 查看后台日志（需要转到前台）
xiaozhi attach

# 重启服务（比如更新配置后）
xiaozhi restart -d
```

## 注意事项

1. **引号使用**: 当配置值包含特殊字符（如 `?`, `&`, `=` 等）时，需要用引号包围整个参数
2. **嵌套键**: 使用点号分隔嵌套键，如 `xiaozhi.endpoint`
3. **自动保存**: 配置更改会立即保存到文件
4. **错误处理**: 命令会提供清晰的错误信息和使用示例
5. **服务检查**: 启动前会检查必要的配置项（endpoint 和 mcpServers）
6. **进程安全**: 防止重复启动，确保同时只有一个服务实例运行

## 开发

如果你想在开发环境中直接运行CLI工具：

```bash
# 直接运行
node bin/xiaozhi --help

# 或者使用src中的文件
node src/cli.js --help
```

## 环境变量

- `MCP_SERVER_PROXY_PATH`: 指定 `mcpServerProxy.js` 文件的完整路径，主要用于测试环境
- `XIAOZHI_CONFIG_DIR`: 指定配置文件目录，默认为当前工作目录
- `XIAOZHI_DAEMON`: 标记进程是否以守护进程模式运行
