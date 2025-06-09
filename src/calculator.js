#!/usr/bin/env node

/**
 * Calculator MCP Server - JavaScript Implementation
 * Provides mathematical calculation tools via MCP protocol
 * Version: 0.1.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Create logger
const logger = {
  info: (msg) => console.error(`[Calculator] INFO: ${msg}`),
  error: (msg) => console.error(`[Calculator] ERROR: ${msg}`),
  debug: (msg) => console.error(`[Calculator] DEBUG: ${msg}`)
};

// Create MCP server
const server = new Server(
  {
    name: 'Calculator',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'calculator',
        description: 'For mathematical calculation, always use this tool to calculate the result of a JavaScript expression. Math and random functions are available.',
        inputSchema: {
          type: 'object',
          properties: {
            javascript_expression: {
              type: 'string',
              description: 'A JavaScript mathematical expression to evaluate'
            }
          },
          required: ['javascript_expression']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'calculator') {
    try {
      const expression = args.javascript_expression;
      
      // Create a safe evaluation context with Math and random functions
      const safeContext = {
        Math,
        random: Math.random,
        // Add common math functions to global scope for convenience
        abs: Math.abs,
        acos: Math.acos,
        asin: Math.asin,
        atan: Math.atan,
        atan2: Math.atan2,
        ceil: Math.ceil,
        cos: Math.cos,
        exp: Math.exp,
        floor: Math.floor,
        log: Math.log,
        max: Math.max,
        min: Math.min,
        pow: Math.pow,
        round: Math.round,
        sin: Math.sin,
        sqrt: Math.sqrt,
        tan: Math.tan,
        PI: Math.PI,
        E: Math.E
      };
      
      // Create a function that evaluates the expression in the safe context
      const func = new Function(...Object.keys(safeContext), `return ${expression}`);
      const result = func(...Object.values(safeContext));
      
      logger.info(`Calculating formula: ${expression}, result: ${result}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, result: result })
          }
        ]
      };
    } catch (error) {
      logger.error(`Error calculating expression: ${error.message}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message })
          }
        ]
      };
    }
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Calculator MCP Server started');
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

// Start the server
main().catch((error) => {
  logger.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});
