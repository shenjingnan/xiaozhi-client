import { Buffer } from 'buffer'
import WebSocket from 'ws'

/**
 * Event type definitions, corresponding to protobuf generated event types
 */
export enum EventType {
  // Default event, used when no events are needed
  None = 0,

  // Connection events (1-99)
  StartConnection = 1,
  // StartTask = 1,
  FinishConnection = 2,
  // FinishTask = 2,
  ConnectionStarted = 50,
  // TaskStarted = 50,
  ConnectionFailed = 51,
  // TaskFailed = 51,
  ConnectionFinished = 52,
  // TaskFinished = 52,

  // Session events (100-199)
  StartSession = 100,
  CancelSession = 101,
  FinishSession = 102,
  SessionStarted = 150,
  SessionCanceled = 151,
  SessionFinished = 152,
  SessionFailed = 153,
  UsageResponse = 154,
  // ChargeData = 154,

  // General events (200-299)
  TaskRequest = 200,
  UpdateConfig = 201,
  AudioMuted = 250,

  // TTS events (300-399)
  SayHello = 300,
  TTSSentenceStart = 350,
  TTSSentenceEnd = 351,
  TTSResponse = 352,
  TTSEnded = 359,
  PodcastRoundStart = 360,
  PodcastRoundResponse = 361,
  PodcastRoundEnd = 362,

  // ASR events (450-499)
  ASRInfo = 450,
  ASRResponse = 451,
  ASREnded = 459,

  // Chat events (500-599)
  ChatTTSText = 500,
  ChatResponse = 550,
  ChatEnded = 559,

  // Subtitle events (650-699)
  SourceSubtitleStart = 650,
  SourceSubtitleResponse = 651,
  SourceSubtitleEnd = 652,
  TranslationSubtitleStart = 653,
  TranslationSubtitleResponse = 654,
  TranslationSubtitleEnd = 655,
}

/**
 * Message protocol related definitions
 */
export enum MsgType {
  Invalid = 0,
  FullClientRequest = 0b1,
  AudioOnlyClient = 0b10,
  FullServerResponse = 0b1001,
  AudioOnlyServer = 0b1011,
  FrontEndResultServer = 0b1100,
  Error = 0b1111,
}

export const MsgTypeServerACK = MsgType.AudioOnlyServer

export enum MsgTypeFlagBits {
  NoSeq = 0,
  PositiveSeq = 0b1,
  LastNoSeq = 0b10,
  NegativeSeq = 0b11,
  WithEvent = 0b100,
}

export enum VersionBits {
  Version1 = 1,
  Version2 = 2,
  Version3 = 3,
  Version4 = 4,
}

export enum HeaderSizeBits {
  HeaderSize4 = 1,
  HeaderSize8 = 2,
  HeaderSize12 = 3,
  HeaderSize16 = 4,
}

export enum SerializationBits {
  Raw = 0,
  JSON = 0b1,
  Thrift = 0b11,
  Custom = 0b1111,
}

export enum CompressionBits {
  None = 0,
  Gzip = 0b1,
  Custom = 0b1111,
}

/**
 * Protocol message structure
 */
export interface Message {
  version: VersionBits
  headerSize: HeaderSizeBits
  type: MsgType
  flag: MsgTypeFlagBits
  serialization: SerializationBits
  compression: CompressionBits
  event?: EventType
  sessionId?: string
  connectId?: string
  sequence?: number
  errorCode?: number
  payload: Uint8Array
}

export function getEventTypeName(eventType: EventType): string {
  return EventType[eventType] || `invalid event type: ${eventType}`
}

export function getMsgTypeName(msgType: MsgType): string {
  return MsgType[msgType] || `invalid message type: ${msgType}`
}

/**
 * Convert Message object to a readable string representation
 */
export function messageToString(msg: Message): string {
  const eventStr =
    msg.event !== undefined ? getEventTypeName(msg.event) : 'NoEvent'
  const typeStr = getMsgTypeName(msg.type)

  switch (msg.type) {
    case MsgType.AudioOnlyServer:
    case MsgType.AudioOnlyClient:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, PayloadSize: ${msg.payload.length}`
      }
      return `MsgType: ${typeStr}, EventType: ${eventStr}, PayloadSize: ${msg.payload.length}`

    case MsgType.Error:
      return `MsgType: ${typeStr}, EventType: ${eventStr}, ErrorCode: ${msg.errorCode}, Payload: ${new TextDecoder().decode(msg.payload)}`

    default:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, Payload: ${new TextDecoder().decode(msg.payload)}`
      }

      return `MsgType: ${typeStr}, EventType: ${eventStr}, Payload: ${new TextDecoder().decode(msg.payload)}`
  }
}

// To implement the toString method for Message interface, we need to modify the createMessage function
export function createMessage(
  msgType: MsgType,
  flag: MsgTypeFlagBits,
): Message {
  const msg = {
    type: msgType,
    flag: flag,
    version: VersionBits.Version1,
    headerSize: HeaderSizeBits.HeaderSize4,
    serialization: SerializationBits.JSON,
    compression: CompressionBits.None,
    payload: new Uint8Array(0),
  }

  // Use Object.defineProperty to add toString method
  Object.defineProperty(msg, 'toString', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function () {
      return messageToString(this)
    },
  })

  return msg as Message
}

/**
 * Message serialization
 */
export function marshalMessage(msg: Message): Uint8Array {
  const buffers: Uint8Array[] = []

  // Build base header
  const headerSize = 4 * msg.headerSize
  const header = new Uint8Array(headerSize)

  header[0] = (msg.version << 4) | msg.headerSize
  header[1] = (msg.type << 4) | msg.flag
  header[2] = (msg.serialization << 4) | msg.compression

  buffers.push(header)

  // Write fields based on message type and flags
  const writers = getWriters(msg)
  for (const writer of writers) {
    const data = writer(msg)
    if (data) buffers.push(data)
  }

  // Merge all buffers
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }

  return result
}

/**
 * Message deserialization
 */
export function unmarshalMessage(data: Uint8Array): Message {
  if (data.length < 3) {
    throw new Error(
      `data too short: expected at least 3 bytes, got ${data.length}`,
    )
  }

  let offset = 0

  // Read base header
  const versionAndHeaderSize = data[offset++]
  const typeAndFlag = data[offset++]
  const serializationAndCompression = data[offset++]

  const msg = {
    version: (versionAndHeaderSize >> 4) as VersionBits,
    headerSize: (versionAndHeaderSize & 0b00001111) as HeaderSizeBits,
    type: (typeAndFlag >> 4) as MsgType,
    flag: (typeAndFlag & 0b00001111) as MsgTypeFlagBits,
    serialization: (serializationAndCompression >> 4) as SerializationBits,
    compression: (serializationAndCompression & 0b00001111) as CompressionBits,
    payload: new Uint8Array(0),
  }

  Object.defineProperty(msg, 'toString', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function () {
      return messageToString(this)
    },
  })

  // Skip remaining header bytes
  offset = 4 * msg.headerSize

  // Read fields based on message type and flags
  const readers = getReaders(msg as Message)
  for (const reader of readers) {
    offset = reader(msg as Message, data, offset)
  }

  return msg as Message
}

// Internal helper functions for serialization/deserialization
function getWriters(msg: Message): Array<(msg: Message) => Uint8Array | null> {
  const writers: Array<(msg: Message) => Uint8Array | null> = []

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    writers.push(writeEvent, writeSessionId)
  }

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        writers.push(writeSequence)
      }
      break
    case MsgType.Error:
      writers.push(writeErrorCode)
      break
    default:
      throw new Error(`unsupported message type: ${msg.type}`)
  }

  writers.push(writePayload)
  return writers
}

function getReaders(
  msg: Message,
): Array<(msg: Message, data: Uint8Array, offset: number) => number> {
  const readers: Array<
    (msg: Message, data: Uint8Array, offset: number) => number
  > = []

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        readers.push(readSequence)
      }
      break
    case MsgType.Error:
      readers.push(readErrorCode)
      break
    default:
      throw new Error(`unsupported message type: ${msg.type}`)
  }

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    readers.push(readEvent, readSessionId, readConnectId)
  }

  readers.push(readPayload)
  return readers
}

// Writer functions
function writeEvent(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setInt32(0, msg.event, false)
  return new Uint8Array(buffer)
}

function writeSessionId(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
      return null
  }

  const sessionId = msg.sessionId || ''
  const sessionIdBytes = Buffer.from(sessionId, 'utf8')
  const sizeBuffer = new ArrayBuffer(4)
  const sizeView = new DataView(sizeBuffer)
  sizeView.setUint32(0, sessionIdBytes.length, false)

  const result = new Uint8Array(4 + sessionIdBytes.length)
  result.set(new Uint8Array(sizeBuffer), 0)
  result.set(sessionIdBytes, 4)

  return result
}

function writeSequence(msg: Message): Uint8Array | null {
  if (msg.sequence === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setInt32(0, msg.sequence, false)
  return new Uint8Array(buffer)
}

function writeErrorCode(msg: Message): Uint8Array | null {
  if (msg.errorCode === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint32(0, msg.errorCode, false)
  return new Uint8Array(buffer)
}

function writePayload(msg: Message): Uint8Array | null {
  const payloadSize = msg.payload.length
  const sizeBuffer = new ArrayBuffer(4)
  const sizeView = new DataView(sizeBuffer)
  sizeView.setUint32(0, payloadSize, false)

  const result = new Uint8Array(4 + payloadSize)
  result.set(new Uint8Array(sizeBuffer), 0)
  result.set(msg.payload, 4)

  return result
}

// Reader functions
function readEvent(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for event')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.event = view.getInt32(0, false)
  return offset + 4
}

function readSessionId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      return offset
  }

  if (offset + 4 > data.length) {
    throw new Error('insufficient data for session ID size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for session ID')
    }
    msg.sessionId = new TextDecoder().decode(data.slice(offset, offset + size))
    offset += size
  }

  return offset
}

function readConnectId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset

  switch (msg.event) {
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      break
    default:
      return offset
  }

  if (offset + 4 > data.length) {
    throw new Error('insufficient data for connect ID size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for connect ID')
    }
    msg.connectId = new TextDecoder().decode(data.slice(offset, offset + size))
    offset += size
  }

  return offset
}

function readSequence(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for sequence')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.sequence = view.getInt32(0, false)
  return offset + 4
}

function readErrorCode(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for error code')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.errorCode = view.getUint32(0, false)
  return offset + 4
}

function readPayload(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for payload size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for payload')
    }
    msg.payload = data.slice(offset, offset + size)
    offset += size
  }

  return offset
}

const messageQueues = new Map<WebSocket, Message[]>()
const messageCallbacks = new Map<WebSocket, ((msg: Message) => void)[]>()

function setupMessageHandler(ws: WebSocket) {
  if (!messageQueues.has(ws)) {
    messageQueues.set(ws, [])
    messageCallbacks.set(ws, [])

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        let uint8Data: Uint8Array
        if (Buffer.isBuffer(data)) {
          uint8Data = new Uint8Array(data)
        } else if (data instanceof ArrayBuffer) {
          uint8Data = new Uint8Array(data)
        } else if (data instanceof Uint8Array) {
          uint8Data = data
        } else {
          throw new Error(`Unexpected WebSocket message type: ${typeof data}`)
        }

        const msg = unmarshalMessage(uint8Data)
        const queue = messageQueues.get(ws)!
        const callbacks = messageCallbacks.get(ws)!

        if (callbacks.length > 0) {
          // If there are waiting callbacks, process message immediately
          const callback = callbacks.shift()!
          callback(msg)
        } else {
          // Otherwise, queue the message
          queue.push(msg)
        }
      } catch (error) {
        throw new Error(`Error processing message: ${error}`)
      }
    })

    ws.on('close', () => {
      messageQueues.delete(ws)
      messageCallbacks.delete(ws)
    })
  }
}

export async function ReceiveMessage(ws: WebSocket): Promise<Message> {
  setupMessageHandler(ws)

  return new Promise((resolve, reject) => {
    const queue = messageQueues.get(ws)!
    const callbacks = messageCallbacks.get(ws)!

    // If there are messages in the queue, process one immediately
    if (queue.length > 0) {
      resolve(queue.shift()!)
      return
    }

    // Otherwise, wait for the next message
    const errorHandler = (error: WebSocket.ErrorEvent) => {
      const index = callbacks.findIndex((cb) => cb === resolver)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
      reject(error)
    }

    const resolver = (msg: Message) => {
      ws.removeListener('error', errorHandler)
      resolve(msg)
    }

    callbacks.push(resolver)
    ws.once('error', errorHandler)
  })
}

export async function WaitForEvent(
  ws: WebSocket,
  msgType: MsgType,
  eventType: EventType,
): Promise<Message> {
  const msg = await ReceiveMessage(ws)
  if (msg.type !== msgType || msg.event !== eventType) {
    throw new Error(
      `Unexpected message: type=${getMsgTypeName(msg.type)}, event=${getEventTypeName(msg.event || 0)}`,
    )
  }
  return msg
}

export async function FullClientRequest(
  ws: WebSocket,
  payload: Uint8Array,
): Promise<void> {
  const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq)
  msg.payload = payload
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function AudioOnlyClient(
  ws: WebSocket,
  payload: Uint8Array,
  flag: MsgTypeFlagBits,
): Promise<void> {
  const msg = createMessage(MsgType.AudioOnlyClient, flag)
  msg.payload = payload
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function StartConnection(ws: WebSocket): Promise<void> {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.StartConnection
  msg.payload = new TextEncoder().encode('{}')
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function FinishConnection(ws: WebSocket): Promise<void> {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.FinishConnection
  msg.payload = new TextEncoder().encode('{}')
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function StartSession(
  ws: WebSocket,
  payload: Uint8Array,
  sessionId: string,
): Promise<void> {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.StartSession
  msg.sessionId = sessionId
  msg.payload = payload
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function FinishSession(
  ws: WebSocket,
  sessionId: string,
): Promise<void> {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.FinishSession
  msg.sessionId = sessionId
  msg.payload = new TextEncoder().encode('{}')
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function CancelSession(
  ws: WebSocket,
  sessionId: string,
): Promise<void> {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.CancelSession
  msg.sessionId = sessionId
  msg.payload = new TextEncoder().encode('{}')
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function TaskRequest(
  ws: WebSocket,
  payload: Uint8Array,
  sessionId: string,
): Promise<void> {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.TaskRequest
  msg.sessionId = sessionId
  msg.payload = payload
  console.log(`${msg.toString()}`)
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}
