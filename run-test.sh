#!/bin/bash

# 安装依赖
npm install ws

# 运行简化测试
echo "=== 运行简化 MCP 连接测试 ==="
node simple-test.js

# 运行完整测试
echo -e "\n=== 运行完整 MCP 连接测试 ==="
node test-mcp-connection.js