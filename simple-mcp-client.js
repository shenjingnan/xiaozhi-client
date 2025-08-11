// 简化的 MCP 客户端测试 - 硬编码接入点和2个模拟工具
import WebSocket from "ws";

const ENDPOINT_URL =
  "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg";

const MOCK_TOOLS = [
  {
    name: "calculator_add",
    description: "简单的加法计算器",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "weather_get",
    description: "获取天气信息",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
];

const ws = new WebSocket(ENDPOINT_URL);

ws.on("open", () => console.log("✅ 已连接"));

ws.on("message", (data) => {
  const msg = JSON.parse(data);
  console.log("🔍 收到消息:", msg);

  if (msg.method === "initialize") {
    // 回应服务器初始化
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: "test-server", version: "1.0.0" },
        },
      })
    );
    console.log("🔍 回应服务器初始化");
  } else if (msg.method === "tools/list") {
    // 提供模拟工具
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: { tools: MOCK_TOOLS },
      })
    );
    console.log(
      "🎯 工具已提供:",
      MOCK_TOOLS.map((t) => t.name)
    );
  } else if (msg.method === "ping") {
    // 处理ping消息
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: {},
      })
    );
    console.log("🏓 回应ping消息");
  }
});

ws.on("close", () => console.log("🔚 断开连接"));
