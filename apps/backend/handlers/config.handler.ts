/**
 * 配置 API HTTP 路由处理器
 * 提供配置读取、配置更新等配置相关的 RESTful API 接口
 */

import type { AppConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import type { Context } from "hono";
import type { AppContext } from "@/types/hono.context.js";
import {
  createPromptFile,
  deletePromptFile,
  listPromptFiles,
  readPromptFile,
  updatePromptFile,
} from "@/utils/prompt-utils.js";
import { BaseHandler } from "./base.handler.js";

/**
 * 配置 API 处理器
 */
export class ConfigApiHandler extends BaseHandler {
  constructor() {
    super();
  }

  /**
   * 获取配置
   * GET /api/config
   */
  async getConfig(c: Context<AppContext>): Promise<Response> {
    const logger = c.get("logger");
    try {
      logger.debug("处理获取配置请求");
      const config = configManager.getConfig();
      logger.debug("获取配置成功");
      return c.success(config);
    } catch (error) {
      logger.error("获取配置失败:", error);
      return c.fail(
        "CONFIG_READ_ERROR",
        error instanceof Error ? error.message : "获取配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 更新配置
   * PUT /api/config
   */
  async updateConfig(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理更新配置请求");
      const newConfig: AppConfig = await c.req.json();

      // 使用 configManager 的验证方法
      configManager.validateConfig(newConfig);

      // 使用 configManager 的批量更新方法
      configManager.updateConfig(newConfig);

      // 更新服务工具配置（单独处理，因为 updateConfig 只更新已存在的配置）
      if (newConfig.mcpServerConfig) {
        for (const [serverName, toolsConfig] of Object.entries(
          newConfig.mcpServerConfig
        )) {
          for (const [toolName, toolConfig] of Object.entries(
            toolsConfig.tools
          )) {
            configManager.setToolEnabled(
              serverName,
              toolName,
              toolConfig.enable
            );
          }
        }
      }

      c.get("logger").info("配置更新成功");
      return c.success(undefined, "配置更新成功");
    } catch (error) {
      c.get("logger").error("配置更新失败:", error);
      return c.fail(
        "CONFIG_UPDATE_ERROR",
        error instanceof Error ? error.message : "配置更新失败"
      );
    }
  }

  /**
   * 获取 MCP 端点
   * GET /api/config/mcp-endpoint
   */
  async getMcpEndpoint(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取 MCP 端点请求");
      const endpoint = configManager.getMcpEndpoint();
      c.get("logger").debug("获取 MCP 端点成功");
      return c.success({ endpoint });
    } catch (error) {
      c.get("logger").error("获取 MCP 端点失败:", error);
      return c.fail(
        "MCP_ENDPOINT_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 端点失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取 MCP 端点列表
   * GET /api/config/mcp-endpoints
   */
  async getMcpEndpoints(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取 MCP 端点列表请求");
      const endpoints = configManager.getMcpEndpoints();
      c.get("logger").debug("获取 MCP 端点列表成功");
      return c.success({ endpoints });
    } catch (error) {
      c.get("logger").error("获取 MCP 端点列表失败:", error);
      return c.fail(
        "MCP_ENDPOINTS_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 端点列表失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取 MCP 服务配置
   * GET /api/config/mcp-servers
   */
  async getMcpServers(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取 MCP 服务配置请求");
      const servers = configManager.getMcpServers();
      c.get("logger").debug("获取 MCP 服务配置成功");
      return c.success({ servers });
    } catch (error) {
      c.get("logger").error("获取 MCP 服务配置失败:", error);
      return c.fail(
        "MCP_SERVERS_READ_ERROR",
        error instanceof Error ? error.message : "获取 MCP 服务配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取连接配置
   * GET /api/config/connection
   */
  async getConnectionConfig(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取连接配置请求");
      const connection = configManager.getConnectionConfig();
      c.get("logger").debug("获取连接配置成功");
      return c.success({ connection });
    } catch (error) {
      c.get("logger").error("获取连接配置失败:", error);
      return c.fail(
        "CONNECTION_CONFIG_READ_ERROR",
        error instanceof Error ? error.message : "获取连接配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 重新加载配置
   * POST /api/config/reload
   */
  async reloadConfig(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理重新加载配置请求");
      configManager.reloadConfig();
      const config = configManager.getConfig();
      c.get("logger").info("重新加载配置成功");
      return c.success(config, "配置重新加载成功");
    } catch (error) {
      c.get("logger").error("重新加载配置失败:", error);
      return c.fail(
        "CONFIG_RELOAD_ERROR",
        error instanceof Error ? error.message : "重新加载配置失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取配置文件路径
   * GET /api/config/path
   */
  async getConfigPath(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取配置文件路径请求");
      const path = configManager.getConfigPath();
      c.get("logger").debug("获取配置文件路径成功");
      return c.success({ path });
    } catch (error) {
      c.get("logger").error("获取配置文件路径失败:", error);
      return c.fail(
        "CONFIG_PATH_READ_ERROR",
        error instanceof Error ? error.message : "获取配置文件路径失败",
        undefined,
        500
      );
    }
  }

  /**
   * 检查配置是否存在
   * GET /api/config/exists
   */
  async checkConfigExists(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理检查配置是否存在请求");
      const exists = configManager.configExists();
      c.get("logger").debug(`配置存在检查结果: ${exists}`);
      return c.success({ exists });
    } catch (error) {
      c.get("logger").error("检查配置是否存在失败:", error);
      return c.fail(
        "CONFIG_EXISTS_CHECK_ERROR",
        error instanceof Error ? error.message : "检查配置是否存在失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取提示词文件列表
   * GET /api/config/prompts
   */
  async getPromptFiles(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取提示词文件列表请求");
      const prompts = listPromptFiles();
      c.get("logger").debug(
        `获取提示词文件列表成功，共 ${prompts.length} 个文件`
      );
      return c.success({ prompts });
    } catch (error) {
      c.get("logger").error("获取提示词文件列表失败:", error);
      return c.fail(
        "PROMPT_FILES_READ_ERROR",
        error instanceof Error ? error.message : "获取提示词文件列表失败",
        undefined,
        500
      );
    }
  }

  /**
   * 获取提示词文件内容
   * GET /api/config/prompts/content?path=./prompts/default.md
   */
  async getPromptFileContent(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取提示词文件内容请求");
      const path = c.req.query("path");

      if (!path) {
        return c.fail("INVALID_REQUEST", "缺少 path 参数", undefined, 400);
      }

      const fileContent = readPromptFile(path);
      c.get("logger").debug(`获取提示词文件内容成功: ${path}`);
      return c.success(fileContent);
    } catch (error) {
      c.get("logger").error("获取提示词文件内容失败:", error);
      return c.fail(
        "PROMPT_FILE_READ_ERROR",
        error instanceof Error ? error.message : "获取提示词文件内容失败",
        undefined,
        400
      );
    }
  }

  /**
   * 更新提示词文件内容
   * PUT /api/config/prompts/content
   */
  async updatePromptFileContent(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理更新提示词文件内容请求");
      const body = await c.req.json();

      // 验证请求体格式
      if (!body || typeof body !== "object") {
        return c.fail("INVALID_REQUEST", "请求体格式错误", undefined, 400);
      }

      const { path, content } = body;

      // 验证 path 参数
      if (!path || typeof path !== "string") {
        return c.fail(
          "INVALID_REQUEST",
          "path 参数必须是字符串",
          undefined,
          400
        );
      }

      // 验证 content 参数
      if (content === undefined || typeof content !== "string") {
        return c.fail(
          "INVALID_REQUEST",
          "content 参数必须是字符串",
          undefined,
          400
        );
      }

      const fileContent = updatePromptFile(path, content);
      c.get("logger").info(`更新提示词文件成功: ${path}`);
      return c.success(fileContent, "提示词文件更新成功");
    } catch (error) {
      c.get("logger").error("更新提示词文件内容失败:", error);
      return c.fail(
        "PROMPT_FILE_UPDATE_ERROR",
        error instanceof Error ? error.message : "更新提示词文件内容失败",
        undefined,
        400
      );
    }
  }

  /**
   * 创建新的提示词文件
   * POST /api/config/prompts/content
   */
  async createPromptFileContent(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理创建提示词文件请求");
      const body = await c.req.json();

      // 验证请求体格式
      if (!body || typeof body !== "object") {
        return c.fail("INVALID_REQUEST", "请求体格式错误", undefined, 400);
      }

      const { fileName, content } = body;

      // 验证 fileName 参数
      if (!fileName || typeof fileName !== "string") {
        return c.fail(
          "INVALID_REQUEST",
          "fileName 参数必须是字符串",
          undefined,
          400
        );
      }

      // 验证 content 参数
      if (content === undefined || typeof content !== "string") {
        return c.fail(
          "INVALID_REQUEST",
          "content 参数必须是字符串",
          undefined,
          400
        );
      }

      const fileContent = createPromptFile(fileName, content);
      c.get("logger").info(`创建提示词文件成功: ${fileName}`);
      return c.success(fileContent, "提示词文件创建成功");
    } catch (error) {
      c.get("logger").error("创建提示词文件失败:", error);
      return c.fail(
        "PROMPT_FILE_CREATE_ERROR",
        error instanceof Error ? error.message : "创建提示词文件失败",
        undefined,
        400
      );
    }
  }

  /**
   * 删除提示词文件
   * DELETE /api/config/prompts/content?path=./prompts/old-prompt.md
   */
  async deletePromptFileContent(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理删除提示词文件请求");
      const path = c.req.query("path");

      if (!path) {
        return c.fail("INVALID_REQUEST", "缺少 path 参数", undefined, 400);
      }

      deletePromptFile(path);
      c.get("logger").info(`删除提示词文件成功: ${path}`);
      return c.success(undefined, "提示词文件删除成功");
    } catch (error) {
      c.get("logger").error("删除提示词文件失败:", error);
      return c.fail(
        "PROMPT_FILE_DELETE_ERROR",
        error instanceof Error ? error.message : "删除提示词文件失败",
        undefined,
        400
      );
    }
  }
}
