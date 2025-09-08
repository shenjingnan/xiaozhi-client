# xiaozhi mcp call 命令使用说明

## 概述

`xiaozhi mcp call` 命令用于调用已配置的 MCP (Model Context Protocol) 服务中的工具，以及自定义的 customMCP 工具。该命令通过 HTTP API 与后台服务通信，实现对各种 MCP 工具和 customMCP 工具的统一调用接口。

### 支持的工具类型

1. **标准 MCP 工具**：通过 MCP 协议连接的外部服务工具
2. **customMCP 工具**：在配置文件中直接定义的自定义工具，支持多种处理器类型：
   - **proxy**：代理调用第三方平台（如 Coze、Dify、n8n）
   - **http**：直接 HTTP API 调用
   - **function**：JavaScript 函数执行
   - **script**：脚本执行（Node.js、Python 等）
   - **chain**：链式工具调用

## 前置条件

在使用 `xiaozhi mcp call` 命令之前，请确保：

1. **服务已启动**：xiaozhi 后台服务必须正在运行
   ```bash
   # 启动后台服务
   xiaozhi start -d

   # 检查服务状态
   xiaozhi status
   ```

2. **MCP 服务已配置**：在配置文件中正确配置了 MCP 服务
3. **工具已启用**：目标工具未被禁用

## 命令语法

### 标准 MCP 工具调用

```bash
xiaozhi mcp call <服务名称> <工具名称> [选项]
```

### customMCP 工具调用

```bash
xiaozhi mcp call customMCP <工具名称> [选项]
```

### 参数说明

#### 必需参数

- `<服务名称>`：
  - 对于标准 MCP 工具：MCP 服务的名称，在配置文件中定义
  - 对于 customMCP 工具：固定使用 `customMCP`
- `<工具名称>`：要调用的工具名称

#### 可选参数

- `--args <JSON>`：工具参数，JSON 格式字符串（默认值：`{}`）
  - customMCP 工具支持基于 JSON Schema 的参数验证

### 选项格式

```bash
--args '{"参数名1": "参数值1", "参数名2": "参数值2"}'
```

## 使用示例

### 标准 MCP 工具示例

#### 1. 调用计算器工具

```bash
# 执行简单的数学计算
xiaozhi mcp call calculator calculator --args '{"javascript_expression": "1+2"}'
```

**输出示例：**
```
✔ calculator/calculator: {"content":[{"type":"text","text":"{\"success\":true,\"result\":3}"}]}
```

#### 2. 调用日期时间工具

```bash
# 获取当前日期
xiaozhi mcp call datetime get_current_date

# 添加时间
xiaozhi mcp call datetime add_time --args '{"date": "2024-01-01", "days": 7}'
```

### customMCP 工具示例

#### 3. 调用 Coze 工作流工具

```bash
# 调用 Coze 工作流进行文本分析
xiaozhi mcp call customMCP coze_workflow_analyzer --args '{"input": "这是一段需要分析的文本内容"}'
```

**输出示例：**
```
✔ customMCP/coze_workflow_analyzer: {"content":[{"type":"text","text":"分析结果：这是一段中性情感的文本..."}]}
```

#### 4. 调用 HTTP API 工具

```bash
# 获取天气信息
xiaozhi mcp call customMCP weather_api --args '{"city": "北京", "units": "metric"}'
```

#### 5. 调用函数处理器工具

```bash
# 文本处理
xiaozhi mcp call customMCP text_processor --args '{"text": "Hello World", "operation": "uppercase"}'
```

**输出示例：**
```
✔ customMCP/text_processor: {"content":[{"type":"text","text":"HELLO WORLD"}]}
```

### 复杂参数示例

#### 3. 多参数工具调用

```bash
# 调用包含多个参数的工具
xiaozhi mcp call myservice mytool --args '{
  "param1": "value1",
  "param2": 123,
  "param3": true,
  "param4": ["item1", "item2"]
}'
```

#### 4. 嵌套对象参数

```bash
# 传递嵌套对象作为参数
xiaozhi mcp call dataservice process --args '{
  "config": {
    "format": "json",
    "options": {
      "pretty": true,
      "indent": 2
    }
  },
  "data": ["a", "b", "c"]
}'
```

## 常见错误和解决方法

### 1. 服务未启动错误

**错误信息：**
```
错误: xiaozhi 服务未启动。请先运行 'xiaozhi start' 或 'xiaozhi start -d' 启动服务。
```

**解决方法：**
```bash
# 启动后台服务
xiaozhi start -d

# 验证服务状态
xiaozhi status
```

### 2. 服务不存在错误

**错误信息：**
```
错误: 服务 'nonexistent' 不存在。可用服务: calculator, datetime
```

**解决方法：**
- 检查服务名称拼写是否正确
- 使用 `xiaozhi config show` 查看已配置的服务
- 确认服务已在配置文件中正确定义

### 3. 工具不存在错误

**错误信息：**
```
错误: 工具 'unknown_tool' 在服务 'calculator' 中不存在。可用工具: calculator
```

**解决方法：**
- 检查工具名称拼写是否正确
- 查看服务文档了解可用工具列表
- 使用正确的工具名称重新调用

### 4. 工具已被禁用错误

**错误信息：**
```
错误: 工具 'calculator' 已被禁用。请使用 'xiaozhi mcp tool calculator calculator enable' 启用该工具。
```

**解决方法：**
```bash
# 启用指定工具
xiaozhi mcp tool calculator calculator enable

# 重新调用工具
xiaozhi mcp call calculator calculator --args '{"javascript_expression": "1+2"}'
```

### 5. 参数格式错误

**错误信息：**
```
错误: 参数格式错误: Unexpected token...
```

**解决方法：**
- 确保 JSON 格式正确
- 使用单引号包围 JSON 字符串
- 检查 JSON 中的引号、括号、逗号等语法

**正确格式：**
```bash
xiaozhi mcp call service tool --args '{"param": "value"}'
```

**错误格式：**
```bash
xiaozhi mcp call service tool --args {"param": "value"}  # 缺少引号
xiaozhi mcp call service tool --args '{"param": value}'  # 值缺少引号
```

### 6. customMCP 工具不存在错误

**错误信息：**
```
错误: customMCP 工具 'unknown_tool' 不存在。可用的 customMCP 工具: coze_workflow, text_processor。请使用 'xiaozhi mcp list' 查看所有可用工具。
```

**解决方法：**
- 检查工具名称拼写是否正确
- 使用 `xiaozhi mcp list --tools` 查看所有可用的 customMCP 工具
- 确认工具已在 `xiaozhi.config.json` 的 `customMCP.tools` 中正确定义

### 7. customMCP 参数验证失败

**错误信息：**
```
错误: 参数验证失败: 缺少必需参数: input
```

**解决方法：**
- 检查工具的 `inputSchema` 定义，了解必需参数
- 确保提供所有必需参数
- 验证参数类型是否正确

**示例：**
```bash
# 错误：缺少必需参数
xiaozhi mcp call customMCP text_processor --args '{}'

# 正确：提供所有必需参数
xiaozhi mcp call customMCP text_processor --args '{"text": "Hello", "operation": "uppercase"}'
```

### 8. customMCP 配置错误

**错误信息：**
```
错误: customMCP 工具 'my_tool' 配置验证失败。请检查配置文件中的工具定义。
```

**解决方法：**
- 检查 `xiaozhi.config.json` 中的 customMCP 配置语法
- 确认 handler 类型和配置参数正确
- 验证环境变量是否已设置（如 API 密钥）
- 参考 [customMCP 配置示例文档](./custom-mcp-handlers-examples.md)

## 相关命令

### 服务管理命令

- `xiaozhi start [-d]`：启动 xiaozhi 服务
- `xiaozhi stop`：停止 xiaozhi 服务
- `xiaozhi status`：查看服务状态
- `xiaozhi restart [-d]`：重启服务

### MCP 相关命令

- `xiaozhi mcp list`：列出所有可用的 MCP 服务和 customMCP 工具
- `xiaozhi mcp list --tools`：显示详细的工具列表，包括 customMCP 工具
- `xiaozhi mcp tool <服务名> <工具名> <enable|disable>`：启用或禁用标准 MCP 工具
- `xiaozhi config show`：查看当前配置，包括 customMCP 配置

## 技术架构说明

`xiaozhi mcp call` 命令采用以下架构：

1. **CLI 命令**：解析用户输入的命令和参数
2. **HTTP API 调用**：通过 HTTP 请求调用后台服务的 `/api/tools/call` 端点
3. **后台服务处理**：后台服务管理所有 MCP 连接并执行工具调用
4. **结果返回**：将工具执行结果格式化后返回给用户

这种架构确保了：
- CLI 和后台服务的清晰分离
- 统一的工具调用接口
- 可靠的错误处理和状态管理

## 最佳实践

### 通用最佳实践

1. **参数验证**：调用前确认参数格式和内容正确
2. **错误处理**：根据错误信息进行相应的故障排除
3. **服务监控**：定期检查服务状态确保正常运行
4. **配置管理**：保持 MCP 服务配置的准确性和时效性

### customMCP 工具最佳实践

1. **配置验证**：
   - 使用 `xiaozhi mcp list` 验证 customMCP 工具是否正确加载
   - 定期检查配置文件语法和结构
   - 确保环境变量正确设置

2. **参数设计**：
   - 为 customMCP 工具定义清晰的 `inputSchema`
   - 使用适当的参数类型和验证规则
   - 提供有意义的参数描述

3. **错误处理**：
   - 实现适当的超时和重试机制
   - 为不同的 handler 类型配置合适的错误处理策略
   - 监控外部 API 调用的成功率

4. **性能优化**：
   - 合理设置超时时间，避免长时间等待
   - 对于频繁调用的工具，考虑缓存机制
   - 监控工具调用的响应时间

5. **安全考虑**：
   - 使用环境变量存储敏感信息（API 密钥等）
   - 定期轮换 API 密钥和访问令牌
   - 限制工具的访问权限和操作范围

## 故障排除检查清单

遇到问题时，请按以下顺序检查：

- [ ] xiaozhi 服务是否正在运行（`xiaozhi status`）
- [ ] 服务名称和工具名称是否正确
- [ ] 参数 JSON 格式是否有效
- [ ] 工具是否已启用
- [ ] 网络连接是否正常
- [ ] 配置文件是否正确

如果问题仍然存在，请查看日志文件获取更详细的错误信息：
```bash
xiaozhi attach  # 查看实时日志
```
