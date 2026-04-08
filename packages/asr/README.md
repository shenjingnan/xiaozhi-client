# @xiaozhi-client/asr

> ByteDance Streaming ASR WebSocket 客户端，用于 Node.js 环境

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fasr.svg)](https://www.npmjs.com/package/@xiaozhi-client/asr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/asr` 是一个完整的字节跳动流式语音识别（ASR）WebSocket 客户端库，提供：

- **WebSocket 流式识别** - 实时语音识别，支持流式传输
- **Opus 音频编码** - 原生支持 Opus 编码格式
- **V2 协议支持** - 支持字节跳动 V2 协议的流式识别
- **事件驱动 API** - 基于 EventEmitter 的事件机制
- **完整的类型支持** - TypeScript 严格模式，提供完整的类型定义
- **多种认证方式** - 支持 Token 和 Signature 两种认证方式
- **多种音频格式** - 支持 WAV、MP3、OGG、RAW 格式

## 特性

### 核心功能

- **流式语音识别** - 实时发送音频数据，获取实时识别结果
- **一次性识别** - 支持整个音频文件的识别
- **事件通知** - 连接状态变化、识别结果的实时通知
- **自动音频处理** - 自动处理 WAV、MP3、OGG 等格式
- **GZIP 压缩** - 自动压缩音频数据，减少传输带宽

### 音频格式

| 格式 | 说明 | 编解码器 |
|------|------|----------|
| **WAV** | 标准 WAV 格式 | PCM |
| **MP3** | MP3 格式 | Raw |
| **OGG** | OGG 容器封装 | Opus |
| **RAW** | 原始 PCM 数据 | Raw |

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
    "prism-media": "^1.3.5",
    "uuid": "^9.0.1",
    "ws": "^8.16.0"
  }
}
```

## 快速开始

### 一次性识别

最简单的方式是使用 `executeOne` 函数进行一次性识别：

```typescript
import { executeOne, AudioFormat, AuthMethod } from '@xiaozhi-client/asr';

const result = await executeOne(
  '/path/to/audio.wav',
  'volcengine_streaming_common',
  {
    appid: 'your-app-id',
    token: 'your-token',
    format: AudioFormat.WAV,
    authMethod: AuthMethod.TOKEN,
    sampleRate: 16000,
    language: 'zh-CN',
  }
);

console.log('识别结果:', result.result?.text);
```

### 流式识别

使用 `ASR` 类进行流式识别：

```typescript
import { ASR, AudioFormat, AuthMethod } from '@xiaozhi-client/asr';

// 创建客户端
const asr = new ASR({
  wsUrl: 'wss://openspeech.bytedance.com/api/v2/asr',
  cluster: 'volcengine_streaming_common',
  appid: 'your-app-id',
  token: 'your-token',
  format: AudioFormat.WAV,
  authMethod: AuthMethod.TOKEN,
  sampleRate: 16000,
  language: 'zh-CN',
  channel: 1,
  bits: 16,
});

// 监听事件
asr.on('open', () => {
  console.log('连接已打开');
});

asr.on('result', (data) => {
  console.log('识别结果:', data.result?.text);
});

asr.on('error', (error: Error) => {
  console.error('错误:', error.message);
});

asr.on('close', () => {
  console.log('连接已关闭');
});

// 执行识别
const result = await asr.execute();
console.log('最终结果:', result);
```

### V2 协议 Opus 流式识别

使用 V2 协议进行 Opus 流式识别：

```typescript
import { ASR, AudioFormat, AuthMethod } from '@xiaozhi-client/asr';

const client = new ASR({
  wsUrl: 'wss://openspeech.bytedance.com/api/v2/asr',
  cluster: 'volcengine_streaming_common',
  appid: 'your-app-id',
  token: 'your-token',
  format: AudioFormat.RAW,
  authMethod: AuthMethod.TOKEN,
  sampleRate: 16000,
  language: 'zh-CN',
  channel: 1,
  bits: 16,
  codec: 'raw',
});

// 设置事件处理器
client.on('result', (result) => {
  console.log('识别结果:', result);
});

// 连接
await client.connect();

// 流式发送音频帧
for (const frame of audioFrames) {
  await client.sendFrame(frame);
}

// 结束并获取最终结果
const result = await client.end();
console.log('最终结果:', result);
```

## 核心 API

### ASR 类

主要的流式 ASR 客户端类。

#### 构造函数

```typescript
constructor(options: ASROption)
```

#### 配置选项

```typescript
interface ASROption {
  // 服务器配置
  wsUrl?: string;           // WebSocket URL（默认: wss://openspeech.bytedance.com/api/v2/asr）
  cluster?: string;         // 集群名称（默认: volcengine_streaming_common）

  // 应用配置
  appid: string;            // 应用 ID
  token: string;            // 访问令牌

  // 用户配置
  uid?: string;             // 用户 ID（默认: streaming_asr_client）

  // 音频配置
  audioPath?: string;       // 音频文件路径
  format?: AudioFormat;     // 音频格式（默认: WAV）
  sampleRate?: number;      // 采样率（默认: 16000）
  language?: string;        // 语言（默认: zh-CN）
  bits?: number;            // 位深度（默认: 16）
  channel?: number;         // 声道数（默认: 1）
  codec?: string;           // 编解码器（默认: raw）

  // 请求配置
  segDuration?: number;     // 分段时长（ms，默认: 15000）
  nbest?: number;           // 返回结果数（默认: 1）
  workflow?: string;        // 处理流程
  showLanguage?: boolean;   // 显示语言（默认: false）
  showUtterances?: boolean; // 显示语句（默认: false）
  resultType?: string;      // 结果类型（默认: full）

  // 认证配置
  authMethod?: AuthMethod;  // 认证方式（默认: TOKEN）
  secret?: string;          // 签名密钥（Signature 认证时需要）

  // MP3 特定
  mp3SegSize?: number;      // MP3 分段大小（默认: 10000）

  // 成功码
  successCode?: number;     // 成功响应码（默认: 1000）
}
```

#### 主要方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `connect()` | 连接到服务器并初始化流式会话 | `Promise<void>` |
| `sendFrame(frame)` | 发送单个音频帧（流式模式） | `Promise<void>` |
| `end()` | 结束流并获取最终结果 | `Promise<ASRResult>` |
| `execute()` | 执行一次性识别 | `Promise<ASRResult>` |
| `close()` | 关闭连接 | `void` |
| `isConnected()` | 检查连接状态 | `boolean` |
| `setAudioPath(path, format?)` | 设置音频路径 | `void` |
| `setFormat(format)` | 设置音频格式 | `void` |

### executeOne 函数

一次性识别函数，简化 API。

```typescript
function executeOne(
  audioPath: string,
  cluster: string,
  options: ASROption
): Promise<ASRResult>
```

## 事件

ASR 类继承自 EventEmitter，支持以下事件：

| 事件 | 说明 | 数据类型 |
|------|------|----------|
| `open` | 连接已打开 | `void` |
| `close` | 连接已关闭 | `void` |
| `error` | 发生错误 | `Error` |
| `result` | 收到识别结果 | `ASRResult` |
| `audio_end` | 音频发送完成 | `void` |
| `full_response` | 收到完整响应 | `unknown` |

### 事件示例

```typescript
asr.on('open', () => {
  console.log('WebSocket 连接已建立');
});

asr.on('result', (result: ASRResult) => {
  if (result.result) {
    console.log('识别文本:', result.result.text);
    console.log('片段:', result.result.segments);
  }
});

asr.on('audio_end', () => {
  console.log('音频数据已全部发送');
});

asr.on('error', (error: Error) => {
  console.error('识别出错:', error.message);
});
```

## 类型定义

### ASRResult

识别结果类型：

```typescript
interface ASRResult {
  code: number;              // 响应码
  message?: string;          // 响应消息
  seq?: number;              // 序列号
  result?: {
    text: string;            // 识别文本
    segments?: Array<{       // 识别片段
      text: string;          // 片段文本
      start_time?: number;   // 开始时间
      end_time?: number;     // 结束时间
    }>;
  };
}
```

### AudioFormat

音频格式枚举：

```typescript
enum AudioFormat {
  WAV = "wav",
  MP3 = "mp3",
  OGG = "ogg",
  RAW = "raw",
}
```

### AuthMethod

认证方式枚举：

```typescript
enum AuthMethod {
  TOKEN = "token",           // Token 认证
  SIGNATURE = "signature",   // 签名认证
}
```

### ASREventType

事件类型：

```typescript
type ASREventType =
  | "open"
  | "close"
  | "error"
  | "result"
  | "audio_end"
  | "full_response";
```

## 完整示例

### 带完整事件处理的 ASR 客户端

```typescript
import {
  ASR,
  AudioFormat,
  AuthMethod,
  type ASRResult
} from '@xiaozhi-client/asr';

class StreamingASRClient {
  private asr: ASR;

  constructor(appid: string, token: string) {
    this.asr = new ASR({
      appid,
      token,
      cluster: 'volcengine_streaming_common',
      format: AudioFormat.WAV,
      authMethod: AuthMethod.TOKEN,
      sampleRate: 16000,
      language: 'zh-CN',
      channel: 1,
      bits: 16,
      nbest: 1,
      resultType: 'full',
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.asr.on('open', () => {
      console.log('✅ 连接已建立');
    });

    this.asr.on('result', (result: ASRResult) => {
      if (result.result?.text) {
        console.log(`📝 识别: ${result.result.text}`);
      }
    });

    this.asr.on('audio_end', () => {
      console.log('🔊 音频传输完成');
    });

    this.asr.on('error', (error: Error) => {
      console.error(`❌ 错误: ${error.message}`);
    });

    this.asr.on('close', () => {
      console.log('🔌 连接已关闭');
    });
  }

  async recognize(audioPath: string): Promise<string> {
    this.asr.setAudioPath(audioPath);
    const result = await this.asr.execute();
    return result.result?.text || '';
  }

  async connect() {
    await this.asr.connect();
  }

  async sendFrame(frame: Buffer) {
    await this.asr.sendFrame(frame);
  }

  async end(): Promise<ASRResult> {
    return await this.asr.end();
  }
}

// 使用示例
const client = new StreamingASRClient(
  'your-app-id',
  'your-token'
);

const text = await client.recognize('/path/to/audio.wav');
console.log('最终结果:', text);
```

## 导出内容

```typescript
// 主客户端
export { ASR, executeOne } from './client';

// 类型
export type {
  ASROption,
  ASRResult,
  ASREventType,
  ASREventData,
} from './client';

// 协议相关
export * from './protocol/index.js';

// 音频相关
export * from './audio/index.js';

// 认证相关
export * from './auth/index.js';

// 工具函数
export * from './utils/index.js';
```

## 最佳实践

### 1. 连接管理

```typescript
// ✅ 推荐：使用 try-finally 确保清理
try {
  await asr.connect();
  // 使用连接...
} finally {
  asr.close();
}

// ❌ 避免：不关闭连接
await asr.connect();
// 使用连接...
// 忘记关闭
```

### 2. 错误处理

```typescript
// ✅ 推荐：捕获并处理错误
asr.on('error', (error: Error) => {
  console.error('ASR 错误:', error.message);
  // 实现重连或恢复逻辑
});

try {
  await asr.execute();
} catch (error) {
  console.error('执行失败:', error);
}

// ❌ 避免：忽略错误
await asr.execute(); // 可能抛出异常
```

### 3. 音频格式选择

```typescript
// ✅ 推荐：根据场景选择合适格式
// 实时流式: 使用 OGG + Opus 编码
const streamingClient = new ASR({
  format: AudioFormat.OGG,
  // ...
});

// 文件识别: 使用 WAV
const fileClient = new ASR({
  format: AudioFormat.WAV,
  // ...
});
```

## 常见问题

### Q: 如何选择音频格式？

**A:**
- **流式识别** → 使用 `OGG` + `Opus` 编码
- **文件识别** → 使用 `WAV`
- **低延迟场景** → 使用 `RAW` PCM

### Q: Token 和 Signature 认证有什么区别？

**A:**
- **Token** - 简单令牌认证，适合大多数场景
- **Signature** - 签名认证，更安全，需要 secret 密钥

### Q: 如何处理长音频？

**A:** 使用流式 API：

```typescript
await asr.connect();
for (const chunk of audioChunks) {
  await asr.sendFrame(chunk);
}
const result = await asr.end();
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

# 运行示例
pnpm demo

# 类型检查
pnpm check:type
```

### 示例代码

项目提供了多个示例文件：

- `examples/demo.ts` - 基础识别示例
- `examples/demo-stream.ts` - 流式识别示例
- `examples/demo-v2-opus-stream.ts` - V2 协议 Opus 流式示例

### 构建产物

```bash
dist/
├── index.js           # ESM 格式的编译产物
├── index.d.ts         # TypeScript 类型声明
└── index.js.map       # Source Map
```

## 相关资源

- [字节跳动语音识别文档](https://www.volcengine.com/docs/6561/79822)
- [示例代码](https://github.com/shenjingnan/xiaozhi-client/tree/main/packages/asr/examples)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

## 许可证

[MIT](LICENSE)

---

**作者**: xiaozhi-client
**版本**: 0.0.1
