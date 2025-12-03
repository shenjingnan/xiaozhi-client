/**
 * 路由聚合器
 * 负责创建和管理所有路由模块实例
 */

import type { BaseRoute } from "./BaseRoute.js";
import type { HandlerDependencies } from "./types.js";

// 导入所有路由模块
import { ConfigRoutes } from "./domains/config/index.js";
import { CozeRoutes } from "./domains/coze/index.js";
import { EndpointRoutes } from "./domains/endpoint/index.js";
import { MCPRoutes } from "./domains/mcp/index.js";
import { MCPServerRoutes } from "./domains/mcpserver/index.js";
import { ServicesRoutes } from "./domains/services/index.js";
import { StaticRoutes } from "./domains/static/index.js";
import { StatusRoutes } from "./domains/status/index.js";
import { ToolLogsRoutes } from "./domains/toollogs/index.js";
import { ToolsRoutes } from "./domains/tools/index.js";
import { UpdateRoutes } from "./domains/update/index.js";
import { VersionRoutes } from "./domains/version/index.js";

/**
 * 路由聚合器类
 * 负责创建和提供所有路由模块的实例
 */
export class RouteAggregator {
  private dependencies: HandlerDependencies;

  /**
   * 构造函数
   * @param dependencies 处理器依赖
   */
  constructor(dependencies: HandlerDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * 创建所有路由模块实例
   * @returns 路由模块数组
   */
  createAllRoutes(): BaseRoute[] {
    const routes: BaseRoute[] = [];

    try {
      // 配置管理路由
      routes.push(new ConfigRoutes(this.dependencies));

      // 状态查询路由
      routes.push(new StatusRoutes(this.dependencies));

      // 工具调用路由
      routes.push(new ToolsRoutes(this.dependencies));

      // MCP 协议路由
      routes.push(new MCPRoutes(this.dependencies));

      // 服务管理路由
      routes.push(new ServicesRoutes(this.dependencies));

      // 版本信息路由
      routes.push(new VersionRoutes(this.dependencies));

      // 端点管理路由
      routes.push(new EndpointRoutes(this.dependencies));

      // 更新管理路由
      routes.push(new UpdateRoutes(this.dependencies));

      // 扣子 API 路由
      routes.push(new CozeRoutes(this.dependencies));

      // 工具调用日志路由
      routes.push(new ToolLogsRoutes(this.dependencies));

      // MCP 服务器管理路由
      routes.push(new MCPServerRoutes(this.dependencies));

      // 静态文件路由（放在最后作为回退）
      routes.push(new StaticRoutes(this.dependencies));
    } catch (error) {
      console.error("创建路由模块时发生错误:", error);
      throw error;
    }

    return routes;
  }

  /**
   * 创建指定类型的路由模块
   * @param routeType 路由类型
   * @returns 路由模块实例
   */
  createRoute(routeType: string): BaseRoute {
    // 在这些模块创建完成后，将取消注释并添加相应导入
    switch (routeType) {
      case "config":
        return new ConfigRoutes(this.dependencies);

      case "status":
        return new StatusRoutes(this.dependencies);

      case "tools":
        return new ToolsRoutes(this.dependencies);

      case "mcp":
        return new MCPRoutes(this.dependencies);

      case "services":
        return new ServicesRoutes(this.dependencies);

      case "version":
        return new VersionRoutes(this.dependencies);

      case "endpoint":
        return new EndpointRoutes(this.dependencies);

      case "update":
        return new UpdateRoutes(this.dependencies);

      case "coze":
        return new CozeRoutes(this.dependencies);

      case "toollogs":
        return new ToolLogsRoutes(this.dependencies);

      case "mcpserver":
        return new MCPServerRoutes(this.dependencies);

      case "static":
        return new StaticRoutes(this.dependencies);

      default:
        throw new Error(`未知的路由类型: ${routeType}`);
    }
  }

  /**
   * 获取所有可用的路由类型
   * @returns 路由类型数组
   */
  getAvailableRouteTypes(): string[] {
    return [
      "config",
      "status",
      "tools",
      "mcp",
      "services",
      "version",
      "endpoint",
      "update",
      "coze",
      "toollogs",
      "mcpserver",
      "static",
    ];
  }

  /**
   * 检查指定的路由类型是否可用
   * @param routeType 路由类型
   * @returns 是否可用
   */
  isRouteTypeAvailable(routeType: string): boolean {
    return this.getAvailableRouteTypes().includes(routeType);
  }

  /**
   * 获取依赖引用
   * @returns 处理器依赖
   */
  getDependencies(): HandlerDependencies {
    return this.dependencies;
  }

  /**
   * 更新依赖引用
   * @param dependencies 新的处理器依赖
   */
  updateDependencies(dependencies: HandlerDependencies): void {
    this.dependencies = dependencies;
  }
}
