/**
 * 配置管理路由模块
 * 处理所有配置相关的 API 路由
 */

import type { Context } from "hono";
import type { AppContext } from "../../types/hono.context.js";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

/**
 * 配置管理路由定义（扁平化版本）
 */
export const configRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/config",
    name: "config-get",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.getConfig(c);
    },
  },
  {
    method: "PUT",
    path: "/api/config",
    name: "config-update",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.updateConfig(c);
    },
  },
  {
    method: "GET",
    path: "/api/config/mcp-endpoint",
    name: "config-mcp-endpoint",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.getMcpEndpoint(c);
    },
  },
  {
    method: "GET",
    path: "/api/config/mcp-endpoints",
    name: "config-mcp-endpoints",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.getMcpEndpoints(c);
    },
  },
  {
    method: "GET",
    path: "/api/config/mcp-servers",
    name: "config-mcp-servers",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.getMcpServers(c);
    },
  },
  {
    method: "GET",
    path: "/api/config/connection",
    name: "config-connection",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.getConnectionConfig(c);
    },
  },
  {
    method: "POST",
    path: "/api/config/reload",
    name: "config-reload",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.reloadConfig(c);
    },
  },
  {
    method: "GET",
    path: "/api/config/path",
    name: "config-path",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.getConfigPath(c);
    },
  },
  {
    method: "GET",
    path: "/api/config/exists",
    name: "config-exists",
    handler: (c: Context<AppContext>) => {
      const dependencies = c.get("dependencies") as HandlerDependencies;
      const { configApiHandler } = dependencies;
      return configApiHandler.checkConfigExists(c);
    },
  },
];
