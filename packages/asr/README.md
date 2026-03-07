# @xiaozhi-client/asr

> ByteDance 流式 ASR WebSocket 客户端库

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fasr.svg)](https://www.npmjs.com/package/@xiaozhi-client/asr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/asr` 是一个功能完整的字节跳动流式 ASR（自动语音识别）WebSocket 客户端库，提供：

- **流式识别** - 支持实时语音识别，边说边识别
- **单次识别** - 支持对完整音频文件进行一次性识别
- **平台支持** - 支持字节跳动 V2、V3 API，提供可扩展的平台抽象
- **音频处理** - 支持多种音频格式（WAV、MP3、OGG/Opus）
- **认证管理** - 支持 Token 和签名认证方式
- **核心抽象** - ASRClient、ASRPlatform 等核心抽象层
- **事件驱动** - 基于 Node.js EventEmitter 的事件系统

## 特性

### 核心功能

- **实时语音识别** - 流式处理音频数据，实时返回识别结果
- **完整音频识别** - 支持对完整音频文件进行识别
- **多平台支持** - 字节跳动 V2、V3 API
- **自动重连** - 连接断开时自动重连
- **VAD 检测** - 语音活动检测，自动识别说话结束

### 音频格式支持

| 格式 | 说明 |
|------|------|
| **WAV** | 标准 WAV 格式 |
| **MP3** - MP3 格式 |
| **OGG/Opus** | OGG 容器封装的 Opus 编码 |

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/asr

# 使用 pnpm
pnpm add @xiaozhi-client/asr

# 使用 yarn
yarn add @xiaozhi-client/asr
```

## 快速开始

### 流式识别模式

流式识别适用于实时语音识别场景，如语音助手、实时转写等：

```typescript
import { ASR } from '@xiaozhi-client/asr';

// 创建 ASR 实例
const asr = new ASR({
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-token',
        cluster: 'volcengine_streaming_common',
      },
      user: {
        uid: 'user-123',
      },
      audio: {
        format: 'wav',
        rate: 16000,
        bits: 16,
        channel: 1,
      },
    },
  },
});

// 监听识别结果
asr.on('result', (result) => {
  console.log('识别结果:', result.result?.[0]?.text);
});

// 监听最终结果
asr.on('vad_end', (finalText) => {
  console.log('最终结果:', finalText);
});

// 连接服务
await asr.connect();

// 发送音频数据（流式）
// ... 发送音频帧

// 结束识别
await asr.end();
```

### 单次识别模式

单次识别适用于对已有音频文件进行识别：

```typescript
import { executeOne } from '@xiaozhi-client/asr';

// 执行单次识别
const result = await executeOne('path/to/audio.wav', 'your-cluster', {
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-token',
        cluster: 'volcengine_streaming_common',
      },
      user: {
        uid: 'user-123',
      },
      audio: {
        format: 'wav',
      },
    },
  },
});

console.log('识别结果:', result);
```

## 事件监听

ASR 类继承自 Node.js 的 EventEmitter，支持以下事件：

```typescript
// 识别结果（实时）
asr.on('result', (result: ASRResult) => {
  console.log('实时识别:', result.result?.[0]?.text);
});

// 语音活动检测结束（最终结果）
asr.on('vad_end', (text: string) => {
  console.log('最终识别:', text);
});

// 连接建立
asr.on('opened', () => {
  console.log('连接已建立');
});

// 连接关闭
asr.on('closed', () => {
  console.log('连接已关闭');
});

// 错误事件
asr.on('error', (error: Error) => {
  console.error('发生错误:', error.message);
});
```

## 配置选项

### ASROption

```typescript
interface ASROption {
  // 字节跳动平台配置
  bytedance?: {
    // V2 API 配置
    v2?: {
      app: {
        appid: string;           // 应用 ID
        token?: string;          // Token 认证
        accessKey?: string;      // Access Key（签名认证）
        secretKey?: string;      // Secret Key（签名认证）
        cluster: string;         // 集群标识
      };
      user?: {
        uid: string;            // 用户 ID
      };
      audio?: {
        format: 'wav' | 'mp3' | 'ogg';
        rate?: number;          // 采样率，默认 16000
        bits?: number;          // 位深，默认 16
        channel?: number;       // 声道数，默认 1
      };
    };
    // V3 API 配置
    v3?: {
      // 类似 V2 配置
    };
  };
}
```

### 认证方式

库支持两种认证方式：

#### Token 认证

```typescript
{
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-token',
        cluster: 'volcengine_streaming_common',
      },
    },
  },
}
```

#### 签名认证

```typescript
{
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        accessKey: 'your-access-key',
        secretKey: 'your-secret-key',
        cluster: 'volcengine_streaming_common',
      },
    },
  },
}
```

## API 参考

### ASR 类

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `connect()` | 连接到 ASR 服务 | `Promise<void>` |
| `send(data)` | 发送音频数据 | `void` |
| `end()` | 结束识别会话 | `Promise<void>` |
| `destroy()` | 销毁实例 | `void` |
| `on(event, listener)` | 监听事件 | `this` |
| `off(event, listener)` | 移除监听 | `this` |

### executeOne 函数

```typescript
function executeOne(
  audioPath: string,      // 音频文件路径
  cluster: string,        // 集群标识
  options: ASROption      // 配置选项
): Promise<ASRResult>
```

### 导出的类型

```typescript
export type {
  ASROption,      // ASR 配置选项
  ASRResult,      // ASR 识别结果
  ASREventType,   // ASR 事件类型
  ASREventData,   // ASR 事件数据
} from './client/index.js';
```

## 完整示例

### 带错误处理的流式识别

```typescript
import { ASR } from '@xiaozhi-client/asr';
import { readFile } from 'node:fs/promises';

class ASRClient {
  private asr: ASR;

  constructor(config: ASROption) {
    this.asr = new ASR(config);

    // 设置事件监听
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.asr.on('result', (result) => {
      const text = result.result?.[0]?.text;
      if (text) {
        console.log('实时识别:', text);
      }
    });

    this.asr.on('vad_end', (text) => {
      console.log('最终结果:', text);
    });

    this.asr.on('error', (error) => {
      console.error('识别错误:', error.message);
    });
  }

  async recognize(audioData: Buffer) {
    try {
      await this.asr.connect();

      // 分块发送音频数据
      const chunkSize = 3200; // 100ms @ 16kHz
      for (let i = 0; i < audioData.length; i += chunkSize) {
        const chunk = audioData.slice(i, i + chunkSize);
        this.asr.send(chunk);
        // 模拟实时流
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await this.asr.end();
    } catch (error) {
      console.error('识别失败:', error);
      throw error;
    }
  }

  async destroy() {
    this.asr.destroy();
  }
}

// 使用示例
const client = new ASRClient({
  bytedance: {
    v2: {
      app: {
        appid: process.env.ASR_APP_ID!,
        token: process.env.ASR_TOKEN!,
        cluster: 'volcengine_streaming_common',
      },
      user: {
        uid: 'user-123',
      },
      audio: {
        format: 'wav',
      },
    },
  },
});

const audioData = await readFile('audio.wav');
await client.recognize(audioData);
await client.destroy();
```

## 最佳实践

### 1. 资源管理

```typescript
// ✅ 推荐：确保正确清理资源
try {
  await asr.connect();
  // 使用 asr...
} finally {
  asr.destroy();
}

// ❌ 避免：不清理资源
await asr.connect();
// 使用 asr...
// 忘记销毁
```

### 2. 错误处理

```typescript
// ✅ 推荐：监听错误事件
asr.on('error', (error) => {
  console.error('ASR 错误:', error);
  // 实现错误恢复逻辑
});

// ❌ 避免：忽略错误
asr.connect(); // 可能失败但没有处理
```

### 3. 音频数据分块

```typescript
// ✅ 推荐：合理分块发送
const chunkSize = 3200; // 根据采样率计算
for (let i = 0; i < audioData.length; i += chunkSize) {
  asr.send(audioData.slice(i, i + chunkSize));
  await sleep(100); // 模拟实时流
}

// ❌ 避免：一次性发送大量数据
asr.send(largeAudioBuffer); // 可能导致缓冲区溢出
```

## 常见问题

### Q: 如何选择合适的音频格式？

**A:**
- **WAV** - 无损格式，适合离线识别
- **Opus** - 压缩率高，适合网络传输
- **MP3** - 兼容性好，但压缩损失较大

### Q: 支持哪些采样率？

**A:** 建议使用 16000 Hz（16kHz），这是 ASR 服务的推荐采样率。

### Q: 如何处理网络中断？

**A:** 库会自动重连，你可以监听 `closed` 和 `opened` 事件来处理连接状态变化：

```typescript
asr.on('closed', () => {
  console.log('连接断开，等待重连...');
});

asr.on('opened', () => {
  console.log('连接已恢复');
});
```

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/xiaozhi-client.git
cd xiaozhi-client/packages/asr

# 安装依赖
pnpm install

# 开发模式（监听文件变化）
pnpm dev

# 构建
pnpm build

# 运行示例
pnpm demo

# 运行测试
pnpm test

# 类型检查
pnpm check:type

# 代码检查
pnpm lint
```

### 示例代码

在 `examples/` 目录中提供了多个示例：

```bash
# V2 流式识别
tsx examples/demo-bytedance-v2-stream.ts

# V3 流式识别
tsx examples/demo-bytedance-v3-stream.ts

# Opus 编码流式识别
tsx examples/demo-v2-opus-stream.ts
```

## 许可证

[MIT](LICENSE)

## 相关资源

- [字节跳动语音识别 API 文档](https://www.volcengine.com/docs/6561/79823)
- [xiaozhi-client 项目主页](https://github.com/shenjingnan/xiaozhi-client)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**版本**: 2.0.0
