<span id="60c34d72"></span>

# Websocket

> 使用账号申请部分申请到的 appid&access_token 进行调用
> 文本一次性送入，后端边合成边返回音频数据

<span id="9e6b61a2"></span>

## 1. 接口说明

> V1:
> **wss://openspeech.bytedance.com/api/v1/tts/ws_binary (V1 单向流式)**
> **https://openspeech.bytedance.com/api/v1/tts (V1 http非流式)**
> V3:
> **wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream (V3 wss单向流式)**
> [V3 websocket单向流式文档](https://www.volcengine.com/docs/6561/1719100)
> **wss://openspeech.bytedance.com/api/v3/tts/bidirection (V3 wss双向流式)**
> [V3 websocket双向流式文档](https://www.volcengine.com/docs/6561/1329505)
> **https://openspeech.bytedance.com/api/v3/tts/unidirectional (V3 http单向流式)**
> [V3 http单向流式文档](https://www.volcengine.com/docs/6561/1598757)

:::warning
大模型音色都推荐接入V3接口，时延上的表现会更好
:::
<span id="34dcdf3a"></span>

## 2. 身份认证

认证方式使用 Bearer Token，在请求的 header 中加上`"Authorization": "Bearer; {token}"`，并在请求的 json 中填入对应的 appid。
:::warning
Bearer 和 token 使用分号 ; 分隔，替换时请勿保留{}
:::
AppID/Token/Cluster 等信息可参考 [控制台使用FAQ-Q1](/docs/6561/196768#q1：哪里可以获取到以下参数appid，cluster，token，authorization-type，secret-key-？)
<span id="f1d92aff"></span>

## 3. 请求方式

<span id="14624bd9"></span>

### 3.1 二进制协议

<span id="7574a509"></span>

#### 报文格式(Message format)

![Image](https://lf3-volc-editor.volccdn.com/obj/volcfe/sop-public/upload_cc1c1cdd61bf29f5bde066dc693dcb2b.png =1816x)
所有字段以 [Big Endian(大端序)](https://zh.wikipedia.org/wiki/%E5%AD%97%E8%8A%82%E5%BA%8F#%E5%A4%A7%E7%AB%AF%E5%BA%8F) 的方式存储。
**字段描述**

| | | | \
|字段 Field （大小， 单位 bit) |描述 Description |值 Values |
|---|---|---|
| | | | \
|协议版本(Protocol version) (4) |可能会在将来使用不同的协议版本，所以这个字段是为了让客户端和服务器在版本上保持一致。 |`0b0001` - 版本 1 （目前只有版本 1) |
| | | | \
|报头大小(Header size) (4) |header 实际大小是 `header size value x 4` bytes. |\
| |这里有个特殊值 `0b1111` 表示 header 大小大于或等于 60(15 x 4 bytes)，也就是会存在 header extension 字段。 |`0b0001` - 报头大小 ＝ 4 (1 x 4) |\
| | |`0b0010` - 报头大小 ＝ 8 (2 x 4) |\
| | |`0b1010` - 报头大小 ＝ 40 (10 x 4) |\
| | |`0b1110` - 报头大小 = 56 (14 x 4) |\
| | |`0b1111` - 报头大小为 60 或更大; 实际大小在 header extension 中定义 |
| | | | \
|消息类型(Message type) (4) |定义消息类型。 |`0b0001` - full client request. |\
| | |`~~0b1001~~` ~~- full server response(弃用).~~ |\
| | |`0b1011` - Audio-only server response (ACK). |\
| | |`0b1111` - Error message from server (例如错误的消息类型，不支持的序列化方法等等) |
| | | | \
|Message type specific flags (4) |flags 含义取决于消息类型。 |\
| |具体内容请看消息类型小节. | |
| | | | \
|序列化方法(Message serialization method) (4) |定义序列化 payload 的方法。 |\
| |注意：它只对某些特定的消息类型有意义 (例如 Audio-only server response `0b1011` 就不需要序列化). |`0b0000` - 无序列化 (raw bytes) |\
| | |`0b0001` - JSON |\
| | |`0b1111` - 自定义类型, 在 header extension 中定义 |
| | | | \
|压缩方法(Message Compression) (4) |定义 payload 的压缩方法。 |\
| |Payload size 字段不压缩(如果有的话，取决于消息类型)，而且 Payload size 指的是 payload 压缩后的大小。 |\
| |Header 不压缩。 |`0b0000` - 无压缩 |\
| | |`0b0001` - gzip |\
| | |`0b1111` - 自定义压缩方法, 在 header extension 中定义 |
| | | | \
|保留字段(Reserved) (8) |保留字段，同时作为边界 (使整个报头大小为 4 个字节). |`0x00` - 目前只有 0 |

<span id="95a31a2c"></span>

#### 消息类型详细说明

目前所有 TTS websocket 请求都使用 full client request 格式，无论"query"还是"submit"。
<span id="d05f01f6"></span>

#### Full client request

- Header size为`b0001`(即 4B，没有 header extension)。
- Message type为`b0001`.
- Message type specific flags 固定为`b0000`.
- Message serialization method为`b0001`JSON。字段参考上方表格。
- 如果使用 gzip 压缩 payload，则 payload size 为压缩后的大小。

<span id="6e82d7df"></span>

#### Audio-only server response

- Header size 应该为`b0001`.
- Message type为`b1011`.
- Message type specific flags 可能的值有：
  - `b0000` - 没有 sequence number.
  - `b0001` - sequence number > 0.
  - `b0010`or`b0011` - sequence number < 0，表示来自服务器的最后一条消息，此时客户端应合并所有音频片段(如果有多条)。
- Message serialization method为`b0000`(raw bytes).

<span id="4f9397bc"></span>

## 4.注意事项

- 每次合成时reqid这个参数需要重新设置，且要保证唯一性（建议使用uuid.V4生成）
- websocket demo中单条链接仅支持单次合成，若需要合成多次，需自行实现。每次创建websocket连接后，按顺序串行发送每一包。一次合成结束后，可以发送新的合成请求。
- operation需要设置为submit才是流式返回
- 在 websocket 握手成功后，会返回这些 Response header
- 不支持["豆包语音合成模型2.0"的音色](https://www.volcengine.com/docs/6561/1257544)，比如："zh_female_vv_uranus_bigtts"，如需使用推荐使用v3 接口

| | | | \
|Key |说明 |Value 示例 |
|---|---|---|
| | | | \
|X-Tt-Logid |服务端返回的 logid，建议用户获取和打印方便定位问题 |202407261553070FACFE6D19421815D605 |

<span id="fe504ac4"></span>

## 5.调用示例

```mixin-react
return (<Tabs>
<Tabs.TabPane title="Python调用示例" key="buVUUlzaRC"><RenderMd content={`<span id="fccb89b1"></span>
### 前提条件

* 调用之前，您需要获取以下信息：
   * \`<appid>\`：使用控制台获取的APP ID，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<access_token>\`：使用控制台获取的Access Token，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<voice_type>\`：您预期使用的音色ID，可参考 [大模型音色列表](https://www.volcengine.com/docs/6561/1257544)。

<span id="824abc9d"></span>
### Python环境

* Python：3.9版本及以上。
* Pip：25.1.1版本及以上。您可以使用下面命令安装。

\`\`\`Bash
python3 -m pip install --upgrade pip
\`\`\`

<span id="5cbec8af"></span>
### 下载代码示例
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/90fc1f44eaac49f0b4e2cbabdaee8010~tplv-goo7wpa0wc-image.image" name="volcengine_binary_demo.tar.gz" ></Attachment>
<span id="44d95afb"></span>
### 解压缩代码包，安装依赖
\`\`\`Bash
mkdir -p volcengine_binary_demo
tar xvzf volcengine_binary_demo.tar.gz -C ./volcengine_binary_demo
cd volcengine_binary_demo
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
pip3 install -e .
\`\`\`

<span id="fdf69422"></span>
### 发起调用
> \`<appid>\`替换为您的APP ID。
> \`<access_token>\`替换为您的Access Token。
> \`<voice_type>\`替换为您预期使用的音色ID，例如\`zh_female_cancan_mars_bigtts\`。

\`\`\`Bash
python3 examples/volcengine/binary.py --appid <appid> --access_token <access_token> --voice_type <voice_type> --text "你好，我是火山引擎的语音合成服务。这是一个美好的旅程。"
\`\`\`

`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Java调用示例" key="bfjarx0zlZ"><RenderMd content={`<span id="e0bca07e"></span>
### 前提条件

* 调用之前，您需要获取以下信息：
   * \`<appid>\`：使用控制台获取的APP ID，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<access_token>\`：使用控制台获取的Access Token，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<voice_type>\`：您预期使用的音色ID，可参考 [大模型音色列表](https://www.volcengine.com/docs/6561/1257544)。

<span id="5f338843"></span>
### Java环境

* Java：21版本及以上。
* Maven：3.9.10版本及以上。

<span id="96af51fa"></span>
### 下载代码示例
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/ba78519b2dc0459fb7a6935b63775c66~tplv-goo7wpa0wc-image.image" name="volcengine_binary_demo.tar.gz" ></Attachment>
<span id="8e0ecd00"></span>
### 解压缩代码包，安装依赖
\`\`\`Bash
mkdir -p volcengine_binary_demo
tar xvzf volcengine_binary_demo.tar.gz -C ./volcengine_binary_demo
cd volcengine_binary_demo
\`\`\`

<span id="fa0a6230"></span>
### 发起调用
> \`<appid>\`替换为您的APP ID。
> \`<access_token>\`替换为您的Access Token。
> \`<voice_type>\`替换为您预期使用的音色ID，例如\`zh_female_cancan_mars_bigtts\`。

\`\`\`Bash
mvn compile exec:java -Dexec.mainClass=com.speech.volcengine.Binary -DappId=<appid> -DaccessToken=<access_token> -Dvoice=<voice_type> -Dtext="**你好**，我是豆包语音助手，很高兴认识你。这是一个愉快的旅程。"
\`\`\`

`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Go调用示例" key="s8zQJ7cCr3"><RenderMd content={`<span id="2733f4d4"></span>
### 前提条件

* 调用之前，您需要获取以下信息：
   * \`<appid>\`：使用控制台获取的APP ID，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<access_token>\`：使用控制台获取的Access Token，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<voice_type>\`：您预期使用的音色ID，可参考 [大模型音色列表](https://www.volcengine.com/docs/6561/1257544)。

<span id="ee9617a6"></span>
### Go环境

* Go：1.21.0版本及以上。

<span id="cf9bb2bf"></span>
### 下载代码示例
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/c553a4a4373840d4a4870a1ef2a4e494~tplv-goo7wpa0wc-image.image" name="volcengine_binary_demo.tar.gz" ></Attachment>
<span id="363963c4"></span>
### 解压缩代码包，安装依赖
\`\`\`Bash
mkdir -p volcengine_binary_demo
tar xvzf volcengine_binary_demo.tar.gz -C ./volcengine_binary_demo
cd volcengine_binary_demo
\`\`\`

<span id="f0acb02c"></span>
### 发起调用
> \`<appid>\`替换为您的APP ID。
> \`<access_token>\`替换为您的Access Token。
> \`<voice_type>\`替换为您预期使用的音色ID，例如\`zh_female_cancan_mars_bigtts\`。

\`\`\`Bash
go run volcengine/binary/main.go --appid <appid> --access_token <access_token> --voice_type <voice_type> --text "**你好**，我是火山引擎的语音合成服务。"
\`\`\`

`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="C#调用示例" key="Thg5rLaSjq"><RenderMd content={`<span id="c60c1d5f"></span>
### 前提条件

* 调用之前，您需要获取以下信息：
   * \`<appid>\`：使用控制台获取的APP ID，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<access_token>\`：使用控制台获取的Access Token，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<voice_type>\`：您预期使用的音色ID，可参考 [大模型音色列表](https://www.volcengine.com/docs/6561/1257544)。

<span id="cf2199fe"></span>
### C#环境

* .Net 9.0版本。

<span id="f7e91692"></span>
### 下载代码示例
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/a95ff3e7604d4bb4ade8fb49e110fef5~tplv-goo7wpa0wc-image.image" name="volcengine_binary_demo.tar.gz" ></Attachment>
<span id="f9131897"></span>
### 解压缩代码包，安装依赖
\`\`\`Bash
mkdir -p volcengine_binary_demo
tar xvzf volcengine_binary_demo.tar.gz -C ./volcengine_binary_demo
cd volcengine_binary_demo
\`\`\`

<span id="5834585b"></span>
### 发起调用
> \`<appid>\`替换为您的APP ID。
> \`<access_token>\`替换为您的Access Token。
> \`<voice_type>\`替换为您预期使用的音色ID，例如\`zh_female_cancan_mars_bigtts\`。

\`\`\`Bash
dotnet run --project Volcengine/Binary/Volcengine.Speech.Binary.csproj -- --appid <appid> --access_token <access_token> --voice_type <voice_type> --text "**你好**，这是一个测试文本。我们正在测试文本转语音功能。"
\`\`\`

`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="TypeScript调用示例" key="p1GEs3rWU7"><RenderMd content={`<span id="8b865031"></span>
### 前提条件

* 调用之前，您需要获取以下信息：
   * \`<appid>\`：使用控制台获取的APP ID，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<access_token>\`：使用控制台获取的Access Token，可参考 [控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F)。
   * \`<voice_type>\`：您预期使用的音色ID，可参考 [大模型音色列表](https://www.volcengine.com/docs/6561/1257544)。

<span id="e7697c4e"></span>
### node环境

* node：v24.0版本及以上。

<span id="03fe45f1"></span>
### 下载代码示例
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/12ef1b1188a84f0c8883a0114da741ad~tplv-goo7wpa0wc-image.image" name="volcengine_binary_demo.tar.gz" ></Attachment>
<span id="13e8a71a"></span>
### 解压缩代码包，安装依赖
\`\`\`Bash
mkdir -p volcengine_binary_demo
tar xvzf volcengine_binary_demo.tar.gz -C ./volcengine_binary_demo
cd volcengine_binary_demo
npm install
npm install -g typescript
npm install -g ts-node
\`\`\`

<span id="0c57973f"></span>
### 发起调用
> \`<appid>\`替换为您的APP ID。
> \`<access_token>\`替换为您的Access Token。
> \`<voice_type>\`替换为您预期使用的音色ID，例如\`<voice_type>\`。

\`\`\`Bash
npx ts-node src/volcengine/binary.ts --appid <appid> --access_token <access_token> --voice_type <voice_type> --text "**你好**，我是火山引擎的语音合成服务。"
\`\`\`

`}></RenderMd></Tabs.TabPane></Tabs>);
```

<span id="9ea45813"></span>

# HTTP

> 使用账号申请部分申请到的 appid&access_token 进行调用
> 文本全部合成完毕之后，一次性返回全部的音频数据

<span id="4d23f0f6"></span>

## 1. 接口说明

接口地址为 **https://openspeech.bytedance.com/api/v1/tts**
<span id="6f96a6fa"></span>

## 2. 身份认证

认证方式采用 Bearer Token. 1)需要在请求的 Header 中填入"Authorization":"Bearer;${token}"
:::warning
Bearer 和 token 使用分号 ; 分隔，替换时请勿保留${}
:::
AppID/Token/Cluster 等信息可参考 [控制台使用FAQ-Q1](/docs/6561/196768#q1：哪里可以获取到以下参数appid，cluster，token，authorization-type，secret-key-？)
<span id="a8c19c9a"></span>

## 3. 注意事项

- 使用 HTTP Post 方式进行请求，返回的结果为 JSON 格式，需要进行解析
- 因 json 格式无法直接携带二进制音频，音频经 base64 编码。使用 base64 解码后，即为二进制音频
- 每次合成时 reqid 这个参数需要重新设置，且要保证唯一性（建议使用 UUID/GUID 等生成）
- 不支持["豆包语音合成模型2.0"的音色](https://www.volcengine.com/docs/6561/1257544)，比如："zh_female_vv_uranus_bigtts"，如需使用推荐使用v3 接口

<span id="参数列表"></span>

# 参数列表

> Websocket 与 Http 调用参数相同

<span id="931a7b76"></span>

## 请求参数

| | | | | | | \
|字段 |含义 |层级 |格式 |必需 |备注 |
|---|---|---|---|---|---|
| | | | | | | \
|app |应用相关配置 |1 |dict |✓ | |
| | | | | | | \
|appid |应用标识 |2 |string |✓ |需要申请 |
| | | | | | | \
|token |应用令牌 |2 |string |✓ |无实际鉴权作用的Fake token，可传任意非空字符串 |
| | | | | | | \
|cluster |业务集群 |2 |string |✓ |volcano_tts |
| | | | | | | \
|user |用户相关配置 |1 |dict |✓ | |
| | | | | | | \
|uid |用户标识 |2 |string |✓ |可传任意非空字符串，传入值可以通过服务端日志追溯 |
| | | | | | | \
|audio |音频相关配置 |1 |dict |✓ | |
| | | | | | | \
|voice_type |音色类型 |2 |string |✓ | |
| | | | | | | \
|emotion |音色情感 |2 |string | |设置音色的情感。示例："emotion": "angry" |\
| | | | | |注：当前仅部分音色支持设置情感，且不同音色支持的情感范围存在不同。 |\
| | | | | |详见：[大模型语音合成API-音色列表-多情感音色](https://www.volcengine.com/docs/6561/1257544) |
| | | | | | | \
|enable_emotion |开启音色情感 |2 |bool | |是否可以设置音色情感，需将enable_emotion设为true |\
| | | | | |示例："enable_emotion": True |
| | | | | | | \
|emotion_scale |情绪值设置 |2 |float | |调用emotion设置情感参数后可使用emotion_scale进一步设置情绪值，范围1~5，不设置时默认值为4。 |\
| | | | | |注：理论上情绪值越大，情感越明显。但情绪值1~5实际为非线性增长，可能存在超过某个值后，情绪增加不明显，例如设置3和5时情绪值可能接近。 |
| | | | | | | \
|encoding |音频编码格式 |2 |string | |wav / pcm / ogg_opus / mp3，默认为 pcm |\
| | | | | |<span style="background-color: rgba(255,246,122, 0.8)">注意：wav 不支持流式</span> |
| | | | | | | \
|speed_ratio |语速 |2 |float | |[0.1,2]，默认为 1，通常保留一位小数即可 |
| | | | | | | \
|rate |音频采样率 |2 |int | |默认为 24000，可选8000，16000 |
| | | | | | | \
|bitrate |比特率 |2 |int | |单位 kb/s，默认160 kb/s |\
| | | | | |**注：** |\
| | | | | |bitrate只针对MP3格式，wav计算比特率跟pcm一样是 比特率 (bps) = 采样率 × 位深度 × 声道数 |\
| | | | | |目前大模型TTS只能改采样率，所以对于wav格式来说只能通过改采样率来变更音频的比特率 |
| | | | | | | \
|explicit_language |明确语种 |2 |string | |仅读指定语种的文本 |\
| | | | | |精品音色和 ICL 声音复刻场景： |\
| | | | | | |\
| | | | | |_ 不给定参数，正常中英混 |\
| | | | | |_ `crosslingual` 启用多语种前端（包含`zh/en/ja/es-ms/id/pt-br`） |\
| | | | | |_ `zh-cn` 中文为主，支持中英混 |\
| | | | | |_ `en` 仅英文 |\
| | | | | |_ `ja` 仅日文 |\
| | | | | |_ `es-mx` 仅墨西 |\
| | | | | |_ `id` 仅印尼 |\
| | | | | |_ `pt-br` 仅巴葡 |\
| | | | | | |\
| | | | | |DIT 声音复刻场景： |\
| | | | | |当音色是使用model_type=2训练的，即采用dit标准版效果时，建议指定明确语种，目前支持： |\
| | | | | | |\
| | | | | |_ 不给定参数，启用多语种前端`zh,en,ja,es-mx,id,pt-br,de,fr` |\
| | | | | |_ `zh,en,ja,es-mx,id,pt-br,de,fr` 启用多语种前端 |\
| | | | | |_ `zh-cn` 中文为主，支持中英混 |\
| | | | | |_ `en` 仅英文 |\
| | | | | |_ `ja` 仅日文 |\
| | | | | |_ `es-mx` 仅墨西 |\
| | | | | |_ `id` 仅印尼 |\
| | | | | |_ `pt-br` 仅巴葡 |\
| | | | | |_ `de` 仅德语 |\
| | | | | |_ `fr` 仅法语 |\
| | | | | | |\
| | | | | |当音色是使用model_type=3训练的，即采用dit还原版效果时，必须指定明确语种，目前支持： |\
| | | | | | |\
| | | | | |_ 不给定参数，正常中英混 |\
| | | | | |_ `zh-cn` 中文为主，支持中英混 |\
| | | | | |_ `en` 仅英文 |
| | | | | | | \
|context_language |参考语种 |2 |string | |给模型提供参考的语种 |\
| | | | | | |\
| | | | | |_ 不给定 西欧语种采用英语 |\
| | | | | |_ id 西欧语种采用印尼 |\
| | | | | |_ es 西欧语种采用墨西 |\
| | | | | |_ pt 西欧语种采用巴葡 |
| | | | | | | \
|loudness_ratio |音量调节 |2 |float | |[0.5,2]，默认为1，通常保留一位小数即可。0.5代表原音量0.5倍，2代表原音量2倍 |
| | | | | | | \
|request |请求相关配置 |1 |dict |✓ | |
| | | | | | | \
|reqid |请求标识 |2 |string |✓ |需要保证每次调用传入值唯一，建议使用 UUID |
| | | | | | | \
|text |文本 |2 |string |✓ |合成语音的文本，长度限制 1024 字节（UTF-8 编码）建议小于300字符，超出容易增加badcase出现概率或报错 |
| | | | | | | \
|model |模型版本 |\
| | |2 |\
| | | |string |否 |模型版本，传`seed-tts-1.1`较默认版本音质有提升，并且延时更优，不传为默认效果。 |\
| | | | | |注：若使用1.1模型效果，在复刻场景中会放大训练音频prompt特质，因此对prompt的要求更高，使用高质量的训练音频，可以获得更优的音质效果。 |
| | | | | | | \
|text_type |文本类型 |2 |string | |使用 ssml 时需要指定，值为"ssml" |
| | | | | | | \
|silence_duration |句尾静音 |2 |float | |设置该参数可在句尾增加静音时长，范围0~30000ms。（注：增加的句尾静音主要针对传入文本最后的句尾，而非每句话的句尾）若启用该参数，必须在request下首先设置enable_trailing_silence_audio = true |
| | | | | | | \
|with_timestamp |时间戳相关 |2 |int |\
| | | |string | |传入1时表示启用，将返回TN后文本的时间戳，例如：2025。根据语义，TN后文本为“两千零二十五”或“二零二五”。 |\
| | | | | |注：原文本中的多个标点连用或者空格仍会被处理，但不影响时间戳的连贯性（仅限大模型场景使用）。 |\
| | | | | |附加说明（小模型和大模型时间戳原理差异）： |\
| | | | | |1. 小模型依据前端模型生成时间戳，然后合成音频。在处理时间戳时，TN前后文本进行了映射，所以小模型可返回TN前原文本的时间戳，即保留原文中的阿拉伯数字或者特殊符号等。 |\
| | | | | |2. 大模型在对传入文本语义理解后合成音频，再针对合成音频进行TN后打轴以输出时间戳。若不采用TN后文本，输出的时间戳将与合成音频无法对齐，所以大模型返回的时间戳对应TN后的文本。 |
| | | | | | | \
|operation |操作 |2 |string |✓ |query（非流式，http 只能 query） / submit（流式） |
| | | | | | | \
|extra_param |附加参数 |2 |jsonstring | | |
| | | | | | | \
|disable_markdown_filter | |3 |bool | |是否开启markdown解析过滤， |\
| | | | | |为true时，解析并过滤markdown语法，例如，**你好**，会读为“你好”， |\
| | | | | |为false时，不解析不过滤，例如，**你好**，会读为“星星‘你好’星星” |\
| | | | | |示例："disable_markdown_filter": True |
| | | | | | | \
|enable_latex_tn | |3 |bool | |是否可以播报latex公式，需将disable_markdown_filter设为true |\
| | | | | |示例："enable_latex_tn": True |
| | | | | | | \
|mute_cut_remain_ms |句首静音参数 |3 |string | |该参数需配合mute_cut_threshold参数一起使用，其中： |\
| | | | | |"mute_cut_threshold": "400", // 静音判断的阈值（音量小于该值时判定为静音） |\
| | | | | |"mute_cut_remain_ms": "50", // 需要保留的静音长度 |\
| | | | | |注：参数和value都为string格式 |\
| | | | | |以python为示例： |\
| | | | | |`Python |\
| | | | | |"extra_param":("{\"mute_cut_threshold\":\"400\", \"mute_cut_remain_ms\": \"0\"}") |\
| | | | | |` |\
| | | | | | |\
| | | | | |特别提醒： |\
| | | | | | |\
| | | | | |_ 因MP3格式的特殊性，句首始终会存在100ms内的静音无法消除，WAV格式的音频句首静音可全部消除，建议依照自身业务需求综合判断选择 |
| | | | | | | \
|disable_emoji_filter |emoji不过滤显示 |3 |bool | |开启emoji表情在文本中不过滤显示，默认为False，建议搭配时间戳参数一起使用。 |\
| | | | | |Python示例：`"extra_param": json.dumps({"disable_emoji_filter": True})` |
| | | | | | | \
|unsupported_char_ratio_thresh |不支持语种占比阈值 |3 |float | |默认: 0.3，最大值: 1.0 |\
| | | | | |检测出不支持合成的文本超过设置的比例，则会返回错误。 |\
| | | | | |Python示例：`"extra_param": json.dumps({"`unsupported_char_ratio_thresh`": 0.3})` |
| | | | | | | \
|aigc_watermark |是否在合成结尾增加音频节奏标识 |3 |bool | |默认: false |\
| | | | | |Python示例：`"extra_param": json.dumps({"aigc_watermark": True})` |
| | | | | | | \
|cache_config |缓存相关参数 |3 |dict | |开启缓存，开启后合成相同文本时，服务会直接读取缓存返回上一次合成该文本的音频，可明显加快相同文本的合成速率，缓存数据保留时间1小时。 |\
| | | | | |（通过缓存返回的数据不会附带时间戳） |\
| | | | | |Python示例：`"extra_param": json.dumps({"cache_config": {"text_type": 1,"use_cache": True}})` |
| | | | | | | \
|text_type |缓存相关参数 |4 |int | |和use_cache参数一起使用，需要开启缓存时传1 |
| | | | | | | \
|use_cache |缓存相关参数 |4 |bool | |和text_type参数一起使用，需要开启缓存时传true |

备注：

1. 已支持字级别时间戳能力（ssml文本类型不支持）
2. ssml 能力已支持，详见 [SSML 标记语言--豆包语音-火山引擎 (volcengine.com)](https://www.volcengine.com/docs/6561/1330194)
3. 暂时不支持音高调节
4. 大模型音色语种支持中英混
5. 大模型非双向流式已支持latex公式
6. 在 websocket/http 握手成功后，会返回这些 Response header

| | | | \
|Key |说明 |Value 示例 |
|---|---|---|
| | | | \
|X-Tt-Logid |服务端返回的 logid，建议用户获取和打印方便定位问题，使用默认格式即可，不要自定义格式 |202407261553070FACFE6D19421815D605 |

请求示例：

```go
{
    "app": {
        "appid": "appid123",
        "token": "access_token",
        "cluster": "volcano_tts",
    },
    "user": {
        "uid": "uid123"
    },
    "audio": {
        "voice_type": "zh_male_M392_conversation_wvae_bigtts",
        "encoding": "mp3",
        "speed_ratio": 1.0,
    },
    "request": {
        "reqid": "uuid",
        "text": "字节跳动语音合成",
        "operation": "query",
    }
}
```

<span id="返回参数"></span>

## 返回参数

| | | | | | \
|字段 |含义 |层级 |格式 |备注 |
|---|---|---|---|---|
| | | | | | \
|reqid |请求 ID |1 |string |请求 ID,与传入的参数中 reqid 一致 |
| | | | | | \
|code |请求状态码 |1 |int |错误码，参考下方说明 |
| | | | | | \
|message |请求状态信息 |1 |string |错误信息 |
| | | | | | \
|sequence |音频段序号 |1 |int |负数表示合成完毕 |
| | | | | | \
|data |合成音频 |1 |string |返回的音频数据，base64 编码 |
| | | | | | \
|addition |额外信息 |1 |string |额外信息父节点 |
| | | | | | \
|duration |音频时长 |2 |string |返回音频的长度，单位 ms |

响应示例

```go
{
        "reqid": "reqid",
        "code": 3000,
        "operation": "query",
        "message": "Success",
        "sequence": -1,
        "data": "base64 encoded binary data",
        "addition": {
                "duration": "1960",
        }
}
```

<span id="ca57b94d"></span>

## 注意事项

- websocket 单条链接仅支持单次合成，若需要合成多次，则需要多次建立链接
- 每次合成时 reqid 这个参数需要重新设置，且要保证唯一性（建议使用 uuid.V4 生成）
- operation 需要设置为 submit

<span id="返回码说明"></span>

# 返回码说明

| | | | | \
|错误码 |错误描述 |举例 |建议行为 |
|---|---|---|---|
| | | | | \
|3000 |请求正确 |正常合成 |正常处理 |
| | | | | \
|3001 |无效的请求 |一些参数的值非法，比如 operation 配置错误 |检查参数 |
| | | | | \
|3003 |并发超限 |超过在线设置的并发阈值 |重试；使用 sdk 的情况下切换离线 |
| | | | | \
|3005 |后端服务忙 |后端服务器负载高 |重试；使用 sdk 的情况下切换离线 |
| | | | | \
|3006 |服务中断 |请求已完成/失败之后，相同 reqid 再次请求 |检查参数 |
| | | | | \
|3010 |文本长度超限 |单次请求超过设置的文本长度阈值 |检查参数 |
| | | | | \
|3011 |无效文本 |参数有误或者文本为空、文本与语种不匹配、文本只含标点 |检查参数 |
| | | | | \
|3030 |处理超时 |单次请求超过服务最长时间限制 |重试或检查文本 |
| | | | | \
|3031 |处理错误 |后端出现异常 |重试；使用 sdk 的情况下切换离线 |
| | | | | \
|3032 |等待获取音频超时 |后端网络异常 |重试；使用 sdk 的情况下切换离线 |
| | | | | \
|3040 |后端链路连接错误 |后端网络异常 |重试 |
| | | | | \
|3050 |音色不存在 |检查使用的 voice_type 代号 |检查参数 |

<span id="常见错误返回说明"></span>

# 常见错误返回说明

1. 错误返回：
   "message": "quota exceeded for types: xxxxxxxxx_lifetime"
   **错误原因：试用版用量用完了，需要开通正式版才能继续使用**
2. 错误返回：
   "message": "quota exceeded for types: concurrency"
   **错误原因：并发超过了限定值，需要减少并发调用情况或者增购并发**
3. 错误返回：
   "message": "Fail to feed text, reason Init Engine Instance failed"
   **错误原因：voice_type / cluster 传递错误**
4. 错误返回：
   "message": "illegal input text!"
   **错误原因：传入的 text 无效，没有可合成的有效文本。比如全部是标点符号或者 emoji 表情，或者使用中文音色时，传递日语，以此类推。多语种音色，也需要使用 language 指定对应的语种**
5. 错误返回：
   "message": "authenticate request: load grant: requested grant not found"
   **错误原因：鉴权失败，需要检查 appid&token 的值是否设置正确，同时，鉴权的正确格式为**
   **headers["Authorization"] = "Bearer;${token}"**
6. 错误返回：
   "message': 'extract request resource id: get resource id: access denied"
   **错误原因：语音合成已开通正式版且未拥有当前音色授权，需要在控制台购买该音色才能调用。标注免费的音色除 BV001_streaming 及 BV002_streaming 外，需要在控制台进行下单（支付 0 元）**
