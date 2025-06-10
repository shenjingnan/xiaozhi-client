#!/usr/bin/env node

/**
 * Proxy MCP Server - Aggregates multiple MCP servers into a single interface
 * This server starts multiple backend MCP servers and exposes their tools with prefixed names
 * to avoid naming conflicts.
 * Version: 0.1.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import process from 'process';

/**
 * ProxyMcpServer class that manages multiple backend MCP servers
 */
export default class ProxyMcpServer {
  constructor(mcpServersConfig) {
    this.mcpServersConfig = mcpServersConfig;
    this.backendServers = new Map(); // serverName -> { process, tools, ready }
    this.aggregatedTools = []; // All tools with prefixed names
    
    // Create logger
    this.logger = {
      info: (msg) => console.error(`[ProxyMCP] INFO: ${msg}`),
      error: (msg) => console.error(`[ProxyMCP] ERROR: ${msg}`),
      debug: (msg) => console.error(`[ProxyMCP] DEBUG: ${msg}`),
      warning: (msg) => console.error(`[ProxyMCP] WARNING: ${msg}`)
    };

    // Create MCP server
    this.server = new Server(
      {
        name: 'ProxyMcpServer',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP server request handlers
   */
  setupHandlers() {
    // Handle list tools requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      await this.ensureBackendServersReady();
      return {
        tools: this.aggregatedTools
      };
    });

    // Handle tool call requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // Parse the prefixed tool name to find the target server
      const { serverName, originalToolName } = this.parseToolName(name);
      
      if (!serverName || !this.backendServers.has(serverName)) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const backendServer = this.backendServers.get(serverName);
      if (!backendServer.ready) {
        throw new Error(`Backend server ${serverName} is not ready`);
      }

      // Forward the request to the backend server
      return await this.forwardToolCall(serverName, originalToolName, args);
    });
  }

  /**
   * Parse a prefixed tool name to extract server name and original tool name
   * Format: serverName_toolName (with hyphens converted to underscores in serverName)
   */
  parseToolName(prefixedName) {
    // Find all possible server names that could match
    for (const serverName of Object.keys(this.mcpServersConfig)) {
      const prefix = this.getServerPrefix(serverName);
      if (prefixedName.startsWith(prefix)) {
        const originalToolName = prefixedName.substring(prefix.length);
        return { serverName, originalToolName };
      }
    }
    return { serverName: null, originalToolName: null };
  }

  /**
   * Get the prefix for a server name (convert hyphens to underscores and add underscore)
   */
  getServerPrefix(serverName) {
    return serverName.replace(/-/g, '_') + '__xzcli__';
  }

  /**
   * Start all backend MCP servers
   */
  async startBackendServers() {
    this.logger.info(`Starting ${Object.keys(this.mcpServersConfig).length} backend MCP servers...`);
    
    const startPromises = Object.entries(this.mcpServersConfig).map(([serverName, config]) => 
      this.startBackendServer(serverName, config)
    );

    await Promise.all(startPromises);
    this.logger.info('All backend servers started');
  }

  /**
   * Start a single backend MCP server
   */
  async startBackendServer(serverName, serverConfig) {
    const { command, args = [], env = {} } = serverConfig;
    
    // Merge environment variables
    const processEnv = { ...process.env, ...env };

    const childProcess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: processEnv
    });

    const backendServer = {
      process: childProcess,
      tools: [],
      ready: false,
      messageQueue: [],
      responseHandlers: new Map() // requestId -> { resolve, reject }
    };

    this.backendServers.set(serverName, backendServer);
    this.logger.info(`Started backend server ${serverName}: ${command} ${args.join(' ')}`);

    // Setup process event handlers
    this.setupBackendServerHandlers(serverName, backendServer);

    // Initialize the server and get its tools
    await this.initializeBackendServer(serverName, backendServer);
  }

  /**
   * Setup event handlers for a backend server process
   */
  setupBackendServerHandlers(serverName, backendServer) {
    const { process: childProcess } = backendServer;

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      this.logger.warning(`Backend server ${serverName} exited with code ${code}, signal ${signal}`);
      backendServer.ready = false;
      this.backendServers.delete(serverName);
    });

    // Handle process error
    childProcess.on('error', (error) => {
      this.logger.error(`Backend server ${serverName} error: ${error.message}`);
      backendServer.ready = false;
    });

    // Handle stderr
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          this.logger.debug(`[${serverName}] ${line}`);
        });
      });
    }

    // Handle stdout (MCP protocol messages)
    if (childProcess.stdout) {
      let buffer = '';
      childProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        lines.forEach(line => {
          if (line.trim()) {
            this.handleBackendMessage(serverName, line.trim());
          }
        });
      });
    }
  }

  /**
   * Handle messages from backend servers
   */
  handleBackendMessage(serverName, message) {
    try {
      const parsed = JSON.parse(message);
      const backendServer = this.backendServers.get(serverName);
      
      if (!backendServer) return;

      // Handle responses to our requests
      if (parsed.id && backendServer.responseHandlers.has(parsed.id)) {
        const handler = backendServer.responseHandlers.get(parsed.id);
        backendServer.responseHandlers.delete(parsed.id);
        
        if (parsed.error) {
          handler.reject(new Error(parsed.error.message || 'Backend server error'));
        } else {
          handler.resolve(parsed.result);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to parse message from ${serverName}: ${error.message}`);
    }
  }

  /**
   * Initialize a backend server and get its tools
   */
  async initializeBackendServer(serverName, backendServer) {
    try {
      // Send initialize request
      await this.sendToBackendServer(serverName, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'ProxyMcpServer',
            version: '0.1.0'
          }
        }
      });

      // Get tools list
      const toolsResult = await this.sendToBackendServer(serverName, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });

      if (toolsResult && toolsResult.tools) {
        backendServer.tools = toolsResult.tools;
        backendServer.ready = true;
        this.updateAggregatedTools();
        this.logger.info(`Backend server ${serverName} is ready with ${toolsResult.tools.length} tools`);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize backend server ${serverName}: ${error.message}`);
    }
  }

  /**
   * Send a message to a backend server and wait for response
   */
  async sendToBackendServer(serverName, message) {
    const backendServer = this.backendServers.get(serverName);
    if (!backendServer || !backendServer.process || backendServer.process.killed) {
      throw new Error(`Backend server ${serverName} is not available`);
    }

    return new Promise((resolve, reject) => {
      const requestId = message.id;
      backendServer.responseHandlers.set(requestId, { resolve, reject });

      // Set timeout
      setTimeout(() => {
        if (backendServer.responseHandlers.has(requestId)) {
          backendServer.responseHandlers.delete(requestId);
          reject(new Error(`Timeout waiting for response from ${serverName}`));
        }
      }, 30000); // 30 second timeout

      // Send message
      const messageStr = JSON.stringify(message) + '\n';
      backendServer.process.stdin.write(messageStr);
    });
  }

  /**
   * Update the aggregated tools list with prefixed names
   */
  updateAggregatedTools() {
    this.aggregatedTools = [];

    for (const [serverName, backendServer] of this.backendServers.entries()) {
      this.logger.debug(`Checking server ${serverName}: ready=${backendServer.ready}, tools=${backendServer.tools ? backendServer.tools.length : 'null'}`);

      if (backendServer.ready && backendServer.tools) {
        const prefix = this.getServerPrefix(serverName);
        this.logger.debug(`Processing ${backendServer.tools.length} tools for server ${serverName} with prefix ${prefix}`);

        for (const tool of backendServer.tools) {
          const prefixedTool = {
            ...tool,
            name: prefix + tool.name,
            description: `[${serverName}] ${tool.description}`
          };
          this.aggregatedTools.push(prefixedTool);
          this.logger.debug(`Added tool: ${tool.name} -> ${prefixedTool.name}`);
        }
      }
    }

    this.logger.info(`Updated aggregated tools: ${this.aggregatedTools.length} total tools`);
  }

  /**
   * Forward a tool call to the appropriate backend server
   */
  async forwardToolCall(serverName, toolName, args) {
    const requestId = Date.now() + Math.random();
    
    const result = await this.sendToBackendServer(serverName, {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    return result;
  }

  /**
   * Ensure all backend servers are ready
   */
  async ensureBackendServersReady() {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const readyServers = Array.from(this.backendServers.values()).filter(server => server.ready);
      if (readyServers.length === Object.keys(this.mcpServersConfig).length) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.logger.warning('Not all backend servers are ready, proceeding anyway');
  }

  /**
   * Start the proxy server
   */
  async start() {
    try {
      // Start all backend servers
      await this.startBackendServers();
      
      // Start the proxy MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('Proxy MCP Server started successfully');
    } catch (error) {
      this.logger.error(`Failed to start proxy server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the proxy server and all backend servers
   */
  async stop() {
    this.logger.info('Stopping proxy server...');
    
    // Stop all backend servers
    for (const [serverName, backendServer] of this.backendServers.entries()) {
      if (backendServer.process && !backendServer.process.killed) {
        this.logger.info(`Stopping backend server ${serverName}`);
        backendServer.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (!backendServer.process.killed) {
            backendServer.process.kill('SIGKILL');
          }
        }, 5000);
      }
    }
    
    this.backendServers.clear();
    this.logger.info('Proxy server stopped');
  }
}
