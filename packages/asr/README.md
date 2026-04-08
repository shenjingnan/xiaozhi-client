# @xiaozhi-client/asr

ByteDance 流式 ASR WebSocket 客户端库

## 特性

- **流式识别** - 支持实时语音识别
- **单次识别** - 支持音频文件识别
- **多格式支持** - 支持 WAV、MP3、OGG/Opus 等音频格式
- **多种认证** - 支持 Token 和签名认证方式
- **平台抽象** - 可扩展的平台抽象层
- **TypeScript** - 完整的类型定义

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

// 监听语音结束事件
asr.on('vad_end', (finalText) => {
  console.log('最终结果:', finalText);
});

// 连接并发送音频
await asr.connect();
// ... 流式发送音频帧
await asr.end();
```

### 单次识别模式

```typescript
import { executeOne } from '@xiaozhi-client/asr';

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

console.log('识别结果:', result.text);
```

## API 参考

### ASR

流式 ASR 客户端类。

#### 构造函数

```typescript
constructor(options: ASROption)
```

#### 方法

##### connect()

连接到 ASR 服务。

```typescript
async connect(): Promise<void>
```

##### send()

发送音频数据。

```typescript
async send(audioData: Buffer): Promise<void>
```

##### end()

结束识别会话。

```typescript
async end(): Promise<void>
```

#### 事件

ASR 类继承自 EventEmitter，支持以下事件：

```typescript
// 识别结果事件
asr.on('result', (result: ASRResult) => {
  console.log('识别结果:', result.result?.[0]?.text);
});

// 语音结束事件
asr.on('vad_end', (finalText: string) => {
  console.log('最终结果:', finalText);
});

// 错误事件
asr.on('error', (error: Error) => {
  console.error('识别错误:', error.message);
});
```

### executeOne()

单次识别工具函数。

```typescript
async function executeOne(
  audioPath: string,
  cluster: string,
  options: ASROption
): Promise<ASRResult>
```

## 类型定义

### ASROption

ASR 配置选项。

```typescript
interface ASROption {
  bytedance: {
    v2?: {
      app: {
        appid: string;
        token?: string;
        cluster: string;
      };
      user: {
        uid: string;
      };
      audio?: {
        format?: 'wav' | 'mp3' | 'opus';
        rate?: number;
        bits?: number;
        channel?: number;
      };
    };
  };
}
```

### ASRResult

ASR 识别结果。

```typescript
interface ASRResult {
  result?: Array<{
    text: string;
    confidence?: number;
  }>;
  is_final?: boolean;
}
```

### ASREventType

ASR 事件类型。

```typescript
type ASREventType = 'result' | 'vad_end' | 'error';
```

## 音频格式支持

### WAV

```typescript
{
  audio: {
    format: 'wav',
    rate: 16000,
    bits: 16,
    channel: 1
  }
}
```

### MP3

```typescript
{
  audio: {
    format: 'mp3',
    rate: 16000
  }
}
```

### OGG/Opus

```typescript
{
  audio: {
    format: 'opus',
    rate: 16000
  }
}
```

## 认证方式

### Token 认证

```typescript
{
  app: {
    appid: 'your-app-id',
    token: 'your-token',
    cluster: 'volcengine_streaming_common'
  }
}
```

### 签名认证

```typescript
{
  app: {
    appid: 'your-app-id',
    cluster: 'volcengine_streaming_common',
    // 使用签名认证时需要配置其他参数
  }
}
```

## 完整示例

### 流式语音识别客户端

```typescript
import { ASR } from '@xiaozhi-client/asr';
import { createReadStream } from 'fs';

class ASRClient {
  private asr: ASR;

  constructor() {
    this.asr = new ASR({
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

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.asr.on('result', (result) => {
      const text = result.result?.[0]?.text;
      if (text) {
        console.log('识别结果:', text);
      }
    });

    this.asr.on('vad_end', (finalText) => {
      console.log('最终结果:', finalText);
    });

    this.asr.on('error', (error) => {
      console.error('识别错误:', error.message);
    });
  }

  async recognize(audioFile: string): Promise<string> {
    await this.asr.connect();

    const stream = createReadStream(audioFile, { highWaterMark: 6400 });

    for await (const chunk of stream) {
      await this.asr.send(chunk);
    }

    await this.asr.end();
    return '识别完成';
  }
}

// 使用示例
const client = new ASRClient();
await client.recognize('test.wav');
```

### 单次音频识别

```typescript
import { executeOne } from '@xiaozhi-client/asr';

async function quickRecognize(audioPath: string) {
  try {
    const result = await executeOne(audioPath, 'volcengine_streaming_common', {
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

    console.log('识别文本:', result.text);
    return result.text;
  } catch (error) {
    console.error('识别失败:', error);
    throw error;
  }
}

// 使用示例
await quickRecognize('audio.wav');
```

## 错误处理

```typescript
import { ASR } from '@xiaozhi-client/asr';

const asr = new ASR({ /* 配置 */ });

asr.on('error', (error) => {
  if (error.message.includes('连接失败')) {
    console.error('无法连接到 ASR 服务');
  } else if (error.message.includes('认证失败')) {
    console.error('认证信息无效，请检查 appid 和 token');
  } else if (error.message.includes('音频格式')) {
    console.error('不支持的音频格式');
  } else {
    console.error('未知错误:', error.message);
  }
});
```

## 常见问题

### Q: 支持哪些音频格式？

A: 支持 WAV、MP3、OGG/Opus 格式。推荐使用 16kHz 采样率的单声道音频。

### Q: 如何处理网络断开？

A: 监听 `error` 事件，根据错误类型决定是否重连。建议实现重连机制处理临时网络故障。

### Q: 流式模式和单次模式有什么区别？

A: 流式模式适合实时语音识别，可以边录边识别；单次模式适合识别已存在的音频文件。

### Q: 如何提高识别准确率？

A:
1. 使用高质量的音频输入（16kHz 采样率）
2. 减少背景噪音
3. 选择合适的集群参数
4. 调整音频参数（采样率、位深度等）

## 许可证

MIT

## 相关链接

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [字节跳动 ASR 文档](https://www.volcengine.com/docs/6561/79820)
