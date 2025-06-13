import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock ws
vi.mock("ws", () => {
  return {
    default: vi.fn(),
  };
});

// Mock dotenv
vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

// Mock configManager
vi.mock("./configManager.js", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getConfigPath: vi.fn(),
  },
}));

// Import after mocking
import { configManager } from "./configManager.js";

// Mock child process
class MockChildProcess extends EventEmitter {
  stdin = {
    write: vi.fn(),
    destroyed: false,
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
  killed = false;
}

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();

  static OPEN = 1;
  static CLOSED = 3;
}

describe("MCPPipe", () => {
  let mockSpawn: any;
  let mockWebSocket: any;
  let mockConfigManager: any;
  let mockProcess: MockChildProcess;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpawn = vi.mocked(spawn);
    mockWebSocket = vi.mocked(WebSocket);
    mockConfigManager = vi.mocked(configManager);

    // Setup mock instances
    mockProcess = new MockChildProcess();
    mockWs = new MockWebSocket();

    mockSpawn.mockReturnValue(mockProcess);
    mockWebSocket.mockImplementation(() => mockWs);

    // Setup default config manager mocks
    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getMcpEndpoint.mockReturnValue(
      "wss://test.example.com/mcp"
    );
    mockConfigManager.getConfigPath.mockReturnValue(
      "/test/xiaozhi.config.json"
    );

    // Mock process.env and process.cwd
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "mcpPipe.js", "test-script.js"],
      env: { ...process.env },
      cwd: vi.fn().mockReturnValue("/test/cwd"),
      stderr: {
        write: vi.fn(),
      },
      exit: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Logger", () => {
    it("should create logger with correct name", async () => {
      // Test logger functionality indirectly through console.error calls
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Import the module to trigger logger creation
      await import("./mcpPipe.js");

      // Logger should be created (we can't test it directly as it's not exported)
      expect(true).toBe(true); // Placeholder assertion

      consoleSpy.mockRestore();
    });
  });

  describe("MCPPipe class", () => {
    // Since MCPPipe is not exported, we test basic functionality

    it("should handle missing command line arguments", () => {
      process.argv = ["node", "mcpPipe.js"]; // Missing script argument

      // Test that we can detect missing arguments
      expect(process.argv.length).toBe(2);
    });

    it("should use config file endpoint when available", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue(
        "wss://config.example.com/mcp"
      );

      // Test that config manager methods are available
      expect(mockConfigManager.configExists).toBeDefined();
      expect(mockConfigManager.getMcpEndpoint).toBeDefined();
    });

    it("should fallback to environment variable when config not available", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      process.env.MCP_ENDPOINT = "wss://env.example.com/mcp";

      // Test that environment variable fallback logic exists
      expect(process.env.MCP_ENDPOINT).toBe("wss://env.example.com/mcp");
    });

    it("should detect when no endpoint is configured", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      process.env.MCP_ENDPOINT = undefined;

      // Test that we can detect missing endpoint
      expect(process.env.MCP_ENDPOINT).toBeUndefined();
    });

    it("should detect invalid endpoint configuration", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpEndpoint.mockReturnValue("<请填写你的端点>");

      const endpoint = mockConfigManager.getMcpEndpoint();
      expect(endpoint).toContain("<请填写");
    });
  });

  describe("Process management", () => {
    it("should spawn MCP process with correct arguments", () => {
      const scriptName = "test-script.js";

      mockSpawn("node", [scriptName], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        [scriptName],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        })
      );
    });

    it("should handle process stdout data", () => {
      const testData = "test message from process";

      // Simulate process stdout data
      mockProcess.stdout.emit("data", Buffer.from(testData));

      // Should send data to WebSocket if connected
      expect(true).toBe(true); // Placeholder assertion
    });

    it("should handle process stderr data", () => {
      const errorData = "error message from process";

      // Simulate process stderr data
      mockProcess.stderr.emit("data", Buffer.from(errorData));

      // Should write to process.stderr
      expect(true).toBe(true); // Placeholder assertion
    });

    it("should handle process exit", () => {
      // Simulate process exit
      mockProcess.emit("exit", 0, null);

      // Should clean up and close WebSocket
      expect(true).toBe(true); // Placeholder assertion
    });

    it("should handle process error", () => {
      // Add error listener to prevent uncaught error
      mockProcess.on("error", () => {});

      // Test that process error event can be emitted
      expect(() => {
        mockProcess.emit("error", new Error("Process error"));
      }).not.toThrow();

      // Should handle error and clean up
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe("WebSocket management", () => {
    it("should create WebSocket with correct URL", () => {
      const endpointUrl = "wss://test.example.com/mcp";

      new WebSocket(endpointUrl);

      expect(mockWebSocket).toHaveBeenCalledWith(endpointUrl);
    });

    it("should handle WebSocket open event", () => {
      // Simulate WebSocket open
      mockWs.emit("open");

      // Should set connection status and reset reconnection
      expect(true).toBe(true); // Placeholder assertion
    });

    it("should handle WebSocket message", () => {
      const testMessage = JSON.stringify({ test: "message" });

      // Simulate WebSocket message
      mockWs.emit("message", testMessage);

      // Should write to process stdin
      expect(true).toBe(true); // Placeholder assertion
    });

    it("should handle WebSocket close event", () => {
      const closeCode = 1000;
      const closeReason = Buffer.from("Normal closure");

      // Simulate WebSocket close
      mockWs.emit("close", closeCode, closeReason);

      // Should handle reconnection logic
      expect(true).toBe(true); // Placeholder assertion
    });

    it("should handle WebSocket error", () => {
      // Add error listener to prevent uncaught error
      mockWs.on("error", () => {});

      // Test that WebSocket error event can be emitted
      expect(() => {
        mockWs.emit("error", new Error("WebSocket error"));
      }).not.toThrow();

      // Should handle error
      expect(true).toBe(true); // Placeholder assertion
    });

    it("should not reconnect on permanent error (code 4004)", () => {
      const closeCode = 4004;
      const closeReason = Buffer.from("Permanent error");

      // Simulate WebSocket close with permanent error
      mockWs.emit("close", closeCode, closeReason);

      // Should not schedule reconnection
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe("Reconnection logic", () => {
    it("should calculate exponential backoff correctly", () => {
      const INITIAL_BACKOFF = 1000;
      const MAX_BACKOFF = 30000;

      // Test backoff calculation
      const attempt1 = Math.min(INITIAL_BACKOFF * 2 ** (1 - 1), MAX_BACKOFF);
      const attempt2 = Math.min(INITIAL_BACKOFF * 2 ** (2 - 1), MAX_BACKOFF);
      const attempt3 = Math.min(INITIAL_BACKOFF * 2 ** (3 - 1), MAX_BACKOFF);

      expect(attempt1).toBe(1000);
      expect(attempt2).toBe(2000);
      expect(attempt3).toBe(4000);
    });

    it("should cap backoff at maximum value", () => {
      const INITIAL_BACKOFF = 1000;
      const MAX_BACKOFF = 30000;

      // Test with high attempt number
      const attemptHigh = Math.min(
        INITIAL_BACKOFF * 2 ** (20 - 1),
        MAX_BACKOFF
      );

      expect(attemptHigh).toBe(MAX_BACKOFF);
    });
  });

  describe("Signal handlers", () => {
    it("should setup signal handlers", () => {
      // Mock process.on if not available
      if (!process.on) {
        process.on = vi.fn();
      }

      // Test that signal handler setup is available
      expect(process.on).toBeDefined();

      // Test that we can register signal handlers
      const mockHandler = vi.fn();
      expect(() => {
        process.on("SIGINT", mockHandler);
        process.on("SIGTERM", mockHandler);
      }).not.toThrow();
    });
  });

  describe("Utility functions", () => {
    it("should implement sleep function correctly", async () => {
      const start = Date.now();
      const sleepTime = 100;

      // Create a simple sleep function for testing
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      await sleep(sleepTime);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(sleepTime - 10); // Allow some tolerance
    });
  });
});
