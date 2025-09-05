# customMCP 故障排除指南

## 概述

本指南提供了 customMCP 工具使用过程中常见问题的诊断和解决方法。按照问题类型分类，帮助您快速定位和解决问题。

## 配置相关问题

### 1. 工具加载失败

**症状：**
- `xiaozhi mcp list` 中看不到 customMCP 工具
- 调用时提示工具不存在

**可能原因：**
- 配置文件语法错误
- customMCP 配置结构不正确
- 配置文件路径错误

**诊断步骤：**

```bash
# 1. 检查配置文件语法
xiaozhi config show

# 2. 验证 JSON 格式
cat xiaozhi.config.json | jq .

# 3. 检查服务状态
xiaozhi status
```

**解决方法：**

1. **修复 JSON 语法错误**：
   ```bash
   # 使用 jq 验证 JSON 格式
   jq . xiaozhi.config.json
   ```

2. **检查配置结构**：
   ```json
   {
     "customMCP": {
       "tools": [
         {
           "name": "tool_name",
           "description": "tool description",
           "inputSchema": { /* schema */ },
           "handler": { /* handler config */ }
         }
       ]
     }
   }
   ```

3. **重启服务**：
   ```bash
   xiaozhi restart -d
   ```

### 2. 环境变量未生效

**症状：**
- API 调用返回认证错误
- 配置中的 `${VAR_NAME}` 未被替换

**诊断步骤：**

```bash
# 检查环境变量是否设置
echo $COZE_API_KEY
env | grep API_KEY

# 检查服务是否能访问环境变量
xiaozhi attach  # 查看日志中的环境变量信息
```

**解决方法：**

1. **设置环境变量**：
   ```bash
   export COZE_API_KEY="your_api_key"
   export WEATHER_API_KEY="your_weather_key"
   ```

2. **持久化环境变量**：
   ```bash
   # 添加到 ~/.bashrc 或 ~/.zshrc
   echo 'export COZE_API_KEY="your_api_key"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **重启服务以加载新的环境变量**：
   ```bash
   xiaozhi restart -d
   ```

## 参数验证问题

### 3. 参数验证失败

**症状：**
```
错误: 参数验证失败: 缺少必需参数: input
错误: 参数验证失败: 参数 /age 类型错误，期望: integer
```

**诊断步骤：**

1. **查看工具的 inputSchema**：
   ```bash
   xiaozhi mcp list --tools | grep -A 20 "tool_name"
   ```

2. **验证参数格式**：
   ```bash
   # 使用 jq 验证 JSON 参数格式
   echo '{"param": "value"}' | jq .
   ```

**解决方法：**

1. **检查必需参数**：
   ```json
   // 配置中的 required 字段
   "required": ["input", "operation"]
   ```
   
   ```bash
   # 确保提供所有必需参数
   xiaozhi mcp call customMCP tool_name --args '{"input": "value", "operation": "process"}'
   ```

2. **检查参数类型**：
   ```bash
   # 错误：字符串传给数字类型
   xiaozhi mcp call customMCP tool_name --args '{"age": "25"}'
   
   # 正确：使用正确的数字类型
   xiaozhi mcp call customMCP tool_name --args '{"age": 25}'
   ```

3. **检查枚举值**：
   ```bash
   # 错误：不在枚举范围内的值
   xiaozhi mcp call customMCP tool_name --args '{"priority": "urgent"}'
   
   # 正确：使用枚举中定义的值
   xiaozhi mcp call customMCP tool_name --args '{"priority": "high"}'
   ```

## 网络和 API 问题

### 4. HTTP 请求失败

**症状：**
```
错误: HTTP 请求失败: 连接超时
错误: API 调用失败: 401 Unauthorized
错误: 外部 API 错误: 500 Internal Server Error
```

**诊断步骤：**

```bash
# 1. 测试网络连接
curl -I https://api.example.com

# 2. 验证 API 密钥
curl -H "Authorization: Bearer $API_KEY" https://api.example.com/test

# 3. 检查防火墙和代理设置
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

**解决方法：**

1. **网络连接问题**：
   - 检查网络连接
   - 配置代理设置（如需要）
   - 增加超时时间

2. **认证问题**：
   ```bash
   # 验证 API 密钥是否正确
   export API_KEY="correct_api_key"
   xiaozhi restart -d
   ```

3. **API 限制问题**：
   - 检查 API 调用频率限制
   - 增加重试延迟
   - 实现指数退避策略

### 5. Coze API 调用问题

**症状：**
```
错误: Coze API 调用失败: workflow not found
错误: Coze 工作流调用失败: insufficient permissions
```

**诊断步骤：**

```bash
# 1. 验证 Coze API 密钥
curl -H "Authorization: Bearer $COZE_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.coze.cn/v1/workflow/run

# 2. 检查工作流 ID
echo "Workflow ID: $WORKFLOW_ID"
```

**解决方法：**

1. **验证工作流 ID**：
   - 确认工作流 ID 正确
   - 检查工作流是否已发布
   - 验证工作流权限设置

2. **API 密钥问题**：
   ```bash
   # 重新生成 API 密钥
   export COZE_API_KEY="new_api_key"
   xiaozhi restart -d
   ```

## 脚本执行问题

### 6. 脚本执行失败

**症状：**
```
错误: 脚本执行失败: 文件不存在
错误: 脚本执行超时
错误: Python 脚本错误: ModuleNotFoundError
```

**诊断步骤：**

```bash
# 1. 检查脚本文件是否存在
ls -la ./scripts/my-script.js

# 2. 验证脚本权限
chmod +x ./scripts/my-script.js

# 3. 手动执行脚本测试
node ./scripts/my-script.js
python ./scripts/my-script.py
```

**解决方法：**

1. **文件路径问题**：
   ```json
   {
     "handler": {
       "type": "script",
       "config": {
         "script": "./scripts/my-script.js",  // 相对于配置文件的路径
         "interpreter": "node"
       }
     }
   }
   ```

2. **权限问题**：
   ```bash
   chmod +x ./scripts/my-script.js
   ```

3. **依赖问题**：
   ```bash
   # Node.js 依赖
   npm install required-package
   
   # Python 依赖
   pip install required-package
   ```

## 性能问题

### 7. 工具调用超时

**症状：**
```
错误: 工具调用超时
错误: 请求处理时间过长
```

**诊断步骤：**

```bash
# 1. 检查工具配置的超时设置
xiaozhi config show | jq '.customMCP.tools[] | select(.name=="tool_name") | .handler.config.timeout'

# 2. 监控工具执行时间
time xiaozhi mcp call customMCP tool_name --args '{}'
```

**解决方法：**

1. **增加超时时间**：
   ```json
   {
     "handler": {
       "type": "http",
       "config": {
         "timeout": 30000  // 30秒
       }
     }
   }
   ```

2. **优化脚本性能**：
   - 减少不必要的计算
   - 使用异步操作
   - 实现缓存机制

3. **分解复杂操作**：
   - 将大任务分解为小任务
   - 使用 chain 处理器并行执行

## 调试技巧

### 启用详细日志

```bash
# 查看实时日志
xiaozhi attach

# 设置日志级别
export LOG_LEVEL=debug
xiaozhi restart -d
```

### 使用测试工具

```bash
# 测试 JSON 格式
echo '{"test": "value"}' | jq .

# 测试 HTTP 请求
curl -X POST -H "Content-Type: application/json" \
     -d '{"test": "data"}' \
     https://api.example.com/test

# 测试脚本执行
node -e "console.log('test')"
```

### 逐步排查

1. **简化配置**：从最简单的配置开始测试
2. **隔离问题**：逐个测试不同的组件
3. **查看日志**：详细分析错误日志信息
4. **对比工作配置**：与已知工作的配置进行对比

## 常见错误代码

| 错误代码 | 含义 | 解决方法 |
|---------|------|----------|
| `SERVICE_OR_TOOL_NOT_FOUND` | 工具不存在 | 检查工具名称和配置 |
| `INVALID_ARGUMENTS` | 参数验证失败 | 检查参数格式和类型 |
| `CUSTOM_MCP_ERROR` | customMCP 特有错误 | 检查配置和环境变量 |
| `EXTERNAL_API_ERROR` | 外部 API 调用失败 | 检查网络和 API 密钥 |
| `TIMEOUT_ERROR` | 请求超时 | 增加超时时间或优化性能 |

## 获取帮助

如果以上方法都无法解决问题，请：

1. **收集诊断信息**：
   ```bash
   xiaozhi status
   xiaozhi config show
   xiaozhi attach  # 复制相关日志
   ```

2. **提供详细信息**：
   - 完整的错误信息
   - 相关的配置片段
   - 执行的命令和参数
   - 系统环境信息

3. **查看文档**：
   - [customMCP 配置指南](./customMCP-configuration-guide.md)
   - [customMCP 处理器示例](./custom-mcp-handlers-examples.md)
   - [MCP 工具调用说明](./mcp-tool-calling.md)
