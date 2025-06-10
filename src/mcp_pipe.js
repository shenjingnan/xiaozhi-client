#!/usr/bin/env node

/**
 * MCP Pipe - WebSocket to MCP Server Bridge
 * This script connects to a WebSocket endpoint and pipes input/output to configured MCP servers.
 * Version: 0.2.0
 *
 * Usage:
 * node mcp_pipe.js
 *
 * Configuration:
 * Configure MCP servers in .xiaozhi/settings.json under "mcpServers" key.
 * Each server should have at least a "command" property, and optionally "args" and "env".
 *
 * Example configuration:
 * {
 *   "mcpServers": {
 *     "Calculator": {
 *       "command": "node",
 *       "args": ["./src/calculator.js"]
 *     },
 *     "amap-maps": {
 *       "command": "npx",
 *       "args": ["-y", "@amap/amap-maps-mcp-server"],
 *       "env": {
 *         "AMAP_MAPS_API_KEY": "your-api-key"
 *       }
 *     }
 *   }
 * }
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';
import { config } from 'dotenv';
import process from 'process';
import SettingManager from './SettingManager.js';

// Load environment variables
config();

// Configure logging
const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] [MCP_PIPE] INFO: ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] [MCP_PIPE] ERROR: ${msg}`),
  warning: (msg) => console.warn(`[${new Date().toISOString()}] [MCP_PIPE] WARNING: ${msg}`),
  debug: (msg) => console.log(`[${new Date().toISOString()}] [MCP_PIPE] DEBUG: ${msg}`)
};

// Reconnection settings
const INITIAL_BACKOFF = 1000; // Initial wait time in milliseconds
const MAX_BACKOFF = 600000; // Maximum wait time in milliseconds
let reconnectAttempt = 0;
let backoff = INITIAL_BACKOFF;

/**
 * Connect to WebSocket server with retry mechanism
 */
async function connectWithRetry(uri, mcpServers) {
  while (true) { // Infinite reconnection
    try {
      if (reconnectAttempt > 0) {
        const waitTime = backoff * (1 + Math.random() * 0.1); // Add some random jitter
        logger.info(`Waiting ${(waitTime / 1000).toFixed(2)} seconds before reconnection attempt ${reconnectAttempt}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Attempt to connect
      await connectToServer(uri, mcpServers);

    } catch (error) {
      reconnectAttempt++;
      logger.warning(`Connection closed (attempt: ${reconnectAttempt}): ${error.message}`);
      // Calculate wait time for next reconnection (exponential backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
    }
  }
}

/**
 * Connect to WebSocket server and establish bidirectional communication with MCP servers
 */
async function connectToServer(uri, mcpServers) {
  return new Promise((resolve, reject) => {
    let childProcesses = [];
    let ws = null;

    try {
      logger.info('Connecting to WebSocket server...');
      ws = new WebSocket(uri);

      ws.on('open', () => {
        logger.info('Successfully connected to WebSocket server');

        // Reset reconnection counter if connection opens successfully
        reconnectAttempt = 0;
        backoff = INITIAL_BACKOFF;

        // Start all MCP server processes
        for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
          const { command, args = [], env = {} } = serverConfig;

          // Merge environment variables
          const processEnv = { ...process.env, ...env };

          const childProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf8',
            env: processEnv
          });

          childProcesses.push({ name: serverName, process: childProcess });
          logger.info(`Started ${serverName} MCP server: ${command} ${args.join(' ')}`);

          // Handle process exit
          childProcess.on('exit', (code, signal) => {
            logger.info(`${serverName} process exited with code ${code}, signal ${signal}`);
            // Remove from active processes
            childProcesses = childProcesses.filter(cp => cp.process !== childProcess);

            // If all processes are dead, close WebSocket
            if (childProcesses.length === 0 && ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          });

          // Handle process error
          childProcess.on('error', (error) => {
            logger.error(`${serverName} process error: ${error.message}`);
            // Remove from active processes
            childProcesses = childProcesses.filter(cp => cp.process !== childProcess);

            // If all processes are dead, close WebSocket
            if (childProcesses.length === 0 && ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          });

          // Pipe process stderr to terminal with server name prefix
          if (childProcess.stderr) {
            childProcess.stderr.on('data', (data) => {
              const lines = data.toString().split('\n').filter(line => line.trim());
              lines.forEach(line => {
                console.error(`[${serverName}] ${line}`);
              });
            });
          }
        }

        // Pipe WebSocket messages to all process stdin
        ws.on('message', (data) => {
          const message = data.toString();
          logger.debug(`<< ${message.substring(0, 120)}...`);

          childProcesses.forEach(({ name, process: childProcess }) => {
            if (childProcess && !childProcess.killed) {
              childProcess.stdin.write(message + '\n');
            }
          });
        });

        // Pipe all process stdout to WebSocket
        childProcesses.forEach(({ name, process: childProcess }) => {
          if (childProcess.stdout) {
            childProcess.stdout.on('data', (data) => {
              const message = data.toString();
              logger.debug(`>> [${name}] ${message.substring(0, 120)}...`);

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
              }
            });
          }
        });
      });
      
      ws.on('close', (code, reason) => {
        logger.error(`WebSocket connection closed: ${code} ${reason}`);
        cleanup();
        reject(new Error(`WebSocket closed: ${code} ${reason}`));
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error: ${error.message}`);
        cleanup();
        reject(error);
      });

    } catch (error) {
      logger.error(`Connection error: ${error.message}`);
      cleanup();
      reject(error);
    }

    function cleanup() {
      // Ensure all child processes are properly terminated
      childProcesses.forEach(({ name, process: childProcess }) => {
        if (childProcess && !childProcess.killed) {
          logger.info(`Terminating ${name} process`);
          try {
            childProcess.kill('SIGTERM');

            // Force kill after timeout
            setTimeout(() => {
              if (!childProcess.killed) {
                childProcess.kill('SIGKILL');
              }
            }, 5000);

          } catch (error) {
            logger.error(`Error terminating ${name} process: ${error.message}`);
          }
          logger.info(`${name} process terminated`);
        }
      });

      // Close WebSocket if still open
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  });
}

/**
 * Signal handler for graceful shutdown
 */
function signalHandler(signal) {
  logger.info(`Received ${signal} signal, shutting down...`);
  process.exit(0);
}

// Main function
async function main() {
  // Register signal handlers
  process.on('SIGINT', () => signalHandler('SIGINT'));
  process.on('SIGTERM', () => signalHandler('SIGTERM'));

  // Get settings
  const settingManager = SettingManager.getInstance();

  // Get endpoint URL from settings
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

  // Start main loop
  try {
    await connectWithRetry(endpointUrl, validServers);
  } catch (error) {
    logger.error(`Program execution error: ${error.message}`);
    process.exit(1);
  }
}

// Start the program
main().catch((error) => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});
