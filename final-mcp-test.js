// 完整的MCP客户端测试 - 支持ping、初始化、工具列表等
import WebSocket from "ws";

const ENDPOINT_URL =
  "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg";

// 模拟的MCP工具定义
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

console.log("🎯 MCP客户端连接测试开始");
console.log("接入点:", ENDPOINT_URL);
console.log("模拟工具:", MOCK_TOOLS.map((t) => t.name).join(", "));
console.log("=".repeat(50));

const ws = new WebSocket(ENDPOINT_URL);
let messageCount = 0;
let toolsSent = false;

ws.on("open", () => {
  console.log("✅ WebSocket连接已建立");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data);
  messageCount++;
  console.log(`📨 [消息${messageCount}]`, msg);

  if (msg.method === "initialize") {
    // 回应服务器初始化
    const response = {
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: true },
          logging: {},
        },
        serverInfo: {
          name: "xiaozhi-mcp-test-server",
          version: "1.0.0",
        },
      },
    };
    ws.send(JSON.stringify(response));
    console.log("🔍 回应服务器初始化");
  } else if (msg.method === "tools/list") {
    // 提供模拟工具
    const response = {
      jsonrpc: "2.0",
      id: msg.id,
      result: { tools: MOCK_TOOLS },
    };
    ws.send(JSON.stringify(response));
    console.log(
      "🎯 工具已提供:",
      MOCK_TOOLS.map((t) => t.name)
    );
    toolsSent = true;
  } else if (msg.method === "ping") {
    // 处理ping消息
    const response = {
      jsonrpc: "2.0",
      id: msg.id,
      result: {},
    };
    ws.send(JSON.stringify(response));
    console.log("🏓 回应ping消息");
  } else if (msg.method === "tools/call") {
    // 处理工具调用
    const { name, arguments: args } = msg.params;
    let result = null;

    switch (name) {
      case "calculator_add":
        result = {
          content: [
            {
              type: "text",
              text: `${args.a} + ${args.b} = ${args.a + args.b}`,
            },
          ],
        };
        break;
      case "weather_get":
        result = {
          content: [
            {
              type: "text",
              text: `${args.city}天气：晴天，25°C，微风`,
            },
          ],
        };
        break;
      default:
        result = {
          content: [
            {
              type: "text",
              text: `未知工具: ${name}`,
            },
          ],
        };
    }

    const response = {
      jsonrpc: "2.0",
      id: msg.id,
      result,
    };
    ws.send(JSON.stringify(response));
    console.log(`🔧 工具 ${name} 已响应`);
  }
});

ws.on("close", () => {
  console.log("🔚 连接已关闭");
  console.log("📊 测试总结:");
  console.log(`- 收到 ${messageCount} 条消息`);
  console.log(`- 工具列表 ${toolsSent ? "已" : "未"}发送`);
  console.log("✅ 测试完成");
});

ws.on("error", (error) => {
  console.error("❌ 连接错误:", error);
});
