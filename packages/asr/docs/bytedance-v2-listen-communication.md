# ByteDance V2 流式 ASR 通信原理分析

## 概述

本文档分析 `packages/asr/examples/demo-bytedance-v2-stream.ts` 中 `listen()` 方法的通信工作原理，以及当前实现对音频帧发送速度的影响。

## 代码调用流程

```typescript
for await (const result of client.bytedance.v2.listen(createPcmStream())) {
  resultCount++;
  const status = result.isFinal ? "最终" : "中间";
  console.log(status, result);
}
```

## 完整通信架构图

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant Controller as ByteDanceV2Controller
    participant ASR as ASR Client
    participant WS as WebSocket
    participant Server as 字节跳动服务器

    Note over User,Server: 阶段 1: 连接建立
    User->>Controller: listen(audioStream)
    Controller->>ASR: connect()
    ASR->>WS: 建立 WebSocket 连接
    WS->>Server: 握手 + 认证
    Server-->>WS: 连接成功
    WS-->>ASR: open 事件
    ASR->>Server: 发送初始请求(包含配置)
    Server-->>ASR: 返回 ACK 响应

    Note over User,Server: 阶段 2: 流式音频传输
    loop 对每帧音频数据
        User->>Controller: 获取下一帧(chunk)
        Controller->>ASR: sendFrame(frame)
        ASR->>ASR: gzip 压缩帧数据
        ASR->>ASR: 生成音频头
        ASR->>WS: send(audioRequest)
        WS->>Server: 发送音频数据帧
        Note over Server: 服务器异步处理中...
        Server-->>WS: 推送识别结果
        WS-->>ASR: message 事件
        ASR->>ASR: handleMessage() 解析结果
        ASR->>Controller: 触发 result 事件
        Controller->>Controller: 放入 resultQueue
        Controller->>User: yield result
    end

    Note over User,Server: 阶段 3: 发送结束信号
    Controller->>ASR: end()
    ASR->>Server: 发送 Last Frame(空数据)
    Server-->>ASR: 返回最终识别结果
    ASR->>Controller: 触发 audio_end 事件
    ASR->>WS: close()
    WS->>Server: 关闭连接
```

## 核心实现分析

### ByteDanceV2Controller.listen() 核心逻辑

```typescript
// 位置: packages/asr/src/platforms/bytedance/controllers/ByteDanceV2Controller.ts:130-149

// 发送音频帧并处理结果
for await (const chunk of asyncIterable) {
  const frame = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

  // 关键: 等待帧发送完成
  await this.asr.sendFrame(frame);

  // 发送完后立即检查并 yield 结果
  while (resultQueue.length > 0) {
    yield resultQueue.shift()!;
  }
}
```

### ASR.sendFrame() 实现

```typescript
// 位置: packages/asr/src/client/ASR.ts:760-785

async sendFrame(frame: Buffer): Promise<void> {
  // 1. gzip 压缩
  const compressedChunk = compressGzipSync(frame);

  // 2. 生成音频头
  const header = generateAudioDefaultHeader();

  // 3. 构建请求
  const audioRequest = Buffer.alloc(compressedChunk.length + 8);
  header.copy(audioRequest, 0);
  audioRequest.writeUInt32BE(compressedChunk.length, 4);
  compressedChunk.copy(audioRequest, 8);

  // 4. 发送 (等待 WebSocket 发送完成)
  await this.sendMessage(audioRequest);
}
```

### ASR.sendMessage() 实现

```typescript
// 位置: packages/asr/src/client/ASR.ts:398-410

private async sendMessage(message: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    this.ws.send(message, (err) => {
      if (err) reject(err);
      else resolve();  // 等待 WebSocket 回调完成
    });
  });
}
```

## 对发送音频帧速度的影响分析

### 当前实现的特性

| 特性 | 说明 |
|------|------|
| 执行模式 | **串行执行** - 发送一帧 → 等待完成 → 处理结果 → 发送下一帧 |
| 等待策略 | 等待 `ws.send()` 回调完成才算帧发送成功 |
| 结果处理 | 发送完当前帧后立即检查队列，处理完再发下一帧 |

### 是否会影响发送速度？

**答案：是的，当前实现会影响发送音频帧的速度，原因如下：**

1. **串行等待机制**
   - 每帧必须等待 `await this.asr.sendFrame(frame)` 完成
   - 这不仅等待数据写入 TCP 缓冲区，还等待回调触发

2. **结果处理阻塞**
   - 发送完一帧后，立即处理所有已接收的结果
   - 如果服务器响应快，结果处理会占用时间

3. **无并发发送**
   - 无法像 HTTP/2那样并行发送多帧
   - 无法利用 WebSocket 的全双工特性

### 影响程度评估

```mermaid
flowchart TD
    A[开始发送帧] --> B{网络延迟低?<br/>RTT < 50ms}
    B -->|是| C[影响较小]
    B -->|否| D{服务器响应快?<br/>每帧 < 20ms}
    D -->|是| E[中等影响]
    D -->|否| F[影响较大]

    C --> G[帧间隔 ≈ 网络延迟]
    E --> G
    F --> H[帧间隔显著增加]

    style C fill:#90EE90
    style E fill:#FFD700
    style F fill:#FF6B6B
```

### 潜在优化方向

1. **批量发送**
   - 积累多帧后批量发送，减少等待次数

2. **后台发送**
   - 使用生产者-消费者模式，发送和处理结果并行

3. **流式背压**
   - 实现简单的背压机制，根据服务器处理能力动态调整发送速度

### 当前设计的合理性

虽然有上述影响，但当前设计也有其合理性：

- ✅ **简单可靠**：实现清晰，易于理解和维护
- ✅ **顺序保证**：结果与音频顺序一致
- ✅ **避免过载**：不会一次性发送大量数据导致服务器积压
- ✅ **调试友好**：便于观察每帧的发送和响应关系

## 数据流总览

```mermaid
flowchart LR
    subgraph 用户层
        A[createPcmStream<br/>AsyncGenerator]
    end

    subgraph Controller层
        B[listen 方法]
    end

    subgraph ASR客户端层
        C[sendFrame]
        D[sendMessage]
    end

    subgraph WebSocket层
        E[ws.send]
    end

    subgraph 服务器
        F[识别引擎]
    end

    A -->|for await| B
    B -->|await| C
    C -->|await| D
    D -->|发送| E
    E -->|推送结果| D
    D -->|触发事件| B

    E --> F
    F -->|识别结果| E
```

## 结论

当前 `for await (const result of client.bytedance.v2.listen(...))` 的实现方式**会影响发送音频帧的速度**，主要体现在：

1. 串行执行导致每帧必须等待前帧发送完成
2. 结果处理与发送串行，增加等待时间

对于大多数实时语音识别场景（如实时通话、直播字幕），当前实现通常足够。但如果对延迟有更高要求（如超低延迟语音交互），可以考虑优化为并行发送+后台结果处理的架构。

## 相关文件

| 文件 | 说明 |
|------|------|
| `packages/asr/src/platforms/bytedance/controllers/ByteDanceV2Controller.ts` | listen 方法实现 |
| `packages/asr/src/client/ASR.ts` | ASR 客户端核心实现 |
| `packages/asr/examples/demo-bytedance-v2-stream.ts` | 示例代码 |
