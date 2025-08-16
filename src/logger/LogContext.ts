import { AsyncLocalStorage } from "node:async_hooks";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
  flags?: number;
}

export interface UserContext {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  roles?: string[];
  permissions?: string[];
}

export interface RequestContext {
  requestId: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  startTime: Date;
  correlationId?: string;
}

export interface BusinessContext {
  operation?: string;
  module?: string;
  feature?: string;
  version?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

export interface LogContextData {
  trace?: TraceContext;
  user?: UserContext;
  request?: RequestContext;
  business?: BusinessContext;
  custom?: Record<string, any>;
}

export interface ContextConfig {
  enabled: boolean;
  traceIdHeader: string;
  spanIdHeader: string;
  correlationIdHeader: string;
  userIdHeader: string;
  sessionIdHeader: string;
  generateTraceId: () => string;
  generateSpanId: () => string;
  generateRequestId: () => string;
}

export class LogContext {
  private static instance: LogContext;
  private asyncLocalStorage: AsyncLocalStorage<LogContextData>;
  private config: ContextConfig;

  private constructor(config?: Partial<ContextConfig>) {
    this.asyncLocalStorage = new AsyncLocalStorage<LogContextData>();
    this.config = {
      enabled: true,
      traceIdHeader: "x-trace-id",
      spanIdHeader: "x-span-id",
      correlationIdHeader: "x-correlation-id",
      userIdHeader: "x-user-id",
      sessionIdHeader: "x-session-id",
      generateTraceId: this.generateId,
      generateSpanId: this.generateId,
      generateRequestId: this.generateId,
      ...config,
    };
  }

  static getInstance(config?: Partial<ContextConfig>): LogContext {
    if (!LogContext.instance) {
      LogContext.instance = new LogContext(config);
    }
    return LogContext.instance;
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  // 生成符合OpenTelemetry标准的trace ID (32位十六进制)
  private generateTraceId(): string {
    const timestamp = Date.now().toString(16).padStart(8, "0");
    const random = Math.random()
      .toString(16)
      .substring(2, 18)
      .padStart(16, "0");
    return timestamp + random;
  }

  // 生成符合OpenTelemetry标准的span ID (16位十六进制)
  private generateSpanId(): string {
    return Math.random().toString(16).substring(2, 18).padStart(16, "0");
  }

  // 运行带上下文的函数
  run<T>(context: LogContextData, fn: () => T): T {
    if (!this.config.enabled) {
      return fn();
    }
    return this.asyncLocalStorage.run(context, fn);
  }

  // 运行带上下文的异步函数
  async runAsync<T>(context: LogContextData, fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return fn();
    }
    return this.asyncLocalStorage.run(context, fn);
  }

  // 获取当前上下文
  getContext(): LogContextData | undefined {
    if (!this.config.enabled) {
      return undefined;
    }
    return this.asyncLocalStorage.getStore();
  }

  // 更新当前上下文
  updateContext(updates: Partial<LogContextData>): void {
    if (!this.config.enabled) {
      return;
    }

    const current = this.getContext() || {};
    const updated = this.mergeContext(current, updates);

    // 由于AsyncLocalStorage不支持直接更新，我们需要在当前上下文中运行
    this.asyncLocalStorage.enterWith(updated);
  }

  // 合并上下文数据
  private mergeContext(
    current: LogContextData,
    updates: Partial<LogContextData>
  ): LogContextData {
    return {
      trace: updates.trace
        ? { ...current.trace, ...updates.trace }
        : current.trace,
      user: updates.user ? { ...current.user, ...updates.user } : current.user,
      request: updates.request
        ? { ...current.request, ...updates.request }
        : current.request,
      business: updates.business
        ? { ...current.business, ...updates.business }
        : current.business,
      custom: updates.custom
        ? { ...current.custom, ...updates.custom }
        : current.custom,
    };
  }

  // 从HTTP请求头创建上下文
  createContextFromHeaders(
    headers: Record<string, string | string[] | undefined>
  ): LogContextData {
    const getHeader = (name: string): string | undefined => {
      const value = headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };

    const traceId =
      getHeader(this.config.traceIdHeader) || this.generateTraceId();
    const spanId = getHeader(this.config.spanIdHeader) || this.generateSpanId();
    const correlationId = getHeader(this.config.correlationIdHeader);
    const userId = getHeader(this.config.userIdHeader);
    const sessionId = getHeader(this.config.sessionIdHeader);

    return {
      trace: {
        traceId,
        spanId,
      },
      user: {
        userId,
        sessionId,
        userAgent: getHeader("user-agent"),
        ip: getHeader("x-forwarded-for") || getHeader("x-real-ip"),
      },
      request: {
        requestId: this.config.generateRequestId(),
        correlationId,
        startTime: new Date(),
        headers: this.sanitizeHeaders(headers),
      },
    };
  }

  // 清理敏感的请求头
  private sanitizeHeaders(
    headers: Record<string, string | string[] | undefined>
  ): Record<string, string> {
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
      "x-access-token",
    ];

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = Array.isArray(value) ? value[0] || "" : value || "";
      }
    }
    return sanitized;
  }

  // 创建子span
  createChildSpan(
    operation: string,
    metadata?: Record<string, any>
  ): LogContextData {
    const current = this.getContext();
    const parentSpanId = current?.trace?.spanId;
    const traceId = current?.trace?.traceId || this.generateTraceId();

    return {
      ...current,
      trace: {
        ...current?.trace,
        traceId,
        spanId: this.generateSpanId(),
        parentSpanId,
      },
      business: {
        ...current?.business,
        operation,
        metadata: {
          ...current?.business?.metadata,
          ...metadata,
        },
      },
    };
  }

  // 设置用户上下文
  setUserContext(user: UserContext): void {
    this.updateContext({ user });
  }

  // 设置业务上下文
  setBusinessContext(business: BusinessContext): void {
    this.updateContext({ business });
  }

  // 设置自定义上下文
  setCustomContext(custom: Record<string, any>): void {
    this.updateContext({ custom });
  }

  // 获取追踪信息用于日志
  getTraceInfo(): { traceId?: string; spanId?: string; parentSpanId?: string } {
    const context = this.getContext();
    return {
      traceId: context?.trace?.traceId,
      spanId: context?.trace?.spanId,
      parentSpanId: context?.trace?.parentSpanId,
    };
  }

  // 获取用户信息用于日志
  getUserInfo(): {
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    ip?: string;
  } {
    const context = this.getContext();
    return {
      userId: context?.user?.userId,
      sessionId: context?.user?.sessionId,
      userAgent: context?.user?.userAgent,
      ip: context?.user?.ip,
    };
  }

  // 获取请求信息用于日志
  getRequestInfo(): {
    requestId?: string;
    method?: string;
    url?: string;
    correlationId?: string;
  } {
    const context = this.getContext();
    return {
      requestId: context?.request?.requestId,
      method: context?.request?.method,
      url: context?.request?.url,
      correlationId: context?.request?.correlationId,
    };
  }

  // 获取业务信息用于日志
  getBusinessInfo(): {
    operation?: string;
    module?: string;
    feature?: string;
    version?: string;
  } {
    const context = this.getContext();
    return {
      operation: context?.business?.operation,
      module: context?.business?.module,
      feature: context?.business?.feature,
      version: context?.business?.version,
    };
  }

  // 获取所有上下文信息用于日志
  getContextForLogging(): Record<string, any> {
    const context = this.getContext();
    if (!context) {
      return {};
    }

    return {
      ...this.getTraceInfo(),
      ...this.getUserInfo(),
      ...this.getRequestInfo(),
      ...this.getBusinessInfo(),
      custom: context.custom,
    };
  }

  // 更新配置
  updateConfig(config: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 启用/禁用上下文追踪
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  // 清理当前上下文
  clear(): void {
    if (this.config.enabled) {
      this.asyncLocalStorage.enterWith({});
    }
  }

  // 中间件：为Express等框架提供上下文支持
  middleware() {
    return (req: any, res: any, next: any) => {
      if (!this.config.enabled) {
        return next();
      }

      const context = this.createContextFromHeaders(req.headers);
      context.request = {
        requestId:
          context.request?.requestId || this.config.generateRequestId(),
        startTime: context.request?.startTime || new Date(),
        ...context.request,
        method: req.method,
        url: req.url || req.originalUrl,
      };

      this.run(context, () => {
        // 在响应头中添加追踪信息
        if (context.trace?.traceId) {
          res.setHeader(this.config.traceIdHeader, context.trace.traceId);
        }
        if (context.request?.requestId) {
          res.setHeader("x-request-id", context.request.requestId);
        }

        next();
      });
    };
  }
}
