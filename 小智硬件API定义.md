# 小智ESP32服务端通信API定义文档

## 一、通信协议架构总览

xiaozhi-esp32 项目采用了多层次、多协议的通信架构：

| 协议 | 用途 | 实时性 | 加密方式 |
|------|------|--------|----------|
| WebSocket | 实时双向通信 | 高 | TLS |
| MQTT + UDP | 高性能音频传输 | 很高 | AES-CTR + TLS |
| HTTP | OTA升级、设备激活、图片上传 | 低 | TLS |

---

## 二、WebSocket 通信协议

### 2.1 连接建立

**核心文件：** `main/protocols/websocket_protocol.cc`

| 项目 | 值 |
|------|-----|
| Method | WebSocket Upgrade (HTTP GET) |
| Domain | 由配置 `websocket.url` 指定 |
| Port | ws://默认80, wss://默认443 |
| Path | 由URL指定 |

**请求头：**
```http
Authorization: Bearer <token>
Protocol-Version: 1/2/3
Device-Id: <MAC地址>
Client-Id: <设备UUID>
```

### 2.2 握手消息

**客户端 → 服务器 (Hello):**
```json
{
  "type": "hello",
  "version": 1,
  "features": {"aec": true, "mcp": true},
  "transport": "websocket",
  "audio_params": {
    "format": "opus",
    "sample_rate": 16000,
    "channels": 1,
    "frame_duration": 60
  }
}
```

**服务器 → 客户端 (Hello Response):**
```json
{
  "type": "hello",
  "transport": "websocket",
  "session_id": "会话ID",
  "audio_params": {
    "format": "opus",
    "sample_rate": 24000,
    "channels": 1,
    "frame_duration": 60
  }
}
```

### 2.3 设备端 → 服务器 消息类型

| 消息类型 | state/参数 | 说明 |
|----------|-----------|------|
| `listen` | start/stop/detect | 控制监听状态 |
| `abort` | wake_word_detected等 | 终止播放 |
| `mcp` | JSON-RPC 2.0 payload | 物联网控制响应 |

**Listen 消息示例：**
```json
{
  "session_id": "xxx",
  "type": "listen",
  "state": "start",
  "mode": "auto"
}
```

**Abort 消息示例：**
```json
{
  "session_id": "xxx",
  "type": "abort",
  "reason": "wake_word_detected"
}
```

### 2.4 服务器 → 设备端 消息类型

| 消息类型 | 说明 | 示例字段 |
|----------|------|----------|
| `stt` | 语音识别结果 | `text` |
| `llm` | 情感控制 | `emotion`, `text` |
| `tts` | 语音合成控制 | `state`, `text` |
| `mcp` | 工具调用 | JSON-RPC 2.0 |
| `system` | 系统控制 | `command` |

**STT 消息示例：**
```json
{
  "session_id": "xxx",
  "type": "stt",
  "text": "用户说的话"
}
```

**TTS 消息示例：**
```json
{
  "session_id": "xxx",
  "type": "tts",
  "state": "start",
  "text": "要朗读的文本"
}
```

### 2.5 二进制音频协议

**协议版本1：** 直接发送 Opus 编码音频

**协议版本2：**
```c
struct BinaryProtocol2 {
    uint16_t version;        // 协议版本
    uint16_t type;           // 0: OPUS, 1: JSON
    uint32_t reserved;       // 保留
    uint32_t timestamp;      // 时间戳（毫秒，用于AEC）
    uint32_t payload_size;   // 负载大小
    uint8_t payload[];       // Opus音频数据
};
```

**协议版本3：**
```c
struct BinaryProtocol3 {
    uint8_t type;            // 消息类型
    uint8_t reserved;        // 保留
    uint16_t payload_size;   // 负载大小
    uint8_t payload[];       // Opus音频数据
};
```

---

## 三、MQTT + UDP 混合协议

**核心文件：** `main/protocols/mqtt_protocol.cc`
**文档：** `docs/mqtt-udp.md`

### 3.1 MQTT 控制通道

| 项目 | 值 |
|------|-----|
| Domain | 由 `mqtt.endpoint` 配置指定 |
| Port | 8883 (SSL/TLS) |
| Protocol | MQTT over TLS |
| Keep Alive | 240秒 |

**客户端 Hello:**
```json
{
  "type": "hello",
  "version": 3,
  "transport": "udp",
  "features": {"mcp": true},
  "audio_params": {
    "format": "opus",
    "sample_rate": 16000,
    "channels": 1,
    "frame_duration": 60
  }
}
```

**服务器 Hello Response:**
```json
{
  "type": "hello",
  "transport": "udp",
  "session_id": "会话ID",
  "audio_params": {
    "format": "opus",
    "sample_rate": 24000,
    "channels": 1,
    "frame_duration": 60
  },
  "udp": {
    "server": "192.168.1.100",
    "port": 8888,
    "key": "32字节十六进制密钥",
    "nonce": "32字节十六进制随机数"
  }
}
```

### 3.2 UDP 音频包结构

```
| type(1B) | flags(1B) | payload_len(2B) | ssrc(4B) | timestamp(4B) | sequence(4B) | encrypted_payload |
```

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1B | 0x01 = 音频数据包 |
| flags | 1B | 标志位（保留） |
| payload_len | 2B | 负载长度（网络字节序） |
| ssrc | 4B | 同步源标识符 |
| timestamp | 4B | 时间戳（网络字节序） |
| sequence | 4B | 序列号（防重放攻击） |
| encrypted_payload | 变长 | AES-CTR 加密的 Opus 数据 |

**加密参数：**
- 算法：AES-CTR
- 密钥：128位
- 随机数：128位

---

## 四、HTTP API 接口

**核心文件：** `main/ota.cc`

### 4.1 固件版本检查 / 配置获取

| 项目 | 值 |
|------|-----|
| Method | GET / POST |
| Domain | `https://api.tenclass.net/xiaozhi/ota/` (默认) |
| Path | `/` |
| Port | 443 |

**请求头：**
```http
Activation-Version: 1或2
Device-Id: <MAC地址>
Client-Id: <设备UUID>
Serial-Number: <序列号> (Version=2时)
User-Agent: <用户代理>
Accept-Language: zh-CN
Content-Type: application/json
```

**响应格式：**
```json
{
  "mqtt": {
    "endpoint": "地址:端口",
    "client_id": "客户端ID",
    "username": "用户名",
    "password": "密码",
    "publish_topic": "发布主题",
    "keepalive": 240
  },
  "websocket": {
    "url": "wss://服务器地址",
    "token": "认证令牌",
    "version": 2
  },
  "server_time": {
    "timestamp": 毫秒时间戳,
    "timezone_offset": 时区偏移分钟
  },
  "firmware": {
    "version": "版本号",
    "url": "固件下载URL",
    "force": 0或1
  },
  "activation": {
    "message": "激活提示",
    "code": "激活码",
    "challenge": "挑战字符串",
    "timeout_ms": 300000
  }
}
```

**API作用：** 获取服务器配置、检查固件更新、设备激活、时间同步

**关键代码：** `main/ota.cc:50-211`

---

### 4.2 设备激活

| 项目 | 值 |
|------|-----|
| Method | POST |
| Path | `/activate` |

**请求体：**
```json
{
  "algorithm": "hmac-sha256",
  "serial_number": "设备序列号",
  "challenge": "服务器提供的挑战",
  "hmac": "HMAC-SHA256签名值"
}
```

**响应状态码：**
- `200` - 激活成功
- `202` - 激活超时
- 其他 - 激活失败

**关键代码：** `main/ota.cc:421-492`

---

### 4.3 固件下载

| 项目 | 值 |
|------|-----|
| Method | GET |
| URL | 从版本检查接口获取 |

**请求头：**
```http
Device-Id: <MAC地址>
Client-Id: <设备UUID>
```

**响应：** 固件二进制数据流

**关键代码：** `main/ota.cc:215-370`

---

### 4.4 摄像头图片上传

**核心文件：** `main/boards/common/esp32_camera.cc`

| 项目 | 值 |
|------|-----|
| Method | POST |
| Content-Type | multipart/form-data |

**请求头：**
```http
Device-Id: <MAC地址>
Client-Id: <设备UUID>
Authorization: Bearer <token>
```

**请求体：**
```
------ESP32_CAMERA_BOUNDARY
Content-Disposition: form-data; name="question"

用户关于图片的问题
------ESP32_CAMERA_BOUNDARY
Content-Disposition: form-data; name="file"; filename="camera.jpg"
Content-Type: image/jpeg

<JPEG二进制数据>
------ESP32_CAMERA_BOUNDARY--
```

**响应：** JSON格式的图片分析结果

---

### 4.5 屏幕截图上传

**核心文件：** `main/mcp_server.cc`

| 项目 | 值 |
|------|-----|
| Method | POST |
| Content-Type | multipart/form-data |

**请求体：**
```
------ESP32_SCREEN_SNAPSHOT_BOUNDARY
Content-Disposition: form-data; name="file"; filename="screenshot.jpg"
Content-Type: image/jpeg

<JPEG二进制数据>
------ESP32_SCREEN_SNAPSHOT_BOUNDARY--
```

---

## 五、MCP 协议（设备控制）

**核心文件：** `main/mcp_server.cc`
**文档：** `docs/mcp-protocol.md`

MCP 是基于 JSON-RPC 2.0 的设备控制协议，封装在 WebSocket 或 MQTT 消息中。

### 5.1 消息结构

```json
{
  "session_id": "会话ID",
  "type": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "方法名",
    "params": {},
    "id": 1,
    "result": {},
    "error": {}
  }
}
```

### 5.2 支持的方法

| 方法 | 方向 | 说明 |
|------|------|------|
| `initialize` | 客户端→设备 | 初始化连接 |
| `tools/list` | 客户端→设备 | 获取工具列表 |
| `tools/call` | 客户端→设备 | 调用工具 |

### 5.3 内置工具列表

**通用工具：**
| 工具名 | 描述 |
|--------|------|
| `self.get_device_status` | 获取设备状态 |
| `self.audio_speaker.set_volume` | 设置音量 |
| `self.screen.set_brightness` | 设置屏幕亮度 |
| `self.screen.set_theme` | 设置主题 |
| `self.camera.take_photo` | 拍照并分析 |

**用户工具：**
| 工具名 | 描述 |
|--------|------|
| `self.get_system_info` | 获取系统信息 |
| `self.reboot` | 重启设备 |
| `self.upgrade_firmware` | 固件升级 |
| `self.screen.snapshot` | 屏幕截图 |
| `self.screen.preview_image` | 预览图片 |

---

## 六、本地 WebSocket 控制服务器

**核心文件：** `main/boards/otto-robot/websocket_control_server.cc`

| 项目 | 值 |
|------|-----|
| Method | WebSocket Upgrade (HTTP GET) |
| Path | `/ws` |
| Port | 可配置（默认80）|

**消息格式：**
```json
{
  "jsonrpc": "2.0",
  "method": "工具名",
  "params": {},
  "id": 1
}
```

---

## 七、安全认证机制

### 7.1 设备标识
- **UUID:** 软件生成，存储在NVS
- **MAC地址:** 硬件标识
- **序列号:** 可选，存储在eFuse

### 7.2 通信认证
- **WebSocket:** Bearer Token
- **MQTT:** Username/Password
- **HTTP:** 自定义请求头

### 7.3 设备激活
- **算法:** HMAC-SHA256
- **机制:** 挑战-响应
- **密钥:** eFuse HMAC_KEY0

---

## 八、关键文件路径

| 文件路径 | 功能 |
|----------|------|
| `main/protocols/websocket_protocol.cc` | WebSocket协议实现 |
| `main/protocols/mqtt_protocol.cc` | MQTT协议实现 |
| `main/ota.cc` | HTTP OTA和激活 |
| `main/boards/common/esp32_camera.cc` | 摄像头图片上传 |
| `main/mcp_server.cc` | MCP服务器实现 |
| `docs/websocket.md` | WebSocket协议文档 |
| `docs/mcp-protocol.md` | MCP协议文档 |
| `docs/mqtt-udp.md` | MQTT+UDP协议文档 |

---

## 九、配置存储

### NVS 命名空间

| 命名空间 | 存储内容 |
|----------|----------|
| `board` | 设备UUID |
| `wifi` | WiFi配置、OTA URL |
| `mqtt` | MQTT连接配置 |
| `websocket` | WebSocket连接配置 |

### 默认配置

```ini
CONFIG_OTA_URL="https://api.tenclass.net/xiaozhi/ota/"
```

配置文件：`main/Kconfig.projbuild`

---

*本文档基于 xiaozhi-esp32 项目代码分析生成*
