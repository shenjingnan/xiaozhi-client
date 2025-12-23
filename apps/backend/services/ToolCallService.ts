/**
 * MCP 工具调用服务
 * 负责处理手动工具调用的核心逻辑
 */

import { configManager } from "@/lib/config/manager.js";
import { ProcessManagerImpl } from "@cli/services/ProcessManager.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";

// 工具调用结果接口
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * 工具调用服务类
 */
export class ToolCallService {
  private logger: Logger;
  private processManager: ProcessManagerImpl;
  private baseUrl: string;

  constructor() {
    this.logger = logger.withTag("ToolCallService");
    this.processManager = new ProcessManagerImpl();

    // 获取 Web 服务器的端口
    try {
      const webPort = configManager.getWebUIPort() ?? 9999;
      this.baseUrl = `http://localhost:${webPort}`;
    } catch (error) {
      this.baseUrl = "http://localhost:9999";
    }
  }

  /**
   * 调用 MCP 工具
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns 工具调用结果
   */
  async callTool(
    serviceName: string,
    toolName: string,
    args: any
  ): Promise<ToolCallResult> {
    // 1. 检查服务状态
    await this.validateServiceStatus();

    // 2. 通过 HTTP API 调用工具
    try {
      const response = await fetch(`${this.baseUrl}/api/tools/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceName,
          toolName,
          args,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const responseData = await response.json();

      if (!responseData.success) {
        throw new Error(responseData.error?.message || "工具调用失败");
      }

      return responseData.data;
    } catch (error) {
      this.logger.error(
        `工具调用失败: ${serviceName}/${toolName}`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 解析 JSON 参数
   * @param argsString JSON 字符串
   * @returns 解析后的参数对象
   */
  parseJsonArgs(argsString: string): any {
    try {
      return JSON.parse(argsString);
    } catch (error) {
      throw new Error(
        `参数格式错误，请使用有效的 JSON 格式。错误详情: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 验证服务状态
   * @private
   */
  private async validateServiceStatus(): Promise<void> {
    // 检查进程级别的服务状态
    const processStatus = this.processManager.getServiceStatus();
    if (!processStatus.running) {
      throw new Error(
        "xiaozhi 服务未启动。请先运行 'xiaozhi start' 或 'xiaozhi start -d' 启动服务。"
      );
    }

    // 检查 Web 服务器是否可访问
    try {
      const response = await fetch(`${this.baseUrl}/api/status`, {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5秒超时
      });

      if (!response.ok) {
        throw new Error(`Web 服务器响应错误: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("连接 xiaozhi 服务超时。请检查服务是否正常运行。");
      }
      throw new Error(
        `无法连接到 xiaozhi 服务。请检查服务状态。错误详情: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 格式化输出结果
   * @param result 工具调用结果
   * @returns 格式化后的字符串
   */
  formatOutput(result: ToolCallResult): string {
    return JSON.stringify(result);
  }

  /**
   * 获取服务状态信息
   * @returns 服务状态描述
   */
  async getServiceStatus(): Promise<string> {
    try {
      // 首先检查进程状态
      const processStatus = this.processManager.getServiceStatus();
      if (!processStatus.running) {
        return "服务未启动";
      }

      // 然后通过 HTTP API 检查服务状态
      try {
        const response = await fetch(`${this.baseUrl}/api/tools/list`, {
          method: "GET",
          signal: AbortSignal.timeout(3000), // 3秒超时
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            return `服务已启动 (PID: ${processStatus.pid}, ${data.data.totalTools} 个工具可用)`;
          }
        }

        return `服务进程运行中 (PID: ${processStatus.pid})，但 MCP 服务可能未完全初始化`;
      } catch (error) {
        return `服务进程运行中 (PID: ${processStatus.pid})，但无法连接到 Web API`;
      }
    } catch (error) {
      return `服务状态检查失败: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }
}
