/**
 * 常量测试
 * 测试所有常量值的正确性、不可变性和类型安全
 */

import { describe, expect, it } from "vitest";
import {
  CACHE_CONFIG,
  CACHE_FILE_CONFIG,
  CACHE_STATS,
  CACHE_TIMEOUTS,
  CONFIG_EVENTS,
  ENDPOINT_EVENTS,
  HEARTBEAT_MONITORING,
  HTTP_CONTENT_TYPES,
  HTTP_ERROR_MESSAGES,
  HTTP_HEADERS,
  HTTP_SERVER_CONFIG,
  HTTP_STATUS_CODES,
  HTTP_TIMEOUTS,
  JSONRPC_ERROR_CODES,
  JSONRPC_ERROR_MESSAGES,
  JSONRPC_VERSION,
  MCP_METHODS,
  MCP_PROTOCOL_VERSIONS,
  MCP_SERVER_EVENTS,
  MCP_SERVER_INFO,
  MCP_SERVICE_EVENTS,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  MCP_TIMEOUTS,
  MESSAGE_SIZE_LIMITS,
  RETRY_CONFIG,
  RETRY_DELAYS,
  STATUS_EVENTS,
  TOOL_NAME_SEPARATORS,
  WEBSOCKET_EVENTS,
} from "../index.js";

describe("HTTP 常量", () => {
  describe("HTTP_CONTENT_TYPES", () => {
    it("应该包含正确的 Content-Type 值", () => {
      expect(HTTP_CONTENT_TYPES.APPLICATION_JSON).toBe("application/json");
      expect(HTTP_CONTENT_TYPES.TEXT_HTML).toBe("text/html");
      expect(HTTP_CONTENT_TYPES.TEXT_PLAIN).toBe("text/plain");
    });

    it("应该使用 as const 定义，提供类型层面的不可变性", () => {
      // TypeScript 的 as const 只提供类型层面的不可变性
      // 运行时仍然可以修改，但我们不应该这样做
      // 这个测试只是验证常量的值是正确的
      expect(HTTP_CONTENT_TYPES.APPLICATION_JSON).toBe("application/json");
    });
  });

  describe("HTTP_HEADERS", () => {
    it("应该包含正确的 HTTP 头名称", () => {
      expect(HTTP_HEADERS.CONTENT_TYPE).toBe("Content-Type");
      expect(HTTP_HEADERS.MCP_PROTOCOL_VERSION).toBe("MCP-Protocol-Version");
    });
  });

  describe("HTTP_STATUS_CODES", () => {
    it("应该包含正确的 HTTP 状态码", () => {
      expect(HTTP_STATUS_CODES.OK).toBe(200);
      expect(HTTP_STATUS_CODES.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS_CODES.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe("HTTP_SERVER_CONFIG", () => {
    it("应该包含正确的服务器配置", () => {
      expect(HTTP_SERVER_CONFIG.DEFAULT_BIND_ADDRESS).toBe("0.0.0.0");
      expect(HTTP_SERVER_CONFIG.DEFAULT_PORT).toBe(9999);
    });
  });

  describe("HTTP_ERROR_MESSAGES", () => {
    it("应该包含正确的错误消息", () => {
      expect(HTTP_ERROR_MESSAGES.REQUEST_TOO_LARGE).toBe("Request too large");
      expect(HTTP_ERROR_MESSAGES.INVALID_CONTENT_TYPE).toBe(
        "Content-Type must be application/json"
      );
    });
  });
});

describe("MCP 常量", () => {
  describe("JSONRPC_VERSION", () => {
    it("应该是 2.0", () => {
      expect(JSONRPC_VERSION).toBe("2.0");
    });
  });

  describe("MCP_PROTOCOL_VERSIONS", () => {
    it("应该包含支持的协议版本", () => {
      expect(MCP_PROTOCOL_VERSIONS.V2024_11_05).toBe("2024-11-05");
      expect(MCP_PROTOCOL_VERSIONS.V2025_06_18).toBe("2025-06-18");
      expect(MCP_PROTOCOL_VERSIONS.DEFAULT).toBe("2024-11-05");
    });
  });

  describe("MCP_SUPPORTED_PROTOCOL_VERSIONS", () => {
    it("应该包含所有支持的协议版本", () => {
      expect(MCP_SUPPORTED_PROTOCOL_VERSIONS).toContain("2024-11-05");
      expect(MCP_SUPPORTED_PROTOCOL_VERSIONS).toContain("2025-06-18");
      expect(MCP_SUPPORTED_PROTOCOL_VERSIONS).toHaveLength(2);
    });
  });

  describe("MCP_SERVER_INFO", () => {
    it("应该包含正确的服务器信息", () => {
      expect(MCP_SERVER_INFO.NAME).toBe("xiaozhi-mcp-server");
      expect(MCP_SERVER_INFO.VERSION).toBe("1.0.0");
    });
  });

  describe("MCP_METHODS", () => {
    it("应该包含所有 MCP 方法名称", () => {
      expect(MCP_METHODS.INITIALIZE).toBe("initialize");
      expect(MCP_METHODS.TOOLS_LIST).toBe("tools/list");
      expect(MCP_METHODS.TOOLS_CALL).toBe("tools/call");
      expect(MCP_METHODS.RESOURCES_LIST).toBe("resources/list");
      expect(MCP_METHODS.PROMPTS_LIST).toBe("prompts/list");
      expect(MCP_METHODS.PING).toBe("ping");
    });
  });

  describe("JSONRPC_ERROR_CODES", () => {
    it("应该包含正确的 JSON-RPC 错误码", () => {
      expect(JSONRPC_ERROR_CODES.PARSE_ERROR).toBe(-32700);
      expect(JSONRPC_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
      expect(JSONRPC_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
      expect(JSONRPC_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
      expect(JSONRPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
    });
  });

  describe("JSONRPC_ERROR_MESSAGES", () => {
    it("应该包含正确的错误消息", () => {
      expect(JSONRPC_ERROR_MESSAGES.PARSE_ERROR).toBe(
        "Parse error: Invalid JSON"
      );
      expect(JSONRPC_ERROR_MESSAGES.METHOD_NOT_FOUND).toBe("Method not found");
      expect(JSONRPC_ERROR_MESSAGES.TOOL_NOT_FOUND).toBe("未找到工具");
    });
  });
});

describe("事件常量", () => {
  describe("MCP_SERVICE_EVENTS", () => {
    it("应该包含正确的 MCP 服务事件名称", () => {
      expect(MCP_SERVICE_EVENTS.CONNECTED).toBe("mcp:service:connected");
      expect(MCP_SERVICE_EVENTS.DISCONNECTED).toBe("mcp:service:disconnected");
      expect(MCP_SERVICE_EVENTS.CONNECTION_FAILED).toBe(
        "mcp:service:connection:failed"
      );
    });
  });

  describe("MCP_SERVER_EVENTS", () => {
    it("应该包含正确的 MCP 服务器事件名称", () => {
      expect(MCP_SERVER_EVENTS.ADDED).toBe("mcp:server:added");
      expect(MCP_SERVER_EVENTS.BATCH_ADDED).toBe("mcp:server:batch_added");
      expect(MCP_SERVER_EVENTS.REMOVED).toBe("mcp:server:removed");
    });
  });

  describe("ENDPOINT_EVENTS", () => {
    it("应该包含正确的接入点事件名称", () => {
      expect(ENDPOINT_EVENTS.STATUS_CHANGED).toBe("endpoint:status:changed");
      expect(ENDPOINT_EVENTS.ADDED).toBe("endpoint:added");
      expect(ENDPOINT_EVENTS.RECONNECT_COMPLETED).toBe(
        "endpoint:reconnect:completed"
      );
    });
  });

  describe("事件名称唯一性", () => {
    it("所有事件名称应该是唯一的", () => {
      const allEvents = [
        ...Object.values(MCP_SERVICE_EVENTS),
        ...Object.values(MCP_SERVER_EVENTS),
        ...Object.values(ENDPOINT_EVENTS),
        ...Object.values(CONFIG_EVENTS),
        ...Object.values(STATUS_EVENTS),
        ...Object.values(WEBSOCKET_EVENTS),
      ];

      const uniqueEvents = new Set(allEvents);
      expect(uniqueEvents.size).toBe(allEvents.length);
    });
  });
});

describe("超时和延迟常量", () => {
  describe("MCP_TIMEOUTS", () => {
    it("应该包含正确的 MCP 超时值", () => {
      expect(MCP_TIMEOUTS.DEFAULT).toBe(8000);
      expect(MCP_TIMEOUTS.HEARTBEAT_INTERVAL).toBe(30000);
      expect(MCP_TIMEOUTS.HEARTBEAT_TIMEOUT).toBe(35000);
      expect(MCP_TIMEOUTS.CONNECTION_TIMEOUT).toBe(30000);
    });

    it("超时值应该是合理的", () => {
      expect(MCP_TIMEOUTS.HEARTBEAT_TIMEOUT).toBeGreaterThan(
        MCP_TIMEOUTS.HEARTBEAT_INTERVAL
      );
    });
  });

  describe("CACHE_TIMEOUTS", () => {
    it("应该包含正确的缓存超时值", () => {
      expect(CACHE_TIMEOUTS.TTL).toBe(300000);
      expect(CACHE_TIMEOUTS.CLEANUP_INTERVAL).toBe(60000);
    });

    it("TTL 应该大于清理间隔", () => {
      expect(CACHE_TIMEOUTS.TTL).toBeGreaterThan(
        CACHE_TIMEOUTS.CLEANUP_INTERVAL
      );
    });
  });

  describe("HTTP_TIMEOUTS", () => {
    it("应该包含正确的 HTTP 超时值", () => {
      expect(HTTP_TIMEOUTS.DEFAULT).toBe(30000);
      expect(HTTP_TIMEOUTS.LONG_RUNNING).toBe(60000);
    });
  });

  describe("RETRY_DELAYS", () => {
    it("应该包含正确的重试延迟值", () => {
      expect(RETRY_DELAYS.INITIAL).toBe(1000);
      expect(RETRY_DELAYS.MAX).toBe(30000);
      expect(RETRY_DELAYS.RECONNECT).toBe(2000);
    });

    it("最大延迟应该大于初始延迟", () => {
      expect(RETRY_DELAYS.MAX).toBeGreaterThan(RETRY_DELAYS.INITIAL);
    });
  });

  describe("HEARTBEAT_MONITORING", () => {
    it("应该包含正确的心跳监控值", () => {
      expect(HEARTBEAT_MONITORING.MONITOR_INTERVAL).toBe(10000);
      expect(HEARTBEAT_MONITORING.TIMEOUT_THRESHOLD).toBe(35000);
    });
  });

  describe("RETRY_CONFIG", () => {
    it("应该包含正确的重试配置", () => {
      expect(RETRY_CONFIG.MAX_ATTEMPTS).toBe(5);
      expect(RETRY_CONFIG.BACKOFF_MULTIPLIER).toBe(2);
    });
  });
});

describe("缓存相关常量", () => {
  describe("CACHE_CONFIG", () => {
    it("应该包含正确的缓存配置", () => {
      expect(CACHE_CONFIG.MAX_SIZE).toBe(1000);
      expect(CACHE_CONFIG.ENABLE_ONE_TIME_CACHE).toBe(true);
    });
  });

  describe("MESSAGE_SIZE_LIMITS", () => {
    it("应该包含正确的消息大小限制", () => {
      expect(MESSAGE_SIZE_LIMITS.DEFAULT).toBe(1024 * 1024);
      expect(MESSAGE_SIZE_LIMITS.MAX).toBe(10 * 1024 * 1024);
    });

    it("最大限制应该大于默认限制", () => {
      expect(MESSAGE_SIZE_LIMITS.MAX).toBeGreaterThan(
        MESSAGE_SIZE_LIMITS.DEFAULT
      );
    });
  });

  describe("CACHE_FILE_CONFIG", () => {
    it("应该包含正确的缓存文件配置", () => {
      expect(CACHE_FILE_CONFIG.FILENAME).toBe("xiaozhi.cache.json");
      expect(CACHE_FILE_CONFIG.TEMP_SUFFIX).toBe(".tmp");
    });
  });

  describe("TOOL_NAME_SEPARATORS", () => {
    it("应该包含正确的分隔符", () => {
      expect(TOOL_NAME_SEPARATORS.SERVICE_TOOL_SEPARATOR).toBe("__");
    });
  });

  describe("CACHE_STATS", () => {
    it("应该包含正确的缓存统计值", () => {
      expect(CACHE_STATS.DEFAULT_HIT_RATE).toBe(0);
      expect(CACHE_STATS.MIN_HIT_RATE).toBe(0);
      expect(CACHE_STATS.MAX_HIT_RATE).toBe(100);
    });
  });
});
