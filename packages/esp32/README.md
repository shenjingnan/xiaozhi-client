# @xiaozhi-client/esp32

> ESP32 硬件设备通信 SDK，提供设备连接管理 + 语音交互全流程（ASR → LLM → TTS）+ 二进制音频协议处理

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fesp32.svg)](https://www.npmjs.com/package/@xiaozhi-client/esp32)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/esp32` 是一个完整的 ESP32 硬件设备通信 SDK，专为智能语音交互场景设计：

- **设备连接管理** - WebSocket 连接、Hello 握手、心跳超时检测
- **语音交互流水线** - ASR（语音识别）→ LLM（对话处理）→ TTS（语音合成）完整流程
- **二进制音频协议** - 支持 Protocol 1/2/3 三种音频传输协议
- **OTA 配置下发** - 设备激活、固件版本检查、WebSocket 配置
- **设备注册管理** - 设备信息存储、状态管理、自动激活
- **零框架绑定** - 不绑定任何 HTTP 框架，通过接口注入实现解耦

## 特性

### 核心功能

- **ESP32DeviceManager** - 设备管理器（编排层），整合 OTA + WebSocket + 语音交互流水线
- **ESP32Connection** - 单设备 WebSocket 连接管理，Hello 握手、消息路由
- **DeviceRegistryService** - 设备注册服务，自动激活、状态更新
- **ASRService** - 语音识别服务，支持流式音频处理
- **LLMService** - 大语言模型对话服务
- **TTSService** - 语音合成服务，支持流式输出

### 音频协议

| 协议 | 说明 | 头部大小 | 特性 |
|------|------|----------|------|
| **Protocol 1** | 纯 Opus 数据 | 无头部 | 最简单，直接传输 |
| **Protocol 2** | 完整协议头 | 16 字节 | 包含时间戳、类型、版本 |
| **Protocol 3** | 精简协议头 | 4 字节 | 无时间戳，适合低延迟场景 |

### 设计原则

- **接口解耦** - 通过 `ILogger`、`IESP32ConfigProvider`、`IDeviceConnection` 接口实现依赖注入
- **零框架绑定** - 不绑定 Express、Fastify 等框架，可在任意 HTTP 服务中使用
- **配置热更新** - 支持配置提供者，实现动态配置更新

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/esp32

# 使用 pnpm
pnpm add @xiaozhi-client/esp32

# 使用 yarn
yarn add @xiaozhi-client/esp32
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

### 基础使用

```typescript
import { ESP32DeviceManager } from '@xiaozhi-client/esp32';
import type WebSocket from 'ws';

// 创建设备管理器
const manager = new ESP32DeviceManager({
  firmwareVersion: '2.2.2',
  firmwareUrl: 'https://example.com/firmware.bin',
  forceUpdate: false,
});

// 处理 OTA 请求（设备首次连接激活）
const otaResponse = await manager.handleOTARequest(
  'AA:BB:CC:DD:EE:FF',  // deviceId (MAC 地址)
  'device-uuid-123',    // clientId
  {
    version: 1,
    application: { version: '2.2.0' },
    board: { type: 'ESP32-S3' },
  },
  { host: '192.168.1.100:8080' }
);

console.log('WebSocket URL:', otaResponse.websocket?.url);

// 处理 WebSocket 连接
await manager.handleWebSocketConnection(
  ws,                   // WebSocket 实例
  'AA:BB:CC:DD:EE:FF',  // deviceId
  'device-uuid-123',    // clientId
);

// 销毁管理器
await manager.destroy();
```

### 使用配置提供者（支持配置热更新）

```typescript
import { ESP32DeviceManager, type IESP32ConfigProvider } from '@xiaozhi-client/esp32';

// 实现配置提供者接口
class MyConfigProvider implements IESP32ConfigProvider {
  private asrConfig = { provider: 'funasr', serverUrl: 'ws://localhost:10095' };
  private ttsConfig = { provider: 'edge-tts', voice: 'zh-CN-XiaoxiaoNeural' };
  private llmConfig = { provider: 'openai', apiKey: 'your-api-key' };

  getASRConfig() { return this.asrConfig; }
  getTTSConfig() { return this.ttsConfig; }
  getLLMConfig() { return this.llmConfig; }
  isLLMConfigValid() { return !!this.llmConfig?.apiKey; }

  // 支持动态更新配置
  updateLLMConfig(config: LLMConfig) {
    this.llmConfig = config;
  }
}

// 创建带配置提供者的管理器
const manager = new ESP32DeviceManager({
  configProvider: new MyConfigProvider(),
  logger: console,
});
```

### 自定义 WebSocket URL

```typescript
const manager = new ESP32DeviceManager({
  buildWebSocketUrl: (host) => {
    // 自定义 WebSocket URL 构建逻辑
    return `wss://${host}/api/esp32/ws`;
  },
});
```

## API 参考

### ESP32DeviceManager

ESP32 设备管理器（编排层），整合 OTA + WebSocket + 语音交互流水线。

#### 构造函数

```typescript
constructor(options?: ESP32DeviceManagerOptions)
```

配置选项：

```typescript
interface ESP32DeviceManagerOptions {
  // 日志器（可选）
  logger?: ILogger;
  // 配置提供者（可选，用于 ASR/LLM/TTS 配置）
  configProvider?: IESP32ConfigProvider;
  // 自定义 WebSocket URL 构建函数（可选）
  buildWebSocketUrl?: (host: string) => string;
  // 固件版本（可选，默认 '2.2.2'）
  firmwareVersion?: string;
  // 固件下载 URL（可选）
  firmwareUrl?: string;
  // 是否强制更新固件（可选，默认 false）
  forceUpdate?: boolean;
}
```

#### 方法

##### handleOTARequest()

处理设备 OTA 请求（设备首次连接激活）。

```typescript
async handleOTARequest(
  deviceId: string,           // 设备 ID（MAC 地址）
  clientId: string,           // 客户端 ID（设备 UUID）
  report: ESP32DeviceReport,  // 设备上报信息
  headerInfo?: {              // 请求头中的设备信息（可选）
    deviceModel?: string;
    deviceVersion?: string;
  },
  host?: string               // 请求的 Host 头（格式：IP:PORT 或 DOMAIN:PORT）
): Promise<ESP32OTAResponse>
```

返回类型：

```typescript
interface ESP32OTAResponse {
  websocket?: ESP32WebSocketConfig;  // WebSocket 配置
  mqtt?: ESP32MQTTConfig;            // MQTT 配置（可选）
  serverTime?: ESP32ServerTime;      // 服务器时间
  firmware?: ESP32FirmwareInfo;      // 固件信息
}
```

##### handleWebSocketConnection()

处理 WebSocket 连接请求。

```typescript
async handleWebSocketConnection(
  ws: WebSocket,      // WebSocket 实例
  deviceId: string,   // 设备 ID
  clientId: string,   // 客户端 ID
  token?: string      // 认证 Token（可选，向后兼容）
): Promise<void>
```

##### getConnection()

获取设备连接实例。

```typescript
getConnection(deviceId: string): ESP32Connection | undefined
```

##### getDevice()

获取设备信息。

```typescript
getDevice(deviceId: string): ESP32Device | null
```

##### getASRService()

获取 ASR 服务实例。

```typescript
getASRService(): ASRService
```

##### destroy()

销毁管理器，断开所有连接。

```typescript
async destroy(): Promise<void>
```

### ESP32Connection

单个 ESP32 设备的 WebSocket 连接管理。

#### 方法

##### send()

发送 JSON 消息到设备。

```typescript
async send(message: ESP32WSMessage): Promise<void>
```

##### sendBinary()

发送原始二进制数据到设备。

```typescript
async sendBinary(data: Uint8Array): Promise<void>
```

##### sendBinaryProtocol2()

发送 BinaryProtocol2 格式的音频数据。

```typescript
async sendBinaryProtocol2(
  data: Uint8Array,      // 音频载荷数据
  timestamp?: number     // 时间戳（毫秒级累加值）
): Promise<void>
```

##### getSessionId()

获取会话 ID。

```typescript
getSessionId(): string
```

##### getDeviceId()

获取设备 ID。

```typescript
getDeviceId(): string
```

##### getState()

获取连接状态。

```typescript
getState(): ESP32ConnectionState
```

##### isHelloCompleted()

检查是否已完成 Hello 握手。

```typescript
isHelloCompleted(): boolean
```

##### close()

关闭连接。

```typescript
async close(): Promise<void>
```

### 音频协议工具

#### encodeBinaryProtocol2()

编码为 BinaryProtocol2 格式。

```typescript
import { encodeBinaryProtocol2 } from '@xiaozhi-client/esp32';

const packet = encodeBinaryProtocol2(
  audioData,       // 音频载荷（Uint8Array）
  timestamp,       // 时间戳（毫秒级）
  'opus'           // 类型：'opus' | 'json'
);
```

#### parseBinaryProtocol2()

解析 BinaryProtocol2 数据。

```typescript
import { parseBinaryProtocol2 } from '@xiaozhi-client/esp32';

const parsed = parseBinaryProtocol2(buffer);
if (parsed) {
  console.log('版本:', parsed.protocolVersion);
  console.log('类型:', parsed.type);        // 'opus' | 'json'
  console.log('时间戳:', parsed.timestamp);
  console.log('载荷大小:', parsed.payload.length);
}
```

#### parseBinaryProtocol3()

解析 BinaryProtocol3 数据。

```typescript
import { parseBinaryProtocol3 } from '@xiaozhi-client/esp32';

const parsed = parseBinaryProtocol3(buffer);
if (parsed) {
  console.log('类型:', parsed.type);        // 'opus' | 'json'
  console.log('载荷:', parsed.payload);
}
```

#### detectAudioProtocol()

自动检测音频协议类型。

```typescript
import { detectAudioProtocol } from '@xiaozhi-client/esp32';

const protocol = detectAudioProtocol(buffer);
// 返回：'protocol1' | 'protocol2' | 'protocol3' | 'unknown'
```

### 设备信息提取

#### extractDeviceInfo()

从设备上报信息中提取设备型号和版本（支持多级回退机制）。

```typescript
import { extractDeviceInfo } from '@xiaozhi-client/esp32';

const { boardType, appVersion } = extractDeviceInfo(report, headerInfo);
```

## 类型定义

### ESP32Device

设备信息接口。

```typescript
interface ESP32Device {
  deviceId: string;            // 设备 ID（MAC 地址）
  macAddress: string;          // MAC 地址
  board: string;               // 硬件型号
  appVersion: string;          // 固件版本
  status: ESP32DeviceStatus;   // 设备状态
  createdAt: Date;             // 创建时间
  lastSeenAt: Date;            // 最后活跃时间
}
```

### ESP32WSMessage

WebSocket 消息联合类型。

```typescript
type ESP32WSMessage =
  | ESP32HelloMessage        // Hello 握手消息
  | ESP32ListenMessage       // 监听状态消息（唤醒词、开始/停止）
  | ESP32AudioMessage        // 音频数据消息
  | ESP32STTMessage          // STT 识别结果
  | ESP32TTSMessage          // TTS 播放消息
  | ESP32LLMMessage          // LLM 响应消息
  | ESP32MCPMessage          // MCP 协议消息
  | ESP32SystemMessage       // 系统控制命令
  | ESP32AbortMessage        // 终止消息
  | ESP32CustomMessage       // 自定义消息
  | ESP32ErrorMessage        // 错误消息
  | ESP32ASREndMessage;      // ASR 结束消息
```

### ESP32ListenMessage

监听状态消息（唤醒词检测和监听状态变化）。

```typescript
interface ESP32ListenMessage {
  type: 'listen';
  state: 'detect' | 'start' | 'stop';  // 监听状态
  mode?: 'auto' | 'manual' | 'realtime'; // 监听模式
  text?: string;                       // 唤醒词文本（state=detect）
}
```

### ESP32ErrorCode

错误代码枚举。

```typescript
enum ESP32ErrorCode {
  MISSING_DEVICE_ID = 'MISSING_DEVICE_ID',       // 设备 ID 缺失
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',         // 设备不存在
  DEVICE_OFFLINE = 'DEVICE_OFFLINE',             // 设备离线
  INVALID_DEVICE_STATUS = 'INVALID_DEVICE_STATUS', // 无效的设备状态
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED', // WebSocket 连接失败
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT', // 无效的消息格式
}
```

### 接口定义

#### ILogger

日志接口。

```typescript
interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

#### IESP32ConfigProvider

配置提供者接口。

```typescript
interface IESP32ConfigProvider {
  getASRConfig(): ASRConfig | null;    // 获取 ASR 配置
  getTTSConfig(): TTSConfig | null;    // 获取 TTS 配置
  getLLMConfig(): LLMConfig | null;    // 获取 LLM 配置
  isLLMConfigValid(): boolean;         // 检查 LLM 配置是否有效
}
```

#### IDeviceConnection

设备连接接口。

```typescript
interface IDeviceConnection {
  send(message: ESP32WSMessage): Promise<void>;  // 发送消息
  sendBinaryProtocol2(data: Uint8Array, timestamp?: number): Promise<void>; // 发送音频
  getSessionId(): string;                        // 获取会话 ID
}
```

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/xiaozhi-client.git
cd xiaozhi-client/packages/esp32

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

# 运行所有检查
pnpm check:all
```

### 构建产物

```bash
dist/
├── index.js           # ESM 格式的编译产物
├── index.d.ts         # TypeScript 类型声明
└── index.js.map       # Source Map
```

## 最佳实践

### 1. 错误处理

```typescript
import { ESP32ErrorCode } from '@xiaozhi-client/esp32';

try {
  await manager.handleOTARequest(deviceId, clientId, report);
} catch (error) {
  if (error instanceof Error) {
    console.error('OTA 处理失败:', error.message);
  }
}
```

### 2. 日志注入

```typescript
// 使用自定义日志器
const manager = new ESP32DeviceManager({
  logger: {
    debug: (msg, ...args) => console.debug(`[ESP32] ${msg}`, ...args),
    info: (msg, ...args) => console.info(`[ESP32] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[ESP32] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ESP32] ${msg}`, ...args),
  },
});
```

### 3. 配置热更新

```typescript
// 实现配置提供者，支持动态更新
class DynamicConfigProvider implements IESP32ConfigProvider {
  private configs: { asr: ASRConfig | null; tts: TTSConfig | null; llm: LLMConfig | null };

  getASRConfig() { return this.configs.asr; }
  getTTSConfig() { return this.configs.tts; }
  getLLMConfig() { return this.configs.llm; }
  isLLMConfigValid() { return !!this.configs.llm?.apiKey; }

  // 更新配置（无需重启服务）
  updateConfig(type: 'asr' | 'tts' | 'llm', config: unknown) {
    this.configs[type] = config;
  }
}
```

## 常见问题

### Q: 如何集成到 Express？

```typescript
import express from 'express';
import { ESP32DeviceManager } from '@xiaozhi-client/esp32';
import { WebSocketServer } from 'ws';

const app = express();
const manager = new ESP32DeviceManager();

// OTA 接口
app.post('/api/esp32/ota', async (req, res) => {
  const { device_id, client_id } = req.headers;
  const response = await manager.handleOTARequest(
    device_id as string,
    client_id as string,
    req.body,
    req.headers.host
  );
  res.json(response);
});

// WebSocket 服务
const wss = new WebSocketServer({ server });
wss.on('connection', async (ws, req) => {
  const deviceId = req.headers['x-device-id'] as string;
  const clientId = req.headers['x-client-id'] as string;
  await manager.handleWebSocketConnection(ws, deviceId, clientId);
});
```

### Q: 如何处理设备断开？

设备断开时，`ESP32Connection` 会触发 `onClose` 回调，`ESP32DeviceManager` 会自动更新设备状态为 `offline` 并清理连接映射。

### Q: 支持哪些音频格式？

支持 Opus 和 PCM 格式，默认使用 Opus（24000Hz, 单声道, 60ms 帧时长）。

## 许可证

[MIT](LICENSE)

## 相关资源

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [ESP32 硬件项目](https://github.com/shenjingnan/xiaozhi-esp32)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**作者**: xiaozhi-client
**版本**: 1.0.0