# @xiaozhi-client/tts

> 小智客户端 TTS（文本转语音）库，支持流式和非流式语音合成

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Ftts.svg)](https://www.npmjs.com/package/@xiaozhi-client/tts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/tts` 是一个功能完整的 TTS（Text-to-Speech）客户端库，提供：

- **双模式合成** - 支持流式和非流式两种语音合成方式
- **事件驱动** - 基于 EventEmitter 的异步事件处理
- **平台支持** - 目前支持字节跳动 TTS 平台
- **简洁 API** - 提供便捷函数和面向对象两种使用方式
- **完整类型** - TypeScript 严格模式，完整类型支持
- **WebSocket 连接** - 基于 WebSocket 的实时语音合成

## 特性

### 核心功能

- **流式合成** - 边合成边输出，适合实时播放场景
- **非流式合成** - 一次性获取完整音频数据
- **事件监听** - 支持连接、音频块、错误等事件监听
- **便捷函数** - 无需实例化，直接调用
- **配置验证** - 内置配置验证和类型检查
- **自动资源管理** - 支持 close 方法释放资源

### 支持的平台

| 平台 | 说明 | 状态 |
|------|------|------|
| **bytedance** | 字节跳动 TTS 服务 | ✅ 稳定 |

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/tts

# 使用 pnpm
pnpm add @xiaozhi-client/tts

# 使用 yarn
yarn add @xiaozhi-client/tts
```

### 依赖要求

```json
{
  "dependencies": {
    "ws": "^8.16.0",
    "zod": "^3.23.8"
  }
}
```

## 快速开始

### 使用便捷函数（推荐）

便捷函数提供最简单的 API，适合一次性语音合成任务。

#### 非流式合成

```typescript
import { synthesizeSpeech } from '@xiaozhi-client/tts';
import fs from 'node:fs';

// 非流式合成：一次性获取完整音频
const audio = await synthesizeSpeech({
  appid: 'your-app-id',
  accessToken: 'your-access-token',
  voice_type: 'zh_female_xiaohe_uranus_bigtts',
  text: '你好，这是一段测试语音。',
  encoding: 'wav',
  speed: 1.0,
  pitch: 0,
  volume: 1.0
});

// audio 是 Uint8Array，可直接保存为文件
fs.writeFileSync('output.wav', audio);
```

#### 流式合成

```typescript
import { synthesizeSpeechStream } from '@xiaozhi-client/tts';

// 流式合成：边合成边获取音频块
const audioChunks: Uint8Array[] = [];

await synthesizeSpeechStream({
  appid: 'your-app-id',
  accessToken: 'your-access-token',
  voice_type: 'zh_female_xiaohe_uranus_bigtts',
  text: '这是一段流式合成的语音。',
  encoding: 'wav',
  onAudioChunk: async (chunk, isLast) => {
    console.log(`收到音频块，大小: ${chunk.length} 字节，最终块: ${isLast}`);
    audioChunks.push(chunk);

    // 可以在这里实时播放音频块
  }
});

// 合并所有音频块
const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
const mergedAudio = new Uint8Array(totalLength);
let offset = 0;
for (const chunk of audioChunks) {
  mergedAudio.set(chunk, offset);
  offset += chunk.length;
}
```

### 使用 TTS 类

TTS 类提供事件驱动的 API，适合需要持续监听和处理的场景。

```typescript
import { TTS } from '@xiaozhi-client/tts';
import fs from 'node:fs';

// 创建 TTS 客户端
const client = new TTS({
  platform: 'bytedance',
  config: {
    app: {
      appid: 'your-app-id',
      accessToken: 'your-access-token'
    },
    audio: {
      voice_type: 'zh_female_xiaohe_uranus_bigtts',
      encoding: 'wav'
    }
  }
});

// 监听事件
client.on('open', () => {
  console.log('[事件] 连接已打开');
});

client.on('audio_chunk', async (chunk: Uint8Array, isLast: boolean) => {
  console.log(`[事件] 收到音频块，大小: ${chunk.length} 字节`);
  // 处理音频块
});

client.on('result', (audio?: Uint8Array) => {
  console.log('[事件] 合成完成');
  if (audio) {
    console.log(`音频大小: ${audio.length} 字节`);
  }
});

client.on('error', (error: Error) => {
  console.error('[事件] 错误:', error.message);
});

client.on('close', () => {
  console.log('[事件] 连接已关闭');
});

// 非流式合成
const audio = await client.synthesize('你好，这是测试语音。');
// 保存音频
fs.writeFileSync('output.wav', audio);

// 关闭连接
client.close();
```

### 流式合成（TTS 类）

```typescript
import { TTS } from '@xiaozhi-client/tts';

const client = new TTS({
  platform: 'bytedance',
  config: {
    app: {
      appid: 'your-app-id',
      accessToken: 'your-access-token'
    },
    audio: {
      voice_type: 'zh_female_xiaohe_uranus_bigtts',
      encoding: 'wav'
    }
  }
});

// 监听音频块事件
client.on('audio_chunk', (chunk: Uint8Array, isLast: boolean) => {
  console.log(`收到音频块: ${chunk.length} 字节, 最终: ${isLast}`);
  // 可以在这里实时播放音频
});

// 流式合成
await client.synthesizeStream('这是一段流式语音。');

client.close();
```

### 使用异步迭代器（V1 API）

```typescript
import { TTS } from '@xiaozhi-client/tts';

const client = new TTS({
  platform: 'bytedance',
  config: {
    app: {
      appid: 'your-app-id',
      accessToken: 'your-access-token'
    },
    audio: {
      voice_type: 'S_70000',
      encoding: 'wav'
    }
  }
});

// 使用异步迭代器
for await (const { chunk, isFinal } of client.bytedance.v1.speak('使用异步迭代器进行语音合成。')) {
  console.log(`收到音频块: ${chunk.length} 字节, 最终: ${isFinal}`);
  // 处理音频块
}

client.close();
```

## API 参考

### 便捷函数

#### synthesizeSpeech()

非流式语音合成。

```typescript
function synthesizeSpeech(options: SynthesizeOptions): Promise<Uint8Array>
```

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `appid` | `string` | ✅ | 应用 ID |
| `accessToken` | `string` | ✅ | 访问令牌 |
| `voice_type` | `string` | ✅ | 声音类型 |
| `text` | `string` | ✅ | 要合成的文本 |
| `encoding` | `string` | ❌ | 编码格式（默认 `wav`） |
| `speed` | `number` | ❌ | 语速（默认 1.0） |
| `pitch` | `number` | ❌ | 音调（默认 0） |
| `volume` | `number` | ❌ | 音量（默认 1.0） |
| `cluster` | `string` | ❌ | 集群类型 |
| `endpoint` | `string` | ❌ | 自定义端点 |

**返回：** `Promise<Uint8Array>` - 音频二进制数据

#### synthesizeSpeechStream()

流式语音合成。

```typescript
function synthesizeSpeechStream(options: SynthesizeStreamOptions): Promise<void>
```

**参数：** 包含 `synthesizeSpeech()` 的所有参数，额外增加：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `onAudioChunk` | `AudioChunkCallback` | ✅ | 音频块回调函数 |

**音频块回调：**

```typescript
type AudioChunkCallback = (chunk: Uint8Array, isLast: boolean) => Promise<void>;
```

#### validateConfig()

验证 TTS 配置。

```typescript
function validateConfig(config: unknown): ByteDanceTTSConfig
```

### TTS 类

事件驱动的 TTS 客户端类。

#### 构造函数

```typescript
constructor(options: TTSClientOptions)
```

**配置选项：**

```typescript
interface TTSClientOptions {
  platform?: 'bytedance';
  config?: ByteDanceTTSConfig;
  bytedance?: {
    v1?: ByteDanceTTSConfig;
  };
}
```

#### 方法

##### synthesize()

非流式合成语音。

```typescript
async synthesize(text: string): Promise<Uint8Array>
```

##### synthesizeStream()

流式合成语音。

```typescript
async synthesizeStream(text: string): Promise<void>
```

##### close()

关闭连接并释放资源。

```typescript
close(): void
```

##### updateConfig()

更新配置。

```typescript
updateConfig(config: Partial<ByteDanceTTSConfig>): void
```

##### getConfig()

获取当前配置。

```typescript
getConfig(): ByteDanceTTSConfig
```

##### validateConfig()（静态）

验证配置。

```typescript
static validateConfig(config: unknown): ByteDanceTTSConfig
```

#### 事件

TTS 类继承自 EventEmitter，支持以下事件：

```typescript
// 连接打开事件
client.on('open', () => {
  console.log('连接已打开');
});

// 音频块事件（流式合成）
client.on('audio_chunk', (chunk: Uint8Array, isLast: boolean) => {
  console.log(`收到音频块: ${chunk.length} 字节`);
});

// 合成完成事件
client.on('result', (audio?: Uint8Array) => {
  console.log('合成完成');
});

// 错误事件
client.on('error', (error: Error) => {
  console.error('错误:', error.message);
});

// 连接关闭事件
client.on('close', () => {
  console.log('连接已关闭');
});
```

## 配置说明

### ByteDanceTTSConfig

字节跳动 TTS 平台配置。

```typescript
interface ByteDanceTTSConfig {
  // 应用配置
  app: {
    appid: string;        // 应用 ID
    accessToken: string;  // 访问令牌
  };

  // 音频配置
  audio: {
    voice_type: string;   // 声音类型
    encoding: string;     // 编码格式（wav, mp3, ogg_opus）
    speed?: number;       // 语速（0.2 - 3.0，默认 1.0）
    pitch?: number;       // 音调（-12.0 - 12.0，默认 0）
    volume?: number;      // 音量（0.1 - 10.0，默认 1.0）
  };

  // 可选配置
  cluster?: string;       // 集群类型
  endpoint?: string;      // 自定义端点
}
```

### 常用声音类型

| 声音类型 | 说明 |
|----------|------|
| `S_70000` | 女声·小何 |
| `zh_female_xiaohe_uranus_bigtts` | 女声·小何（完整标识） |
| 更多声音类型请参考 [字节跳动 TTS 文档](https://www.volcengine.com/docs/6561/80818) | |

## 完整示例

### 带完整错误处理的 TTS 客户端

```typescript
import { TTS, type TTSClientOptions } from '@xiaozhi-client/tts';
import fs from 'node:fs';

class TTSClient {
  private client: TTS;

  constructor(appid: string, accessToken: string) {
    const options: TTSClientOptions = {
      platform: 'bytedance',
      config: {
        app: {
          appid,
          accessToken
        },
        audio: {
          voice_type: 'zh_female_xiaohe_uranus_bigtts',
          encoding: 'wav',
          speed: 1.0,
          pitch: 0,
          volume: 1.0
        }
      }
    };

    this.client = new TTS(options);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('open', () => {
      console.log('✅ TTS 连接已建立');
    });

    this.client.on('error', (error: Error) => {
      console.error('❌ TTS 错误:', error.message);
    });

    this.client.on('close', () => {
      console.log('🔌 TTS 连接已关闭');
    });
  }

  async synthesizeToFile(text: string, outputPath: string): Promise<void> {
    try {
      console.log(`开始合成: ${text}`);

      const audio = await this.client.synthesize(text);

      console.log(`合成完成，音频大小: ${audio.length} 字节`);
      fs.writeFileSync(outputPath, audio);
      console.log(`音频已保存到: ${outputPath}`);
    } catch (error) {
      console.error('合成失败:', error);
      throw error;
    }
  }

  async synthesizeStream(text: string, outputPath: string): Promise<void> {
    try {
      console.log(`开始流式合成: ${text}`);

      const chunks: Uint8Array[] = [];

      this.client.on('audio_chunk', (chunk: Uint8Array, isLast: boolean) => {
        console.log(`收到音频块: ${chunk.length} 字节, 最终: ${isLast}`);
        chunks.push(chunk);
      });

      await this.client.synthesizeStream(text);

      // 合并音频块
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedAudio = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        mergedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      fs.writeFileSync(outputPath, mergedAudio);
      console.log(`音频已保存到: ${outputPath}`);
    } catch (error) {
      console.error('流式合成失败:', error);
      throw error;
    }
  }

  close(): void {
    this.client.close();
  }
}

// 使用示例
async function main() {
  const ttsClient = new TTSClient(
    'your-app-id',
    'your-access-token'
  );

  try {
    // 非流式合成
    await ttsClient.synthesizeToFile('你好，世界！', 'output.wav');

    // 流式合成
    await ttsClient.synthesizeStream('这是一段流式语音。', 'output-stream.wav');
  } finally {
    ttsClient.close();
  }
}

main();
```

## 最佳实践

### 1. 资源管理

```typescript
// ✅ 推荐：使用 try-finally 确保释放资源
const client = new TTS(config);
try {
  await client.synthesize('测试文本');
} finally {
  client.close();
}

// ❌ 避免：忘记释放资源
const client = new TTS(config);
await client.synthesize('测试文本');
// 忘记调用 close()
```

### 2. 错误处理

```typescript
// ✅ 推荐：捕获并处理错误
try {
  await client.synthesize('测试文本');
} catch (error) {
  if (error instanceof Error) {
    console.error('合成失败:', error.message);
    // 实现重试逻辑或其他错误处理
  }
}

// ❌ 避免：忽略错误
await client.synthesize('测试文本'); // 可能抛出异常
```

### 3. 流式合成音频合并

```typescript
// ✅ 推荐：高效合并音频块
const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
const merged = new Uint8Array(totalLength);
let offset = 0;
for (const chunk of chunks) {
  merged.set(chunk, offset);
  offset += chunk.length;
}

// ❌ 避免：低效的拼接方式
let merged = new Uint8Array(0);
for (const chunk of chunks) {
  const temp = new Uint8Array(merged.length + chunk.length);
  temp.set(merged);
  temp.set(chunk, merged.length);
  merged = temp;
}
```

## 常见问题

### Q: 如何获取字节跳动 TTS 的 App ID 和 Access Token？

**A:** 请访问[字节跳动火山引擎](https://www.volcengine.com/)注册账号并创建应用，获取相关凭证。

### Q: 流式合成和非流式合成有什么区别？

**A:**
- **非流式合成**：等待完整音频生成后返回，适合短文本或需要完整音频的场景
- **流式合成**：边合成边返回音频块，适合长文本或需要实时播放的场景

### Q: 支持哪些音频编码格式？

**A:** 支持 `wav`、`mp3`、`ogg_opus` 等格式，具体取决于 TTS 平台支持。

### Q: 如何调整语音的语速、音调和音量？

**A:** 在配置中设置 `speed`（语速）、`pitch`（音调）、`volume`（音量）参数：

```typescript
config: {
  audio: {
    speed: 1.2,    // 语速 1.2 倍
    pitch: 2.0,    // 音调 +2
    volume: 1.5    // 音量 1.5 倍
  }
}
```

## 许可证

[MIT](LICENSE)

## 相关资源

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [字节跳动 TTS 文档](https://www.volcengine.com/docs/)

---

**作者**: xiaozhi-client
**版本**: 0.0.1
