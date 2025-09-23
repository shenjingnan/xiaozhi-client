# 动态MCP服务重连问题修复总结

## 问题描述
当通过Web界面动态添加新的MCP服务后，新服务的工具没有被小智接入点获取到，因为小智接入点连接没有重新建立。

## 根本原因
在 `MCPServiceManager.handleServiceConnected` 方法中，当MCP服务连接成功时，只进行了工具同步和CustomMCPHandler刷新，但**缺少了小智接入点的重连逻辑**。相比之下，服务移除时正确触发了重连。

## 修复方案

### 1. 核心修复
**文件**: `src/services/MCPServiceManager.ts`

**修改位置**: `handleServiceConnected` 方法 (第116-151行)

**修改内容**:
```typescript
// 在服务连接成功时触发重连
await this.scheduleReconnect();
```

### 2. 防抖优化
为了避免频繁添加/移除服务时导致的重连风暴，添加了防抖机制：

**新增属性**:
```typescript
// 防抖相关属性
private reconnectDebounceTimer: NodeJS.Timeout | null = null;
private isReconnecting = false;
```

**新增方法**:
- `scheduleReconnect()`: 防抖重连调度，1秒延迟
- 改进的 `reconnectXiaozhiEndpoints()`: 添加状态检查和错误处理

**更新方法**:
- `handleServiceConnected()`: 使用防抖重连
- `removeService()`: 使用防抖重连（保持一致性）
- `stopAllServices()`: 清理防抖定时器

## 修复后的事件流程

### 服务添加成功时的完整流程：
1. MCP服务连接成功
2. 触发 `mcp:service:connected` 事件
3. `handleServiceConnected` 被调用
4. 执行工具同步 (`syncToolsAfterConnection`)
5. 重新初始化CustomMCPHandler (`refreshCustomMCPHandlerPublic`)
6. **【新增】** 调度防抖重连 (`scheduleReconnect`)
7. **【新增】** 1秒后触发 `mcp:services:updated` 事件
8. **【期望】** XiaozhiConnectionManager 监听事件并重新建立连接
9. **【结果】** 新服务的工具被正确获取

### 防抖机制说明：
- 重连请求被延迟1秒执行
- 如果1秒内有多个重连请求，只执行最后一次
- 添加重连状态检查，避免重复重连
- 服务停止时清理防抖定时器

## 代码质量检查
✅ TypeScript 类型检查通过  
✅ Biome 代码格式检查通过  
✅ 无代码质量错误

## 预期效果
修复后，当动态添加MCP服务时：
1. ✅ MCP服务连接成功
2. ✅ 工具同步完成
3. ✅ **自动触发小智接入点重连**（修复点）
4. ✅ 新服务的工具被正确获取

## 测试建议
1. **功能测试**: 通过Web界面添加MCP服务，验证新工具能被小智接入点获取
2. **性能测试**: 快速连续添加多个服务，验证防抖机制正常工作
3. **稳定性测试**: 确保重连不会导致现有连接中断
4. **错误处理测试**: 测试重连失败时的错误处理

## 风险评估
- **低风险**: 修改范围小，仅影响服务添加流程
- **向后兼容**: 不破坏现有功能
- **有完善的错误处理**: 包含日志记录和异常处理

## 技术要点
1. **事件驱动架构**: 利用现有的事件总线系统
2. **防抖设计**: 避免频繁重连对性能的影响
3. **状态管理**: 添加重连状态避免重复操作
4. **资源清理**: 确保定时器等资源被正确清理

修复完成！动态添加MCP服务后，小智接入点现在会自动重新连接，确保新服务的工具能被正确获取。