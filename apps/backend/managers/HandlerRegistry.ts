/**
 * Handler 注册表
 *
 * 负责管理和提供 HTTP API 处理器的依赖注入，包括：
 * - 配置 API 处理器
 * - 状态 API 处理器
 * - 服务 API 处理器
 * - MCP 工具处理器
 * - MCP 工具日志处理器
 * - 版本 API 处理器
 * - 静态文件处理器
 * - MCP 路由处理器
 * - MCP 处理器
 * - 更新 API 处理器
 * - Coze 处理器
 * - TTS API 处理器
 *
 * @example
 * ```typescript
 * const registry = new HandlerRegistry();
 * registry.register('configApiHandler', new ConfigApiHandler());
 * const handler = registry.get('configApiHandler');
 * ```
 */

import type { HandlerDependencies } from "../routes/index.js";
import type { ConfigApiHandler } from "../handlers/config.handler.js";
import type { StatusApiHandler } from "../handlers/status.handler.js";
import type { ServiceApiHandler } from "../handlers/service.handler.js";
import type { MCPToolHandler } from "../handlers/mcp-tool.handler.js";
import type { MCPToolLogHandler } from "../handlers/mcp-tool-log.handler.js";
import type { VersionApiHandler } from "../handlers/version.handler.js";
import type { StaticFileHandler } from "../handlers/static-file.handler.js";
import type { MCPRouteHandler } from "../handlers/index.js";
import type { MCPHandler } from "../handlers/mcp-manage.handler.js";
import type { UpdateApiHandler } from "../handlers/update.handler.js";
import type { CozeHandler } from "../handlers/coze.handler.js";
import type { TTSApiHandler } from "../handlers/tts.handler.js";

/**
 * Handler 名称类型
 */
export type HandlerName =
  | "configApiHandler"
  | "statusApiHandler"
  | "serviceApiHandler"
  | "mcpToolHandler"
  | "mcpToolLogHandler"
  | "versionApiHandler"
  | "staticFileHandler"
  | "mcpRouteHandler"
  | "mcpHandler"
  | "updateApiHandler"
  | "cozeHandler"
  | "ttsApiHandler";

/**
 * Handler 注册表
 *
 * 提供类型安全的 Handler 管理和依赖注入
 */
export class HandlerRegistry {
  private handlers = new Map<HandlerName, unknown>();

  /**
   * 注册 Handler
   *
   * @param name - Handler 名称
   * @param handler - Handler 实例
   */
  register<T extends HandlerName>(name: T, handler: HandlerRegistryType<T>): void {
    this.handlers.set(name, handler);
  }

  /**
   * 获取 Handler
   *
   * @param name - Handler 名称
   * @returns Handler 实例
   * @throws {Error} 如果 Handler 未注册
   */
  get<T extends HandlerName>(name: T): HandlerRegistryType<T> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Handler '${name}' 未注册`);
    }
    return handler as HandlerRegistryType<T>;
  }

  /**
   * 检查 Handler 是否已注册
   *
   * @param name - Handler 名称
   * @returns 是否已注册
   */
  has(name: HandlerName): boolean {
    return this.handlers.has(name);
  }

  /**
   * 移除 Handler
   *
   * @param name - Handler 名称
   */
  unregister(name: HandlerName): void {
    this.handlers.delete(name);
  }

  /**
   * 创建 Handler 依赖对象
   *
   * 此方法统一管理依赖对象的创建，避免代码重复
   *
   * @returns Handler 依赖对象
   */
  createDependencies(): HandlerDependencies {
    return {
      configApiHandler: this.get("configApiHandler"),
      statusApiHandler: this.get("statusApiHandler"),
      serviceApiHandler: this.get("serviceApiHandler"),
      mcpToolHandler: this.get("mcpToolHandler"),
      mcpToolLogHandler: this.get("mcpToolLogHandler"),
      versionApiHandler: this.get("versionApiHandler"),
      staticFileHandler: this.get("staticFileHandler"),
      mcpRouteHandler: this.get("mcpRouteHandler"),
      mcpHandler: this.get("mcpHandler"),
      updateApiHandler: this.get("updateApiHandler"),
      cozeHandler: this.get("cozeHandler"),
      ttsApiHandler: this.get("ttsApiHandler"),
      // endpointHandler 通过中间件动态注入，不在此初始化
    };
  }

  /**
   * 清空所有注册的 Handler
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Handler 类型映射
 * 用于提供类型安全的 get 方法
 */
type HandlerRegistryType<T extends HandlerName> = T extends "configApiHandler"
  ? ConfigApiHandler
  : T extends "statusApiHandler"
    ? StatusApiHandler
    : T extends "serviceApiHandler"
      ? ServiceApiHandler
      : T extends "mcpToolHandler"
        ? MCPToolHandler
        : T extends "mcpToolLogHandler"
          ? MCPToolLogHandler
          : T extends "versionApiHandler"
            ? VersionApiHandler
            : T extends "staticFileHandler"
              ? StaticFileHandler
              : T extends "mcpRouteHandler"
                ? MCPRouteHandler
                : T extends "mcpHandler"
                  ? MCPHandler
                  : T extends "updateApiHandler"
                    ? UpdateApiHandler
                    : T extends "cozeHandler"
                      ? CozeHandler
                      : T extends "ttsApiHandler"
                        ? TTSApiHandler
                        : never;
