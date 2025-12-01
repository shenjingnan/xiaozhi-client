/**
 * Stdio 传输适配器
 * 处理通过标准输入输出进行的 MCP 通信，主要用于 Cursor 等客户端
 * 从 mcpServerProxy.ts 中抽取的 stdio 处理逻辑
 */

import type { MCPMessageHandler } from "../MCPMessageHandler.js";
import { ConnectionState, TransportAdapter } from "./TransportAdapter.js";
import type {
  MCPMessage,
  MCPResponse,
  TransportConfig,
} from "./TransportAdapter.js";

/**
 * Stdio 适配器配置
 */
export interface StdioConfig extends TransportConfig {
  encoding?: BufferEncoding;
  bufferSize?: number;
}

/**
 * Stdio 传输适配器实现
 * 处理标准输入输出的 JSON-RPC 消息通信
 */
export class StdioAdapter extends TransportAdapter {
  private messageBuffer = "";
  private isRunning = false;
  private encoding: BufferEncoding;
  private bufferSize: number;

  constructor(
    messageHandler: MCPMessageHandler,
    config: StdioConfig = { name: "stdio" }
  ) {
    super(messageHandler, config);
    this.encoding = config.encoding || "utf8";
    this.bufferSize = config.bufferSize || 1024 * 1024; // 1MB default buffer
  }

  /**
   * 初始化 Stdio 适配器
   */
  async initialize(): Promise<void> {
    console.info("初始化 Stdio 适配器");

    try {
      // 设置标准输入编码
      process.stdin.setEncoding(this.encoding);

      // 设置进程退出处理
      this.setupProcessHandlers();

      this.setState(ConnectionState.CONNECTING);
      console.info("Stdio 适配器初始化完成");
    } catch (error) {
      console.error("Stdio 适配器初始化失败", error);
      this.setState(ConnectionState.ERROR);
      throw error;
    }
  }

  /**
   * 启动 Stdio 适配器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("Stdio 适配器已在运行");
      return;
    }

    console.info("启动 Stdio 适配器");

    try {
      this.isRunning = true;
      this.setupStdioHandlers();
      this.setState(ConnectionState.CONNECTED);

      console.info("Stdio 适配器启动成功，等待消息...");
    } catch (error) {
      console.error("启动 Stdio 适配器失败", error);
      this.setState(ConnectionState.ERROR);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止 Stdio 适配器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.info("停止 Stdio 适配器");

    try {
      this.isRunning = false;
      this.removeStdioHandlers();
      this.setState(ConnectionState.DISCONNECTED);

      console.info("Stdio 适配器已停止");
    } catch (error) {
      console.error("停止 Stdio 适配器时出错", error);
      throw error;
    }
  }

  /**
   * 发送消息到标准输出
   */
  async sendMessage(message: MCPMessage | MCPResponse): Promise<void> {
    try {
      const serializedMessage = this.serializeMessage(message);

      // 写入到标准输出，添加换行符
      process.stdout.write(`${serializedMessage}\n`);

      console.debug("消息已发送到 stdout", {
        messageId: message.id,
        method: "method" in message ? message.method : "response",
      });
    } catch (error) {
      console.error("发送消息失败", error);
      throw error;
    }
  }

  /**
   * 设置标准输入输出处理器
   */
  private setupStdioHandlers(): void {
    // 处理标准输入数据
    process.stdin.on("data", this.handleStdinData.bind(this));

    // 处理标准输入结束
    process.stdin.on("end", this.handleStdinEnd.bind(this));

    // 处理标准输入错误
    process.stdin.on("error", this.handleStdinError.bind(this));
  }

  /**
   * 移除标准输入输出处理器
   */
  private removeStdioHandlers(): void {
    process.stdin.removeListener("data", this.handleStdinData.bind(this));
    process.stdin.removeListener("end", this.handleStdinEnd.bind(this));
    process.stdin.removeListener("error", this.handleStdinError.bind(this));
  }

  /**
   * 处理标准输入数据
   */
  private async handleStdinData(data: Buffer | string): Promise<void> {
    try {
      // 将数据添加到缓冲区
      this.messageBuffer += data.toString();

      // 检查缓冲区大小
      if (this.messageBuffer.length > this.bufferSize) {
        console.warn(
          `消息缓冲区超过限制 (${this.bufferSize} bytes)，清空缓冲区`
        );
        this.messageBuffer = "";
        return;
      }

      // 按换行符分割消息
      const lines = this.messageBuffer.split("\n");

      // 保留最后一个不完整的行在缓冲区中
      this.messageBuffer = lines.pop() || "";

      // 处理完整的消息行
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          await this.processMessageLine(trimmedLine);
        }
      }
    } catch (error) {
      console.error("处理 stdin 数据时出错", error);
    }
  }

  /**
   * 处理单行消息
   */
  private async processMessageLine(line: string): Promise<void> {
    try {
      console.debug(`处理消息行: ${line.substring(0, 200)}...`);

      const message = this.parseMessage(line);
      if (message) {
        await this.handleIncomingMessage(message);
      }
    } catch (error) {
      console.error(`处理消息行失败: ${line.substring(0, 100)}...`, error);

      // 尝试从原始消息中提取ID，如果失败则生成默认ID
      let messageId: string | number = `parse-error-${Date.now()}`;
      try {
        const parsedMessage = JSON.parse(line.trim());
        if (
          parsedMessage &&
          (typeof parsedMessage.id === "string" ||
            typeof parsedMessage.id === "number")
        ) {
          messageId = parsedMessage.id;
        }
      } catch {
        // 如果无法解析消息，使用生成的默认ID
      }

      // 发送错误响应
      const errorResponse: MCPResponse = {
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: "解析错误",
          data: { originalLine: line.substring(0, 100) },
        },
        id: messageId,
      };

      await this.sendMessage(errorResponse);
    }
  }

  /**
   * 处理标准输入结束
   */
  private handleStdinEnd(): void {
    console.info("标准输入已关闭，停止适配器");
    this.stop().catch((error) => {
      console.error("停止适配器时出错", error);
    });
  }

  /**
   * 处理标准输入错误
   */
  private handleStdinError(error: Error): void {
    console.error("标准输入错误", error);
    this.setState(ConnectionState.ERROR);
  }

  /**
   * 设置进程处理器
   */
  private setupProcessHandlers(): void {
    // 处理进程退出信号
    const handleExit = () => {
      console.info("收到退出信号，清理资源");
      this.stop().finally(() => {
        process.exit(0);
      });
    };

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      console.error("未捕获的异常", error);
      this.setState(ConnectionState.ERROR);
    });

    // 处理未处理的 Promise 拒绝
    process.on("unhandledRejection", (reason, promise) => {
      console.error("未处理的 Promise 拒绝", { reason, promise });
    });
  }

  /**
   * 获取适配器状态信息
   */
  getStatus(): {
    isRunning: boolean;
    bufferSize: number;
    encoding: string;
    connectionId: string;
    state: ConnectionState;
  } {
    return {
      isRunning: this.isRunning,
      bufferSize: this.messageBuffer.length,
      encoding: this.encoding,
      connectionId: this.connectionId,
      state: this.state,
    };
  }

  /**
   * 清空消息缓冲区
   */
  clearBuffer(): void {
    this.messageBuffer = "";
    console.debug("消息缓冲区已清空");
  }
}
