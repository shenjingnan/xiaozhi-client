# @xiaozhi-client/asr

> ByteDance 流式 ASR WebSocket 客户端库

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fasr.svg)](https://www.npmjs.com/package/@xiaozhi-client/asr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/asr` 是一个与字节跳动 ASR 服务集成的流式语音识别客户端库，提供：

- **流式 ASR 客户端** - 支持实时语音识别和单次识别
- **多平台支持** - 支持字节跳动 V2、V3 API，提供可扩展的平台抽象
- **音频格式处理** - 支持 WAV、MP3、OGG/Opus、RAW 多种音频格式
- **认证管理** - 支持 Token 和签名认证方式
- **核心抽象层** - ASRClient、ASRPlatform 等核心抽象
- **VAD 支持** - 自动检测语音活动结束

## 特性

### 核心功能

- **流式识别** - 实时发送音频帧，实时获取识别结果
- **单次识别** - 一次性处理音频文件并返回结果
- **事件驱动** - 基于 EventEmitter 的异步事件系统
- **多音频格式** - 自动处理 WAV、MP3、OGG/Opus 等格式
- **协议封装** - 自动处理 ByteDance V2/V3 协议

### API 版本

| 版本 | 说明 | 使用场景 |
|------|------|----------|
| **V2** | 字节跳动 ASR V2 API | 流式语音识别，实时场景 |
| **V3** | 字节跳动 ASR V3 API | 大模型语音识别 |

### 音频格式

| 格式 | 说明 | 处理方式 |
|------|------|----------|
| **WAV** | WAV PCM 音频 | 直接发送 PCM 数据 |
| **MP3** | MP3 音频 | 转换后发送 |
| **OGG/Opus** | OGG Opus 音频 | 发送 Opus 数据 |
| **RAW** | 裸 PCM 数据 | 直接发送 |

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
  "dependencies": {
    "@discordjs/opus": "^0.10.0",
    "prism-media": "^1.3.5",
    "uuid": "^9.0.1",
    "ws": "^8.16.0",
    "zod": "^3.23.8"
  }
}
```

## 快速开始

### 流式识别模式

使用 `connect()` + `sendFrame()` + `end()` 进行流式语音识别：

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
      },
    },
  },
});

// 监听识别结果
asr.on('result', (result) => {
  console.log('识别结果:', result.result?.[0]?.text);
});

// 监听 VAD 结束（语音活动结束）
asr.on('vad_end', (finalText) => {
  console.log('最终结果:', finalText);
});

// 连接并发送音频
await asr.connect();
// ... 流式发送音频帧
await asr.sendFrame(audioFrame);
await asr.end();
```

### 使用 listen() API（推荐）

使用 `listen()` API 进行更简洁的流式识别：

```typescript
import { ASR } from '@xiaozhi-client/asr';

const client = new ASR({
  bytedance: {
    v2: {
      app: {
        appid: 'your-app-id',
        token: 'your-token',
        cluster: 'volcengine_streaming_common',
      },
      user: {
        uid: 'streaming_asr_client',
      },
      audio: {
        format: 'raw',
        language: 'zh-CN',
      },
    },
  },
});

// 创建异步可迭代的 PCM 流
async function* createPcmStream(): AsyncGenerator<Buffer> {
  // 从音频源获取 PCM 数据
  for (const chunk of audioChunks) {
    yield chunk;
  }
}

// 使用 listen() API 进行流式识别
for await (const result of client.bytedance.v2.listen(createPcmStream())) {
  console.log(result.isFinal ? '最终' : '中间', result.text);
  if (result.isFinal) break;
}
```

### 单次识别模式

使用 `executeOne()` 一次性处理音频文件：

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

### 使用 ASR 类进行单次识别

```typescript
import { ASR, AudioFormat } from '@xiaozhi-client/asr';

const asr = new ASR({
  audioPath: 'path/to/audio.wav',
  format: AudioFormat.WAV,
  cluster: 'volcengine_streaming_common',
  appid: 'your-app-id',
  token: 'your-token',
  uid: 'user-123',
});

const result = await asr.execute();
console.log('识别结果:', result.result?.[0]?.text);
```

## 核心概念

### ASR 类

`ASR` 是主要的客户端类，继承自 `EventEmitter`，提供完整的语音识别功能。

#### 主要方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `connect()` | 建立连接并发送初始配置 | `Promise<void>` |
| `sendFrame(frame)` | 发送单个音频帧 | `Promise<void>` |
| `end()` | 结束音频流并获取最终结果 | `Promise<ASRResult>` |
| `execute()` | 执行单次识别（完整流程） | `Promise<ASRResult>` |
| `close()` | 关闭连接 | `void` |
| `isConnected()` | 检查连接状态 | `boolean` |
| `isInStreamingMode()` | 检查是否在流式模式 | `boolean` |

### 事件类型

```typescript
type ASREventType =
  | 'open'          // 连接已打开
  | 'close'         // 连接已关闭
  | 'error'         // 发生错误
  | 'result'        // 收到识别结果
  | 'audio_end'     // 音频发送完成
  | 'full_response' // 收到完整响应
  | 'vad_end';      // VAD 检测到语音结束
```

### ByteDance 控制器

通过 `bytedance` 属性访问平台特定的控制器：

```typescript
// V2 控制器
client.bytedance.v2.listen(stream)  // 流式识别
client.bytedance.v2.send(pcmData)   // 发送 PCM 数据

// V3 控制器
client.bytedance.v3.listen(stream)  // 流式识别
```

## 配置选项

### ByteDance V2 配置

```typescript
interface ByteDanceV2Option {
  v2: {
    app: {
      appid: string;        // 应用 ID（必需）
      token: string;        // 认证 Token（必需）
      cluster?: string;     // 集群名称，默认: volcengine_streaming_common
    };
    user?: {
      uid?: string;         // 用户 ID，默认: streaming_asr_client
    };
    audio?: {
      format?: AudioFormat; // 音频格式，默认: wav
      rate?: number;        // 采样率，默认: 16000
      bits?: number;        // 位深度，默认: 16
      channel?: number;     // 声道数，默认: 1
      codec?: string;       // 编解码器，默认: raw
      language?: string;    // 语言，默认: zh-CN
    };
    request?: {
      segDuration?: number;   // 分段时长（ms），默认: 15000
      nbest?: number;         // 返回候选数，默认: 1
      workflow?: string;      // 处理流程
      showLanguage?: boolean; // 显示语言
      showUtterances?: boolean; // 显示分句
      resultType?: string;    // 结果类型
    };
  };
}
```

### ByteDance V3 配置

```typescript
interface ByteDanceV3Option {
  v3: {
    appKey: string;        // 应用 Key（必需）
    accessKey: string;     // 访问 Key（必需）
    user?: {
      uid?: string;        // 用户 ID
    };
    audio?: {
      format?: AudioFormat; // 音频格式
      rate?: number;        // 采样率
      bits?: number;        // 位深度
      channel?: number;     // 声道数
    };
  };
}
```

### 认证方式

```typescript
enum AuthMethod {
  TOKEN = 'token',      // Token 认证（推荐）
  SIGNATURE = 'signature', // 签名认证
}
```

## 音频处理

### AudioFormat 枚举

```typescript
enum AudioFormat {
  WAV = 'wav',   // WAV PCM
  MP3 = 'mp3',   // MP3 音频
  OGG = 'ogg',   // OGG Opus
  RAW = 'raw',   // 裸 PCM
}
```

### OpusDecoder

解码 Opus 音频为 PCM：

```typescript
import { OpusDecoder } from '@xiaozhi-client/asr';

const pcmData = await OpusDecoder.toPcm(opusData);
```

### AudioProcessor

处理音频文件：

```typescript
import { AudioProcessor } from '@xiaozhi-client/asr';

const processor = new AudioProcessor('path/to/audio.wav', AudioFormat.WAV);

// 获取 WAV 信息
const wavInfo = processor.getWavInfo();

// 获取 WAV PCM 数据
const wavData = processor.getWavData();

// 获取 Opus 数据（OGG 格式）
const opusData = processor.getOpusData();
```

## 完整示例

### 流式语音识别（带完整错误处理）

```typescript
import {
  ASR,
  AudioFormat,
  AuthMethod,
} from '@xiaozhi-client/asr';

class MyASRClient {
  private asr: ASR;

  constructor(appid: string, token: string, cluster: string) {
    this.asr = new ASR({
      bytedance: {
        v2: {
          app: { appid, token, cluster },
          user: { uid: 'my-client' },
          audio: { format: AudioFormat.WAV, language: 'zh-CN' },
        },
      },
      authMethod: AuthMethod.TOKEN,
    });

    // 设置事件监听
    this.asr.on('error', (error) => {
      console.error('ASR 错误:', error.message);
    });

    this.asr.on('result', (result) => {
      const text = result.result?.[0]?.text;
      if (text) console.log('识别:', text);
    });

    this.asr.on('vad_end', (text) => {
      console.log('最终结果:', text);
    });
  }

  async recognize(audioPath: string): Promise<string> {
    try {
      this.asr.setAudioPath(audioPath, AudioFormat.WAV);
      const result = await this.asr.execute();

      if (result.code !== 1000) {
        throw new Error(`识别失败: code=${result.code}`);
      }

      return result.result?.[0]?.text || '';
    } catch (error) {
      console.error('识别错误:', error);
      throw error;
    } finally {
      this.asr.close();
    }
  }

  async streamRecognize(audioStream: AsyncGenerator<Buffer>): Promise<string> {
    try {
      await this.asr.connect();

      for await (const chunk of audioStream) {
        await this.asr.sendFrame(chunk);
      }

      const result = await this.asr.end();
      return result.result?.[0]?.text || '';
    } catch (error) {
      console.error('流式识别错误:', error);
      throw error;
    }
  }
}

// 使用示例
const client = new MyASRClient(
  'your-app-id',
  'your-token',
  'volcengine_streaming_common'
);

const text = await client.recognize('path/to/audio.wav');
console.log('识别结果:', text);
```

### 处理 OGG/Opus 音频

```typescript
import { ASR, AudioFormat } from '@xiaozhi-client/asr';

const asr = new ASR({
  audioPath: 'path/to/audio.ogg',
  format: AudioFormat.OGG,
  cluster: 'volcengine_streaming_common',
  appid: 'your-app-id',
  token: 'your-token',
});

// OGG 格式自动使用 Opus 编解码器
const result = await asr.execute();
console.log('识别结果:', result.result?.[0]?.text);
```

## API 参考

### 导出的类

```typescript
// 主客户端
export { ASR } from './client/ASR.js';

// 核心抽象
export { ASRClient } from './core/ASRClient.js';
export { ASRPlatform } from './core/ASRPlatform.js';

// 音频处理
export { AudioProcessor } from './audio/AudioProcessor.js';
export { OpusDecoder } from './audio/OpusDecoder.js';
export { WavParser } from './audio/WavParser.js';

// 认证
export { TokenAuth } from './auth/TokenAuth.js';
export { SignatureAuth } from './auth/SignatureAuth.js';

// 控制器
export { ByteDanceV2Controller } from './platforms/bytedance/controllers/ByteDanceV2Controller.js';
export { ByteDanceV3Controller } from './platforms/bytedance/controllers/ByteDanceV3Controller.js';
```

### 导出的枚举

```typescript
export { AudioFormat } from './audio/types.js';
export { AuthMethod } from './auth/types.js';
```

### 导出的类型

```typescript
export type {
  // 客户端配置
  ASROption,
  ASRResult,
  ASREventType,
  ASREventData,

  // 音频配置
  AudioConfig,
  AudioData,
  WavInfo,

  // 认证配置
  AuthConfig,
  AuthHeaders,

  // ByteDance 配置
  ByteDanceOption,
  ByteDanceV2Config,
  ByteDanceV3Config,
} from './types/index.js';
```

### 导出的工具函数

```typescript
// 单次识别
export { executeOne } from './client/ASR.js';
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

# 运行测试
pnpm test

# 类型检查
pnpm check:type

# 运行示例
pnpm demo
```

### 构建产物

```bash
dist/
├── index.js           # ESM 格式的编译产物
├── index.d.ts         # TypeScript 类型声明
└── index.js.map       # Source Map
```

## 最佳实践

### 1. 连接管理

```typescript
// ✅ 推荐：使用 try-finally 确保关闭连接
try {
  await asr.connect();
  // 发送音频...
  await asr.end();
} finally {
  asr.close();
}

// ❌ 避免：不关闭连接
await asr.connect();
// 发送音频...
// 忘记关闭
```

### 2. 错误处理

```typescript
// ✅ 推荐：监听错误事件
asr.on('error', (error) => {
  console.error('错误:', error.message);
});

// ✅ 推荐：使用 try-catch 捕获异常
try {
  await asr.execute();
} catch (error) {
  console.error('识别失败:', error);
}

// ❌ 避免：忽略错误
await asr.execute(); // 可能抛出异常
```

### 3. 音频格式选择

```typescript
// ✅ 推荐：根据场景选择合适格式
// WAV - 本地文件处理，简单直接
// OGG/Opus - 网络传输，压缩效率高
// RAW - 实时音频流，无需转换

// ❌ 避免：不必要的格式转换
// 如果源已经是 WAV，不要转换到其他格式
```

## 常见问题

### Q: 如何获取字节跳动 ASR 的 appid 和 token？

**A:** 请访问字节跳动火山引擎控制台，创建语音识别应用获取相关凭证。

### Q: 如何处理音频采样率不匹配？

**A:** 库会自动处理常见采样率。如需特定采样率，通过配置指定：

```typescript
audio: {
  rate: 16000, // 指定 16kHz
}
```

### Q: 流式识别中如何判断识别结束？

**A:** 监听 `vad_end` 事件：

```typescript
asr.on('vad_end', (text) => {
  console.log('语音活动结束:', text);
});
```

### Q: 支持哪些语言？

**A:** 默认支持中文（zh-CN），可通过配置指定其他语言：

```typescript
audio: {
  language: 'en-US', // 英语
}
```

## 许可证

[MIT](LICENSE)

## 相关资源

- [字节跳动火山引擎 ASR](https://www.volcengine.com/docs/656/79817)
- [@xiaozhi-client/mcp-core](https://github.com/shenjingnan/xiaozhi-client)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**作者**: xiaozhi-client
**版本**: 2.2.0