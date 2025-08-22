/**
 * 统一错误处理系统
 */

import { ERROR_CODES } from "../Constants.js";

/**
 * CLI 基础错误类
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode = 1,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = "CLIError";

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CLIError);
    }
  }

  /**
   * 创建带建议的错误
   */
  static withSuggestions(
    message: string,
    code: string,
    suggestions: string[]
  ): CLIError {
    return new CLIError(message, code, 1, suggestions);
  }
}

/**
 * 配置错误
 */
export class ConfigError extends CLIError {
  constructor(message: string, suggestions?: string[]) {
    super(message, ERROR_CODES.CONFIG_ERROR, 1, suggestions);
    this.name = "ConfigError";
  }

  static configNotFound(): ConfigError {
    return new ConfigError("配置文件不存在", [
      '请运行 "xiaozhi init" 初始化配置文件',
    ]);
  }

  static invalidFormat(format: string): ConfigError {
    return new ConfigError(`无效的配置文件格式: ${format}`, [
      "支持的格式: json, json5, jsonc",
    ]);
  }
}

/**
 * 服务错误
 */
export class ServiceError extends CLIError {
  constructor(message: string, suggestions?: string[]) {
    super(message, ERROR_CODES.SERVICE_ERROR, 1, suggestions);
    this.name = "ServiceError";
  }

  static alreadyRunning(pid: number): ServiceError {
    return new ServiceError(`服务已经在运行 (PID: ${pid})`, [
      '请先运行 "xiaozhi stop" 停止现有服务',
      '或者使用 "xiaozhi restart" 重启服务',
    ]);
  }

  static autoRestarting(pid: number): ServiceError {
    return new ServiceError(
      `检测到服务已在运行 (PID: ${pid})，正在自动重启...`,
      ["如果不希望自动重启，请使用 xiaozhi stop 手动停止服务"]
    );
  }

  static notRunning(): ServiceError {
    return new ServiceError("服务未运行", ['请运行 "xiaozhi start" 启动服务']);
  }

  static startFailed(reason: string): ServiceError {
    return new ServiceError(`服务启动失败: ${reason}`, [
      "检查配置文件是否正确",
      "确保端口未被占用",
      "查看日志文件获取详细信息",
    ]);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends CLIError {
  constructor(message: string, field: string) {
    super(`验证失败: ${field} - ${message}`, ERROR_CODES.VALIDATION_ERROR, 1);
    this.name = "ValidationError";
  }

  static invalidPort(port: number): ValidationError {
    return new ValidationError(
      `端口号必须在 1-65535 范围内，当前值: ${port}`,
      "port"
    );
  }

  static requiredField(field: string): ValidationError {
    return new ValidationError("必填字段不能为空", field);
  }
}

/**
 * 文件操作错误
 */
export class FileError extends CLIError {
  constructor(message: string, filePath?: string, suggestions?: string[]) {
    const fullMessage = filePath ? `${message}: ${filePath}` : message;
    super(fullMessage, ERROR_CODES.FILE_ERROR, 1, suggestions);
    this.name = "FileError";
  }

  static notFound(filePath: string): FileError {
    return new FileError("文件不存在", filePath, ["检查文件路径是否正确"]);
  }

  static permissionDenied(filePath: string): FileError {
    return new FileError("权限不足", filePath, [
      "检查文件权限或使用管理员权限运行",
    ]);
  }

  static alreadyExists(filePath: string): FileError {
    return new FileError("文件已存在", filePath, [
      "使用不同的文件名或删除现有文件",
    ]);
  }
}

/**
 * 进程错误
 */
export class ProcessError extends CLIError {
  constructor(message: string, pid?: number, suggestions?: string[]) {
    const fullMessage = pid ? `${message} (PID: ${pid})` : message;
    super(fullMessage, ERROR_CODES.PROCESS_ERROR, 1, suggestions);
    this.name = "ProcessError";
  }

  static killFailed(pid: number): ProcessError {
    return new ProcessError("无法终止进程", pid, [
      "进程可能已经停止或权限不足",
    ]);
  }

  static notFound(pid: number): ProcessError {
    return new ProcessError("进程不存在", pid);
  }
}
