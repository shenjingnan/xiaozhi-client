# @xiaozhi-client/mcp-core 可运行示例

本目录包含 `@xiaozhi-client/mcp-core` 包的可运行示例脚本，展示如何连接到 stdio MCP 服务并使用工具。

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

### 使用 tsx 运行（推荐）

```bash
# 示例 01：基础连接
pnpm run example:01

# 示例 02：计算器服务
pnpm run example:02

# 示例 03：日期时间服务
pnpm run example:03

# 示例 04：多服务聚合
pnpm run example:04
```

## 示例说明

| 文件 | 说明 | 难度 |
|------|------|------|
| `01-basic-connection.ts` | 最简单的单个服务连接示例，展示连接、获取工具、调用工具的基本流程 | ⭐ |
| `02-calculator-demo.ts` | 完整的计算器服务示例，展示数学计算功能 | ⭐⭐ |
| `03-datetime-demo.ts` | 完整的日期时间服务示例，展示时间格式化和计算功能 | ⭐⭐ |
| `04-multi-service.ts` | 同时管理多个 MCP 服务，展示 MCPManager 的使用 | ⭐⭐⭐ |

## 示例详情

### 01 - 基础连接

展示如何使用 `MCPConnection` 连接到单个 MCP 服务：
- 创建连接配置
- 建立连接并监听事件
- 获取工具列表
- 调用工具
- 断开连接

### 02 - 计算器服务

展示 `calculator-mcp` 服务的完整使用：
- 连接到计算器服务
- 执行各种数学计算（加减乘除、三角函数、幂运算等）
- 解析和显示计算结果

### 03 - 日期时间服务

展示 `datetime-mcp` 服务的完整使用：
- 连接到日期时间服务
- 获取不同格式的时间
- 执行日期计算（加天数、月份等）
- 时间格式化

### 04 - 多服务聚合

展示使用 `MCPManager` 管理多个服务：
- 同时连接多个 MCP 服务
- 列出所有服务的工具
- 跨服务调用工具
- 服务状态监控

## 注意事项

- 示例脚本会通过 `npx` 启动 MCP 服务，确保网络连接正常
- 首次运行时，npx 会自动下载 calculator-mcp 和 datetime-mcp 包
- 某些示例可能需要几秒钟来启动服务
- 所有示例都包含完整的错误处理和中文注释

## 相关文档

- [@xiaozhi-client/mcp-core README](../README.md)
- [MCP 协议规范](https://modelcontextprotocol.io/)
