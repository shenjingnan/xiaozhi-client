/**
 * 配置管理路由模块
 * 处理所有配置相关的 API 路由
 * 简化版本：移除继承，直接导出路由配置
 */

import type { Context } from "hono";
import type { AppContext } from "../../types/hono.context.js";
import type { HandlerDependencies, RouteConfig } from "../types.js";

/**
 * 配置管理路由配置
 * 从原有的 ConfigRoutes 类迁移而来，保持功能完全一致
 */
export const configRoutes: RouteConfig = {
  name: "config",
  path: "/api/config",
  description: "配置管理相关 API",
  routes: [
    {
      method: "GET",
      path: "",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.getConfig(c);
      },
    },
    {
      method: "PUT",
      path: "",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.updateConfig(c);
      },
    },
    {
      method: "GET",
      path: "/mcp-endpoint",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.getMcpEndpoint(c);
      },
    },
    {
      method: "GET",
      path: "/mcp-endpoints",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.getMcpEndpoints(c);
      },
    },
    {
      method: "GET",
      path: "/mcp-servers",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.getMcpServers(c);
      },
    },
    {
      method: "GET",
      path: "/connection",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.getConnectionConfig(c);
      },
    },
    {
      method: "POST",
      path: "/reload",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.reloadConfig(c);
      },
    },
    {
      method: "GET",
      path: "/path",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.getConfigPath(c);
      },
    },
    {
      method: "GET",
      path: "/exists",
      handler: (c: Context<AppContext>) => {
        const dependencies = c.get("dependencies") as HandlerDependencies;
        const { configApiHandler } = dependencies;
        return configApiHandler.checkConfigExists(c);
      },
    },
  ],
};
