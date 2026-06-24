# @xiaozhi-client/asr

> ByteDance 流式 ASR WebSocket 客户端库，支持实时语音识别

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fasr.svg)](https://www.npmjs.com/package/@xiaozhi-client/asr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/asr` 是一个 ByteDance 流式 ASR（自动语音识别）WebSocket 客户端库，提供：

- **多协议支持** - 支持字节跳动 V2、V3 ASR API
- **流式识别** - 实时语音识别和单次识别两种模式
- **多格式支持** - 支持 WAV、MP3、OGG/Opus 等音频格式
- **多种认证** - Token 认证和签名认证方式
- **事件驱动** - 基于 EventEmitter 的结果通知机制
- **完整类型** - TypeScript 严格模式，完整类型定义

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/asr

# 使用 pnpm
pnpm add @xiaozhi-client/asr

# 使用 yarn
yarn add @xiaozhi-client/asr
```

### 依赖要求

```json
{
  "peerDependencies": {
    "ws": "^8.16.0"
  }
}
```

请确保项目中安装了 `ws`：

```bash
npm install ws
```

## 快速开始

### 流式识别模式

适用于实时语音流识别场景：

```typescript
import { ASR } from '@xiaozhi-client/asr';

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
      },
    },
  },
});

// 监听识别结果事件
asr.on('result', (result) => {
  console.log('中间结果:', result.result?.[0]?.text);
});

// 监听 VAD 结束事件（一句话说完）
asr.on('vad_end', (finalText) => {
  console.log('最终结果:', finalText);
});

// 监听音频结束事件
asr.on('audio_end', () => {
  console.log('音频发送完成');
});

// 连接服务
await asr.connect();

// 流式发送音频帧
await asr.sendFrame(audioChunk1);
await asr.sendFrame(audioChunk2);
// ...

// 结束音频发送，获取最终结果
const finalResult = await asr.end();
```

### 单次识别模式

适用于完整音频文件的一次性识别：

```typescript
import { executeOne } from '@xiaozhi-client/asr';

const result = await executeOne('path/to/audio.wav', 'volcengine_streaming_common', {
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

console.log('识别结果:', result.result?.[0]?.text);
```

### V3 API 使用

字节跳动 V3 API 使用不同的认证方式：

```typescript
import { ASR } from '@xiaozhi-client/asr';

const asr = new ASR({
  bytedance: {
    v3: {
      appKey: 'your-app-key',
      accessKey: 'your-access-key',
      user: {
        uid: 'user-123',
      },
      audio: {
        format: 'wav',
        rate: 16000,
      },
    },
  },
});
```

## 核心 API

### ASR 类

流式 ASR 客户端核心类：

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `connect()` | 连接 WebSocket 并发送配置 | `Promise<void>` |
| `sendFrame(frame)` | 发送音频帧数据 | `Promise<void>` |
| `end()` | 结束音频发送并获取最终结果 | `Promise<ASRResult>` |
| `close()` | 关闭 WebSocket 连接 | `void` |
| `isConnected()` | 检查是否已连接 | `boolean` |
| `isInStreamingMode()` | 检查是否在流式模式 | `boolean` |
| `isAudioEnded()` | 检查音频是否已结束 | `boolean` |
| `setAudioPath(path, format)` | 设置音频文件路径 | `void` |
| `execute()` | 执行单次音频文件识别 | `Promise<ASRResult>` |

### 事件类型

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `result` | 收到中间识别结果 | `ASRResult` |
| `vad_end` | VAD 结束（一句话说完） | `string` (最终文本) |
| `audio_end` | 音频发送完成 | `void` |
| `full_response` | 收到完整响应 | `unknown` |
| `open` | WebSocket 连接建立 | `void` |
| `close` | WebSocket 连接关闭 | `void` |
| `error` | 发生错误 | `Error` |

### executeOne 函数

单次识别便捷函数：

```typescript
function executeOne(
  audioPath: string,
  cluster: string,
  options: ASROption
): Promise<ASRResult>
```

## 配置选项

### ASROption

ASR 客户端配置接口：

```typescript
interface ASROption {
  // ByteDance 配置（推荐）
  bytedance?: {
    v2?: ByteDanceV2Config;
    v3?: ByteDanceV3Config;
  };

  // 兼容旧版配置
  wsUrl?: string;
  appid?: string;
  token?: string;
  cluster?: string;
  uid?: string;

  // 音频配置
  audioPath?: string;
  format?: AudioFormat;
  sampleRate?: number;
  language?: string;

  // 请求配置
  segDuration?: number;
  nbest?: number;
  workflow?: string;

  // 认证配置
  authMethod?: AuthMethod;
  secret?: string;
}
```

### ByteDanceV2Config

字节跳动 V2 API 配置：

```typescript
interface ByteDanceV2Config {
  app: {
    appid: string;
    token: string;
    cluster?: string;
  };
  user?: {
    uid?: string;
  };
  audio?: {
    format?: AudioFormat;
    rate?: number;
    bits?: number;
    channel?: number;
    codec?: string;
    language?: string;
  };
  request?: {
    segDuration?: number;
    nbest?: number;
    workflow?: string;
    showLanguage?: boolean;
    showUtterances?: boolean;
    resultType?: string;
  };
}
```

### AudioFormat

支持的音频格式：

```typescript
enum AudioFormat {
  WAV = 'wav',
  MP3 = 'mp3',
  OGG = 'ogg',
}
```

## 音频处理

### 音频格式支持

| 格式 | 说明 | 使用场景 |
|------|------|----------|
| **WAV** | WAV PCM 格式 | 最常用，高质量音频 |
| **MP3** | MP3 格式 | 压缩音频，自动转换 |
| **OGG** | OGG/Opus 格式 | Opus 编码音频 |

### 音频参数配置

```typescript
const asr = new ASR({
  bytedance: {
    v2: {
      app: { appid, token, cluster },
      audio: {
        format: 'wav',
        rate: 16000,    // 采样率
        bits: 16,       // 位深度
        channel: 1,     // 声道数
        codec: 'raw',   // 编码格式
        language: 'zh-CN',
      },
    },
  },
});
```

## 认证方式

### Token 认证（推荐）

```typescript
const asr = new ASR({
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-token',
        cluster: 'volcengine_streaming_common',
      },
    },
  },
  authMethod: AuthMethod.TOKEN, // 默认值
});
```

### 签名认证

```typescript
import { AuthMethod } from '@xiaozhi-client/asr';

const asr = new ASR({
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-app-key', // 注意：签名认证使用 appKey
        cluster: 'volcengine_streaming_common',
      },
    },
  },
  authMethod: AuthMethod.SIGNATURE,
  secret: 'your-secret-key',
});
```

## 完整示例

### 实时流式识别

```typescript
import { ASR, AudioFormat } from '@xiaozhi-client/asr';
import { readFileSync } from 'fs';

class StreamingASRClient {
  private asr: ASR;

  constructor(config: { appid: string; token: string; cluster: string }) {
    this.asr = new ASR({
      bytedance: {
        v2: {
          app: config,
          user: { uid: 'streaming-client' },
          audio: { format: AudioFormat.WAV, rate: 16000 },
        },
      },
    });

    // 注册事件监听
    this.asr.on('result', (result) => {
      const text = result.result?.[0]?.text || '';
      console.log('识别中:', text);
    });

    this.asr.on('vad_end', (finalText) => {
      console.log('一句话结束:', finalText);
    });

    this.asr.on('error', (error) => {
      console.error('识别错误:', error.message);
    });
  }

  async start() {
    await this.asr.connect();
    console.log('ASR 服务已连接');
  }

  async sendAudio(chunk: Buffer) {
    await this.asr.sendFrame(chunk);
  }

  async finish() {
    const result = await this.asr.end();
    console.log('最终结果:', result);
    return result;
  }
}

// 使用示例
const client = new StreamingASRClient({
  appid: 'your-app-id',
  token: 'your-token',
  cluster: 'volcengine_streaming_common',
});

await client.start();

// 模拟实时音频流
const audioChunks = getAudioChunksFromMicrophone(); // 你的音频源
for (const chunk of audioChunks) {
  await client.sendAudio(chunk);
}

await client.finish();
```

### 音频文件识别

```typescript
import { ASR, executeOne, AudioFormat } from '@xiaozhi-client/asr';

// 方式一：使用 executeOne 函数
const result1 = await executeOne('./test.wav', 'volcengine_streaming_common', {
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-token',
        cluster: 'volcengine_streaming_common',
      },
    },
  },
});

// 方式二：使用 ASR 类
const asr = new ASR({
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-token',
        cluster: 'volcengine_streaming_common',
      },
    },
  },
  audioPath: './test.mp3',
  format: AudioFormat.MP3,
});

const result2 = await asr.execute();
```

## 导出模块

```typescript
// 主要导出
export { ASR, executeOne } from './client/index.js';

// 类型导出
export type {
  ASROption,
  ASRResult,
  ASREventType,
  ASREventData,
} from './client/index.js';

// 音频处理
export * from './audio/index.js';

// 认证模块
export * from './auth/index.js';

// 平台实现
export * from './platforms/index.js';

// 核心抽象
export * from './core/index.js';
```

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/xiaozhi-client.git
cd xiaozhi-client/packages/asr

# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm check:type

# 运行演示
pnpm demo
```

### 构建产物

```bash
dist/
├── index.js           # ESM 格式的编译产物
├── index.d.ts         # TypeScript 类型声明
└── index.js.map       # Source Map
```

## 许可证

[MIT](LICENSE)

## 相关资源

- [字节跳动 ASR API 文档](https://www.volcengine.com/docs/6561/79817)
- [xiaozhi-client 项目](https://github.com/shenjingnan/xiaozhi-client)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**作者**: xiaozhi-client
**版本**: 2.2.0