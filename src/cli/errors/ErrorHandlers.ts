/**
 * 错误处理器
 */

import chalk from "chalk";
import { ERROR_MESSAGES } from "./ErrorMessages";
import { CLIError } from "./index";

/**
 * 错误处理器类
 */
export class ErrorHandler {
  /**
   * 处理错误并退出程序
   */
  static handle(error: Error): never {
    if (error instanceof CLIError) {
      ErrorHandler.handleCLIError(error);
    } else {
      ErrorHandler.handleUnknownError(error);
    }

    process.exit(1);
  }

  /**
   * 处理 CLI 错误
   */
  private static handleCLIError(error: CLIError): void {
    console.error(chalk.red(`❌ 错误: ${error.message}`));

    // 显示错误码（调试模式）
    if (process.env.DEBUG) {
      console.error(chalk.gray(`错误码: ${error.code}`));
    }

    // 显示建议
    if (error.suggestions && error.suggestions.length > 0) {
      console.log(chalk.yellow("💡 建议:"));
      for (const suggestion of error.suggestions) {
        console.log(chalk.gray(`   ${suggestion}`));
      }
    }

    // 显示相关帮助信息
    const helpMessage = ERROR_MESSAGES.getHelpMessage(error.code);
    if (helpMessage) {
      console.log(chalk.blue(`ℹ️  ${helpMessage}`));
    }
  }

  /**
   * 处理未知错误
   */
  private static handleUnknownError(error: Error): void {
    console.error(chalk.red(`❌ 未知错误: ${error.message}`));

    // 在调试模式下显示完整堆栈
    if (process.env.DEBUG || process.env.NODE_ENV === "development") {
      console.error(chalk.gray("堆栈信息:"));
      console.error(chalk.gray(error.stack));
    } else {
      console.log(
        chalk.yellow("💡 提示: 设置 DEBUG=1 环境变量查看详细错误信息")
      );
    }
  }

  /**
   * 错误处理包装器
   */
  private static wrapError(error: unknown, context: string): CLIError {
    if (error instanceof CLIError) {
      return error;
    }
    if (error instanceof Error) {
      return new CLIError(
        `${context}失败: ${error.message}`,
        "OPERATION_FAILED",
        1
      );
    }
    return new CLIError(`${context}失败: 未知错误`, "OPERATION_FAILED", 1);
  }

  /**
   * 异步操作错误处理包装器
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw ErrorHandler.wrapError(error, context);
    }
  }

  /**
   * 同步操作错误处理包装器
   */
  static handleSync<T>(operation: () => T, context: string): T {
    try {
      return operation();
    } catch (error) {
      throw ErrorHandler.wrapError(error, context);
    }
  }

  /**
   * 警告处理
   */
  static warn(message: string, suggestions?: string[]): void {
    console.warn(chalk.yellow(`⚠️  警告: ${message}`));

    if (suggestions && suggestions.length > 0) {
      console.log(chalk.yellow("💡 建议:"));
      for (const suggestion of suggestions) {
        console.log(chalk.gray(`   ${suggestion}`));
      }
    }
  }

  /**
   * 信息提示
   */
  static info(message: string): void {
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  /**
   * 成功提示
   */
  static success(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }
}
