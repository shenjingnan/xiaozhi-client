#!/usr/bin/env node

/**
 * Simple MCP Pipe - Minimal version for debugging
 * This script connects to a WebSocket endpoint and pipes input/output to a proxy MCP server
 * that aggregates multiple configured MCP servers.
 *
 * Configuration:
 * Configure MCP servers in .xiaozhi/settings.json under "mcpServers" key.
 * Each server should have at least a "command" property, and optionally "args" and "env".
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';
import { config } from 'dotenv';
import process from 'process';
import SettingManager from './settingManager.js';

// Load environment variables
config();

// Configure logging
const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] [SIMPLE] INFO: ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] [SIMPLE] ERROR: ${msg}`),
  warning: (msg) => console.warn(`[${new Date().toISOString()}] [SIMPLE] WARNING: ${msg}`),
  debug: (msg) => console.log(`[${new Date().toISOString()}] [SIMPLE] DEBUG: ${msg}`)
};

async function main() {
  try {
    logger.info('Starting simple MCP pipe...');

    // Get settings
    const settingManager = SettingManager.getInstance();
    const endpointUrl = settingManager.get('xiaozhi.endpoint');

    if (!endpointUrl) {
      logger.error('Please configure the xiaozhi.endpoint in .xiaozhi/settings.json');
      process.exit(1);
    }

    // Get MCP servers configuration
    const mcpServers = settingManager.get('mcpServers');
    if (!mcpServers || typeof mcpServers !== 'object') {
      logger.error('No MCP servers configured in .xiaozhi/settings.json');
      logger.info('Please add MCP server configurations under "mcpServers" key');
      process.exit(1);
    }

    // Filter out non-server entries (like "desc")
    const validServers = Object.fromEntries(
      Object.entries(mcpServers).filter(([key, value]) =>
        typeof value === 'object' && value.command
      )
    );

    if (Object.keys(validServers).length === 0) {
      logger.error('No valid MCP servers found in configuration');
      logger.info('Each MCP server must have at least a "command" property');
      process.exit(1);
    }

    logger.info(`Found ${Object.keys(validServers).length} MCP server(s): ${Object.keys(validServers).join(', ')}`);
    logger.info(`Connecting to: ${endpointUrl}`);
    
    // Start proxy server
    logger.info('Starting proxy MCP server...');
    const proxyProcess = spawn('node', ['src/proxyMcpServerRunner.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8'
    });
    
    // Handle proxy process stderr
    if (proxyProcess.stderr) {
      proxyProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          console.error(`[ProxyMCP] ${line}`);
        });
      });
    }
    
    // Give proxy server time to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    logger.info('Proxy server should be ready');
    
    // Connect to WebSocket
    const ws = new WebSocket(endpointUrl);
    
    ws.on('open', () => {
      logger.info('WebSocket connection opened');
    });
    
    ws.on('message', (data) => {
      const message = data.toString();
      logger.info(`<< ${message.substring(0, 100)}...`);
      
      // Forward to proxy server
      if (proxyProcess && !proxyProcess.killed) {
        proxyProcess.stdin.write(message + '\n');
      }
    });
    
    // Handle proxy server stdout
    if (proxyProcess.stdout) {
      let buffer = '';
      proxyProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        lines.forEach(line => {
          if (line.trim()) {
            logger.info(`>> ${line.substring(0, 100)}...`);
            
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(line);
            }
          }
        });
      });
    }
    
    ws.on('close', (code, reason) => {
      logger.info(`WebSocket closed: ${code} ${reason}`);
      if (proxyProcess && !proxyProcess.killed) {
        proxyProcess.kill('SIGTERM');
      }
    });
    
    ws.on('error', (error) => {
      logger.error(`WebSocket error: ${error.message}`);
      if (proxyProcess && !proxyProcess.killed) {
        proxyProcess.kill('SIGTERM');
      }
    });
    
    // Handle process termination
    const cleanup = () => {
      logger.info('Shutting down...');
      if (proxyProcess && !proxyProcess.killed) {
        proxyProcess.kill('SIGTERM');
        // Force kill after timeout
        setTimeout(() => {
          if (!proxyProcess.killed) {
            proxyProcess.kill('SIGKILL');
          }
        }, 5000);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down...');
      cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down...');
      cleanup();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

main();
