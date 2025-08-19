#!/usr/bin/env node

/**
 * MCP Calculator Server - JavaScript Implementation
 * Provides mathematical calculation tools via MCP protocol
 * Version: 0.2.0 - Using @modelcontextprotocol/sdk
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Simple logger utility
const logger = {
	info: (message) => {
		const timestamp = new Date().toISOString();
		console.error(`${timestamp} - Calculator - INFO - ${message}`);
	},
	error: (message) => {
		const timestamp = new Date().toISOString();
		console.error(`${timestamp} - Calculator - ERROR - ${message}`);
	},
	debug: (message) => {
		const timestamp = new Date().toISOString();
		console.error(`${timestamp} - Calculator - DEBUG - ${message}`);
	},
};

// Create MCP server instance using the official SDK
const server = new McpServer({
	name: "Calculator",
	version: "0.2.0",
});

// Register calculator tool using the SDK
server.tool(
	"calculator",
	"For mathematical calculation, always use this tool to calculate the result of a JavaScript expression. Math object and basic operations are available.",
	{
		javascript_expression: z
			.string()
			.describe("JavaScript expression to evaluate"),
	},
	async ({ javascript_expression }) => {
		try {
			// Simple and direct evaluation like Python version
			// Note: In a production environment, you might want to add more security measures
			const result = eval(javascript_expression);
			logger.info(
				`Calculating formula: ${javascript_expression}, result: ${result}`
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							result: result,
						}),
					},
				],
			};
		} catch (error) {
			logger.error(`Calculation error: ${error.message}`);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: false,
							error: error.message,
						}),
					},
				],
				isError: true,
			};
		}
	}
);

// Start the server if this file is run directly
async function main() {
	logger.info("Starting MCP Calculator server with SDK");

	const transport = new StdioServerTransport();
	await server.connect(transport);

	logger.info("MCP Calculator server is running on stdio");
}

// Run the server if this file is executed directly
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const currentFile = fileURLToPath(import.meta.url);
const argFile = process.argv[1] ? resolve(process.argv[1]) : null;

if (argFile && currentFile === argFile) {
	main().catch((error) => {
		logger.error(`Failed to start server: ${error.message}`);
		process.exit(1);
	});
}

export default server;
