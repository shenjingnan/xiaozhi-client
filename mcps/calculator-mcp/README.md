# @xiaozhi-client/calculator-mcp

小智计算器 MCP 服务，提供数学计算功能。

## 安装

```bash
npm install -g @xiaozhi-client/calculator-mcp
```

## 使用

### 在 xiaozhi.config.json 中配置

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": ["-y", "@xiaozhi-client/calculator-mcp"]
    }
  }
}
```

### 提供的工具

#### calculator
计算数学表达式

**参数**：
- `expression` (string): 要计算的数学表达式

**返回**：
计算结果

## 开发

```bash
# 构建
pnpm --filter @xiaozhi-client/calculator-mcp build

# 本地运行
node dist/index.js
```
