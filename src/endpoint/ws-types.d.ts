// 声明 ws 模块类型
// 解决 ws v8 ESM 入口（wrapper.mjs）与 TypeScript bundler 解析的兼容性问题
declare module "ws" {
  import { EventEmitter } from "node:events";
  import type { Duplex, DuplexOptions } from "node:stream";
  import type { IncomingMessage } from "node:http";
  import type { SecureContextOptions } from "node:tls";

  import type * as TLS from "node:tls";

  interface WebSocket extends EventEmitter {
    binaryType: string;
    bufferedAmount: number;
    extensions: {};
    isPaused: boolean;
    protocol: string;
    readyState: number;
    url: string;

    close(code?: number, data?: string): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    send(data: any, cb?: (err?: Error) => void): void;
    terminate(): void;
  }

  interface WebSocketServer extends EventEmitter {
    clients: Set<WebSocket>;
    options: WebSocketServerOptions;
    shouldHandle(req: IncomingMessage): boolean;
    close(cb?: (err?: Error) => void): void;
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (ws: WebSocket, req: IncomingMessage) => void
    ): void;
  }

  interface WebSocketServerOptions {
    host?: string;
    port?: number;
    backlog?: number;
    server?: any;
    verifyClient?(
      info: { origin: string; secure: boolean; req: IncomingMessage },
      cb: (result: boolean, code?: number, message?: string) => void
    ): void;
    handleProtocols?: (
      protocols: Set<string>,
      cb: (result: boolean | string) => void
    ) => void;
    clientTracking?: boolean;
    perMessageDeflate?: boolean | object;
    maxPayload?: number;
    WebSocket?: typeof WebSocket;
    noServer?: boolean;
    skipLingeringClose?: boolean;
    path?: string;
    uniqueId?: string;
  }

  const WebSocket: {
    new (
      address: string,
      protocols?: string | string[] | object,
      options?: WebSocketServerOptions | object
    );
    CONNECTING: number;
    OPEN: number;
    CLOSING: number;
    CLOSED: number;
  };

  const WebSocketServer: {
    new (options?: WebSocketServerOptions, callback?: () => void);
  };

  export default WebSocket;
  export { WebSocket, WebSocketServer };
}
