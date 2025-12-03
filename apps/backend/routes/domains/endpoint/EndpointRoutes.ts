/**
 * 端点管理路由模块
 * 处理所有端点管理相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 端点管理路由类
 * 负责注册端点管理相关的所有 API 路由
 */
export class EndpointRoutes extends BaseRoute {
  private endpointHandler?: any;

  /**
   * 获取端点管理路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    return {
      name: "endpoint",
      description: "端点管理相关 API",
      path: "/api/endpoint",
      routes: [
        {
          method: "POST",
          path: "/status",
          handler: (c) => this.handleEndpointStatus(c),
        },
        {
          method: "POST",
          path: "/connect",
          handler: (c) => this.handleEndpointConnect(c),
        },
        {
          method: "POST",
          path: "/disconnect",
          handler: (c) => this.handleEndpointDisconnect(c),
        },
        {
          method: "POST",
          path: "/reconnect",
          handler: (c) => this.handleEndpointReconnect(c),
        },
        {
          method: "POST",
          path: "/add",
          handler: (c) => this.handleEndpointAdd(c),
        },
        {
          method: "POST",
          path: "/remove",
          handler: (c) => this.handleEndpointRemove(c),
        },
      ],
    };
  }

  /**
   * 设置连接管理器（延迟初始化端点处理器）
   * @param connectionManager 连接管理器实例
   */
  setConnectionManager(connectionManager: any): void {
    this.endpointHandler =
      this.dependencies.createEndpointHandler(connectionManager);
  }

  /**
   * 处理获取接入点状态请求
   */
  private async handleEndpointStatus(c: any): Promise<Response> {
    if (!this.endpointHandler) {
      throw new Error("端点处理器未初始化，请先设置连接管理器");
    }
    return this.endpointHandler.getEndpointStatus(c);
  }

  /**
   * 处理接入点连接请求
   */
  private async handleEndpointConnect(c: any): Promise<Response> {
    if (!this.endpointHandler) {
      throw new Error("端点处理器未初始化，请先设置连接管理器");
    }
    return this.endpointHandler.connectEndpoint(c);
  }

  /**
   * 处理接入点断开请求
   */
  private async handleEndpointDisconnect(c: any): Promise<Response> {
    if (!this.endpointHandler) {
      throw new Error("端点处理器未初始化，请先设置连接管理器");
    }
    return this.endpointHandler.disconnectEndpoint(c);
  }

  /**
   * 处理接入点重连请求
   */
  private async handleEndpointReconnect(c: any): Promise<Response> {
    if (!this.endpointHandler) {
      throw new Error("端点处理器未初始化，请先设置连接管理器");
    }
    return this.endpointHandler.reconnectEndpoint(c);
  }

  /**
   * 处理添加接入点请求
   */
  private async handleEndpointAdd(c: any): Promise<Response> {
    if (!this.endpointHandler) {
      throw new Error("端点处理器未初始化，请先设置连接管理器");
    }
    return await this.endpointHandler.addEndpoint(c);
  }

  /**
   * 处理移除接入点请求
   */
  private async handleEndpointRemove(c: any): Promise<Response> {
    if (!this.endpointHandler) {
      throw new Error("端点处理器未初始化，请先设置连接管理器");
    }
    return this.endpointHandler.removeEndpoint(c);
  }
}
