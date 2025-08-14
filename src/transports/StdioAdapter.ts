/**
 * Stdio 传输适配器
 * 处理通过标准输入输出进行的 MCP 通信，主要用于 Cursor 等客户端
 * 从 mcpServerProxy.ts 中抽取的 stdio 处理逻辑
 */

import type { MCPMessageHandler } from "../core/MCPMessageHandler.js";
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
    this.logger.info("初始化 Stdio 适配器");

    try {
      // 设置标准输入编码
      process.stdin.setEncoding(this.encoding);

      // 设置进程退出处理
      this.setupProcessHandlers();

      this.setState(ConnectionState.CONNECTING);
      this.logger.info("Stdio 适配器初始化完成");
    } catch (error) {
      this.logger.error("Stdio 适配器初始化失败", error);
      this.setState(ConnectionState.ERROR);
      throw error;
    }
  }

  /**
   * 启动 Stdio 适配器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Stdio 适配器已在运行");
      return;
    }

    this.logger.info("启动 Stdio 适配器");

    try {
      this.isRunning = true;
      this.setupStdioHandlers();
      this.setState(ConnectionState.CONNECTED);

      this.logger.info("Stdio 适配器启动成功，等待消息...");
    } catch (error) {
      this.logger.error("启动 Stdio 适配器失败", error);
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

    this.logger.info("停止 Stdio 适配器");

    try {
      this.isRunning = false;
      this.removeStdioHandlers();
      this.setState(ConnectionState.DISCONNECTED);

      this.logger.info("Stdio 适配器已停止");
    } catch (error) {
      this.logger.error("停止 Stdio 适配器时出错", error);
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

      this.logger.debug("消息已发送到 stdout", {
        messageId: message.id,
        method: "method" in message ? message.method : "response",
      });
    } catch (error) {
      this.logger.error("发送消息失败", error);
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
        this.logger.warn(
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
      this.logger.error("处理 stdin 数据时出错", error);
    }
  }

  /**
   * 处理单行消息
   */
  private async processMessageLine(line: string): Promise<void> {
    try {
      this.logger.debug(`处理消息行: ${line.substring(0, 200)}...`);

      const message = this.parseMessage(line);
      if (message) {
        await this.handleIncomingMessage(message);
      }
    } catch (error) {
      this.logger.error(`处理消息行失败: ${line.substring(0, 100)}...`, error);

      // 发送错误响应
      const errorResponse: MCPResponse = {
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: "解析错误",
          data: { originalLine: line.substring(0, 100) },
        },
        id: null,
      };

      await this.sendMessage(errorResponse);
    }
  }

  /**
   * 处理标准输入结束
   */
  private handleStdinEnd(): void {
    this.logger.info("标准输入已关闭，停止适配器");
    this.stop().catch((error) => {
      this.logger.error("停止适配器时出错", error);
    });
  }

  /**
   * 处理标准输入错误
   */
  private handleStdinError(error: Error): void {
    this.logger.error("标准输入错误", error);
    this.setState(ConnectionState.ERROR);
  }

  /**
   * 设置进程处理器
   */
  private setupProcessHandlers(): void {
    // 处理进程退出信号
    const handleExit = () => {
      this.logger.info("收到退出信号，清理资源");
      this.stop().finally(() => {
        process.exit(0);
      });
    };

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      this.logger.error("未捕获的异常", error);
      this.setState(ConnectionState.ERROR);
    });

    // 处理未处理的 Promise 拒绝
    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error("未处理的 Promise 拒绝", { reason, promise });
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
    this.logger.debug("消息缓冲区已清空");
  }
}
