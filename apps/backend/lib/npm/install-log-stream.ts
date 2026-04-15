/**
 * NPM 安装日志流管理器
 *
 * 管理每个安装任务的日志数据，支持通过 SSE 流式推送给前端。
 * 替代原有的 WebSocket 广播机制。
 *
 * ## 核心功能
 * - 按 installId 隔离各安装任务的日志
 * - 支持实时追加日志条目
 * - 提供 ReadableStream 接口用于 SSE 响应
 * - 自动清理已完成的安装任务数据
 */

/** 单条安装日志 */
export interface InstallLogEntry {
  type: "stdout" | "stderr";
  message: string;
  timestamp: number;
}

/** 安装开始事件数据 */
export interface InstallStartedData {
  version: string;
  installId: string;
  timestamp: number;
}

/** 安装完成事件数据 */
export interface InstallCompletedData {
  version: string;
  installId: string;
  success: boolean;
  duration: number;
  timestamp: number;
}

/** 安装失败事件数据 */
export interface InstallFailedData {
  version: string;
  installId: string;
  error: string;
  duration: number;
  timestamp: number;
}

/** 安装任务内部状态 */
interface InstallSession {
  /** 已收集的日志（用于断线重连的客户端） */
  logs: InstallLogEntry[];
  /** 正在等待的 SSE 流控制器（可能有多个消费者） */
  controllers: Set<ReadableStreamDefaultController>;
  /** 是否已完成（成功或失败） */
  done: boolean;
  /** 完成时的最终事件数据 */
  finalData?: InstallCompletedData | InstallFailedData;
}

/**
 * NPM 安装日志流管理器
 *
 * 使用方式：
 * 1. NPMManager 调用 startInstall/pushLog/complete/fail 写入数据
 * 2. SSE 端点调用 createSSEStream 获取 ReadableStream 用于响应
 */
export class InstallLogStream {
  /** 按 installId 管理的安装会话 */
  private sessions: Map<string, InstallSession> = new Map();

  /**
   * 开始一个新的安装会话
   */
  startInstall(data: InstallStartedData): void {
    this.sessions.set(data.installId, {
      logs: [],
      controllers: new Set(),
      done: false,
    });
  }

  /**
   * 追加一条安装日志
   */
  pushLog(installId: string, entry: InstallLogEntry): void {
    const session = this.sessions.get(installId);
    if (!session) {
      return;
    }

    session.logs.push(entry);

    // 向所有活跃的 SSE 消费者推送日志
    const eventData = this.formatSSEEvent("log", {
      installId,
      ...entry,
    });
    this.pushToControllers(session.controllers, eventData);
  }

  /**
   * 标记安装完成
   */
  complete(data: InstallCompletedData): void {
    this.finalizeSession(data.installId, data);
  }

  /**
   * 标记安装失败
   */
  fail(data: InstallFailedData): void {
    this.finalizeSession(data.installId, data);
  }

  /**
   * 创建 SSE ReadableStream
   *
   * 前端通过 GET /api/install/logs?installId=xxx 连接此流。
   * 返回的 ReadableStream 会先发送历史日志（支持断线重连），
   * 然后持续推送新日志直到安装完成。
   */
  createSSEStream(installId: string): ReadableStream<string> | null {
    const session = this.sessions.get(installId);
    if (!session) {
      return null;
    }

    let streamController: ReadableStreamDefaultController<string> | null = null;

    return new ReadableStream<string>({
      start: (controller) => {
        streamController = controller;
        session.controllers.add(controller);

        // 发送 SSE 响应头和初始数据
        controller.enqueue(": connected\n\n");

        // 发送历史日志（支持晚连接的客户端）
        for (const log of session.logs) {
          const eventData = this.formatSSEEvent("log", {
            installId,
            ...log,
          });
          controller.enqueue(eventData);
        }

        // 如果已经完成，直接发送最终事件并关闭
        if (session.done && session.finalData) {
          const eventType =
            "success" in session.finalData ? "completed" : "failed";
          const eventData = this.formatSSEEvent(eventType, session.finalData);
          controller.enqueue(eventData);
          controller.close();
          session.controllers.delete(controller);
          streamController = null;
          return;
        }
      },
      cancel: () => {
        if (streamController) {
          session.controllers.delete(streamController);
          streamController = null;
        }
      },
    });
  }

  /**
   * 清理指定安装会话的资源
   */
  cleanup(installId: string): void {
    const session = this.sessions.get(installId);
    if (session) {
      // 关闭所有活跃的消费者
      for (const controller of session.controllers) {
        try {
          controller.close();
        } catch {
          // 忽略关闭错误
        }
      }
      session.controllers.clear();
      this.sessions.delete(installId);
    }
  }

  /**
   * 清理所有已完成的会话（可定期调用释放内存）
   */
  cleanupCompleted(): void {
    for (const [installId, session] of this.sessions) {
      if (session.done) {
        this.cleanup(installId);
      }
    }
  }

  /**
   * 检查安装会话是否存在
   */
  hasSession(installId: string): boolean {
    return this.sessions.has(installId);
  }

  // ==================== 私有方法 ====================

  /**
   * 终结会话：发送最终事件并关闭所有消费者
   */
  private finalizeSession(
    installId: string,
    data: InstallCompletedData | InstallFailedData
  ): void {
    const session = this.sessions.get(installId);
    if (!session || session.done) {
      return;
    }

    session.done = true;
    session.finalData = data;

    const eventType = "success" in data ? "completed" : "failed";
    const eventData = this.formatSSEEvent(eventType, data);

    // 向所有活跃消费者发送最终事件并关闭
    for (const controller of session.controllers) {
      try {
        controller.enqueue(eventData);
        controller.close();
      } catch {
        // 流可能已被取消
      }
    }
    session.controllers.clear();

    // 延迟清理会话数据（给消费者一些时间处理完成事件）
    setTimeout(() => {
      this.cleanup(installId);
    }, 60_000); // 1 分钟后清理
  }

  /**
   * 向所有活跃控制器推送 SSE 数据
   */
  private pushToControllers(
    controllers: Set<ReadableStreamDefaultController>,
    data: string
  ): void {
    for (const controller of controllers) {
      try {
        controller.enqueue(data);
      } catch {
        // 流可能已被取消或关闭，从集合中移除
        controllers.delete(controller);
      }
    }
  }

  /**
   * 格式化 SSE 事件数据
   *
   * 输出格式：
   * event: <type>\n
   * data: <json>\n\n
   */
  private formatSSEEvent(type: string, data: unknown): string {
    return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  }
}
