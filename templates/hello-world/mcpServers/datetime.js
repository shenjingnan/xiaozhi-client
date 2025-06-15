#!/usr/bin/env node

/**
 * MCP DateTime Server - JavaScript Implementation
 * Provides date and time tools via MCP protocol
 * Version: 0.2.0 - Using @modelcontextprotocol/sdk
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Simple logger utility
const logger = {
	info: (message) => {
		const timestamp = new Date().toISOString();
		console.error(`${timestamp} - DateTime - INFO - ${message}`);
	},
	error: (message) => {
		const timestamp = new Date().toISOString();
		console.error(`${timestamp} - DateTime - ERROR - ${message}`);
	},
	debug: (message) => {
		const timestamp = new Date().toISOString();
		console.error(`${timestamp} - DateTime - DEBUG - ${message}`);
	},
};

// Create MCP server instance using the official SDK
const server = new McpServer({
	name: "DateTime",
	version: "0.2.0",
});

// Register get_current_time tool
server.tool(
	"get_current_time",
	"Get the current time in various formats",
	{
		format: z
			.string()
			.optional()
			.describe(
				"Time format: 'iso' (default), 'timestamp', 'locale', 'time-only'"
			),
	},
	async ({ format = "iso" }) => {
		try {
			const now = new Date();
			let result;

			switch (format) {
				case "timestamp":
					result = now.getTime();
					break;
				case "locale":
					result = now.toLocaleString();
					break;
				case "time-only":
					result = now.toLocaleTimeString();
					break;
				case "iso":
				default:
					result = now.toISOString();
					break;
			}

			logger.info(
				`Getting current time in format: ${format}, result: ${result}`
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							result: result,
							format: format,
						}),
					},
				],
			};
		} catch (error) {
			logger.error(`Get current time error: ${error.message}`);
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

// Register get_current_date tool
server.tool(
	"get_current_date",
	"Get the current date in various formats",
	{
		format: z
			.string()
			.optional()
			.describe(
				"Date format: 'iso' (default), 'locale', 'date-only', 'yyyy-mm-dd'"
			),
	},
	async ({ format = "iso" }) => {
		try {
			const now = new Date();
			let result;

			switch (format) {
				case "locale":
					result = now.toLocaleDateString();
					break;
				case "date-only":
					result = now.toDateString();
					break;
				case "yyyy-mm-dd":
					result = now.toISOString().split("T")[0];
					break;
				case "iso":
				default:
					result = now.toISOString();
					break;
			}

			logger.info(
				`Getting current date in format: ${format}, result: ${result}`
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							result: result,
							format: format,
						}),
					},
				],
			};
		} catch (error) {
			logger.error(`Get current date error: ${error.message}`);
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

// Register format_datetime tool
server.tool(
	"format_datetime",
	"Format a given date/time string or timestamp into specified format",
	{
		datetime: z.string().describe("Date/time string or timestamp to format"),
		format: z
			.string()
			.optional()
			.describe(
				"Output format: 'iso', 'locale', 'timestamp', 'yyyy-mm-dd', 'custom'"
			),
		custom_format: z
			.string()
			.optional()
			.describe("Custom format string (when format is 'custom')"),
	},
	async ({ datetime, format = "iso", custom_format }) => {
		try {
			let date;

			// Try to parse the input datetime
			if (!isNaN(Number(datetime))) {
				// It's a timestamp
				date = new Date(Number(datetime));
			} else {
				// It's a date string
				date = new Date(datetime);
			}

			if (isNaN(date.getTime())) {
				throw new Error("Invalid date/time format");
			}

			let result;
			switch (format) {
				case "timestamp":
					result = date.getTime();
					break;
				case "locale":
					result = date.toLocaleString();
					break;
				case "yyyy-mm-dd":
					result = date.toISOString().split("T")[0];
					break;
				case "custom":
					if (custom_format) {
						// Simple custom formatting (can be extended)
						result = custom_format
							.replace("YYYY", date.getFullYear())
							.replace("MM", String(date.getMonth() + 1).padStart(2, "0"))
							.replace("DD", String(date.getDate()).padStart(2, "0"))
							.replace("HH", String(date.getHours()).padStart(2, "0"))
							.replace("mm", String(date.getMinutes()).padStart(2, "0"))
							.replace("ss", String(date.getSeconds()).padStart(2, "0"));
					} else {
						result = date.toISOString();
					}
					break;
				case "iso":
				default:
					result = date.toISOString();
					break;
			}

			logger.info(
				`Formatting datetime: ${datetime} to format: ${format}, result: ${result}`
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							result: result,
							original: datetime,
							format: format,
						}),
					},
				],
			};
		} catch (error) {
			logger.error(`Format datetime error: ${error.message}`);
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

// Register add_time tool
server.tool(
	"add_time",
	"Add or subtract time from a given date/time",
	{
		datetime: z.string().describe("Base date/time string or timestamp"),
		amount: z
			.number()
			.describe("Amount to add (positive) or subtract (negative)"),
		unit: z
			.string()
			.describe(
				"Time unit: 'milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'"
			),
	},
	async ({ datetime, amount, unit }) => {
		try {
			let date;

			// Try to parse the input datetime
			if (!isNaN(Number(datetime))) {
				date = new Date(Number(datetime));
			} else {
				date = new Date(datetime);
			}

			if (isNaN(date.getTime())) {
				throw new Error("Invalid date/time format");
			}

			// Calculate the new date based on unit
			const newDate = new Date(date);

			switch (unit.toLowerCase()) {
				case "milliseconds":
					newDate.setTime(newDate.getTime() + amount);
					break;
				case "seconds":
					newDate.setTime(newDate.getTime() + amount * 1000);
					break;
				case "minutes":
					newDate.setTime(newDate.getTime() + amount * 60 * 1000);
					break;
				case "hours":
					newDate.setTime(newDate.getTime() + amount * 60 * 60 * 1000);
					break;
				case "days":
					newDate.setDate(newDate.getDate() + amount);
					break;
				case "weeks":
					newDate.setDate(newDate.getDate() + amount * 7);
					break;
				case "months":
					newDate.setMonth(newDate.getMonth() + amount);
					break;
				case "years":
					newDate.setFullYear(newDate.getFullYear() + amount);
					break;
				default:
					throw new Error(`Unsupported time unit: ${unit}`);
			}

			const result = newDate.toISOString();
			logger.info(`Adding ${amount} ${unit} to ${datetime}, result: ${result}`);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							result: result,
							original: datetime,
							amount: amount,
							unit: unit,
						}),
					},
				],
			};
		} catch (error) {
			logger.error(`Add time error: ${error.message}`);
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
	logger.info("Starting MCP DateTime server with SDK");

	const transport = new StdioServerTransport();
	await server.connect(transport);

	logger.info("MCP DateTime server is running on stdio");
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
