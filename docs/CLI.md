# Xiaozhi CLI 使用文档

`xiaozhi` 是小智AI客户端的命令行工具，提供配置管理和其他实用功能。

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

## 注意事项

1. **引号使用**: 当配置值包含特殊字符（如 `?`, `&`, `=` 等）时，需要用引号包围整个参数
2. **嵌套键**: 使用点号分隔嵌套键，如 `xiaozhi.endpoint`
3. **自动保存**: 配置更改会立即保存到文件
4. **错误处理**: 命令会提供清晰的错误信息和使用示例

## 开发

如果你想在开发环境中直接运行CLI工具：

```bash
# 直接运行
node bin/xiaozhi --help

# 或者使用src中的文件
node src/cli.js --help
```
