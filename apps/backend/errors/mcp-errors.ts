/**
 * MCP服务错误类型定义
 *
 * 本模块提供了统一的错误处理框架，包括：
 * - 标准化的错误代码和分类
 * - 结构化的错误信息
 * - 可扩展的错误处理器
 * - 错误转换和格式化工具
 *
 * @module mcp-errors
 */

/**
 * MCP错误代码枚举
 *
 * 定义了所有MCP服务相关的错误代码，用于错误分类和处理。
 * 错误代码按功能区域分组：配置、连接、操作、系统等。
 */
export enum MCPErrorCode {
  // 配置错误 - 服务配置相关的问题
  /** 服务已存在，尝试添加重复服务时使用 */
  SERVER_ALREADY_EXISTS = "SERVER_ALREADY_EXISTS",
  /** 服务未找到，操作不存在的服务时使用 */
  SERVER_NOT_FOUND = "SERVER_NOT_FOUND",
  /** 配置格式无效或内容不正确 */
  INVALID_CONFIG = "INVALID_CONFIG",
  /** 服务名称不符合规范 */
  INVALID_SERVICE_NAME = "INVALID_SERVICE_NAME",

  // 连接错误 - 网络连接和服务通信问题
  /** 无法建立到服务的连接 */
  CONNECTION_FAILED = "CONNECTION_FAILED",
  /** 连接超时 */
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT",
  /** 服务暂时不可用 */
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // 操作错误 - 服务操作过程中的问题
  /** 一般操作失败 */
  OPERATION_FAILED = "OPERATION_FAILED",
  /** 服务添加操作失败 */
  ADD_FAILED = "ADD_FAILED",
  /** 服务移除操作失败 */
  REMOVE_FAILED = "REMOVE_FAILED",
  /** 工具同步操作失败 */
  SYNC_FAILED = "SYNC_FAILED",

  // 系统错误 - 内部系统问题
  /** 内部系统错误 */
  INTERNAL_ERROR = "INTERNAL_ERROR",
  /** 配置更新操作失败 */
  CONFIG_UPDATE_FAILED = "CONFIG_UPDATE_FAILED",

  // 工具同步错误 - 工具管理相关错误
  /** 工具同步失败 */
  TOOL_SYNC_FAILED = "TOOL_SYNC_FAILED",
  /** 工具验证失败 */
  TOOL_VALIDATION_FAILED = "TOOL_VALIDATION_FAILED",
  /** 工具未找到 */
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
}

/**
 * MCP错误严重级别
 */
export enum ErrorSeverity {
  LOW = "low", // 轻微错误，不影响主要功能
  MEDIUM = "medium", // 中等错误，影响部分功能
  HIGH = "high", // 严重错误，影响核心功能
  CRITICAL = "critical", // 致命错误，系统无法继续运行
}

/**
 * MCP错误类别
 */
export enum ErrorCategory {
  CONFIGURATION = "configuration", // 配置相关错误
  CONNECTION = "connection", // 连接相关错误
  VALIDATION = "validation", // 验证相关错误
  OPERATION = "operation", // 操作相关错误
  SYSTEM = "system", // 系统相关错误
  EXTERNAL = "external", // 外部服务错误
}

/**
 * 错误详情接口
 */
export interface ErrorDetails {
  serverName?: string;
  config?: unknown;
  tools?: string[];
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  stack?: string;
  context?: Record<string, unknown>;
  operation?: string;
  errors?: string[];
}

/**
 * 标准化的MCP错误类
 */
export class MCPError extends Error {
  public readonly code: MCPErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly details: ErrorDetails;
  public readonly timestamp: string;

  constructor(
    code: MCPErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    details: Partial<ErrorDetails> = {}
  ) {
    super(message);
    this.name = "MCPError";
    this.code = code;
    this.severity = severity;
    this.category = category;
    this.timestamp = new Date().toISOString();

    // 合并详情信息
    this.details = {
      ...details,
      timestamp: this.timestamp,
      severity: this.severity,
      category: this.category,
      stack: this.stack,
    };

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  /**
   * 创建配置错误
   */
  static configError(
    code: MCPErrorCode,
    message: string,
    details: Partial<ErrorDetails> = {}
  ): MCPError {
    return new MCPError(
      code,
      message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.CONFIGURATION,
      details
    );
  }

  /**
   * 创建连接错误
   */
  static connectionError(
    code: MCPErrorCode,
    message: string,
    details: Partial<ErrorDetails> = {}
  ): MCPError {
    return new MCPError(
      code,
      message,
      ErrorSeverity.HIGH,
      ErrorCategory.CONNECTION,
      details
    );
  }

  /**
   * 创建操作错误
   */
  static operationError(
    code: MCPErrorCode,
    message: string,
    details: Partial<ErrorDetails> = {}
  ): MCPError {
    return new MCPError(
      code,
      message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.OPERATION,
      details
    );
  }

  /**
   * 创建系统错误
   */
  static systemError(
    code: MCPErrorCode,
    message: string,
    details: Partial<ErrorDetails> = {}
  ): MCPError {
    return new MCPError(
      code,
      message,
      ErrorSeverity.HIGH,
      ErrorCategory.SYSTEM,
      details
    );
  }

  /**
   * 创建验证错误
   */
  static validationError(
    code: MCPErrorCode,
    message: string,
    details: Partial<ErrorDetails> = {}
  ): MCPError {
    return new MCPError(
      code,
      message,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      details
    );
  }

  /**
   * 从普通错误创建MCPError
   */
  static fromError(
    error: Error,
    defaultCode: MCPErrorCode = MCPErrorCode.INTERNAL_ERROR,
    category: ErrorCategory = ErrorCategory.SYSTEM
  ): MCPError {
    return new MCPError(
      defaultCode,
      error.message,
      ErrorSeverity.MEDIUM,
      category,
      {
        stack: error.stack,
        context: { originalError: error.name },
      }
    );
  }
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(error: Error, context?: Record<string, unknown>): MCPError | null;
}

/**
 * 默认错误处理器
 */
export class DefaultErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return !(error instanceof MCPError);
  }

  handle(error: Error, _context?: Record<string, unknown>): MCPError {
    return MCPError.fromError(
      error,
      MCPErrorCode.INTERNAL_ERROR,
      ErrorCategory.SYSTEM
    );
  }
}

/**
 * 配置错误处理器
 */
export class ConfigErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return (
      error.message.includes("配置") ||
      error.message.includes("config") ||
      error.message.includes("JSON") ||
      error.message.includes("解析")
    );
  }

  handle(error: Error, context?: Record<string, unknown>): MCPError {
    return MCPError.configError(
      MCPErrorCode.INVALID_CONFIG,
      `配置错误: ${error.message}`,
      { context }
    );
  }
}

/**
 * 连接错误处理器
 */
export class ConnectionErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return (
      error.message.includes("连接") ||
      error.message.includes("connection") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND")
    );
  }

  handle(error: Error, context?: Record<string, unknown>): MCPError {
    return MCPError.connectionError(
      MCPErrorCode.CONNECTION_FAILED,
      `连接失败: ${error.message}`,
      { context }
    );
  }
}

/**
 * 错误处理器注册表
 */
export class ErrorHandlerRegistry {
  private handlers: ErrorHandler[] = [];

  constructor() {
    // 注册默认处理器
    this.registerHandler(new ConfigErrorHandler());
    this.registerHandler(new ConnectionErrorHandler());
    this.registerHandler(new DefaultErrorHandler());
  }

  /**
   * 注册错误处理器
   */
  registerHandler(handler: ErrorHandler): void {
    this.handlers.unshift(handler); // 添加到前面，优先处理
  }

  /**
   * 处理错误
   */
  handleError(error: Error, context?: Record<string, unknown>): MCPError {
    // 如果已经是MCPError，直接返回
    if (error instanceof MCPError) {
      return error;
    }

    // 查找合适的处理器
    for (const handler of this.handlers) {
      if (handler.canHandle(error)) {
        const result = handler.handle(error, context);
        if (result) {
          return result;
        }
      }
    }

    // 如果没有处理器能处理，使用默认处理器
    return new DefaultErrorHandler().handle(error, context);
  }
}

/**
 * 全局错误处理器实例
 */
export const globalErrorHandler = new ErrorHandlerRegistry();
