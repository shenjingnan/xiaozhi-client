# @xiaozhi-client/asr

ByteDance 流式 ASR WebSocket 客户端库，提供实时语音识别功能。

## 特性

- **流式识别** - 支持实时语音识别
- **单次识别** - 支持音频文件识别
- **多格式支持** - 支持 WAV、MP3、OGG/Opus 等音频格式
- **多种认证** - 支持 Token 和签名认证方式
- **平台抽象** - 可扩展的平台抽象层（支持 V2、V3 API）
- **TypeScript** - 完整的类型定义

## 安装

```bash
npm install @xiaozhi-client/asr
# 或
pnpm add @xiaozhi-client/asr
# 或
yarn add @xiaozhi-client/asr
```

## 快速开始

### 流式识别

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

asr.on('result', (result) => {
  console.log('识别结果:', result.result?.[0]?.text);
});

asr.on('vad_end', (finalText) => {
  console.log('最终结果:', finalText);
});

await asr.connect();
// ... 流式发送音频帧
await asr.end();
```

### 单次识别

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
```

## API 参考

详细的 API 文档可以参考 `src/index.ts` 中的 JSDoc 注释。

## 许可证

[MIT](LICENSE)
