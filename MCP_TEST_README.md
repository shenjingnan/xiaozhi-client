# MCP 客户端连接测试

## 测试概述

这个测试创建了一个简化的 JavaScript MCP 客户端，用于验证与固定接入点的连接和工具识别功能。

## 文件说明

### 基础版本
- `simple-mcp-client.js` - 最简化的 MCP 客户端（核心功能）
- `validate-mcp-tools.cjs` - 完整的验证测试
- `mcp-client-test.cjs` - 详细的测试客户端

### 增强版本（解决连接断开问题）
- `enhanced-mcp-client.js` - 增强版MCP客户端（ES模块）
- `enhanced-mcp-client.cjs` - 增强版MCP客户端（CommonJS）
- `test-connection-stability.js` - 连接稳定性测试

## 主要问题及解决方案

### 问题分析
WebSocket连接自动断开的主要原因：
1. **服务器端空闲超时**：服务器在空闲一段时间后主动关闭连接
2. **缺少心跳保活**：没有定期发送ping/pong消息保持连接
3. **网络不稳定**：网络波动导致连接中断
4. **错误处理不足**：异常情况下连接未正确处理

### 解决方案
增强版客户端实现了以下功能：
- ✅ **心跳保活机制**：每30秒发送ping消息
- ✅ **自动重连功能**：断线后3秒自动重连
- ✅ **错误处理增强**：完善的错误捕获和日志
- ✅ **状态监控**：实时连接状态反馈
- ✅ **优雅退出**：支持Ctrl+C安全退出

## 运行测试

### 基础测试
```bash
# 运行最简化的客户端
node simple-mcp-client.js

# 运行完整验证测试
node validate-mcp-tools.cjs

# 运行详细测试
node mcp-client-test.cjs
```

### 增强版测试（推荐）
```bash
# 运行增强版客户端（ES模块）
node enhanced-mcp-client.js

# 运行增强版客户端（CommonJS）
node enhanced-mcp-client.cjs

# 运行连接稳定性测试
node test-connection-stability.js
```

## 成功标准

### 基础测试
- ✅ WebSocket 连接成功建立
- ✅ MCP 协议初始化完成
- ✅ 服务器能正确识别并列出 2 个模拟工具
- ✅ 工具列表包含 `calculator_add` 和 `weather_get`

### 增强版测试
- ✅ 连接持续稳定运行
- ✅ 心跳机制正常工作
- ✅ 自动重连功能有效
- ✅ 支持手动安全退出
- ✅ 实时状态监控

## 技术实现

### 基础版本
- WebSocket 连接管理
- JSON-RPC 2.0 消息格式
- MCP 初始化流程
- 工具列表响应

### 增强版本
- **心跳机制**：定时ping/pong保活
- **重连策略**：指数退避重连
- **状态管理**：连接状态实时监控
- **错误处理**：完善的异常处理
- **优雅退出**：信号处理安全关闭

## 配置参数

### 增强版客户端参数
```javascript
const client = new EnhancedMCPClient(url, {
  reconnectInterval: 3000,    // 重连间隔(毫秒)
  heartbeatInterval: 30000,   // 心跳间隔(毫秒)
  maxReconnectAttempts: 10    // 最大重连次数
});
```

## 使用场景

### 什么时候使用增强版
- 需要长时间保持连接
- 网络环境不稳定
- 需要自动恢复连接
- 生产环境使用

### 什么时候使用基础版
- 快速测试连接
- 诊断网络问题
- 学习MCP协议
- 简单调试

## 故障排除

### 连接仍然断开
1. 检查网络连接稳定性
2. 确认服务器端超时设置
3. 调整心跳间隔参数
4. 查看服务器日志

### 重连失败
1. 检查URL和token是否正确
2. 确认服务器是否可达
3. 增加重连间隔时间
4. 检查防火墙设置

### 内存占用过高
1. 减少日志输出频率
2. 优化心跳间隔
3. 定期重启客户端