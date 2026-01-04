/**
 * 命令处理器工厂
 */

import type {
  CommandHandler,
  ICommandHandlerFactory,
} from "../interfaces/Command";
import type { IDIContainer } from "../interfaces/Config";

/**
 * 命令处理器工厂实现
 */
export class CommandHandlerFactory implements ICommandHandlerFactory {
  constructor(private container: IDIContainer) {}

  /**
   * 创建所有命令处理器
   */
  createHandlers(): CommandHandler[] {
    return [
      this.createHandler("service"),
      this.createHandler("config"),
      this.createHandler("project"),
      this.createHandler("mcp"),
      this.createHandler("endpoint"),
    ];
  }

  /**
   * 创建指定类型的命令处理器
   */
  createHandler(type: string): CommandHandler {
    switch (type) {
      case "service":
        return this.createServiceCommandHandler();
      case "config":
        return this.createConfigCommandHandler();
      case "project":
        return this.createProjectCommandHandler();
      case "mcp":
        return this.createMcpCommandHandler();
      case "endpoint":
        return this.createEndpointCommandHandler();
      default:
        throw new Error(`未知的命令处理器类型: ${type}`);
    }
  }

  /**
   * 创建服务命令处理器
   */
  private createServiceCommandHandler(): CommandHandler {
    // 动态导入以避免循环依赖
    const {
      ServiceCommandHandler,
    } = require("./ServiceCommandHandler.js");
    return new ServiceCommandHandler(this.container);
  }

  /**
   * 创建配置命令处理器
   */
  private createConfigCommandHandler(): CommandHandler {
    const {
      ConfigCommandHandler,
    } = require("./ConfigCommandHandler.js");
    return new ConfigCommandHandler(this.container);
  }

  /**
   * 创建项目命令处理器
   */
  private createProjectCommandHandler(): CommandHandler {
    const {
      ProjectCommandHandler,
    } = require("./ProjectCommandHandler.js");
    return new ProjectCommandHandler(this.container);
  }

  /**
   * 创建MCP命令处理器
   */
  private createMcpCommandHandler(): CommandHandler {
    const { McpCommandHandler } = require("./McpCommandHandler.js");
    return new McpCommandHandler(this.container);
  }

  /**
   * 创建端点命令处理器
   */
  private createEndpointCommandHandler(): CommandHandler {
    const {
      EndpointCommandHandler,
    } = require("./EndpointCommandHandler.js");
    return new EndpointCommandHandler(this.container);
  }
}
