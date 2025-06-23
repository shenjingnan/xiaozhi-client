# Xiaozhi Client

[![npm version](https://badge.fury.io/js/xiaozhi-client.svg)](https://badge.fury.io/js/xiaozhi-client)
[![codecov](https://codecov.io/gh/shenjingnan/xiaozhi-client/branch/main/graph/badge.svg)](https://codecov.io/gh/shenjingnan/xiaozhi-client)
[![CI](https://github.com/shenjingnan/xiaozhi-client/workflows/Release/badge.svg)](https://github.com/shenjingnan/xiaozhi-client/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

小智 AI 客户端，目前主要用于 MCP 的对接

![效果图](https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docs/images/preview.png)

## 功能特性

- 支持 小智(xiaozhi.me) 官方服务器接入点
- 支持 自定义 MCP 服务
- 支持 使用标准 MCP 配置方式多个 MCP Server
- 支持 聚合多个 MCP Server
- 支持 动态控制 MCP Server 提供的工具
- 支持 通过模板创建
- 支持 后台运行

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

## 路线图

- 支持 通过 SSE 类型的 MCP Server
- 支持 直接使用 [modelscope](https://www.modelscope.cn/mcp) 中托管的 MCP 服务
- 支持 通过使用网页进行 MCP 配置
