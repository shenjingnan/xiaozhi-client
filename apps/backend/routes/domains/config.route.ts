/**
 * 配置管理路由模块
 * 处理所有配置相关的 API 路由
 * 简化版本：移除继承，直接导出路由配置
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

/**
 * 配置管理路由配置
 * 从原有的 ConfigRoutes 类迁移而来，保持功能完全一致
 */
export const configRoutes: SimpleRouteConfig = {
  name: "config",
  path: "/api/config",
  description: "配置管理相关 API",
  routes: [
    {
      method: "GET",
      path: "",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.getConfig(c);
      },
    },
    {
      method: "PUT",
      path: "",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.updateConfig(c);
      },
    },
    {
      method: "GET",
      path: "/mcp-endpoint",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.getMcpEndpoint(c);
      },
    },
    {
      method: "GET",
      path: "/mcp-endpoints",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.getMcpEndpoints(c);
      },
    },
    {
      method: "GET",
      path: "/mcp-servers",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.getMcpServers(c);
      },
    },
    {
      method: "GET",
      path: "/connection",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.getConnectionConfig(c);
      },
    },
    {
      method: "POST",
      path: "/reload",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.reloadConfig(c);
      },
    },
    {
      method: "GET",
      path: "/path",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.getConfigPath(c);
      },
    },
    {
      method: "GET",
      path: "/exists",
      handler: (c: Context) => {
        const { configApiHandler } = c.get("dependencies") as any;
        return configApiHandler.checkConfigExists(c);
      },
    },
  ],
};