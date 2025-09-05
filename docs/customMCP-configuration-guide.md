# customMCP 工具配置和使用指南

## 概述

customMCP 是 xiaozhi 系统的一个强大功能，允许您在配置文件中直接定义自定义工具，无需开发独立的 MCP 服务。customMCP 支持多种处理器类型，可以满足各种自动化和集成需求。

## 配置结构

customMCP 工具在 `xiaozhi.config.json` 文件的 `customMCP` 字段中定义：

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "工具名称",
        "description": "工具描述",
        "inputSchema": {
          "type": "object",
          "properties": {
            "参数名": {
              "type": "参数类型",
              "description": "参数描述"
            }
          },
          "required": ["必需参数列表"]
        },
        "handler": {
          "type": "处理器类型",
          "config": {
            // 处理器特定配置
          }
        }
      }
    ]
  }
}
```

### 基本字段说明

- **name**：工具的唯一标识符，用于调用时指定
- **description**：工具的功能描述，显示在工具列表中
- **inputSchema**：JSON Schema 格式的参数定义，用于参数验证
- **handler**：处理器配置，定义工具的执行逻辑

## 支持的处理器类型

### 1. proxy 处理器

用于代理调用第三方平台的 API，如 Coze、Dify、n8n 等。

```json
{
  "name": "coze_workflow",
  "description": "调用 Coze 工作流",
  "inputSchema": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "输入内容"
      }
    },
    "required": ["input"]
  },
  "handler": {
    "type": "proxy",
    "platform": "coze",
    "config": {
      "workflow_id": "7513776469241741352",
      "api_key": "${COZE_API_KEY}",
      "timeout": 30000
    }
  }
}
```

**支持的平台**：
- `coze`：Coze 平台工作流和聊天机器人
- `dify`：Dify 平台应用
- `n8n`：n8n 工作流自动化

### 2. http 处理器

直接调用 HTTP API，支持各种认证方式和请求格式。

```json
{
  "name": "weather_api",
  "description": "获取天气信息",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "城市名称"
      }
    },
    "required": ["city"]
  },
  "handler": {
    "type": "http",
    "config": {
      "url": "https://api.openweathermap.org/data/2.5/weather",
      "method": "GET",
      "headers": {
        "X-API-Key": "${WEATHER_API_KEY}"
      },
      "timeout": 10000,
      "retry_count": 3
    }
  }
}
```

### 3. function 处理器

执行 JavaScript 函数，支持内联代码和外部模块。

```json
{
  "name": "text_processor",
  "description": "文本处理工具",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "要处理的文本"
      },
      "operation": {
        "type": "string",
        "enum": ["uppercase", "lowercase", "reverse"],
        "description": "处理操作"
      }
    },
    "required": ["text", "operation"]
  },
  "handler": {
    "type": "function",
    "config": {
      "code": "function processText(args) { const { text, operation } = args; switch(operation) { case 'uppercase': return text.toUpperCase(); case 'lowercase': return text.toLowerCase(); case 'reverse': return text.split('').reverse().join(''); default: return text; } }",
      "functionName": "processText"
    }
  }
}
```

### 4. script 处理器

执行外部脚本，支持 Node.js、Python 等多种解释器。

```json
{
  "name": "data_analyzer",
  "description": "数据分析工具",
  "inputSchema": {
    "type": "object",
    "properties": {
      "data": {
        "type": "array",
        "description": "数据数组"
      }
    },
    "required": ["data"]
  },
  "handler": {
    "type": "script",
    "config": {
      "script": "./scripts/analyze-data.js",
      "interpreter": "node",
      "timeout": 15000,
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 5. chain 处理器

链式调用多个工具，支持顺序执行和并行执行。

```json
{
  "name": "document_pipeline",
  "description": "文档处理流水线",
  "inputSchema": {
    "type": "object",
    "properties": {
      "document": {
        "type": "string",
        "description": "文档内容"
      }
    },
    "required": ["document"]
  },
  "handler": {
    "type": "chain",
    "config": {
      "tools": ["text_processor", "coze_workflow", "send_notification"],
      "mode": "sequential",
      "error_handling": "continue"
    }
  }
}
```

## 参数验证

customMCP 工具支持基于 JSON Schema 的参数验证，提供以下功能：

### 基本类型验证

```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "minLength": 2,
        "maxLength": 50
      },
      "age": {
        "type": "integer",
        "minimum": 0,
        "maximum": 150
      },
      "active": {
        "type": "boolean"
      }
    },
    "required": ["name", "age"]
  }
}
```

### 复杂类型验证

```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "user": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "email": { "type": "string" }
        },
        "required": ["name"]
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 1,
        "maxItems": 10
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high"]
      }
    }
  }
}
```

## 环境变量配置

customMCP 工具支持使用环境变量来存储敏感信息：

```bash
# 设置环境变量
export COZE_API_KEY="your_coze_api_key"
export WEATHER_API_KEY="your_weather_api_key"
export DATABASE_URL="your_database_url"
```

在配置中使用环境变量：

```json
{
  "handler": {
    "type": "http",
    "config": {
      "url": "${DATABASE_URL}/api/data",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}
```

## 使用示例

### 调用 customMCP 工具

```bash
# 基本调用
xiaozhi mcp call customMCP text_processor --args '{"text": "Hello World", "operation": "uppercase"}'

# 复杂参数调用
xiaozhi mcp call customMCP weather_api --args '{"city": "北京", "units": "metric"}'

# 查看可用的 customMCP 工具
xiaozhi mcp list --tools
```

### 错误处理示例

```bash
# 参数验证失败
$ xiaozhi mcp call customMCP text_processor --args '{}'
错误: 参数验证失败: 缺少必需参数: text

# 工具不存在
$ xiaozhi mcp call customMCP unknown_tool --args '{}'
错误: customMCP 工具 'unknown_tool' 不存在。可用的 customMCP 工具: text_processor, weather_api
```

## 性能优化建议

1. **合理设置超时时间**：根据工具的实际执行时间设置合适的超时值
2. **使用重试机制**：对于网络请求，配置适当的重试次数和延迟
3. **缓存策略**：对于频繁调用且结果相对稳定的工具，考虑实现缓存
4. **并行执行**：使用 chain 处理器的并行模式提高处理效率

## 安全最佳实践

1. **环境变量存储敏感信息**：不要在配置文件中硬编码 API 密钥
2. **最小权限原则**：为工具配置最小必要的权限和访问范围
3. **定期轮换密钥**：定期更新 API 密钥和访问令牌
4. **输入验证**：使用严格的 inputSchema 验证用户输入
5. **错误信息脱敏**：避免在错误信息中泄露敏感数据

## 故障排除

### 常见问题

1. **工具加载失败**：检查配置文件语法和结构
2. **参数验证失败**：确认参数类型和必需字段
3. **API 调用失败**：验证 API 密钥和网络连接
4. **脚本执行错误**：检查脚本路径和解释器配置

### 调试技巧

1. 使用 `xiaozhi mcp list` 验证工具是否正确加载
2. 查看详细的错误信息和日志
3. 先测试简单的配置，再逐步增加复杂性
4. 使用 `xiaozhi attach` 查看实时日志

更多详细示例请参考 [customMCP 处理器配置示例](./custom-mcp-handlers-examples.md)。
