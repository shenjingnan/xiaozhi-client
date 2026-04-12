# @xiaozhi-client/asr

> ByteDance 流式 ASR WebSocket 客户端库

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fasr.svg)](https://www.npmjs.com/package/@xiaozhi-client/asr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/asr` 是一个 ByteDance 流式 ASR（自动语音识别）WebSocket 客户端库，专为实时语音识别场景设计。提供：

- **流式识别** - 支持实时音频流式识别，低延迟响应
- **多平台支持** - 支持字节跳动 V2、V3 API，提供可扩展的平台抽象
- **音频处理** - 支持多种音频格式（WAV、MP3、OGG/Opus）
- **灵活认证** - 支持 Token 和签名认证方式
- **完整类型** - TypeScript 严格模式，提供完整的类型支持
- **生产就绪** - 经过充分测试，可直接用于生产环境

## 特性

### 核心功能

- **ASRClient** - 流式 ASR 客户端，支持实时语音识别和单次识别
- **平台抽象** - ASRPlatform 抽象层，支持多平台扩展
- **音频处理** - 内置音频格式转换和验证
- **认证管理** - Token 和签名认证方式
- **事件驱动** - 基于回调的事件机制，易于集成

### 支持的平台

| 平台 | 版本 | 说明 |
|------|------|------|
| **ByteDance** | V2 | 字节跳动流式语音识别 API V2 |
| **ByteDance** | V3 | 字节跳动流式语音识别 API V3 |

### 音频格式

| 格式 | 说明 | 支持 |
|------|------|------|
| **WAV** | 波形音频格式 | ✅ |
| **MP3** | MPEG 音频层 III | ✅ |
| **OGG/Opus** | OGG 容器 + Opus 编码 | ✅ |

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

- Node.js >= 18.0.0
- TypeScript >= 5.0.0（如果使用 TypeScript）

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

// 监听 VAD 结束事件
asr.on('vad_end', (finalText) => {
  console.log('最终结果:', finalText);
});

// 连接并开始识别
await asr.connect();

// 流式发送音频数据
const audioData = Buffer.from(/* 音频数据 */);
asr.send(audioData);

// 结束识别
await asr.end();
```

### 单次识别模式

```typescript
import { executeOne } from '@xiaozhi-client/asr';

const result = await executeOne({
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
}, Buffer.from(/* 音频数据 */));

console.log('识别结果:', result.text);
```

## API 参考

### ASR

流式 ASR 客户端类。

#### 构造函数

```typescript
new ASR(options: ASROption)
```

**参数**

- `options` - ASR 配置选项
  - `bytedance` - ByteDance 平台配置
    - `v2` - V2 API 配置
    - `v3` - V3 API 配置

#### 方法

##### `connect(): Promise<void>`

建立 WebSocket 连接并开始识别。

##### `send(audioData: Buffer): void`

发送音频数据。

**参数**

- `audioData` - 音频数据 Buffer

##### `end(): Promise<void>`

结束识别并关闭连接。

##### `on(event: string, callback: Function): void`

监听事件。

**事件**

- `result` - 识别结果事件
- `vad_end` - VAD 结束事件
- `error` - 错误事件
- `close` - 连接关闭事件

### executeOne

单次识别函数。

```typescript
executeOne(options: ASROption, audioData: Buffer): Promise<ASRResult>
```

**参数**

- `options` - ASR 配置选项
- `audioData` - 音频数据 Buffer

**返回值**

- `ASRResult` - 识别结果

## 配置说明

### ByteDance V2 配置

```typescript
interface ByteDanceV2Config {
  app: {
    appid: string;        // 应用 ID
    token: string;        // 访问令牌
    cluster: string;      // 集群名称
  };
  user: {
    uid: string;          // 用户 ID
  };
  audio: {
    format: 'wav' | 'mp3' | 'ogg';  // 音频格式
    sample_rate?: number; // 采样率
  };
}
```

### ByteDance V3 配置

```typescript
interface ByteDanceV3Config {
  appid: string;          // 应用 ID
  access_token: string;   // 访问令牌
  resource_id: string;    // 资源 ID
  format: 'wav' | 'mp3' | 'ogg';  // 音频格式
}
```

## 示例

查看 [examples/](./examples/) 目录获取更多使用示例：

- `demo.ts` - 基础示例
- `demo-stream.ts` - 流式识别示例
- `demo-bytedance-v2-stream.ts` - ByteDance V2 流式识别示例
- `demo-bytedance-v3-stream.ts` - ByteDance V3 流式识别示例

运行示例：

```bash
# 基础示例
pnpm demo

# 运行特定示例
npx tsx examples/demo-stream.ts
```

## 文档

- [ByteDance 流式语音识别 API 文档](./docs/字节跳动-流式语音识别.md)
- [ByteDance V2 通信协议](./docs/bytedance-v2-listen-communication.md)

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT](./LICENSE)
