#!/usr/bin/env node
// 增强版MCP客户端 - 支持心跳保活和自动重连
import WebSocket from "ws";

const ENDPOINT_URL =
  "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg";

const MOCK_TOOLS = [
  {
    name: "calculator_add",
    description: "简单的加法计算器",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "第一个数字" },
        b: { type: "number", description: "第二个数字" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "weather_get",
    description: "获取天气信息",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名称" },
      },
      required: ["city"],
    },
  },
];

class EnhancedMCPClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      reconnectInterval: 3000, // 重连间隔3秒
      heartbeatInterval: 30000, // 心跳间隔30秒
      maxReconnectAttempts: 10, // 最大重连次数
      ...options,
    };

    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.messageId = 0;
    this.serverInitialized = false;
    this.availableTools = [MOCK_TOOLS[0]]; // 初始只提供第一个工具
    this.toolsLoaded = false; // 标记是否已加载所有工具
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`🔄 ${new Date().toISOString()} 正在连接...`);

      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`✅ ${new Date().toISOString()} WebSocket连接已建立`);
        this.startHeartbeat();

        // 30秒后添加第二个工具
        setTimeout(() => {
          this.addSecondTool();
        }, 30000);

        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (error) {
          console.error(`❌ ${new Date().toISOString()} 消息解析错误:`, error);
        }
      });

      this.ws.on("close", (code, reason) => {
        this.isConnected = false;
        this.serverInitialized = false;
        this.stopHeartbeat();
        console.log(
          `🔚 ${new Date().toISOString()} 连接已关闭 (代码: ${code}, 原因: ${reason})`
        );

        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.log(
            `⚠️ ${new Date().toISOString()} 已达到最大重连次数，停止重连`
          );
        }
      });

      this.ws.on("error", (error) => {
        console.error(
          `❌ ${new Date().toISOString()} WebSocket错误:`,
          error.message
        );
      });

      this.ws.on("pong", () => {
        console.log(`🏓 ${new Date().toISOString()} 收到pong响应`);
      });
    });
  }

  handleMessage(message) {
    console.log(
      `📨 ${new Date().toISOString()} 收到消息:`,
      JSON.stringify(message, null, 2)
    );

    if (message.method) {
      this.handleServerRequest(message);
    }
  }

  handleServerRequest(request) {
    switch (request.method) {
      case "initialize":
        this.sendResponse(request.id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true },
            logging: {},
          },
          serverInfo: {
            name: "xiaozhi-mcp-enhanced-server",
            version: "1.0.0",
          },
        });
        this.serverInitialized = true;
        console.log(`🔍 ${new Date().toISOString()} 服务器初始化完成`);
        break;

      case "tools/list":
        this.sendResponse(request.id, { tools: this.availableTools });
        console.log(
          `🎯 ${new Date().toISOString()} 工具列表已发送 (${
            this.availableTools.length
          }个工具)`
        );
        break;

      case "ping":
        this.sendResponse(request.id, {});
        console.log(`🏓 ${new Date().toISOString()} 回应ping消息`);
        break;

      default:
        console.log(
          `⚠️ ${new Date().toISOString()} 未知请求: ${request.method}`
        );
    }
  }

  sendResponse(id, result) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      const response = {
        jsonrpc: "2.0",
        id,
        result,
      };
      this.ws.send(JSON.stringify(response));
    }
  }

  sendMessage(message) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        // 发送ping消息
        this.sendMessage({
          jsonrpc: "2.0",
          id: ++this.messageId,
          method: "ping",
          params: {},
        });

        // 或者使用WebSocket原生ping
        this.ws.ping();
        console.log(`💓 ${new Date().toISOString()} 发送心跳`);
      }
    }, this.options.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    this.stopReconnect();

    this.reconnectAttempts++;
    console.log(
      `🔄 ${new Date().toISOString()} ${this.reconnectAttempts}秒后重连...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(console.error);
    }, this.options.reconnectInterval);
  }

  stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect() {
    console.log(`👋 ${new Date().toISOString()} 主动断开连接`);
    this.stopHeartbeat();
    this.stopReconnect();

    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      initialized: this.serverInitialized,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url,
      availableTools: this.availableTools.length,
      allToolsLoaded: this.toolsLoaded,
    };
  }

  addSecondTool() {
    if (this.toolsLoaded) {
      console.log(
        `ℹ️ ${new Date().toISOString()} 所有工具已加载，无需再次添加`
      );
      return;
    }

    if (MOCK_TOOLS.length > 1) {
      this.availableTools.push(MOCK_TOOLS[1]);
      this.toolsLoaded = true;

      console.log(
        `➕ ${new Date().toISOString()} 已动态添加第二个工具: ${
          MOCK_TOOLS[1].name
        }`
      );
      console.log(
        `📋 ${new Date().toISOString()} 当前可用工具: ${this.availableTools
          .map((t) => t.name)
          .join(", ")}`
      );

      // 通知客户端工具列表已更新
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          jsonrpc: "2.0",
          method: "notifications/tools/list_changed",
          params: {},
        });
        console.log(`📢 ${new Date().toISOString()} 已发送工具列表变更通知`);
      }
    } else {
      console.log(`⚠️ ${new Date().toISOString()} MOCK_TOOLS 中没有足够的工具`);
    }
  }
}

// 主程序
async function main() {
  console.log("🚀 增强版MCP客户端启动");
  console.log("接入点:", ENDPOINT_URL);
  console.log("总模拟工具:", MOCK_TOOLS.map((t) => t.name).join(", "));
  console.log("初始可用工具:", [MOCK_TOOLS[0]].map((t) => t.name).join(", "));
  console.log("30秒后将动态添加第二个工具:", MOCK_TOOLS[1]?.name || "无");
  console.log("=".repeat(60));

  const client = new EnhancedMCPClient(ENDPOINT_URL);

  // 处理进程退出
  process.on("SIGINT", () => {
    console.log("\n👋 收到退出信号，正在关闭连接...");
    client.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n👋 收到终止信号，正在关闭连接...");
    client.disconnect();
    process.exit(0);
  });

  try {
    await client.connect();

    // 每10秒显示一次状态
    const statusInterval = setInterval(() => {
      const status = client.getStatus();
      console.log(`📊 ${new Date().toISOString()} 状态:`, status);
    }, 10000);

    // 测试工具调用
    setTimeout(() => {
      if (client.getStatus().connected) {
        console.log("🔧 测试工具调用...");
        // 这里可以添加实际的工具调用测试
      }
    }, 5000);
  } catch (error) {
    console.error("❌ 连接失败:", error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default EnhancedMCPClient;
