# CustomMCP 处理器配置示例

本文档提供了各种 CustomMCP 处理器的配置示例，展示如何使用第四阶段实现的具体处理器类型。

## Coze API 代理处理器

### Coze 工作流调用

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "coze_workflow_analyzer",
        "description": "使用 Coze 工作流分析文档内容",
        "inputSchema": {
          "type": "object",
          "properties": {
            "input": {
              "type": "string",
              "description": "要分析的文档内容"
            },
            "analysis_type": {
              "type": "string",
              "enum": ["summary", "sentiment", "keywords"],
              "description": "分析类型"
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
            "base_url": "https://api.coze.cn",
            "timeout": 30000,
            "retry_count": 2,
            "retry_delay": 1000,
            "headers": {
              "X-Custom-Header": "xiaozhi-client"
            }
          }
        }
      }
    ]
  }
}
```

### Coze 聊天机器人调用

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "coze_chatbot",
        "description": "与 Coze 聊天机器人对话",
        "inputSchema": {
          "type": "object",
          "properties": {
            "input": {
              "type": "string",
              "description": "用户消息"
            },
            "conversation_id": {
              "type": "string",
              "description": "会话 ID（可选）"
            }
          },
          "required": ["input"]
        },
        "handler": {
          "type": "proxy",
          "platform": "coze",
          "config": {
            "bot_id": "7513776469241741353",
            "api_key": "${COZE_API_KEY}",
            "timeout": 30000
          }
        }
      }
    ]
  }
}
```

## HTTP 处理器

### REST API 调用

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "weather_api",
        "description": "获取天气信息",
        "inputSchema": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "城市名称"
            },
            "units": {
              "type": "string",
              "enum": ["metric", "imperial"],
              "default": "metric"
            }
          },
          "required": ["city"]
        },
        "handler": {
          "type": "http",
          "url": "https://api.openweathermap.org/data/2.5/weather",
          "method": "GET",
          "timeout": 10000,
          "retry_count": 3,
          "retry_delay": 1000,
          "auth": {
            "type": "api_key",
            "api_key": "${WEATHER_API_KEY}",
            "api_key_header": "X-API-Key"
          },
          "response_mapping": {
            "data_path": "main",
            "success_path": "weather"
          }
        }
      }
    ]
  }
}
```

### POST 请求与模板变量

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "send_notification",
        "description": "发送通知消息",
        "inputSchema": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "description": "通知标题"
            },
            "message": {
              "type": "string",
              "description": "通知内容"
            },
            "priority": {
              "type": "string",
              "enum": ["low", "normal", "high"],
              "default": "normal"
            }
          },
          "required": ["title", "message"]
        },
        "handler": {
          "type": "http",
          "url": "https://api.pushover.net/1/messages.json",
          "method": "POST",
          "headers": {
            "Content-Type": "application/json"
          },
          "body_template": "{\"token\": \"${PUSHOVER_TOKEN}\", \"user\": \"${PUSHOVER_USER}\", \"title\": \"{{title}}\", \"message\": \"{{message}}\", \"priority\": \"{{priority}}\"}",
          "auth": {
            "type": "bearer",
            "token": "${PUSHOVER_API_TOKEN}"
          }
        }
      }
    ]
  }
}
```

## 函数处理器

### JavaScript 模块函数

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "text_processor",
        "description": "处理文本内容",
        "inputSchema": {
          "type": "object",
          "properties": {
            "text": {
              "type": "string",
              "description": "要处理的文本"
            },
            "operation": {
              "type": "string",
              "enum": ["uppercase", "lowercase", "reverse", "wordcount"],
              "description": "处理操作"
            }
          },
          "required": ["text", "operation"]
        },
        "handler": {
          "type": "function",
          "module": "./custom-functions/text-utils.js",
          "function": "processText",
          "timeout": 5000,
          "context": {
            "encoding": "utf-8",
            "locale": "zh-CN"
          }
        }
      }
    ]
  }
}
```

### 默认导出函数

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "data_validator",
        "description": "验证数据格式",
        "inputSchema": {
          "type": "object",
          "properties": {
            "data": {
              "type": "any",
              "description": "要验证的数据"
            },
            "schema": {
              "type": "object",
              "description": "验证模式"
            }
          },
          "required": ["data", "schema"]
        },
        "handler": {
          "type": "function",
          "module": "./validators/data-validator.js",
          "function": "default",
          "timeout": 3000
        }
      }
    ]
  }
}
```

## 脚本处理器

### Node.js 脚本

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "file_analyzer",
        "description": "分析文件内容",
        "inputSchema": {
          "type": "object",
          "properties": {
            "file_path": {
              "type": "string",
              "description": "文件路径"
            },
            "analysis_type": {
              "type": "string",
              "enum": ["size", "lines", "encoding"],
              "description": "分析类型"
            }
          },
          "required": ["file_path"]
        },
        "handler": {
          "type": "script",
          "script": "./scripts/file-analyzer.js",
          "interpreter": "node",
          "timeout": 10000,
          "env": {
            "NODE_ENV": "production",
            "MAX_FILE_SIZE": "10MB"
          }
        }
      }
    ]
  }
}
```

### Python 脚本

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "data_science_tool",
        "description": "数据科学分析工具",
        "inputSchema": {
          "type": "object",
          "properties": {
            "data": {
              "type": "array",
              "description": "数据数组"
            },
            "operation": {
              "type": "string",
              "enum": ["mean", "median", "std", "correlation"],
              "description": "统计操作"
            }
          },
          "required": ["data", "operation"]
        },
        "handler": {
          "type": "script",
          "script": "import json\nimport sys\nimport numpy as np\n\n# 从环境变量读取参数\nargs = json.loads(os.environ.get('XIAOZHI_ARGUMENTS', '{}'))\ndata = np.array(args['data'])\noperation = args['operation']\n\nif operation == 'mean':\n    result = np.mean(data)\nelif operation == 'median':\n    result = np.median(data)\nelif operation == 'std':\n    result = np.std(data)\nelse:\n    result = 'Unknown operation'\n\nprint(json.dumps({'result': float(result) if isinstance(result, np.number) else result}))",
          "interpreter": "python",
          "timeout": 15000,
          "env": {
            "PYTHONPATH": "/usr/local/lib/python3.9/site-packages"
          }
        }
      }
    ]
  }
}
```

## 链式处理器

### 顺序执行链

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "document_pipeline",
        "description": "文档处理流水线",
        "inputSchema": {
          "type": "object",
          "properties": {
            "document": {
              "type": "string",
              "description": "原始文档内容"
            }
          },
          "required": ["document"]
        },
        "handler": {
          "type": "chain",
          "tools": ["text_processor", "coze_workflow_analyzer", "send_notification"],
          "mode": "sequential",
          "error_handling": "continue"
        }
      }
    ]
  }
}
```

### 并行执行链

```json
{
  "customMCP": {
    "tools": [
      {
        "name": "multi_analysis",
        "description": "多维度分析工具",
        "inputSchema": {
          "type": "object",
          "properties": {
            "content": {
              "type": "string",
              "description": "要分析的内容"
            }
          },
          "required": ["content"]
        },
        "handler": {
          "type": "chain",
          "tools": ["coze_workflow_analyzer", "text_processor", "data_validator"],
          "mode": "parallel",
          "error_handling": "continue"
        }
      }
    ]
  }
}
```

## 环境变量配置

在使用这些配置示例时，请确保设置相应的环境变量：

```bash
# Coze API
export COZE_API_KEY="your_coze_api_key"

# 天气 API
export WEATHER_API_KEY="your_weather_api_key"

# 推送通知
export PUSHOVER_TOKEN="your_pushover_token"
export PUSHOVER_USER="your_pushover_user"
export PUSHOVER_API_TOKEN="your_pushover_api_token"
```

## 故障排除

### 常见问题

1. **Coze API 调用失败**
   - 检查 API 密钥是否正确
   - 确认 workflow_id 或 bot_id 是否有效
   - 检查网络连接和防火墙设置

2. **HTTP 请求超时**
   - 增加 timeout 配置值
   - 检查目标 API 的响应时间
   - 考虑增加重试次数

3. **函数模块加载失败**
   - 确认模块路径是否正确
   - 检查模块文件是否存在
   - 验证函数名称是否匹配

4. **脚本执行错误**
   - 检查脚本语法是否正确
   - 确认解释器是否已安装
   - 验证环境变量设置

### 调试技巧

- 启用详细日志记录
- 使用较短的超时时间进行测试
- 先测试简单的配置，再逐步增加复杂性
- 检查返回的错误消息以获取具体信息
