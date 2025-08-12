#!/usr/bin/env node
// 测试连接稳定性 - 专门测试心跳保活和重连功能
const WebSocket = require("ws");

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

class ConnectionTest {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.connectionStart = null;
    this.messageCount = 0;
    this.pingCount = 0;
    this.reconnectCount = 0;
  }

  async testConnection() {
    console.log("🔬 开始连接稳定性测试");
    console.log("测试接入点:", this.url);
    console.log("测试目标:", MOCK_TOOLS.map((t) => t.name).join(", "));
    console.log("预计运行时间: 1分钟 (可提前按Ctrl+C结束)");
    console.log("=".repeat(60));

    await this.connect();

    // 设置1分钟后自动结束测试
    setTimeout(() => {
      this.printSummary();
      process.exit(0);
    }, 60000);

    // 每5秒打印状态
    setInterval(() => {
      this.printStatus();
    }, 5000);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`🔄 ${new Date().toISOString()} 建立连接...`);

      this.ws = new WebSocket(this.url);
      this.connectionStart = new Date();

      this.ws.on("open", () => {
        this.isConnected = true;
        console.log(`✅ ${new Date().toISOString()} 连接已建立`);
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data);
          this.messageCount++;
          this.handleMessage(message);
        } catch (error) {
          console.error("❌ 消息解析错误:", error);
        }
      });

      this.ws.on("close", (code, reason) => {
        this.isConnected = false;
        console.log(
          `🔚 ${new Date().toISOString()} 连接关闭 (代码: ${code}, 原因: ${reason})`
        );
        this.reconnectCount++;

        // 模拟自动重连
        setTimeout(() => {
          console.log(`🔄 ${new Date().toISOString()} 尝试重新连接...`);
          this.connect();
        }, 3000);
      });

      this.ws.on("error", (error) => {
        console.error(
          `❌ ${new Date().toISOString()} 连接错误:`,
          error.message
        );
      });

      this.ws.on("pong", () => {
        console.log(`🏓 ${new Date().toISOString()} 收到PONG响应`);
      });
    });
  }

  handleMessage(message) {
    console.log(
      `📨 ${new Date().toISOString()} 收到:`,
      message.method || "响应"
    );

    if (message.method === "initialize") {
      this.sendResponse(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: true },
          logging: {},
        },
        serverInfo: {
          name: "test-connection-stability",
          version: "1.0.0",
        },
      });
    } else if (message.method === "tools/list") {
      this.sendResponse(message.id, { tools: MOCK_TOOLS });
      console.log(`🎯 ${new Date().toISOString()} 工具列表已提供`);
    } else if (message.method === "ping") {
      this.sendResponse(message.id, {});
      this.pingCount++;
      console.log(
        `🏓 ${new Date().toISOString()} 回应第${this.pingCount}次ping`
      );
    }
  }

  sendResponse(id, result) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const response = {
        jsonrpc: "2.0",
        id,
        result,
      };
      this.ws.send(JSON.stringify(response));
    }
  }

  printStatus() {
    const uptime = this.connectionStart
      ? Math.floor((new Date() - this.connectionStart) / 1000)
      : 0;

    console.log(`📊 ${new Date().toISOString()} 状态:`);
    console.log(`  - 连接状态: ${this.isConnected ? "✅ 在线" : "❌ 离线"}`);
    console.log(`  - 运行时间: ${uptime}秒`);
    console.log(`  - 收到消息: ${this.messageCount}条`);
    console.log(`  - 回应ping: ${this.pingCount}次`);
    console.log(`  - 重连次数: ${this.reconnectCount}次`);
    console.log("-".repeat(40));
  }

  printSummary() {
    const totalTime = this.connectionStart
      ? Math.floor((new Date() - this.connectionStart) / 1000)
      : 0;

    console.log("\n🎯 测试完成总结:");
    console.log(`⏱️  总运行时间: ${totalTime}秒`);
    console.log(`💬 总消息数: ${this.messageCount}条`);
    console.log(`🏓 ping响应: ${this.pingCount}次`);
    console.log(`🔄 重连次数: ${this.reconnectCount}次`);
    console.log(`✅ 测试状态: ${this.isConnected ? "保持连接" : "已断开"}`);

    if (this.reconnectCount > 0) {
      console.log("⚠️  检测到连接断开，但已重新连接");
    } else {
      console.log("🎉 连接稳定，未检测到断开");
    }
  }
}

// 主程序
async function main() {
  const test = new ConnectionTest(ENDPOINT_URL);

  // 处理Ctrl+C
  process.on("SIGINT", () => {
    console.log("\n👋 手动结束测试");
    test.printSummary();
    process.exit(0);
  });

  await test.testConnection();
}

if (require.main === module) {
  main();
}

module.exports = ConnectionTest;
