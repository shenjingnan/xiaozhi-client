# @xiaozhi-client/datetime-mcp

小智日期时间 MCP 服务，提供日期时间处理功能。

## 安装

```bash
npm install -g @xiaozhi-client/datetime-mcp
```

## 使用

### 在 xiaozhi.config.json 中配置

```json
{
  "mcpServers": {
    "datetime": {
      "command": "npx",
      "args": ["-y", "@xiaozhi-client/datetime-mcp"]
    }
  }
}
```

### 提供的工具

#### get_current_time
获取当前时间，支持多种格式（iso、timestamp、locale、time-only）

#### get_current_date
获取当前日期，支持多种格式（iso、locale、date-only、yyyy-mm-dd）

#### format_datetime
将给定的日期时间字符串或时间戳格式化为指定格式

#### add_time
在给定的日期时间基础上增加或减少时间

## 开发

```bash
# 构建
pnpm --filter @xiaozhi-client/datetime-mcp build

# 本地运行
node dist/index.js
```
