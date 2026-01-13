#!/usr/bin/env node

/**
 * MCP DateTime Server
 * 提供日期时间功能的 MCP 服务
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 日志工具
const logger = {
  info: (message: string) => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - DateTime - INFO - ${message}`);
  },
  error: (message: string) => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} - DateTime - ERROR - ${message}`);
  },
};

// 创建 MCP 服务器实例
const server = new McpServer({
  name: "@xiaozhi-client/datetime-mcp",
  version: "1.0.0",
});

// 注册获取当前时间工具
server.tool(
  "get_current_time",
  "获取当前时间，支持多种格式",
  {
    format: z
      .string()
      .optional()
      .describe("时间格式：'iso'（默认）、'timestamp'、'locale'、'time-only'"),
  },
  async ({ format = "iso" }) => {
    try {
      const now = new Date();
      let result: string | number;

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

      logger.info(`获取当前时间，格式：${format}，结果：${result}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              result,
              format,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error(`获取当前时间错误：${error.message}`);
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

// 注册获取当前日期工具
server.tool(
  "get_current_date",
  "获取当前日期，支持多种格式",
  {
    format: z
      .string()
      .optional()
      .describe("日期格式：'iso'（默认）、'locale'、'date-only'、'yyyy-mm-dd'"),
  },
  async ({ format = "iso" }) => {
    try {
      const now = new Date();
      let result: string;

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

      logger.info(`获取当前日期，格式：${format}，结果：${result}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              result,
              format,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error(`获取当前日期错误：${error.message}`);
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

// 注册格式化日期时间工具
server.tool(
  "format_datetime",
  "将给定的日期时间字符串或时间戳格式化为指定格式",
  {
    datetime: z.string().describe("要格式化的日期时间字符串或时间戳"),
    format: z
      .string()
      .optional()
      .describe("输出格式：'iso'、'locale'、'timestamp'、'yyyy-mm-dd'、'custom'"),
    custom_format: z
      .string()
      .optional()
      .describe("自定义格式字符串（当 format 为 'custom' 时使用）"),
  },
  async ({ datetime, format = "iso", custom_format }) => {
    try {
      let date: Date;

      // 尝试解析输入的日期时间
      if (!isNaN(Number(datetime))) {
        // 是时间戳
        date = new Date(Number(datetime));
      } else {
        // 是日期字符串
        date = new Date(datetime);
      }

      if (isNaN(date.getTime())) {
        throw new Error("无效的日期时间格式");
      }

      let result: string | number;
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
            // 简单的自定义格式化
            result = custom_format
              .replace("YYYY", String(date.getFullYear()))
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

      logger.info(`格式化日期时间：${datetime} 为格式：${format}，结果：${result}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              result,
              original: datetime,
              format,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error(`格式化日期时间错误：${error.message}`);
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

// 注册时间加减工具
server.tool(
  "add_time",
  "在给定的日期时间基础上增加或减少时间",
  {
    datetime: z.string().describe("基准日期时间字符串或时间戳"),
    amount: z.number().describe("要增加（正数）或减少（负数）的数量"),
    unit: z
      .string()
      .describe("时间单位：'milliseconds'、'seconds'、'minutes'、'hours'、'days'、'weeks'、'months'、'years'"),
  },
  async ({ datetime, amount, unit }) => {
    try {
      let date: Date;

      // 尝试解析输入的日期时间
      if (!isNaN(Number(datetime))) {
        date = new Date(Number(datetime));
      } else {
        date = new Date(datetime);
      }

      if (isNaN(date.getTime())) {
        throw new Error("无效的日期时间格式");
      }

      // 根据单位计算新日期
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
          throw new Error(`不支持的时间单位：${unit}`);
      }

      const result = newDate.toISOString();
      logger.info(`在 ${datetime} 基础上增加 ${amount} ${unit}，结果：${result}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              result,
              original: datetime,
              amount,
              unit,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error(`时间加减错误：${error.message}`);
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

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("DateTime MCP 服务已启动");
}

main().catch((error) => {
  logger.error(`启动服务失败：${error.message}`);
  process.exit(1);
});

export default server;
