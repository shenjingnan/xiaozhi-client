#!/usr/bin/env node

/**
 * MCP Pipe - WebSocket to MCP Server Bridge
 * This script connects to a WebSocket endpoint and pipes input/output to an MCP server process.
 * Version: 0.1.0
 * 
 * Usage:
 * export MCP_ENDPOINT=<websocket_url>
 * node mcp_pipe.js <mcp_script>
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
async function connectWithRetry(uri, mcpScript) {
  while (true) { // Infinite reconnection
    try {
      if (reconnectAttempt > 0) {
        const waitTime = backoff * (1 + Math.random() * 0.1); // Add some random jitter
        logger.info(`Waiting ${(waitTime / 1000).toFixed(2)} seconds before reconnection attempt ${reconnectAttempt}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Attempt to connect
      await connectToServer(uri, mcpScript);
      
    } catch (error) {
      reconnectAttempt++;
      logger.warning(`Connection closed (attempt: ${reconnectAttempt}): ${error.message}`);
      // Calculate wait time for next reconnection (exponential backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
    }
  }
}

/**
 * Connect to WebSocket server and establish bidirectional communication with MCP script
 */
async function connectToServer(uri, mcpScript) {
  return new Promise((resolve, reject) => {
    let childProcess = null;
    let ws = null;
    
    try {
      logger.info('Connecting to WebSocket server...');
      ws = new WebSocket(uri);
      
      ws.on('open', () => {
        logger.info('Successfully connected to WebSocket server');
        
        // Reset reconnection counter if connection opens successfully
        reconnectAttempt = 0;
        backoff = INITIAL_BACKOFF;
        
        // Start MCP script process
        childProcess = spawn('node', [mcpScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf8'
        });
        
        logger.info(`Started ${mcpScript} process`);
        
        // Pipe WebSocket messages to process stdin
        ws.on('message', (data) => {
          const message = data.toString();
          logger.debug(`<< ${message.substring(0, 120)}...`);
          
          if (childProcess && !childProcess.killed) {
            childProcess.stdin.write(message + '\n');
          }
        });
        
        // Pipe process stdout to WebSocket
        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data) => {
            const message = data.toString();
            logger.debug(`>> ${message.substring(0, 120)}...`);
            
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(message);
            }
          });
        }
        
        // Pipe process stderr to terminal
        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
          });
        }
        
        // Handle process exit
        childProcess.on('exit', (code, signal) => {
          logger.info(`${mcpScript} process exited with code ${code}, signal ${signal}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
        
        // Handle process error
        childProcess.on('error', (error) => {
          logger.error(`Process error: ${error.message}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
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
      // Ensure the child process is properly terminated
      if (childProcess && !childProcess.killed) {
        logger.info(`Terminating ${mcpScript} process`);
        try {
          childProcess.kill('SIGTERM');
          
          // Force kill after timeout
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
          
        } catch (error) {
          logger.error(`Error terminating process: ${error.message}`);
        }
        logger.info(`${mcpScript} process terminated`);
      }
      
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
  
  // Check command line arguments
  if (process.argv.length < 3) {
    logger.error('Usage: node mcp_pipe.js <mcp_script>');
    process.exit(1);
  }
  
  const mcpScript = process.argv[2];

  // Get endpoint URL from settings
  const settingManager = SettingManager.getInstance();
  const endpointUrl = settingManager.get('xiaozhi.endpoint');
  if (!endpointUrl) {
    logger.error('Please configure the xiaozhi.endpoint in .xiaozhi/settings.json');
    process.exit(1);
  }
  
  // Start main loop
  try {
    await connectWithRetry(endpointUrl, mcpScript);
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
