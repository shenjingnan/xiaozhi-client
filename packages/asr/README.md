# @xiaozhi-client/asr

ByteDance 流式 ASR WebSocket 客户端库，提供实时语音识别功能。

## 特性

- 流式识别、单次识别
- 支持 WAV、MP3、OGG/Opus 等音频格式
- 支持 Token 和签名认证，V2/V3 API
- 完整的 TypeScript 类型定义

## 安装

```bash
pnpm add @xiaozhi-client/asr
```

## 快速开始

```typescript
import { ASR } from '@xiaozhi-client/asr';

const asr = new ASR({
  bytedance: {
    v2: {
      app: { appid: 'your-app-id', token: 'your-token', cluster: 'volcengine_streaming_common' },
      user: { uid: 'user-123' },
      audio: { format: 'wav' },
    },
  },
});

asr.on('result', (result) => console.log('识别结果:', result.result?.[0]?.text));
asr.on('vad_end', (finalText) => console.log('最终结果:', finalText));
await asr.connect();
await asr.end();
```

## 单次识别

```typescript
import { executeOne } from '@xiaozhi-client/asr';
const result = await executeOne('path/to/audio.wav', 'your-cluster', config);
```

## 许可证

[MIT](LICENSE)
