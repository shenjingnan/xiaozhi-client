# xiaozhi 缓存文件 JSON Schema 文档

## 概述

`xiaozhi.cache.schema.json` 是 xiaozhi 项目的缓存文件格式规范，定义了 `xiaozhi.cache.json` 缓存文件的完整数据结构。该 Schema 基于 JSON Schema Draft 7 标准，用于验证缓存文件格式的正确性，并为开发者提供缓存数据结构的文档说明。

## 文件结构

### 根级别结构

```json
{
  "version": "1.0.0",
  "servers": { ... },
  "metadata": { ... }
}
```

#### 字段说明

- **`version`** (string, 必需): 缓存文件格式版本号，遵循语义化版本规范
- **`servers`** (object, 必需): MCP 服务器配置和工具列表的映射，键为服务器名称
- **`metadata`** (object, 必需): 缓存文件的全局元数据信息

### 服务器条目结构 (`MCPToolsCacheEntry`)

每个服务器条目包含以下字段：

```json
{
  "tools": [...],
  "lastUpdated": "2025-09-01T11:14:24.373Z",
  "serverConfig": { ... },
  "configHash": "26e2388a301509d276dba45913acfeb5b4886a089186ce30663bbd16caaea6e5",
  "version": "1.0.0"
}
```

#### 字段说明

- **`tools`** (array, 必需): 该服务提供的工具列表
- **`lastUpdated`** (string, 必需): 该服务工具列表最后更新时间，ISO 8601 格式
- **`serverConfig`** (object, 必需): 服务配置的快照，用于检测配置变更
- **`configHash`** (string, 必需): 服务配置的 SHA256 哈希值，用于快速检测配置变更
- **`version`** (string, 必需): 缓存条目版本号

### 工具定义结构 (`Tool`)

每个工具包含以下字段：

```json
{
  "name": "calculator",
  "description": "For mathematical calculation",
  "inputSchema": { ... }
}
```

#### 字段说明

- **`name`** (string, 必需): 工具名称，必须唯一
- **`description`** (string, 可选): 工具功能描述
- **`inputSchema`** (object, 可选): 工具输入参数的 JSON Schema 定义

### 元数据结构 (`metadata`)

```json
{
  "lastGlobalUpdate": "2025-09-01T11:14:24.374Z",
  "totalWrites": 3,
  "createdAt": "2025-09-01T11:14:24.288Z"
}
```

#### 字段说明

- **`lastGlobalUpdate`** (string, 必需): 全局最后更新时间，ISO 8601 格式
- **`totalWrites`** (integer, 必需): 缓存文件的总写入次数
- **`createdAt`** (string, 必需): 缓存文件创建时间，ISO 8601 格式

## 使用方法

### 1. 验证缓存文件

使用提供的验证脚本：

```bash
# 验证默认位置的缓存文件
node scripts/validate-cache.js

# 验证指定路径的缓存文件
node scripts/validate-cache.js /path/to/xiaozhi.cache.json

# 使用自定义 Schema 文件
node scripts/validate-cache.js /path/to/cache.json /path/to/schema.json
```

### 2. 使用 ajv-cli 验证

```bash
# 安装 ajv-cli
npm install -g ajv-cli

# 验证缓存文件
ajv validate -s xiaozhi.cache.schema.json -d xiaozhi.cache.json
```

### 3. 在代码中使用

```javascript
import Ajv from 'ajv';
import fs from 'fs';

// 加载 Schema
const schema = JSON.parse(fs.readFileSync('xiaozhi.cache.schema.json', 'utf8'));
const ajv = new Ajv();
const validate = ajv.compile(schema);

// 验证缓存数据
const cacheData = JSON.parse(fs.readFileSync('xiaozhi.cache.json', 'utf8'));
const valid = validate(cacheData);

if (valid) {
  console.log('缓存文件格式正确');
} else {
  console.log('验证失败:', validate.errors);
}
```

## 示例缓存文件

```json
{
  "version": "1.0.0",
  "servers": {
    "calculator": {
      "tools": [
        {
          "name": "calculator",
          "description": "For mathematical calculation",
          "inputSchema": {
            "type": "object",
            "properties": {
              "javascript_expression": {
                "type": "string",
                "description": "JavaScript expression to evaluate"
              }
            },
            "required": ["javascript_expression"],
            "additionalProperties": false
          }
        }
      ],
      "lastUpdated": "2025-09-01T11:14:24.373Z",
      "serverConfig": {
        "name": "calculator",
        "type": "stdio",
        "command": "node",
        "args": ["./mcpServers/calculator.js"],
        "timeout": 30000
      },
      "configHash": "26e2388a301509d276dba45913acfeb5b4886a089186ce30663bbd16caaea6e5",
      "version": "1.0.0"
    }
  },
  "metadata": {
    "lastGlobalUpdate": "2025-09-01T11:14:24.374Z",
    "totalWrites": 3,
    "createdAt": "2025-09-01T11:14:24.288Z"
  }
}
```

## 验证规则

### 格式验证

- **时间戳**: 必须符合 ISO 8601 格式 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **版本号**: 必须符合语义化版本格式 (`x.y.z`)
- **配置哈希**: 必须是 64 位十六进制字符串 (SHA256)
- **服务器名称**: 只能包含字母、数字、下划线和连字符

### 数据完整性

- 所有必需字段必须存在
- 数组字段不能为 null
- 数值字段必须在合理范围内
- 字符串字段不能为空（除非明确允许）

## 版本兼容性

当前 Schema 版本: `1.0.0`

### 版本升级策略

- **主版本号**: 不兼容的结构变更
- **次版本号**: 向后兼容的功能添加
- **修订版本号**: 向后兼容的问题修复

## 相关文件

- `xiaozhi.cache.schema.json`: JSON Schema 定义文件
- `scripts/validate-cache.js`: 缓存文件验证脚本
- `src/services/MCPCacheManager.ts`: 缓存管理器实现
- `xiaozhi.cache.json`: 实际的缓存文件

## 注意事项

1. **数据一致性**: 缓存文件应该与实际的 MCP 服务配置保持一致
2. **性能考虑**: 大型缓存文件可能影响读写性能
3. **安全性**: 缓存文件可能包含敏感的配置信息，注意访问权限
4. **备份**: 建议定期备份缓存文件，避免数据丢失

## 故障排除

### 常见验证错误

1. **时间格式错误**: 确保时间戳符合 ISO 8601 格式
2. **缺少必需字段**: 检查所有必需字段是否存在
3. **类型不匹配**: 确保字段类型与 Schema 定义一致
4. **格式不符**: 检查版本号、哈希值等格式是否正确

### 修复建议

1. 使用验证脚本检查具体错误信息
2. 参考示例文件修正格式问题
3. 重新生成缓存文件（删除现有文件，重启服务）
4. 检查 MCPCacheManager 的实现逻辑
