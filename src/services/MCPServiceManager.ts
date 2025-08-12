#!/usr/bin/env node

/**
 * 简化版 MCP 服务管理器 - TypeScript 版本
 * 用于快速验证 MCP 服务管理的核心概念
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { LocalMCPServerConfig } from '../configManager.js';

// 工具信息接口
interface ToolInfo {
  serviceName: string;
  originalName: string;
  tool: Tool;
}

// 服务状态接口
interface ServiceStatus {
  connected: boolean;
  clientName: string;
}

// 管理器状态接口
interface ManagerStatus {
  services: Record<string, ServiceStatus>;
  totalTools: number;
  availableTools: string[];
}

// 工具调用结果接口
interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export class MCPServiceManager {
  private mcpServers: Record<string, LocalMCPServerConfig>;
  private clients: Map<string, Client>;
  private processes: Map<string, any>;
  private tools: Map<string, ToolInfo>;

  constructor() {
    // 硬编码的 MCP 服务配置（从模板复制）
    this.mcpServers = {
      "calculator": {
        "command": "node",
        "args": ["/Users/nemo/github/shenjingnan/xiaozhi-client/templates/hello-world/mcpServers/calculator.js"]
      },
      "datetime": {
        "command": "node",
        "args": ["/Users/nemo/github/shenjingnan/xiaozhi-client/templates/hello-world/mcpServers/datetime.js"]
      }
    };

    this.clients = new Map(); // 存储 MCP 客户端实例
    this.processes = new Map(); // 存储 MCP 进程实例
    this.tools = new Map(); // 存储工具映射
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    console.log('正在启动所有 MCP 服务...');

    for (const [serviceName, config] of Object.entries(this.mcpServers)) {
      await this.startService(serviceName, config);
    }

    console.log('所有 MCP 服务启动完成');
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string, config: LocalMCPServerConfig): Promise<void> {
    console.log(`启动 MCP 服务: ${serviceName}`);

    try {
      // 创建 MCP 客户端
      const client = new Client({
        name: `xiaozhi-${serviceName}-client`,
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      });

      // 创建 stdio 传输层，让 SDK 自己管理进程
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args
      });

      // 连接到 MCP 服务
      await client.connect(transport);
      this.clients.set(serviceName, client);

      // 获取工具列表
      const toolsResult = await client.listTools();
      const tools: Tool[] = toolsResult.tools || [];

      // 注册工具到映射表
      for (const tool of tools) {
        const toolKey = `${serviceName}__${tool.name}`;
        this.tools.set(toolKey, {
          serviceName,
          originalName: tool.name,
          tool
        });
      }

      console.log(`${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
                  tools.map(t => t.name).join(', '));

    } catch (error) {
      console.error(`启动 ${serviceName} 服务失败:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * 获取所有可用工具
   */
  getAllTools(): Array<{
    name: string;
    description: string;
    inputSchema: any;
    serviceName: string;
    originalName: string;
  }> {
    const allTools: Array<{
      name: string;
      description: string;
      inputSchema: any;
      serviceName: string;
      originalName: string;
    }> = [];

    for (const [toolKey, toolInfo] of this.tools) {
      allTools.push({
        name: toolKey,
        description: toolInfo.tool.description || '',
        inputSchema: toolInfo.tool.inputSchema,
        serviceName: toolInfo.serviceName,
        originalName: toolInfo.originalName
      });
    }
    return allTools;
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(toolName: string, arguments_: any): Promise<ToolCallResult> {
    console.log(`调用工具: ${toolName}，参数:`, arguments_);

    const toolInfo = this.tools.get(toolName);
    if (!toolInfo) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    const client = this.clients.get(toolInfo.serviceName);
    if (!client) {
      throw new Error(`服务 ${toolInfo.serviceName} 不可用`);
    }

    try {
      const result = await client.callTool({
        name: toolInfo.originalName,
        arguments: arguments_ || {}
      });

      console.log(`工具 ${toolName} 调用成功，结果:`, result);
      return result as ToolCallResult;
    } catch (error) {
      console.error(`工具 ${toolName} 调用失败:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    console.log('正在停止所有 MCP 服务...');

    // 关闭所有客户端连接（SDK会自动管理进程）
    for (const [serviceName, client] of this.clients) {
      try {
        await client.close();
        console.log(`${serviceName} 客户端已关闭`);
      } catch (error) {
        console.error(`关闭 ${serviceName} 客户端失败:`, (error as Error).message);
      }
    }

    this.clients.clear();
    this.processes.clear();
    this.tools.clear();

    console.log('所有 MCP 服务已停止');
  }

  /**
   * 获取服务状态
   */
  getStatus(): ManagerStatus {
    const status: ManagerStatus = {
      services: {},
      totalTools: this.tools.size,
      availableTools: Array.from(this.tools.keys())
    };

    for (const [serviceName, client] of this.clients) {
      status.services[serviceName] = {
        connected: !!client,
        clientName: (client as any)?.name || 'unknown'
      };
    }

    return status;
  }
}

export default MCPServiceManager;
