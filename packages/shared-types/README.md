# @xiaozhi-client/shared-types

共享类型包，用于 xiaozhi-client 项目中的类型定义。

## 功能

此包提供了以下核心类型：

- `UserType` - 用户类型定义
- `MessageType` - 消息类型定义
- `ConfigType` - 配置类型定义
- `ResponseType` - 响应类型定义

## 使用方法

```typescript
import { UserType, MessageType } from '@xiaozhi-client/shared-types';

const user: UserType = {
  id: '123',
  name: '张三',
  // ... 其他字段
};
```

## API 参考

### UserType

用户类型定义。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 用户 ID |
| name | string | 用户名 |
| email | string | 邮箱 |

### MessageType

消息类型定义。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 消息 ID |
| content | string | 消息内容 |
| timestamp | number | 时间戳 |

## 开发

### 构建项目

```bash
npm run build
```

### 运行测试

```bash
npm test
```

## 许可证

MIT
