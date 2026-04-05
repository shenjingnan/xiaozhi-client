/**
 * 错误消息管理
 */

import { ERROR_CODES } from "../Constants.js";

/**
 * 错误消息映射
 */
const ERROR_HELP_MESSAGES: Record<string, string> = {
  [ERROR_CODES.CONFIG_ERROR]: '运行 "xiaozhi --help" 查看配置相关命令',
  [ERROR_CODES.SERVICE_ERROR]: '运行 "xiaozhi status" 检查服务状态',
  [ERROR_CODES.VALIDATION_ERROR]: "检查输入参数是否正确",
  [ERROR_CODES.FILE_ERROR]: "检查文件路径和权限",
  [ERROR_CODES.PROCESS_ERROR]: "检查进程状态和权限",
  [ERROR_CODES.NETWORK_ERROR]: "检查网络连接和防火墙设置",
  [ERROR_CODES.PERMISSION_ERROR]: "尝试使用管理员权限运行",
};

/**
 * 常见问题解决方案
 */
const COMMON_SOLUTIONS: Record<string, string[]> = {
  config_not_found: [
    '运行 "xiaozhi init" 初始化配置文件',
    "检查当前目录是否为项目根目录",
    "设置 XIAOZHI_CONFIG_DIR 环境变量指定配置目录",
  ],
  service_port_occupied: [
    "检查端口是否被其他程序占用",
    '使用 "lsof -i :端口号" 查看端口使用情况',
    "更改配置文件中的端口设置",
  ],
  permission_denied: [
    "检查文件和目录权限",
    "使用 sudo 或管理员权限运行",
    "确保当前用户有足够的权限",
  ],
  service_start_failed: [
    "检查配置文件格式是否正确",
    "查看日志文件获取详细错误信息",
    "确保所有依赖服务正常运行",
  ],
};

/**
 * 错误消息管理类
 */
export class ERROR_MESSAGES {
  /**
   * 获取错误码对应的帮助信息
   */
  static getHelpMessage(errorCode: string): string | undefined {
    return ERROR_HELP_MESSAGES[errorCode];
  }

  /**
   * 获取常见问题的解决方案
   */
  static getSolutions(problemKey: string): string[] {
    return COMMON_SOLUTIONS[problemKey] || [];
  }

  /**
   * 格式化错误消息
   */
  static formatError(error: Error, context?: string): string {
    const contextPrefix = context ? `[${context}] ` : "";
    return `${contextPrefix}${error.message}`;
  }

  /**
   * 获取友好的错误描述
   */
  static getFriendlyMessage(errorCode: string): string {
    const friendlyMessages: Record<string, string> = {
      [ERROR_CODES.CONFIG_ERROR]: "配置文件相关错误",
      [ERROR_CODES.SERVICE_ERROR]: "服务运行相关错误",
      [ERROR_CODES.VALIDATION_ERROR]: "输入验证错误",
      [ERROR_CODES.FILE_ERROR]: "文件操作错误",
      [ERROR_CODES.PROCESS_ERROR]: "进程管理错误",
      [ERROR_CODES.NETWORK_ERROR]: "网络连接错误",
      [ERROR_CODES.PERMISSION_ERROR]: "权限不足错误",
    };

    return friendlyMessages[errorCode] || "未知错误";
  }

  /**
   * 检查是否为可恢复错误
   */
  static isRecoverable(errorCode: string): boolean {
    const recoverableErrors: string[] = [
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.FILE_ERROR,
      ERROR_CODES.SERVICE_ERROR,
    ];

    return recoverableErrors.includes(errorCode);
  }

  /**
   * 获取错误的严重程度
   */
  static getSeverity(
    errorCode: string
  ): "low" | "medium" | "high" | "critical" {
    const severityMap: Record<string, "low" | "medium" | "high" | "critical"> =
      {
        [ERROR_CODES.VALIDATION_ERROR]: "low",
        [ERROR_CODES.FILE_ERROR]: "medium",
        [ERROR_CODES.CONFIG_ERROR]: "medium",
        [ERROR_CODES.NETWORK_ERROR]: "medium",
        [ERROR_CODES.SERVICE_ERROR]: "high",
        [ERROR_CODES.PROCESS_ERROR]: "high",
        [ERROR_CODES.PERMISSION_ERROR]: "critical",
      };

    return severityMap[errorCode] || "medium";
  }
}
