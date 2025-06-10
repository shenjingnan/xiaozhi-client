#!/usr/bin/env node

/**
 * Proxy MCP Server Runner
 * This script creates and runs a ProxyMcpServer instance using configuration from settings.json
 * It's designed to be run as a separate process by mcp_pipe.js
 */

import ProxyMcpServer from './proxyMcpServer.js';
import SettingManager from './settingManager.js';
import process from 'process';

// 定义MCP服务器配置接口
interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// Create logger
const logger = {
  info: (msg: string) => console.error(`[ProxyRunner] INFO: ${msg}`),
  error: (msg: string) => console.error(`[ProxyRunner] ERROR: ${msg}`),
  debug: (msg: string) => console.error(`[ProxyRunner] DEBUG: ${msg}`),
  warning: (msg: string) => console.error(`[ProxyRunner] WARNING: ${msg}`)
};

/**
 * Main function to start the proxy server
 */
async function main() {
  try {
    // Get settings
    const settingManager = SettingManager.getInstance();

    // Get MCP servers configuration
    const mcpServers = settingManager.get('mcpServers');
    if (!mcpServers || typeof mcpServers !== 'object') {
      logger.error('No MCP servers configured in .xiaozhi/settings.json');
      process.exit(1);
    }

    // Filter out non-server entries (like "desc")
    const validServers = Object.fromEntries(
      Object.entries(mcpServers).filter(([, value]) =>
        typeof value === 'object' && value !== null && 'command' in value && typeof (value as McpServerConfig).command === 'string'
      )
    ) as Record<string, McpServerConfig>;

    if (Object.keys(validServers).length === 0) {
      logger.error('No valid MCP servers found in configuration');
      process.exit(1);
    }

    logger.info(`Starting proxy server with ${Object.keys(validServers).length} backend servers: ${Object.keys(validServers).join(', ')}`);

    // Create and start the proxy server
    const proxyServer = new ProxyMcpServer(validServers);
    await proxyServer.start();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to start proxy server: ${errorMessage}`);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the proxy server
main().catch((error) => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});
