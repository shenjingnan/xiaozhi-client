# SettingManager 使用文档

SettingManager 是一个单例配置管理器，用于管理 `.xiaozhi/settings.json` 配置文件。

## 特性

- **单例模式**: 确保全局只有一个配置管理实例
- **只读访问**: 外部只能通过方法获取配置，不能直接修改
- **方法更新**: 必须通过提供的方法来更新配置
- **自动保存**: 配置更新后自动保存到文件
- **嵌套键支持**: 支持使用点号分隔的嵌套键，如 `xiaozhi.endpoint`

## 基本用法

### 获取实例

```javascript
import SettingManager from './src/SettingManager.js';

const settings = SettingManager.getInstance();
```

### 读取配置

```javascript
// 读取简单配置
const endpoint = settings.get('xiaozhi.endpoint');

// 读取嵌套配置
const command = settings.get('mcpServers.amap-maps.command');

// 获取所有配置（只读副本）
const allSettings = settings.getAll();
```

### 更新配置

```javascript
// 更新现有配置
settings.set('xiaozhi.endpoint', 'wss://new-endpoint.com');

// 添加新配置
settings.set('myApp.newSetting', 'value');

// 创建嵌套配置
settings.set('myApp.nested.deep.setting', 'deep value');
```

### 检查配置是否存在

```javascript
if (settings.has('xiaozhi.endpoint')) {
  console.log('Endpoint is configured');
}
```

### 删除配置

```javascript
// 删除配置项
settings.delete('myApp.temporarySetting');

// 删除嵌套配置
settings.delete('myApp.nested.deep.setting');
```

### 重新加载配置

```javascript
// 从文件重新加载配置（如果文件被外部修改）
settings.reload();
```

## 配置文件结构

配置文件位于 `.xiaozhi/settings.json`，典型结构如下：

```json
{
  "xiaozhi": {
    "endpoint": "wss://api.xiaozhi.me/mcp/?token=..."
  },
  "mcpServers": {
    "amap-maps": {
      "command": "npx",
      "args": ["-y", "@amap/amap-maps-mcp-server"],
      "env": {
        "AMAP_MAPS_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 在 mcp_pipe.js 中的使用

原来的代码使用环境变量：

```javascript
const endpointUrl = process.env.MCP_ENDPOINT;
```

现在使用 SettingManager：

```javascript
import SettingManager from './SettingManager.js';

const settingManager = SettingManager.getInstance();
const endpointUrl = settingManager.get('xiaozhi.endpoint');
```

## 注意事项

1. **单例模式**: 无论在哪里调用 `SettingManager.getInstance()`，都会返回同一个实例
2. **自动保存**: 调用 `set()` 或 `delete()` 方法后，配置会立即保存到文件
3. **只读访问**: `get()` 和 `getAll()` 返回的是配置的副本，直接修改不会影响实际配置
4. **错误处理**: 如果配置文件损坏或无法访问，会抛出相应的错误
5. **目录创建**: 如果 `.xiaozhi` 目录不存在，会自动创建

## 示例

查看 `examples/setting_manager_usage.js` 文件获取完整的使用示例。
